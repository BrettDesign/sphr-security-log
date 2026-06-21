# SPHR Security Log — PRD

## Problem Statement
Mobile-first night patrol & incident reporting app for resort/holiday park security guards. Replaces handwritten patrol books with a digital system to record incidents, log locations, timestamp entries, capture GPS + photos, dictate by voice, save offline, and submit the nightly report to management by email.

## Architecture
- **Frontend:** Expo Router (stack), React Native, dark "Night Patrol" theme (#101112 surface + #F5A623 amber). Offline-first via AsyncStorage (`@/src/utils/storage`).
- **Backend:** FastAPI + MongoDB (motor). Routes under `/api`. Managers seeded on startup.
- **Storage:** Active shift persisted locally; best-effort sync to backend (`POST /api/reports` upsert).

## User Persona
Night-shift security guard patrolling resorts/caravan parks/villas; one-handed phone use outdoors in low light.

## Core Requirements (static)
- Passwordless shift login (Security #, Guard Name, Date)
- Manager-on-diversion selector (radio cards, add new)
- Patrol entries: Location, Action Taken, auto timestamp (locks on action entry), GPS, photo, voice-to-text
- Offline save + backend sync, PDF export, email submit to dm@sphr.com.au

## Implemented (2026-06-21)
- Shift login + manager selector + add-manager modal
- Patrol dashboard with sync status, entry feed, empty state
- Log entry form: location, action, lock-on-action timestamp, GPS capture, camera/library photo (base64), voice-to-text (web SpeechRecognition + native expo-speech-recognition with graceful fallback)
- Shift summary: stats, entry list, PDF export (expo-print + sharing), submit via expo-mail-composer → mailto fallback, end-shift
- Backend: managers CRUD, reports upsert/list/get; device permissions in app.json
- Tested: backend 5/5, all frontend flows pass

## Notes / Limitations
- Email = device mail app pre-filled (no email service) — per user choice
- Voice-to-text needs an installed/deployed build (not available in Expo Go); degrades gracefully

## Backlog
- P1: Report history screen (multiple past shifts), QR checkpoint scanning
- P2: Incident categories, staff accounts/auth, manager dashboard, panic alert
