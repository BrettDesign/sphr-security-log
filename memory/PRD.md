# SPHR Security Log — PRD

## Problem Statement
Mobile-first night patrol & incident reporting PWA for resort/holiday park security guards. Replaces handwritten patrol books: record incidents, log locations, timestamp entries, capture GPS + photos, dictate by voice, complete final door checks, save offline, and email the nightly report (formatted body + PDF) to management.

## Architecture
- Frontend: Expo Router (stack), React Native, dark night-patrol theme (#101112 + amber #F5A623). Offline-first via AsyncStorage (`@/src/utils/storage`). Installable PWA (manifest + service worker + runtime head injection).
- Backend: FastAPI + MongoDB (motor), routes under /api.
- Email: Brevo transactional API (ACTIVATED). Sender nightlysecurityinfo@gmail.com → dm@sphr.com.au, HTML body + server-generated PDF (xhtml2pdf).

## Implemented (updated 2026-06-23)
- Passwordless shift login (Security #, Guard Name, Date)
- Manager-on-diversion selector + add manager (seeded: Zachary, Brett, Clarke, Margi, Mel)
- Patrol entries: Location, Action Taken, timestamp locks on action entry, GPS capture, photo (compressed via expo-image-manipulator), voice-to-text (web SpeechRecognition / native expo-speech-recognition)
- Offline save + backend sync (race-safe; never clobbers newer entries)
- Final Door Checks: 18 areas, tap to tick (green), progress X/18, dashboard card, required-before-submit warning (review/submit-anyway)
- Summary: stats, FINAL DOOR CHECKS section, PATROL LOG, Export PDF, Submit to DM
- Submit to DM: backend Brevo send (formatted HTML body + PDF w/ door checks); mail-app fallback if send fails
- QR / Share screen (install link), PWA install banner (Android one-tap install; iOS Add-to-Home-Screen guidance)
- Custom SPHR shield app icon + adaptive/splash/favicon/maskable icons

## Integrations
- Brevo email (key in backend/.env). Recommended next: authenticate sphr.com.au domain in Brevo for deliverability.

## Backlog / Next
- P1: Management web dashboard to view all submitted reports; report history in-app
- P1: Verify sphr.com.au domain in Brevo (DNS) + switch sender to nightlysecurityinfo@sphr.com.au
- P2: Incident categories, QR checkpoint scanning, staff accounts, panic alert
