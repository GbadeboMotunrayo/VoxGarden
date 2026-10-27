# Architecture (draft)

## Principle

Users touch one interface. Everything else is ours to hide.

```
 Listeners                Broadcasters
    |                        |
 Globe (web)         Create (PWA)   Studio (web)
    \                       |          /
     \--------- VoxGarden Control Platform ---------/
        accounts · billing · permissions · provisioning
        station registry · media library · monitoring
                          |
                  (server-side only)
                          |
            Audio Engine: AzuraCast
            (Liquidsoap + Icecast, AutoDJ, Web DJ)
```

## Rules that keep this safe

1. **Admin keys never leave the server.** Apps and browsers talk to the Control Platform. Only the Control Platform talks to AzuraCast's API.
2. **One identity.** One account, one station ID, one media library across Create, Studio and Globe.
3. **Per-station isolation.** Each station gets its own AzuraCast station and scoped credentials. A presenter token can go live on one station and nothing else.
4. **Engine is replaceable.** Wrap AzuraCast behind our own interface (`createStation`, `uploadMedia`, `schedule`, `goLive`, `health`) so we could swap it later.

## Proposed stack (open to debate)

| Part | Choice | Why |
|---|---|---|
| Control Platform | TypeScript, Postgres, a small API server | Familiar, easy to hire for |
| Studio, Globe | Web app (Next.js or similar) | One codebase, shareable links |
| Globe rendering | MapLibre GL (globe projection) with flat-map fallback | Open source, light |
| Create | PWA with local audio processing (Web Audio / WASM) | No store fees, no server cost for editing |
| Engine | AzuraCast in Docker on a VPS | Already does AutoDJ, live, scheduling, API |
| Billing | Paystack or Flutterwave first | Naira card and bank payments |

## Data model sketch

`User` -> `Membership` -> `Station` -> (`Show`, `MediaItem`, `ScheduleSlot`, `Stream`) ; `Station` has `Plan`, `Location`, `Language`, `Genre`, `PublishedToGlobe`.

## Build order

1. **Spike (1-2 weeks):** Deploy AzuraCast. By hand: create a station, upload a track, schedule it, go live with Web DJ from Chrome and from an Android phone. Record what breaks and what a listener costs.
2. **Control Platform v0:** Sign-up, create station via AzuraCast API, store the mapping, public station page with player.
3. **Studio v0:** Upload, playlist/schedule, Go Live button, on-air indicator, auto-fallback.
4. **Globe v0:** Flat map with pins for VoxGarden stations; add the globe view after.
5. **Create v0:** Record, trim, upload to library.
6. **Pilot:** 1 campus and 5-10 independent broadcasters.
7. Billing and plans once people want what they are using.

## Risks to retire early

- Web DJ reliability across browsers, phones and poor networks.
- AzuraCast multi-station limits on one server, and backup/restore.
- AGPL: modifications we host may need to be published. Prefer configuring and calling its API over forking.
- Server cost per listener (measure in the spike).
