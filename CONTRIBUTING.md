# Working together

## Ground rules

- `main` is always readable. Work on a branch, open a pull request, and have at least one other founder look before merging.
- Decisions go in `docs/DECISIONS.md` (one line: date, decision, who agreed) so nobody has to remember a voice note.
- Disagree in the pull request, decide together, then commit. Anything touching money, ownership or the name needs all three founders.
- **Never commit secrets**: API keys, server passwords, `.env` files. Use a password manager. This repo is public.
- Never commit personal data from real broadcasters or listeners.

## Suggested lanes (to be agreed)

| Founder | Lane |
|---|---|
| Ayobami | Partnerships, broadcaster relationships, licensing and legal questions |
| Bamidele | Product, audio infrastructure, technical operations |
| Motunrayo | Community, creator experience, education partnerships, brand |

Everyone can edit everything. Lanes decide who has the last word when we are stuck.

## How to start

```bash
git clone https://github.com/GbadeboMotunrayo/VoxGarden.git
cd VoxGarden
git checkout -b my-change
# edit, then
git add -A && git commit -m "Describe the change"
git push -u origin my-change
```

Then open a pull request on GitHub.
