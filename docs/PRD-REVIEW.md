# PRD v1.0 review (PM pass)

Reviewer: Claude, acting as project manager, 27 October 2026.
Verdict: **a strong base, but not yet buildable as an MVP.** It describes v1 of the product well. The "MVP" section still contains most of v1. Six changes before founder sign-off.

---

## 1. The MVP is too big

Section 5 says the MVP "is not four complete applications", then puts all four products in it. Section 8 has **13 "Must" requirements**, including live broadcasting, mobile editing, a map, health monitoring and usage metering. That is several months of work for a small team, built before a single customer has confirmed the problem.

**Proposed MVP-0 (pilot slice).** The PRD's own objective is: *smartphone → station → listener link.* Only what that path needs:

| Keep in MVP-0 | Why |
|---|---|
| FR-01 Accounts | Can't put real users on an open system |
| FR-02 Station wizard (name, description, category, language, logo) | First impression; drives the directory later |
| FR-03 Automated provisioning | The core promise: no technical setup |
| FR-04 Record on phone (record/pause/stop, **trim start/end only**) | The differentiator. Full editing waits |
| FR-06 + FR-07 Upload to library, from phone or file | |
| FR-08 Scheduling (simple: play this at this time) | Journey A step 9 |
| FR-10 Public station page with player and share link | The thing users show people |
| FR-13 Usage metering (listener-hours, storage per station) | Without it we can't price |

**Moved out of MVP-0, into MVP-1:** FR-05 beyond trim, FR-09 live broadcasting, FR-11 search/map, FR-12 health dashboard (alerts to us, not a UI), FR-14 collaborators.

Live broadcasting is the hardest technical piece and Journey A does not need it. A campus or community pilot can run on recorded, scheduled programmes. Go Live becomes the first MVP-1 feature, with its own success test.

## 2. No first customer is named

Section 3 lists four primary user groups. An MVP serves one. Pick one for the pilot, with a number:

> Suggested: **one university media/journalism department, 10 to 20 student presenters, one station, 6 weeks.** Plus 3 to 5 independent broadcasters as a contrast group.

This is a suggestion. The founders decide.

## 3. Regulation is missing (the biggest gap)

The PRD covers music licensing in one risk line. It does not mention **broadcast licensing at all**. NBC has stated online broadcasters must register; one unverified document suggests a large internet-radio licence fee. Who holds that licence (VoxGarden, or each station) decides the business model.

**Add:** a section "Regulatory and legal", and a **gate**: no paid launch until a Nigerian media lawyer has answered (a) does each station need a licence, (b) does VoxGarden as host, (c) cost and timeline, (d) music rights path. Also missing: Nigeria Data Protection Act obligations (we store user and listener data), terms of service, content takedown process, and who owns uploaded content.

## 4. Metrics need numbers, a time frame, and a money signal

- Percentages without a pilot size are fragile ("80%" of 5 users is 4 people). State the pilot size.
- Add a time frame: "within the 6-week pilot".
- **No metric tests willingness to pay.** Add one, for example: "at least 3 pilot stations agree to a paid plan or letter of intent at the end of the pilot".
- 99.5% stream availability is a measurement goal for a pilot, not a pass/fail. Keep it, but don't block the pilot on it.
- Add "time from sign-up to first listener" (target: under 30 minutes, unassisted).

## 5. The engine decision contradicts our build

Section 10 says "evaluate AzuraCast". The decision log says we build our own control platform directly on Liquidsoap + Icecast, and that is what the code does. Both are defensible:

| | Our own on Liquidsoap/Icecast | AzuraCast underneath |
|---|---|---|
| Control and ownership | Full | Partial; AGPL obligations if we modify it |
| Work for us | Scheduling, live input, monitoring, per-station isolation are all ours to build | Mostly already done |
| Risk | More code to own | Integration and multi-tenant limits |

**Recommendation:** keep our own control platform (needed either way), and decide the engine with a 3-day spike comparing both on four things: scheduled playback accuracy, live input from a browser, per-station isolation, and RAM per station. Update the PRD and decision log with the result. Until then, mark Section 10 as "open".

