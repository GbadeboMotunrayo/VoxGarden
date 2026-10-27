# VoxGarden

**Every voice deserves room to grow.**

VoxGarden lets anyone start an internet radio station from a phone or a laptop, with no servers, encoders or stream URLs to understand. Stations then appear on a listening map so people can find them.

Founders: **Ayobami**, **Bamidele**, **Motunrayo**. Principle: *we rise by lifting others.*

> Status: **building MVP-0, testing locally.** Built so far: accounts, station wizard, uploads, per-station engine, scheduling, public station page. Not yet: phone recording, usage metering, Go Live button. Details in [docs/PRD-REVIEW.md](docs/PRD-REVIEW.md).

## Run it on your computer

You need **Node.js 24+** ([nodejs.org](https://nodejs.org)) and **Docker** (Docker Desktop on Mac/Windows, Docker Engine on Linux), running. On Windows, use WSL2 (Ubuntu) and run the commands there. Allow about 2 GB of free memory and 2 GB of disk.

```bash
git clone https://github.com/GbadeboMotunrayo/VoxGarden.git
cd VoxGarden
npm run setup     # first time only: checks tools, makes passwords, downloads the engine (~1 GB)
npm start         # then open http://localhost:4000
```

Then try the whole flow:

1. **Create an account**, then **Plant your first station** (4 short steps).
2. **Upload an audio file** to the Library. The station starts broadcasting within a few seconds.
3. Click **Public page ↗**: that's what listeners see. Press play.
4. In **Schedule**, pick the track and a time a minute or two ahead. Watch it move to *Played on time*.

Stop everything with `Ctrl+C`, then `npm run stop`. Your accounts, stations and audio stay in `data/` and `engine/media/` (both git-ignored), and come back on the next `npm start`.

**Listen from your phone on the same Wi-Fi** (optional): start with `ICECAST_BIND=0.0.0.0 VG_HOST=0.0.0.0 VG_PUBLIC_BASE=http://<your-computer-ip>:4000 VG_STREAM_BASE=http://<your-computer-ip>:8000 npm start`, then open `http://<your-computer-ip>:4000/s/<station>` on the phone. Only do this on a network you trust. Phone *recording* will need HTTPS, which comes later.

| Problem | Fix |
|---|---|
| `Docker is installed but not running` | Open Docker Desktop and wait for it to say *running*. |
| `port is already allocated` (4000 or 8000) | Something else is using it. Stop it, or run with `PORT=4100 npm start` (Studio only). |
| A station shows *Live now* but plays silence | Give it 5-10 s after the first upload; the engine is starting. Run `docker ps` to check for `vg-station-<name>`. |
| Computer gets slow | Each station's engine uses ~80 MB (≈300 MB for a few seconds while starting). Keep a handful of test stations. |

Nothing here is public: by default everything listens on your computer only.

## Start here

| Read | What it is |
|---|---|
| [docs/EXPLAINER.md](docs/EXPLAINER.md) | What VoxGarden is, who it is for, how it makes money. Plain language. Send this to anyone. |
| [docs/BETTER.md](docs/BETTER.md) | Where we deliberately go beyond Radio Garden and Radio.co, and why. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces connect, and the build order. |
| [docs/RESEARCH.md](docs/RESEARCH.md) | What we checked, what we could not confirm, and the open questions. |
| [docs/PRD.md](docs/PRD.md) | Product requirements and MVP definition (draft v1.0). |
| [docs/PRD-REVIEW.md](docs/PRD-REVIEW.md) | Review of the PRD, proposed MVP-0 scope, and what is built vs required. |
| [docs/ENGINE-SPIKE.md](docs/ENGINE-SPIKE.md) | Engine test results: our own engine vs AzuraCast. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How the three of us (and later others) work in this repo. |

## The four products, one account

1. **Create**: record and edit on a phone, send to your station.
2. **Studio**: create a station, schedule, go live from the browser, manage presenters.
3. **Engine**: streaming, AutoDJ, storage, invisible to users. Our own engine: Liquidsoap + Icecast, one Liquidsoap process per station (decided 27 Oct, see docs/ENGINE-SPIKE.md).
4. **Globe**: a map where listeners discover stations.

## First milestone

A Nigerian broadcaster creates a station, schedules a show, goes live from a laptop, shares a link, and strangers listen. Nothing else matters until that works.

## Licence

Code: AGPL-3.0 (see [LICENSE](LICENSE)). AzuraCast is AGPL too, so this keeps us clean. Writing in `docs/` is shared under the same repo licence unless a file says otherwise. The name and logo are not yet cleared as trademarks.
