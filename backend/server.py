from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import base64
import html as html_lib
from io import BytesIO
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
import requests
from datetime import datetime, timezone
from xhtml2pdf import pisa

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

BREVO_API_KEY = os.environ.get('BREVO_API_KEY', '')
BREVO_SENDER_EMAIL = os.environ.get('BREVO_SENDER_EMAIL', '')
BREVO_SENDER_NAME = os.environ.get('BREVO_SENDER_NAME', 'SPHR Nightly Security')
# Comma-separated list of report recipients. Everyone here receives the nightly report.
DM_RECIPIENT_EMAIL = os.environ.get(
    'DM_RECIPIENT_EMAIL',
    'dm@sphr.com.au,supervisor@sphr.com.au,gm@sphr.com.au,ops@sphr.com.au',
)
DM_RECIPIENTS = [e.strip() for e in DM_RECIPIENT_EMAIL.split(',') if e.strip()]

DOOR_CHECK_AREAS = [
    "GM Office", "Back Door", "Glass Doors x2", "Kitchen Door", "Hallway Gate",
    "Staff Room", "LDNG Dock Gate", "Pool Gates x8", "Pool Bar door",
    "Pool Bar Shutters", "Keg Room", "Rear Shed rollers", "Rear Shed",
    "Shed Gates x2", "Pool Room 1", "Pool Room 2", "Kids room", "Arcade room",
]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---- Models ----
class Manager(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    mobile: str
    created_at: str = Field(default_factory=now_iso)


class ManagerCreate(BaseModel):
    name: str
    mobile: str


class PatrolEntry(BaseModel):
    id: str
    location: str
    action: str
    timestamp: str
    time_label: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photo: Optional[str] = None


class Report(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    security_number: str
    guard_name: str
    shift_date: str
    manager_name: Optional[str] = None
    manager_mobile: Optional[str] = None
    entries: List[PatrolEntry] = []
    door_checks: Dict[str, bool] = {}
    submitted: bool = False
    created_at: str = Field(default_factory=now_iso)
    synced_at: str = Field(default_factory=now_iso)


class ReportCreate(BaseModel):
    id: Optional[str] = None
    security_number: str
    guard_name: str
    shift_date: str
    manager_name: Optional[str] = None
    manager_mobile: Optional[str] = None
    entries: List[PatrolEntry] = []
    door_checks: Dict[str, bool] = {}
    submitted: bool = False


@api_router.get("/")
async def root():
    return {"message": "SPHR Security Log API", "status": "ok"}


@api_router.get("/managers", response_model=List[Manager])
async def get_managers():
    docs = await db.managers.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return [Manager(**d) for d in docs]


@api_router.post("/managers", response_model=Manager)
async def create_manager(payload: ManagerCreate):
    mgr = Manager(**payload.dict())
    await db.managers.insert_one(mgr.dict())
    return mgr


@api_router.put("/managers/{manager_id}", response_model=Manager)
async def update_manager(manager_id: str, payload: ManagerCreate):
    existing = await db.managers.find_one({"id": manager_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Manager not found")
    await db.managers.update_one(
        {"id": manager_id},
        {"$set": {"name": payload.name, "mobile": payload.mobile}},
    )
    doc = await db.managers.find_one({"id": manager_id}, {"_id": 0})
    return Manager(**doc)


@api_router.delete("/managers/{manager_id}")
async def delete_manager(manager_id: str):
    res = await db.managers.delete_one({"id": manager_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Manager not found")
    return {"deleted": manager_id}


@api_router.post("/reports", response_model=Report)
async def upsert_report(payload: ReportCreate):
    data = payload.dict()
    rid = data.get("id") or str(uuid.uuid4())
    data["id"] = rid
    existing = await db.reports.find_one({"id": rid})
    if existing:
        data["created_at"] = existing.get("created_at", now_iso())
        data["synced_at"] = now_iso()
        report = Report(**data)
        await db.reports.replace_one({"id": rid}, report.dict())
    else:
        report = Report(**data)
        await db.reports.insert_one(report.dict())
    return report


@api_router.get("/reports", response_model=List[Report])
async def list_reports():
    docs = await db.reports.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Report(**d) for d in docs]


@api_router.get("/reports/{report_id}", response_model=Report)
async def get_report(report_id: str):
    doc = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return Report(**doc)


# ---------- Email report (Brevo) ----------
def _esc(s):
    return html_lib.escape(s or "")


def build_report_html(r: "Report") -> str:
    rows = ""
    for i, e in enumerate(r.entries):
        gps = "&mdash;"
        if e.latitude is not None and e.longitude is not None:
            gps = f"{e.latitude:.5f}, {e.longitude:.5f}"
        photo_html = ""
        if e.photo:
            photo_html = (
                f'<br/><img src="{e.photo}" style="max-width:150px;margin-top:6px;" />'
            )
        rows += (
            "<tr>"
            f'<td style="border-bottom:1px solid #e0e0e0;padding:8px;">{i + 1}</td>'
            f'<td style="border-bottom:1px solid #e0e0e0;padding:8px;"><b>{_esc(e.location)}</b></td>'
            f'<td style="border-bottom:1px solid #e0e0e0;padding:8px;">{_esc(e.action)}{photo_html}</td>'
            f'<td style="border-bottom:1px solid #e0e0e0;padding:8px;">{_esc(e.time_label or "")}</td>'
            f'<td style="border-bottom:1px solid #e0e0e0;padding:8px;">{gps}</td>'
            "</tr>"
        )
    if not rows:
        rows = '<tr><td colspan="5" style="padding:8px;">No patrol entries recorded.</td></tr>'

    generated = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")

    checks = r.door_checks or {}
    done_count = sum(1 for a in DOOR_CHECK_AREAS if checks.get(a))
    check_rows = ""
    for area in DOOR_CHECK_AREAS:
        if checks.get(area):
            mark = '<span style="color:#1a9c4e;font-weight:bold;">&#10004; Checked</span>'
        else:
            mark = '<span style="color:#b00020;">&#9744; Not checked</span>'
        check_rows += (
            "<tr>"
            f'<td style="border-bottom:1px solid #e0e0e0;padding:6px 8px;">{_esc(area)}</td>'
            f'<td style="border-bottom:1px solid #e0e0e0;padding:6px 8px;">{mark}</td>'
            "</tr>"
        )
    door_html = f"""
  <h2 style="margin-top:28px;border-bottom:2px solid #101112;padding-bottom:4px;">
    Final Door Checks <span style="color:#D88D16;">({done_count}/{len(DOOR_CHECK_AREAS)})</span>
  </h2>
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <tbody>{check_rows}</tbody>
  </table>"""

    return f"""<html><head><meta charset="utf-8"/></head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#101112;">
  <h1 style="margin:0 0 4px;">SPHR <span style="color:#D88D16;">Night Patrol Report</span></h1>
  <table style="width:100%;background:#f5f5f5;border-radius:8px;margin:16px 0;">
    <tr><td style="padding:12px 16px;font-size:13px;line-height:1.6;">
      <b>Security Number:</b> {_esc(r.security_number)}<br/>
      <b>Guard Name:</b> {_esc(r.guard_name)}<br/>
      <b>Shift Date:</b> {_esc(r.shift_date)}<br/>
      <b>Manager on Diversion:</b> {_esc(r.manager_name or "—")} {("(" + _esc(r.manager_mobile) + ")") if r.manager_mobile else ""}<br/>
      <b>Total Patrol Entries:</b> {len(r.entries)}
    </td></tr>
  </table>
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr style="background:#101112;color:#ffffff;text-align:left;">
      <th style="padding:8px;">#</th><th style="padding:8px;">Location</th>
      <th style="padding:8px;">Action Taken</th><th style="padding:8px;">Time</th>
      <th style="padding:8px;">GPS</th>
    </tr></thead>
    <tbody>{rows}</tbody>
  </table>
  {door_html}
  <p style="margin-top:24px;font-size:11px;color:#888;">
    Generated by SPHR Security Log App &middot; {generated}
  </p>
</body></html>"""


def make_pdf_base64(html_str: str) -> Optional[str]:
    try:
        buf = BytesIO()
        result = pisa.CreatePDF(src=html_str, dest=buf)
        if result.err:
            return None
        return base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception as ex:
        logger.warning(f"PDF generation failed: {ex}")
        return None


def send_via_brevo(subject: str, html_body: str, pdf_b64: Optional[str]) -> requests.Response:
    payload = {
        "sender": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
        "to": [{"email": e} for e in DM_RECIPIENTS],
        "subject": subject,
        "htmlContent": html_body,
    }
    if pdf_b64:
        payload["attachment"] = [
            {"content": pdf_b64, "name": "SPHR_Nightly_Report.pdf"}
        ]
    return requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
            "accept": "application/json",
        },
        json=payload,
        timeout=30,
    )


@api_router.post("/reports/send")
async def send_report(payload: ReportCreate):
    if not BREVO_API_KEY:
        raise HTTPException(status_code=503, detail="Email service not configured")

    # Persist the report too (so management has a record).
    data = payload.dict()
    rid = data.get("id") or str(uuid.uuid4())
    data["id"] = rid
    data["submitted"] = True
    existing = await db.reports.find_one({"id": rid})
    if existing:
        data["created_at"] = existing.get("created_at", now_iso())
        data["synced_at"] = now_iso()
        report = Report(**data)
        await db.reports.replace_one({"id": rid}, report.dict())
    else:
        report = Report(**data)
        await db.reports.insert_one(report.dict())

    html_body = build_report_html(report)
    pdf_b64 = make_pdf_base64(html_body)
    subject = "SPHR Nightly security report"

    try:
        resp = send_via_brevo(subject, html_body, pdf_b64)
    except Exception as ex:
        logger.error(f"Brevo request error: {ex}")
        raise HTTPException(status_code=502, detail="Could not reach email service")

    if resp.status_code in (200, 201, 202):
        # Photos have now been delivered to management (inline in the email +
        # in the attached PDF). Purge the base64 photo data from the stored
        # report so the database stays small — the email is the photo archive.
        # The record (locations, actions, GPS, times, door checks) is kept.
        purged = await db.reports.update_one(
            {"id": rid},
            {"$set": {"entries.$[].photo": None, "photos_purged": True}},
        )
        return {
            "sent": True,
            "recipients": DM_RECIPIENTS,
            "pdf_attached": pdf_b64 is not None,
            "photos_purged": purged.modified_count > 0,
            "message": f"Report emailed to management ({len(DM_RECIPIENTS)} recipients).",
        }

    logger.error(f"Brevo send failed {resp.status_code}: {resp.text[:400]}")
    raise HTTPException(
        status_code=502,
        detail=f"Email provider rejected the send ({resp.status_code}). Check sender verification.",
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
