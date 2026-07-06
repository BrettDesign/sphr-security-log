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

---

## 8. Free hosting — deploy on Oracle Cloud "Always Free" (with automatic HTTPS)

This runs the **whole app** (PWA + backend + MongoDB) on a **permanently free** Oracle
Cloud VM, with a free auto-renewing HTTPS certificate via Caddy. No monthly bill, no
credits. (Any small VPS such as Hetzner works with the exact same steps from step 4.)

**You will need:** a free Oracle Cloud account and a domain name. If you don't own a
domain, get a **free** subdomain at https://www.duckdns.org (e.g. `sphr.duckdns.org`).
HTTPS is mandatory — PWA install, GPS and camera only work over `https://`.

### Step 1 — Create the free server
1. Sign up at https://www.oracle.com/cloud/free/ (a card is required for identity
   verification only; "Always Free" resources are never charged).
2. Create a **Compute instance**: choose an **Ampere (ARM)** shape, image **Ubuntu 22.04**.
3. Save the SSH key it gives you, and note the instance's **public IP address**.
4. Open the firewall for web traffic:
   - In Oracle: VCN → your subnet's **Security List** → add **Ingress** rules allowing
     TCP **80** and **443** from `0.0.0.0/0`.
   - On the server (after login): `sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT`
     and the same for `443` (or `sudo ufw allow 80,443/tcp`).

### Step 2 — Point your domain at the server
- Add a DNS **A record** for your domain → the server's public IP.
- (DuckDNS: just set the IP in your DuckDNS dashboard.)

### Step 3 — Log in and install Docker
```bash
ssh ubuntu@YOUR_SERVER_IP
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

### Step 4 — Get the code and add your secrets
```bash
git clone <your-github-repo-url> sphr && cd sphr
cp .env.example .env
nano .env          # fill in your BREVO_* values and DM_RECIPIENT_EMAIL
```

### Step 5 — Set your domain in the Caddyfile
```bash
nano Caddyfile     # replace "your-domain.com" with your real domain / DuckDNS name
```

### Step 6 — Launch everything (with automatic HTTPS)
```bash
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build
```
Caddy will automatically obtain the HTTPS certificate within a minute or two.

### Step 7 — You're live
Open `https://your-domain.com`. Then guards install it on their phones:
- **Android (Chrome/Edge):** open the link → menu **⋮ → Add to Home screen / Install app**.
- **iPhone (Safari):** open the link → **Share** → **Add to Home Screen**.

### Updating later
```bash
cd sphr && git pull
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build
```

**Notes**
- Photos are stored in MongoDB, whose data lives in the `mongo_data` Docker volume on
  the server's disk — no size limit beyond the disk. Back up that volume periodically.
- Verify your sender address/domain in Brevo for reliable email delivery.

---

## 9. Deploy on Render (no server / no terminal, click-based)

Render deploys straight from this GitHub repo — no SSH or Linux commands. It runs the
app as **two services** (frontend + backend) plus a **free MongoDB Atlas** database.
A `render.yaml` Blueprint in this repo wires them together automatically.

### Step 1 — Create a free MongoDB Atlas database
1. Sign up at https://www.mongodb.com/cloud/atlas → create a **free M0** cluster.
2. **Database Access:** create a database user + password (save them).
3. **Network Access:** add IP `0.0.0.0/0` (allow from anywhere).
4. **Connect → Drivers:** copy the connection string, e.g.
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   (put your real password in place of `PASSWORD`).

### Step 2 — Deploy the Blueprint on Render
5. Sign up at https://render.com and connect your GitHub account.
6. Click **New + → Blueprint**, pick this repo (`sphr-security-log`), click **Apply**.
7. Render reads `render.yaml` and asks for the secret values — fill in:
   - `MONGO_URL` = your Atlas connection string from Step 1
   - `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `DM_RECIPIENT_EMAIL` = your Brevo values
8. Click **Apply / Create Resources**. Render builds both services (a few minutes).

### Step 3 — You're live
9. Open the **sphr-frontend** service → its `https://sphr-frontend-xxxx.onrender.com` URL
   is your app. Send it to guards → they **Add to Home Screen**.

### Notes
- On the **free** plan the backend **sleeps after 15 min idle** (first request after that
  takes ~30–60s to wake). To keep it always-on, open the **sphr-backend** service →
  **Settings → Instance Type → Starter (~$7/mo)**. (In `render.yaml`, `plan: free`.)
- The free MongoDB Atlas tier (512 MB) is plenty because the app **auto-deletes photos**
  from the database once each report has been emailed.
- Updates deploy automatically whenever you push to GitHub.


