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
- Create station, upload/remove audio, AutoDJ playlist streams over Icecast at 64 kbps MP3.

## Known gaps (next)
- No password reset or email verification yet. Still local-only: do not expose this port.
- Set `VG_SECURE_COOKIE=1` when running behind HTTPS.
- Adding a station restarts Liquidsoap, briefly interrupting the others. Fix: one process per station.
- No scheduling, live (Go Live) input, listener stats, or Studio UI yet.
