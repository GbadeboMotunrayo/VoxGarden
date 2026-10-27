# Control platform (v0)

Our own station-management API. Needs Node 24+; no npm dependencies.

```bash
cp engine/.env.example engine/.env      # then set real passwords
node apps/control/src/server.ts          # API on 127.0.0.1:4000
cd engine && docker compose up -d        # Icecast :8000 + Liquidsoap
```

Open http://127.0.0.1:4000, create an account, create a station, upload audio.
Listen at `http://localhost:8000/<station-web-address>`.

API calls need a session cookie (from `/auth/signup` or `/auth/login`) and the header `x-vg-request: 1` on every POST/DELETE.

## What works
- Accounts (FR-01): sign up, log in, log out. scrypt password hashes, HttpOnly session cookie (only a hash is stored), login rate limit, CSRF header check.
- Station ownership: you only see and change stations you belong to. Others get a 404.
- Station wizard (FR-02): name, web address, description, category, language, country, city, logo (PNG/JPEG/WebP checked by content, max 2 MB). Owners can edit; the web address is permanent.
- Engine: one Liquidsoap container per station (`vg-station-<slug>`), started on its first upload, restarted alone when its name changes. Icecast is shared.
- Scheduling (FR-08): `GET/POST /stations/:slug/schedule`, `DELETE /stations/:slug/schedule/:id`. A 250 ms scheduler loop hands due items to the station; late by more than 60 s = missed.
- Public station page (FR-10): `/s/<web-address>` and `GET /public/stations/<web-address>` (profile + on-air + listeners; no secrets). Set `VG_PUBLIC_BASE` (page links, previews) and `VG_STREAM_BASE` (listener stream host) in production.
- Recording (FR-04): `POST /stations/:slug/recordings?title=&start=&end=` with the raw browser recording (WebM, Ogg, MP4/AAC, WAV or MP3, judged by content). A one-off Liquidsoap container trims and converts it to 64 kbps mono MP3. Browser WebM has no seek index, so trimming the start uses two passes (decode to WAV, then cut).
- Create station, upload/remove audio, AutoDJ playlist streams over Icecast at 64 kbps MP3.

## Known gaps (next)
- No password reset or email verification yet. Still local-only: do not expose this port.
- Set `VG_SECURE_COOKIE=1` when running behind HTTPS.
- No Go Live UI yet (the engine's live input works; see docs/ENGINE-SPIKE.md), no recurring schedules, no listener stats.
