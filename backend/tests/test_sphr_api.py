"""SPHR Security Log API tests"""
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'https://night-patrol-log.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Managers ---
class TestManagers:
    def test_get_managers_seeded(self, client):
        r = client.get(f"{BASE_URL}/api/managers", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        names = [m["name"] for m in data]
        # Seeded managers per current build
        for expected in ["Zachary", "Brett", "Clarke", "Margi", "Mel"]:
            assert expected in names, f"Missing seeded manager: {expected}"
        for m in data:
            assert "id" in m and "mobile" in m
            assert "_id" not in m

    def test_create_and_delete_manager(self, client):
        payload = {"name": f"TEST_Mgr_{uuid.uuid4().hex[:6]}", "mobile": "0499 999 999"}
        r = client.post(f"{BASE_URL}/api/managers", json=payload, timeout=20)
        assert r.status_code == 200
        created = r.json()
        assert created["name"] == payload["name"]
        assert created["mobile"] == payload["mobile"]
        mid = created["id"]
        # verify persisted
        r2 = client.get(f"{BASE_URL}/api/managers", timeout=20)
        assert mid in [m["id"] for m in r2.json()]
        # delete
        d = client.delete(f"{BASE_URL}/api/managers/{mid}", timeout=20)
        assert d.status_code == 200
        # verify gone
        r3 = client.get(f"{BASE_URL}/api/managers", timeout=20)
        assert mid not in [m["id"] for m in r3.json()]

    def test_delete_unknown_manager_404(self, client):
        r = client.delete(f"{BASE_URL}/api/managers/{uuid.uuid4()}", timeout=20)
        assert r.status_code == 404


# --- Reports ---
class TestReports:
    def test_upsert_report_create_then_update(self, client):
        rid = str(uuid.uuid4())
        entry = {
            "id": str(uuid.uuid4()),
            "location": "Main Gate",
            "action": "Perimeter check OK",
            "timestamp": "2026-01-01T22:00:00Z",
            "time_label": "22:00",
            "latitude": -28.0167,
            "longitude": 153.4000,
            "photo": None,
        }
        payload = {
            "id": rid,
            "security_number": "TEST_SG-204",
            "guard_name": "TEST_John Smith",
            "shift_date": "01/01/2026",
            "manager_name": "Duty Manager",
            "manager_mobile": "0400 000 000",
            "entries": [entry],
            "submitted": False,
        }
        r = client.post(f"{BASE_URL}/api/reports", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        rep = r.json()
        assert rep["id"] == rid
        assert len(rep["entries"]) == 1
        assert rep["entries"][0]["location"] == "Main Gate"
        assert rep["entries"][0]["latitude"] == -28.0167

        # update: add another entry, mark submitted
        entry2 = {**entry, "id": str(uuid.uuid4()), "location": "Pool Area", "action": "All clear"}
        payload["entries"].append(entry2)
        payload["submitted"] = True
        r2 = client.post(f"{BASE_URL}/api/reports", json=payload, timeout=20)
        assert r2.status_code == 200
        rep2 = r2.json()
        assert rep2["id"] == rid
        assert len(rep2["entries"]) == 2
        assert rep2["submitted"] is True

        # GET single
        g = client.get(f"{BASE_URL}/api/reports/{rid}", timeout=20)
        assert g.status_code == 200
        got = g.json()
        assert got["id"] == rid
        assert got["submitted"] is True
        assert "_id" not in got

        # list contains it
        ls = client.get(f"{BASE_URL}/api/reports", timeout=20)
        assert ls.status_code == 200
        assert rid in [x["id"] for x in ls.json()]

    def test_get_report_unknown_404(self, client):
        r = client.get(f"{BASE_URL}/api/reports/{uuid.uuid4()}", timeout=20)
        assert r.status_code == 404

    def test_send_report_brevo_email(self, client):
        """Brevo is activated — send ONE real email and assert {sent:true, pdf_attached:true}.

        Limited to a single call per testing run to avoid spamming dm@sphr.com.au.
        """
        rid = str(uuid.uuid4())
        entry = {
            "id": str(uuid.uuid4()),
            "location": "Main Gate",
            "action": "Automated regression test — please ignore",
            "timestamp": "2026-01-01T22:00:00Z",
            "time_label": "22:00",
            "latitude": -28.0167,
            "longitude": 153.4000,
            "photo": None,
        }
        door_checks = {a: True for a in [
            "GM Office", "Back Door", "Glass Doors x2", "Kitchen Door", "Hallway Gate",
            "Staff Room", "LDNG Dock Gate", "Pool Gates x8", "Pool Bar door",
            "Pool Bar Shutters", "Keg Room", "Rear Shed rollers", "Rear Shed",
            "Shed Gates x2", "Pool Room 1", "Pool Room 2", "Kids room", "Arcade room",
        ]}
        payload = {
            "id": rid,
            "security_number": "TEST_SG-204",
            "guard_name": "TEST_Automated Regression",
            "shift_date": "01/01/2026",
            "manager_name": "Zachary",
            "manager_mobile": "0400 000 000",
            "entries": [entry],
            "door_checks": door_checks,
            "submitted": True,
        }
        r = client.post(f"{BASE_URL}/api/reports/send", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("sent") is True
        assert body.get("pdf_attached") is True
        assert body.get("recipient") == "dm@sphr.com.au"
        # Verify the report was also persisted with submitted=True
        g = client.get(f"{BASE_URL}/api/reports/{rid}", timeout=20)
        assert g.status_code == 200
        assert g.json()["submitted"] is True

    def test_report_with_door_checks_persists(self, client):
        """Door checks dict should round-trip via POST and GET."""
        rid = str(uuid.uuid4())
        door_checks = {
            "GM Office": True,
            "Back Door": True,
            "Glass Doors x2": False,
            "Kitchen Door": True,
        }
        payload = {
            "id": rid,
            "security_number": "TEST_SG-204",
            "guard_name": "TEST_John Smith",
            "shift_date": "01/01/2026",
            "manager_name": "Zachary",
            "manager_mobile": "0400 000 000",
            "entries": [],
            "door_checks": door_checks,
            "submitted": False,
        }
        r = client.post(f"{BASE_URL}/api/reports", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        rep = r.json()
        assert rep["door_checks"]["GM Office"] is True
        assert rep["door_checks"]["Glass Doors x2"] is False
        g = client.get(f"{BASE_URL}/api/reports/{rid}", timeout=20)
        assert g.status_code == 200
        assert g.json()["door_checks"]["Kitchen Door"] is True

    def test_report_with_base64_photo_persists(self, client):
        """PRIMARY BUG retest: report with a base64 photo data URI must save and round-trip."""
        # Tiny 1x1 px JPEG base64 (compressed style payload like the app sends).
        photo_b64 = (
            "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJ"
            "ChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYa"
            "KCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIA"
            "AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAA"
            "AAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgD//Z"
        )
        rid = str(uuid.uuid4())
        entry = {
            "id": str(uuid.uuid4()),
            "location": "Villa 8",
            "action": "Photo evidence captured",
            "timestamp": "2026-01-01T22:30:00Z",
            "time_label": "22:30",
            "latitude": None,
            "longitude": None,
            "photo": photo_b64,
        }
        payload = {
            "id": rid,
            "security_number": "TEST_SG-204",
            "guard_name": "TEST_John Smith",
            "shift_date": "01/01/2026",
            "manager_name": "Zachary",
            "manager_mobile": "0400 000 000",
            "entries": [entry],
            "submitted": False,
        }
        r = client.post(f"{BASE_URL}/api/reports", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        rep = r.json()
        assert rep["entries"][0]["photo"] == photo_b64
        # round-trip via GET
        g = client.get(f"{BASE_URL}/api/reports/{rid}", timeout=20)
        assert g.status_code == 200
        assert g.json()["entries"][0]["photo"] == photo_b64
