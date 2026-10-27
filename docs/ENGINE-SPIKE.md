# Engine spike: our own engine vs AzuraCast

Date: 27 October 2026. Status: **decided: keep our own engine** (Motunrayo, 27 Oct). AzuraCast side was not measured; see "What was not tested".
Purpose: settle PRD Section 10 before building scheduling (FR-08).

## Criteria

1. Scheduled playback accuracy
2. Live input from a browser (Go Live)
3. Per-station isolation (one station's change must not affect another's listeners)
4. Memory (RAM) per station, which drives hosting cost
5. Licence and control

## Results: our engine (Liquidsoap 2.3.2 + Icecast, driven by our control platform)

Test rig: [infra/engine-spike](../infra/engine-spike) — one station with AutoDJ, a schedule queue and live input, in priority order `live > scheduled > AutoDJ`.

| Criterion | Result | Evidence |
|---|---|---|
| Scheduling | **Pass.** Item pushed by the control platform is on air in **55–120 ms** (median 96 ms, 10 runs). | `tools/sched-latency.mjs`, Liquidsoap's own on-air timestamp vs push time. Listeners hear it a few seconds later because of normal player/stream buffering, the same on any engine. |
| Live from a command-line source | **Pass.** On air ~3.3 s after connecting. Wrong password refused (401). When the presenter drops, the buffer plays out and AutoDJ resumes ~2.4 s later: **no dead air.** | ffmpeg as an Icecast source client. |
| Live from a browser | **Pass.** Browser → WebSocket (`webcast` protocol) → Liquidsoap: on air **~2.5 s** after connecting; AutoDJ resumes ~2 s after disconnect. | Desktop Chromium, MediaRecorder WebM/Opus at 64 kbps. **Test tone, not a real microphone; Android not tested.** |
| Isolation | **Fail as currently built.** A listener on one station was **disconnected** at the moment another user created a station (current design restarts a single shared Liquidsoap). | Listener `curl` ended at 6.25 s, exactly when `POST /stations` ran. |
| RAM | One Liquidsoap process ≈ **80 MB** with 1 station; ≈ **88 MB** with 6 stations. Icecast ≈ 5 MB. CPU ≈ 3% of a core per 64 kbps station. | `docker stats`. |
| Licence | Liquidsoap and Icecast are **GPL-2.0**. We run them unmodified as separate programs, so our own code stays ours. | GitHub licence metadata. |

Default to fix: Liquidsoap's live input waits for a **12-second** buffer by default, so short broadcasts never went on air. Set `buffer=2.` (done in the spike).

## Results: AzuraCast

| Criterion | Status |
|---|---|
| Licence | **AGPL-3.0** (confirmed from GitHub). Modifying it and running it for users obliges us to publish our changes. |
| Scheduling, live, isolation, RAM | **Not measured.** AzuraCast's first boot on this 7 GB laptop, alongside other running apps, overloaded the machine and the session crashed. It was stopped to protect the machine. |
| Known from its design (not measured by us) | It is a PHP web app with its own database and Redis, and runs **one Liquidsoap + one Icecast per station**, so isolation is built in. Its Web DJ uses the same Liquidsoap browser-WebSocket input we tested above. |

## What this means

- The parts that worried us most, **scheduling and browser Go Live, work on Liquidsoap directly**. AzuraCast uses the same Liquidsoap underneath, so it would not do these better; it would only save us writing the glue.
- The one failure, **isolation, is an architecture choice, not a Liquidsoap limit**. The fix is the same model AzuraCast uses: **one Liquidsoap process per station**, started and stopped by our control platform.
- That fix sets the hosting cost: at ~80 MB per station, a 2 GB server holds roughly **15–20 stations** after the OS. AzuraCast would cost the same per station *plus* its own web app, database and Redis on top.
- A later optimisation is several low-traffic stations per Liquidsoap process with runtime add/remove, to cut RAM for free-tier stations. Not needed for the pilot.

## Recommendation (for founders to confirm)

**Keep our own engine on Liquidsoap + Icecast.** Before building scheduling:

1. Switch to **one Liquidsoap process per station** (fixes isolation). Re-run the listener test: adding a station must not disconnect anyone.
2. Use a **scheduled queue + live input + AutoDJ fallback** per station, exactly as in `spike.liq`. Scheduling (FR-08) = our control platform pushing items at slot time.
3. Set live buffer to 2 s.

Confidence: **medium.** It rests on our own measurements for our engine, but AzuraCast was not measured side by side.

## Follow-up: per-station processes (built 27 Oct)

| Check | Result |
|---|---|
| Isolation | **Pass.** Two listeners on other stations stayed connected for a full 30 s while a new station process started and another was restarted by a rename. |
| Memory | Liquidsoap **peaks at ~300 MB while starting** (script compile), then settles at **75-95 MB** per station. A 192 MB cap made stations crash-loop; the cap is now 512 MB and start-ups are staggered 4 s apart. |
| Scheduling | Hard start: 5 back-to-back slots went on air **12-293 ms** after their time, each cutting off the previous scheduled item. |

Hosting estimate stands: roughly 15-20 stations on a 2 GB server, as long as start-ups are staggered.

## What was not tested (and how to close it)

- AzuraCast measurements. Run on the VPS, not the laptop, if the founders want the side-by-side numbers before deciding.
- A real microphone, and an Android phone on mobile data (needs a person).
- Listener-side latency end to end, and behaviour over a poor network.
- More than one station per process at scale, and RAM with 20+ stations.
