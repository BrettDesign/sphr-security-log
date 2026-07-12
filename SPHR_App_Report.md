# SPHR Security Log — Application Report

*Prepared for SPHR management*

---

## Part 1 — How the App Is Built (the "moving parts")

The SPHR Security Log is a **Progressive Web App (PWA)** — a modern web application
that installs onto a guard's phone like a normal app (via "Add to Home Screen"), works
in full screen, and can operate offline. There is nothing to download from an app store
and no approval process to wait on.

Behind the scenes it is made of four independent "moving parts", each hosted on a
free service, all joined together over the internet:

### 1. The app screen (Frontend)
- **What it is:** The screens the guards see and tap — login, dashboard, patrol logging,
  door checks, and the report summary.
- **Built with:** Expo / React Native (a widely used, professional mobile framework).
- **Where it lives:** Hosted as a static website on **Render** (free tier).
- **Role:** It's the "face" of the app. It captures everything the guard does and sends
  it securely to the backend.

### 2. The engine (Backend)
- **What it is:** The behind-the-scenes program that receives data from the app, stores
  it, builds the PDF report, and sends the email.
- **Built with:** FastAPI (a fast, reliable Python framework), packaged with Docker.
- **Where it lives:** A web service on **Render** (free tier).
- **Role:** The "brain". It handles the logic the guard never sees.

### 3. The filing cabinet (Database)
- **What it is:** Secure cloud storage for managers, patrol reports, and door-check records.
- **Built with:** **MongoDB Atlas** (free tier).
- **Role:** Remembers everything — the manager list, and a permanent text record of every
  submitted report (photos are automatically removed after emailing to keep it lean).

### 4. The postman (Email service)
- **What it is:** The service that actually delivers the nightly report to management.
- **Built with:** **Brevo** (free tier), sending from a verified address.
- **Role:** Emails the formatted report plus a PDF attachment to `dm@sphr.com.au`.

### How they work together (a typical night)
1. A guard opens the app on their phone and logs their patrol (location, action, photo,
   voice note, GPS, timestamp).
2. The **frontend** saves it on the phone instantly (works even with no signal).
3. At the end of the shift the guard completes the 18-point door checks and taps **Submit**.
4. The **frontend** sends the shift to the **backend**.
5. The **backend** saves the record to the **database**, builds a PDF, and hands it to the
   **email service**.
6. The **email service** delivers the report + PDF to `dm@sphr.com.au` within seconds.
7. The guard's phone clears the shift, ready for the next night.

### The source code
All the code is stored safely on **GitHub**, so it is backed up, version-controlled, and
can be moved to any other server in the future if ever needed. It is not locked into any
single provider.

---

## Why it runs at **no cost** to the resort

Every part of the app runs on a provider's **free tier**, and the design deliberately
stays within those free limits:

| Part | Provider | Cost |
|------|----------|------|
| App screen (frontend) | Render (static hosting) | **Free** |
| Engine (backend) | Render (free web service) | **Free** |
| Database | MongoDB Atlas (free tier) | **Free** |
| Email delivery | Brevo (free tier) | **Free** |
| Secure web address (HTTPS) | Included automatically | **Free** |
| **Total monthly running cost** | | **AU$0.00** |

A key design decision keeps it free long-term: **guard photos are automatically deleted
from the database the moment a report has been emailed.** The email (with its inline
photos and PDF attachment) becomes the permanent photo archive, so the free database
never fills up.

**One optional consideration:** On the free plan the backend "sleeps" after ~15 minutes of
inactivity, so the *first* guard to open the app after a quiet period may wait ~30–60
seconds for it to wake up. If management ever wants that wait removed (instant every time),
the backend can be upgraded to an "always-on" plan for roughly **AU$10–11 per month** — but
this is entirely optional; the app is fully functional on the free plan.

---

## Part 2 — Full Functionality & Benefits to the Resort

### A. Shift Login (no passwords to manage)
- Guards start a shift by entering a **Security Number** and **Guard Name**, choosing the
  **Shift Date** from a calendar, and selecting the **duty manager** on call.
- **Benefit:** Fast, foolproof start — no accounts, passwords, or IT admin. Every report is
  clearly attributed to a named guard, date, and the responsible manager.

### B. Manager "Diversion" List (add / edit / delete)
- A managed list of duty managers with their names and mobile numbers, with quick-dial and
  the ability to **add, edit, or delete** entries (e.g. fix a typo or update a number).
- **Benefit:** Guards always know exactly who is on call and can reach them instantly.
  Management keeps the list current without any technical help.

### C. "Resume shift" safeguard
- If an unfinished shift is found on the device, the app asks whether to **resume** it or
  **start a new one** — and clearly flags if the saved shift is **from a previous day**.
- **Benefit:** Prevents a new night's patrol from being accidentally logged against the
  wrong (old) shift, protecting the integrity of the records.

### D. Patrol Logging (the core nightly task)
Each patrol entry captures:
- **Location** and **Action** taken
- **Automatic timestamp** (tamper-evident time of each check)
- **GPS coordinates** (proof of where the guard was)
- A **photo** (automatically compressed so it uploads fast)
- **Voice-to-text** notes (guards can speak instead of type)
- **Benefit:** A detailed, time-stamped, location-verified, photographic record of every
  patrol — strong evidence for insurance, incidents, and accountability, captured with
  minimal effort so guards keep patrolling rather than paperworking.

### E. Works Offline
- Entries are saved on the phone instantly and sent when a connection is available.
- **Benefit:** Reliable in basement car parks, back-of-house areas, and anywhere signal is
  weak — no data is ever lost.

### F. 18-Point Final Door Checks
- Before a report can be submitted, the guard completes a checklist of the resort's 18 key
  doors/gates/areas (GM Office, Back Door, Pool Gates, Keg Room, Sheds, etc.).
- **Benefit:** Guarantees nothing is missed at lock-up. A consistent, enforced end-of-night
  security routine every single shift.

### G. Automatic Report Submission (Email + PDF)
- On submit, the app emails a professionally formatted report — including all patrol
  entries, photos, GPS and the door-check results — plus a **PDF attachment**, straight to
  **dm@sphr.com.au**.
- **Benefit:** Management receives a complete, consistent nightly report automatically,
  every morning, with zero effort from the guard beyond tapping "Submit". The PDF is ideal
  for filing, printing, or forwarding.

### H. Installable App + Dark Mode
- Installs to the phone home screen and runs full-screen; a dark theme is easy on the eyes
  for night work and saves battery.
- **Benefit:** Feels like a real, purpose-built app; comfortable and practical for
  overnight use.

### I. Privacy & Storage Hygiene
- Photos are automatically deleted from the database once emailed; the email is the archive.
- **Benefit:** Keeps stored data minimal and running costs at zero, while management still
  retains every report and photo in their inbox.

---

## Summary

The SPHR Security Log is a **live, fully working app** that guards install on their own
phones. It turns the nightly patrol into a fast, tap-driven routine that produces a
detailed, verifiable, photo-and-GPS-backed report — automatically emailed to management as
a formatted email and PDF every night. It enforces the 18-point lock-up checklist, works
even without signal, and currently runs at **AU$0.00 per month**.

**In short:** better accountability, stronger evidence, a guaranteed lock-up routine, and
effortless nightly reporting for management — at no ongoing cost to the resort.
