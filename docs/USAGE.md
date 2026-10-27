# Usage metering (FR-13)

Why it exists: so we can set prices and free-tier limits from real numbers, not guesses. The PRD's unit-economics metric is *"streaming and storage costs measured per station and listener-hour"*.

## What is measured

| Measure | How | Accuracy |
|---|---|---|
| **Listener-hours** | Every 30 s the platform asks Icecast how many people are on each station and adds *listeners × 30 s*. | Within one sample (±30 s per listener connection). A test with 3 listeners for ~20 s recorded 72 listener-seconds against ~60 expected. |
| **Peak listeners** | Highest count seen in a sample that day. | Short spikes between samples can be missed. |
| **Data sent to listeners** | *Estimated*: listener-seconds × station bitrate (64 kbps ≈ 29 MB per listener-hour). | Ignores protocol overhead and listeners who buffer ahead; real egress is a little higher. |
| **On-air hours** | Time the station's stream was up, sampled the same way. | ±30 s. |
| **Uploads received** | Bytes of every upload and recording, counted when they arrive. | Exact. |
| **Recording minutes processed** | Length of audio trimmed and converted. | Exact. |
| **Storage** | Sum of the station's library files. | Exact. |

Nothing is counted while VoxGarden is not running (the sampler skips gaps longer than two samples).

Numbers are stored per station per day (UTC) in the `usage_daily` table.

## Who sees what

- **Station members** see their station's last 30 days in the Studio (*Usage* card): listener-hours, peak, data streamed, recording minutes, storage against the limit, and a daily chart.
- **Founders** see every station on one page (*Platform usage* button), heaviest listening first, with owner and totals. Founders are set by email:

```bash
VG_ADMIN_EMAILS=ayobami@example.com,bamidele@example.com,motunrayo@example.com npm start
```

Everyone else gets "not found" from the founder endpoint.

## Limits (enforced)

- **Storage per station:** default **1000 MB**, change with `VG_STORAGE_QUOTA_MB`. Uploads and recordings that would go over are refused with a message saying how much is used and needed. Big uploads are refused *before* they are received when the browser declares the size.
- Not yet limited: listeners per station, hours on air, recordings per day. These need the pilot's numbers first.

The 1000 MB default is a placeholder, not a pricing decision.

## Turning numbers into cost (for pricing)

Per station per month, roughly:

```
streaming cost ≈ listener-hours × 0.029 GB × (price per GB of egress)
storage cost   ≈ storage GB × (price per GB-month)
engine cost    ≈ (number of on-air stations ÷ stations per server) × server price
                 (~15-20 stations per 2 GB server; see docs/ENGINE-SPIKE.md)
```

Fill in the prices from the chosen host. The pilot gives the listener-hours.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `VG_ADMIN_EMAILS` | (none) | Founders who can see platform usage |
| `VG_STORAGE_QUOTA_MB` | 1000 | Storage limit per station, decimal MB |
| `VG_USAGE_SAMPLE_MS` | 30000 | How often listeners are sampled (ms) |
