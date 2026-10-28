# VoxGarden design guide

The look: **a local radio paper**. Warm newsprint, bottle green, marigold, and a news serif. It should feel made by people, not generated from a template.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f2ede2` newsprint | `#15130e` | Page background |
| `--paper` / `--surface` | `#fbf8f2` | `#1f1c15` | Cards, panels |
| `--ink` | `#1e1b16` | `#eee7d8` | Text |
| `--muted` | `#625a4c` | `#b0a690` | Secondary text (5.8:1 / 7.7:1) |
| `--green` | `#1f4b37` bottle green | `#9dc49a` | Brand, primary buttons |
| `--marigold` | `#e9a04b` | `#eda349` | Highlights, numbers, the logo's edge. Never small text on light paper |
| `--accent` | `#9a4d0f` | `#eda349` | Small labels and focus rings (5.2:1) |
| `--live` / `--rec` | `#d23a22` | `#f0634b` | **Only** "on air" and recording. Dots and buttons, not body text |

Rules:
- Red means live. Don't use it for decoration or errors (errors use `--danger`).
- Every text colour pair must pass WCAG AA (4.5:1). Check new pairs before shipping.
- No blue, no purple gradients, no glassmorphism.

## Type

- **Display:** Newsreader (SIL OFL), self-hosted in `apps/public/fonts/` with the extended Latin set so Yoruba, Igbo and Hausa marks render (Ọ̀rọ̀ Àárọ̀). Weight 500–600; italic for the second line of a headline.
- **UI and body:** the device's system sans. Fast, familiar, no download.
- Labels: small caps style, uppercase, letter-spaced, 0.68–0.78rem, bold.

## Shape

- Corners 3–8 px. No pill buttons, no 20 px cards.
- Lines and rules (like newsprint columns) instead of shadows. One soft shadow is allowed: the phone in the hero.
- Icons: thin-stroke SVG. **No emoji as icons.**
- Motifs: the radio dial (tick marks, red needle) and equaliser bars. Bars stop under reduced motion.

## Writing

- Plain, specific, honest. No invented testimonials, user counts or listener numbers. Illustrations are labelled.
- Proposed prices say so.
- Say what it does ("goes out within a second of its slot"), not adjectives ("blazing fast").

## Pre-delivery checklist

From the UI/UX Pro Max skill, adapted:
- [ ] Text contrast 4.5:1 in light and dark
- [ ] Visible keyboard focus on every control
- [ ] Touch targets at least 44 × 44 px
- [ ] `prefers-reduced-motion` respected
- [ ] No horizontal scroll at 375 px; checked at 375, 768, 1280
- [ ] Every number on a public page is real, or clearly an illustration

## Where this came from

- The palette and type were chosen over the UI/UX Pro Max skill's default suggestion (blue `#2563EB` with geometric sans), which read as generic. From the skill we kept its "News Editorial" pairing idea, its landing-page structure and its checklist.
- The landing page section order follows Open SaaS (hero, showcase, features, proof, pricing, FAQ, footer), with real "on air now" stations in place of testimonials.
