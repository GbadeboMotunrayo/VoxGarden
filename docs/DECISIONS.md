# Decisions

- 2026-10-27: Working name VoxGarden (trademark and domain not yet cleared).
- 2026-10-27: Build our own platform (control platform + Studio), not a reskinned AzuraCast. Engine layer = Icecast + Liquidsoap (the same primitives AzuraCast uses), driven by our code. AzuraCast kept only as a reference/benchmark (infra/azuracast-spike).
- 2026-10-27: PRD v1.0 added (docs/PRD.md). Not yet signed off. Open conflict: PRD Section 10 says evaluate AzuraCast; current code uses our own platform on Liquidsoap + Icecast. To be settled by an engine spike (see docs/PRD-REVIEW.md).
