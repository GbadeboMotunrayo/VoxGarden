# Research log

Date: 2026-10-27. Method: web searches only. Nothing below is legal advice, and a search snippet is not a clearance. Items marked **UNVERIFIED** must be checked against the primary source before anyone relies on them.

## Radio Garden

- Globe-as-interface: pick a place, hear live stations. The original globe was built on CesiumJS with a React interface ([Cesium blog](https://cesium.com/blog/2019/07/19/radio-garden/)).
- Its API is not officially open; community specs exist. Do not build a product on it. Terms and rights are unresolved.
- Open alternative data source: **Radio Browser**, a community directory with locations, genres and stream URLs and a public API ([api.radio-browser.info](https://api.radio-browser.info)). **UNVERIFIED:** geo-filter parameters and whether commercial use of the data is permitted. Read its terms.
- An example open project: [andersan/radio-map](https://github.com/andersan/radio-map). Not reviewed in depth.

## AzuraCast

- Open-source web radio suite with a browser Web DJ, AutoDJ, multi-station administration and an API ([docs](https://docs.azuracast.com)).
- Licence: search results conflicted (AGPL vs Apache). **UNVERIFIED:** read the `LICENSE` file in the official GitHub repo before building.
- **UNVERIFIED:** the exact API calls for creating a station, scoping permissions per station, and limits on stations per server. Test in the spike.

## Nigeria: regulation and rights

- The NBC has stated that online/IP broadcasters must register or be licensed, and that an FM licence does not cover streaming ([ITEdgeNews](https://www.itedgenews.africa/register-with-us-now-or-face-sanction-nbc-tells-web-broadcasters/)).
- A fee schedule snippet suggested an internet-protocol radio licence fee of N10 million over five years ([NBC document](https://www.nbc.gov.ng/wp-content/uploads/2026/03/SUMMARY-OF-NBC-SLA.pdf)). **UNVERIFIED:** I did not confirm the table, who it applies to, or current rates. If true, it changes the business model: **who holds the licence, VoxGarden or each station?** This is the single most important question to resolve with a Nigerian media lawyer.
- Music: collecting societies COSON and MCSN. One blog reports a July 2026 Court of Appeal outcome in MCSN's favour ([Interspace](https://interspacemusic.com/blog/coson-court-of-appeal-mcsn-royalty-collection-nigeria/)). **UNVERIFIED:** single source; the position may still be contested.

## Name

- Searches found no existing "VoxGarden" or "Vox Garden" trademark record. Nearby marks exist (VOICEGARDEN, cancelled; VOXNEST, active in a different class). This is not a clearance search.
- To do: USPTO and Nigerian Trademarks Registry search in classes 9, 38, 41, 42; domain and social handles; "Voxtox" and similar audio brands for confusion risk.

## Open questions (owner suggestions in brackets)

1. Licensing model: who needs an NBC licence, and at what cost? (Ayobami + lawyer)
2. Music rights path for stations: Seed Library, CMO licence, or talk-only start? (Ayobami)
3. Real cost per listener-hour on our chosen host. (Bamidele)
4. Does Web DJ hold up on Android Chrome over 3G/4G? (Bamidele)
5. Will campuses and independents pay, and how much? Interview 15 people. (Motunrayo)
6. Founders' agreement. (all, with a lawyer)
7. Name and domain clearance. (Motunrayo)
