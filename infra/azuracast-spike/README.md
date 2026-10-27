# Step 1: AzuraCast spike

Goal: prove the audio engine works before we build anything on top of it.

## Run it

```bash
cd infra/azuracast-spike
docker compose up -d
```

Then open http://localhost:8088 and create the admin account (first visit only).
Ports are shifted (8088/8443) so it does not clash with other local services. `.env` and `azuracast.env` are git-ignored: they hold passwords. Never commit them.

## Checklist (record results in docs/SPIKE_RESULTS.md)

- [ ] Admin account created, first station created by hand
- [ ] Upload a track, put it in a playlist, hear it on the public player
- [ ] Schedule a playlist for a specific time
- [ ] Go live from the browser (Web DJ) on desktop Chrome
- [ ] Go live from an Android phone over mobile data
- [ ] Presenter drops mid-show: does AutoDJ take over cleanly?
- [ ] Create a second station through the API (generate an API key, call the station endpoint). This is what our Control Platform will do.
- [ ] Create a limited user who can only manage one station
- [ ] Measure RAM and CPU with 1, then 3 stations
- [ ] Measure bandwidth per listener at 64 kbps (expected ~29 MB per hour)

## Machine note

AzuraCast wants about 2 GB RAM. This dev machine is tight, so treat performance numbers from here as a floor, not the real server.
