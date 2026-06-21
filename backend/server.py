from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