## 6. Gaps in the non-functional requirements

These need numbers before engineering can test against them:
- **Supported devices:** name a reference low-end Android phone and minimum Chrome version.
- **Scheduling tolerance:** e.g. a scheduled programme starts within 10 seconds of its slot.
- **Stream quality:** default bitrate (e.g. 64 kbps MP3 or 48 kbps AAC), plus a data-light option.
- **Upload limits:** max file size and length per tier.
- **Content safety:** a public station can broadcast anything. Need a report button, a takedown path, and an admin kill switch per station.
- **Support:** who answers a pilot user at 9pm when their station is silent?

## Smaller notes

- Section 1.3 has no price hypotheses. Keep pricing out of the PRD if you like, but link a pricing-hypothesis page so the pilot can test it.
- Section 14 (governance) is right, and should be a precondition for building with outside users, not just for "commercial launch".
- Journey A step 8 mentions "publish as a podcast". Podcasting is not in scope anywhere else. Remove it from MVP or add it deliberately.

---

## Gap check: what is built today vs the PRD

| FR | Status | Notes |
|---|---|---|
| FR-01 Accounts | **Built** (27 Oct) | Sign up, log in, log out, station ownership. No password reset or email verification yet. |
| FR-02 Station wizard | **Built** (27 Oct) | 4 steps: name and web address, description/category/language, country/city, logo. Same wizard edits a station (owners only; web address is permanent). |
| FR-03 Provisioning | **Built** (27 Oct) | One Liquidsoap process per station, started on first upload. Adding or changing a station no longer affects anyone else's listeners (tested). |
| FR-04 Record on phone | **Built** (27 Oct) | Record / pause / resume / stop with level meter, waveform, trim start and end, preview the kept part, title, send with upload progress. Server trims and converts to 64 kbps mono MP3 using the engine image (no extra installs). Tested with a generated tone in desktop Chromium; **real phones need HTTPS** (browser rule), so not yet tested on a phone. |
| FR-05 Editing | Not built | |
| FR-06 Upload/organise | Partial | Upload and remove work. No organising, no validation of file contents. |
| FR-07 Create → Studio | **Built** (27 Oct) | A recording lands in the station library under its title, ready to schedule. No local drafts yet: an unsent recording is lost if the page closes (the page warns first). |
| FR-08 Scheduling | **Built** (27 Oct) | Pick a library track and a time; it starts on time (12-293 ms after the slot in tests), cuts off any earlier scheduled item, then AutoDJ resumes. Cancel, missed (>60 s late) and failed states. Single plays only: no recurring shows or playlists-in-a-slot yet. |
| FR-09 Live | Not built | |
| FR-10 Public player | **Built** (27 Oct) | `/s/<station>`: no login, logo, details, live/off-air status, listener count, play/pause that stops data use when paused, auto-reconnect, lock-screen controls, data-use note, WhatsApp/share/copy, link previews (title, description, logo). |
| FR-11 Discovery | Not built | |
| FR-12 Health | Not built | |
| FR-13 Usage metering | **Built** (27 Oct) | Listener-hours, peak listeners, data streamed (estimate), on-air time, uploads, recording minutes and storage, per station per day. Studio usage card; founders-only platform view (`VG_ADMIN_EMAILS`); storage limit per station enforced. See docs/USAGE.md. |

NFR security: auth and server-side permissions now in place; upload content validation, quotas and rate limits beyond login still missing. Everything built so far is a technical proof of concept (PRD Phase 1), not MVP work, and should be described that way.

## Proposed order of work once signed off

1. Founders sign off on MVP-0 scope, pilot customer, and metrics (this document + PRD edits).
2. Lawyer question on licensing started in parallel (Ayobami).
3. Engine spike, 3 days, decides Section 10 (Bamidele).
4. Pilot customer conversations start (Motunrayo).
5. Build MVP-0 in this order: accounts and station ownership → station wizard → scheduling → public station page → phone recording with trim → usage metering.
