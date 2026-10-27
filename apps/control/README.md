# Control platform (v0)

Our own station-management API. Needs Node 24+; no npm dependencies.

```bash
cp engine/.env.example engine/.env      # then set real passwords
node apps/control/src/server.ts          # API on 127.0.0.1:4000
cd engine && docker compose up -d        # Icecast :8000 + Liquidsoap
```

```bash
curl -X POST localhost:4000/stations -d '{"name":"My Station","slug":"my-station"}'
curl -X POST --data-binary @song.mp3 "localhost:4000/stations/my-station/media?filename=song.mp3"
# listen: http://localhost:8000/my-station
```

## What works
Create station, upload audio, AutoDJ playlist streams over Icecast at 64 kbps MP3.

## Known gaps (next)
- No auth or accounts yet. Do not expose this port.
- Adding a station restarts Liquidsoap, briefly interrupting the others. Fix: one process per station.
- No scheduling, live (Go Live) input, listener stats, or Studio UI yet.
