# SPHR Security Log

A mobile-first night patrol & incident reporting app for resort / holiday park security guards.
Guards log patrol entries (location, action, auto timestamp, GPS, photo, voice-to-text),
complete a Final Door Checks checklist, and submit a nightly report (formatted email + PDF)
to management. Installable as a PWA ("Add to Home Screen") — no app store required.

**Stack:** Expo (React Native, web/PWA) frontend · FastAPI backend · MongoDB · Brevo email.

---

## 1. Prerequisites

- **Node.js** 18+ and **Yarn**
- **Python** 3.11+
- **MongoDB** (local, or a cloud instance like MongoDB Atlas)
- A **Brevo** account + API key (for sending the nightly email). Sender address must be verified in Brevo.

---

## 2. Environment Variables

### Backend — `backend/.env`
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="sphr_security"
BREVO_API_KEY="xkeysib-...your key..."
BREVO_SENDER_EMAIL="nightlysecurityinfo@gmail.com"
BREVO_SENDER_NAME="SPHR Nightly Security"
DM_RECIPIENT_EMAIL="dm@sphr.com.au"
```

### Frontend — `frontend/.env`
```
EXPO_PUBLIC_BACKEND_URL="https://your-server-domain.com"
```
> `EXPO_PUBLIC_BACKEND_URL` is the **public base URL of your server**. The app calls the API at
> `${EXPO_PUBLIC_BACKEND_URL}/api/...`, so your server must route `/api/*` to the FastAPI backend
> and serve the web app at the root.

---

## 3. Run the Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start the API (must bind 0.0.0.0:8001; all routes are under /api)
uvicorn server:app --host 0.0.0.0 --port 8001
```

On startup the API connects to `MONGO_URL`. No manual DB seeding is required — managers are
created via the app. Health check: `GET /api/` should return `{"status":"ok"}`.

**Key endpoints**
- `GET/POST/DELETE /api/managers`
- `POST /api/reports` (upsert), `GET /api/reports`, `GET /api/reports/{id}`
- `POST /api/reports/send` — generates the PDF + HTML email and sends via Brevo to `DM_RECIPIENT_EMAIL`

---

## 4. Run / Build the Frontend (Expo PWA)

```bash
cd frontend
yarn install
```

### Local development
```bash
yarn expo start --port 3000
```

### Production web build (the installable PWA)
```bash
npx expo export --platform web --output-dir dist
```
This produces a static site in `frontend/dist/` (includes `manifest.json`, icons, and the
service worker from `frontend/public/`). Serve the contents of `dist/` as static files at your
site root.

---

## 5. Putting it together on one server

Your reverse proxy (Nginx, Caddy, etc.) should:
- Route `/api/*`  → FastAPI backend on `127.0.0.1:8001`
- Route everything else → the static `frontend/dist/` (the PWA), with SPA fallback to `index.html`

Example Nginx location blocks:
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location / {
    root /var/www/sphr/dist;
    try_files $uri $uri/ /index.html;
}
```
Serve over **HTTPS** — required for PWA install and GPS/camera permissions.

---

## 6. Notes

- **Secrets are not committed** — set them in `backend/.env` and `frontend/.env` on the server.
- **Email sender** must be verified in Brevo. For best deliverability, authenticate your domain
  in Brevo and use a sender like `nightlysecurityinfo@yourdomain.com`.
- **Photos** are compressed on-device before upload (kept small for storage + email).
- **Offline-first:** the app saves the active shift locally and syncs to the backend when online.
- **Voice-to-text** uses the device speech engine — works in installed/native builds (not plain
  desktop browsers).

---

## 7. Project Structure

```
app/
├── backend/
│   ├── server.py          # FastAPI app (managers, reports, /reports/send email+PDF)
│   ├── requirements.txt
│   └── .env               # backend secrets (create on server)
└── frontend/
    ├── app/               # expo-router screens (index, dashboard, log-entry, door-checks, summary, share)
    ├── src/lib/           # store, api, report, voice, theme, doorChecks, pwa-head
    ├── src/components/    # ui, InstallBanner
    ├── public/            # manifest.json, icons/, sw.js (PWA)
    ├── package.json
    └── .env               # EXPO_PUBLIC_BACKEND_URL (create on server)
```
