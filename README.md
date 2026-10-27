# VoxGarden

**Every voice deserves room to grow.**

VoxGarden lets anyone start an internet radio station from a phone or a laptop, with no servers, encoders or stream URLs to understand. Stations then appear on a listening map so people can find them.

Founders: **Ayobami**, **Bamidele**, **Motunrayo**. Principle: *we rise by lifting others.*

> Status: **PRD drafted, awaiting founder sign-off.** The code in `apps/` and `engine/` is a technical proof of concept, not the MVP.

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
3. **Engine**: streaming, AutoDJ, storage, invisible to users. Engine choice (our own on Liquidsoap + Icecast, or AzuraCast) is still open.
4. **Globe**: a map where listeners discover stations.

## First milestone

A Nigerian broadcaster creates a station, schedules a show, goes live from a laptop, shares a link, and strangers listen. Nothing else matters until that works.

## Licence

Code: AGPL-3.0 (see [LICENSE](LICENSE)). AzuraCast is AGPL too, so this keeps us clean. Writing in `docs/` is shared under the same repo licence unless a file says otherwise. The name and logo are not yet cleared as trademarks.
