# Making it better than the original idea

The first pitch (Radio.co alternative plus a Radio Garden globe, with a phone creation app) is sound. After research, these are the changes I would make. Each is a proposal for the three of us to accept or reject.

## 1. Start with campuses, not "everyone"

A university has people, a reason (journalism, media and communication courses), a budget line and a place to put an antenna's worth of attention. One campus station brings dozens of presenters and thousands of listeners who already know each other. Five campuses are a better proof than five hundred solo broadcasters. Free/discounted accounts in exchange for a case study and a student training cohort.

## 2. Solve music rights instead of ignoring them

Most failed internet stations die on licensing, not technology. Most new broadcasters want to play music, and commercial music needs rights clearance through a collecting society.

Idea: a **Seed Library**. Independent artists opt in and upload tracks that VoxGarden stations may play, with the artist credited and a simple play report. Stations get legal music, artists get airplay and data. It also gives the Globe a reason to exist for musicians. Talk-first formats (news, sermons, education, sport) need no music at all and should be the default launch path.

## 3. Design for weak data and cheap phones

Our users are often on prepaid data and low-end Android. So:
- A **data-light listening mode** (low bitrate stream, for example 32-48 kbps HE-AAC or Opus) shown honestly with an estimate of MB per hour.
- The Globe works as a flat map and a list on slow connections; the 3D globe is an upgrade, not the only way in.
- Create records and edits locally first and uploads in the background, resuming if the connection drops.
- Share links that open straight to a playing station in WhatsApp's in-app browser.

## 4. Make Go Live boring and safe

One-click broadcasting is the product. So the Studio needs: a mic test, a visible "you are on air" state, automatic reconnect, and a fallback to AutoDJ if the presenter drops, so a station never goes silent. Browser live audio on mobile is the riskiest claim in the plan; ship desktop browser first.

## 5. A compliance wizard

Do not promise legal certainty we cannot give. Do give each station a checklist: regulator registration status, music rights status, content standards, takedown contact. Campus plans get an institutional oversight view. This turns a risk into a feature.

## 6. Seed the Globe before anyone joins

An empty map is a dead product. Public directories such as Radio Browser list many stations with locations, so Globe can launch populated, clearly labelled as "stations from around the web", with VoxGarden stations highlighted. Check the directory's terms and whether we may use its data this way before building on it.

## 7. Money that fits Nigerian reality

Local currency pricing, Paystack/Flutterwave billing, annual and term-based (school term) plans, and a sponsor-a-station option where an alumnus or business pays for a student station. Keep a cost-per-listener-hour number on the founders' dashboard from day one.

## 8. A visible lifting-others mechanism

"We rise by lifting others" should be a feature. Candidate: each paying Professional station sponsors a free Community station and is credited on it; a Campus Broadcaster Programme with a mentor from a working station for each new one.

## 9. AI only where it saves hours

Transcripts, show notes, clip suggestions and schedule drafts. Never write the presenter's words. Never required for basic use, because it costs money per use.

## What I would cut or delay

- Native iOS/Android apps (PWA first)
- Ad marketplace
- 3D globe polish
- Anything needing more than one audio engine

## Cost sanity check (illustrative, not a quote)

Listener cost is roughly `bitrate x hours`. At 64 kbps, one listener-hour is about 29 MB. 1,000 listener-hours is about 29 GB. Check bandwidth pricing from at least three hosts (including African ones) before setting any plan limit; egress pricing varies enormously.
