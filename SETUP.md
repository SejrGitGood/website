# Blessings of Valkyriegade — setup

Live and working: Supabase project, shared login, public repo, GitHub Pages, image pasting, the shop generator, the character roster (Karakterer), monster/spell lookup, the party health widget, and the loot/gold tracker (Skattekammer) — all under DM Tools except the health widget, which is on the homepage.

**One-time step needed**: the loot tracker (`loot_items`, `party_treasury`) and the "Monster"/"Besværgelse" lore categories need the latest `schema.sql` run once in Supabase → SQL Editor → New query → Run. Safe to re-run any time, including on top of the existing database.

**Pending**: automatic D&D Beyond refresh needs a one-time Edge Function deploy — see `CHARACTERS_SETUP.md`. Until that's done, the "Opdater nu" button on the Karakterer page won't work yet, but the page itself and the seeded data work fine.

## Day to day

- Adding a session, lore entry, or updating logistics: log into the live site and use the forms — no redeploy needed, it reads/writes straight from Supabase.
- Attaching a picture: click into a session or lore text field and paste (Ctrl+V) an image straight from your clipboard — it lands inline, right where the cursor was.
- Changing the site's design or adding pages: edit the files here and `git push` — GitHub Pages redeploys automatically within a minute or two.
- **Cache-busting**: `css/styles.css`, `js/app.js`, `js/config.js` and `js/shops.js` are all referenced with a `?v=1` query string. GitHub Pages caches these for 10 minutes, so browsers can otherwise keep serving an old copy after a change. Whenever one of those files changes, bump the `?v=` number everywhere it's referenced in the same commit (Claude does this automatically when it edits those files) — that's what forces browsers to fetch the new version immediately instead of waiting out the cache.
- No domain yet — you're on the `sejrgitgood.github.io/website/` URL. Ask any time if you want one added later.
