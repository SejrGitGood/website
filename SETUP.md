# Blessings of Valkyriegade — setup

Live and working: Supabase project, shared login, public repo, GitHub Pages, image pasting, the shop generator, the character roster (Karakterer) with public teasers, monster/spell/condition lookup, the party health widget with an Inspiration toggle, the campaign day counter, the loot/gold tracker (Skattekammer), NPC attitude and status tracking on Lore, the quest board (Mål), the interactive timeline (Tidslinje), site-wide search, a manual theme switcher (Auto/Lys/Mørk/Blodmåne) in the nav, automatic lore cross-linking with hover previews in Sessions/Lore text, and personal per-player accounts (Min Karakter) for a private backstory alongside the public teaser.

**Lore auto-linking**: any text in a session recap or Lore entry that matches another Lore entry's title exactly (case-sensitive, whole word/phrase) becomes a clickable link automatically, with a hover preview card. No setup needed — it just reads whatever titles already exist. Rename a Lore entry and old mentions of the new name start linking automatically; nothing needs to be re-saved.

**Nav structure**: the top nav is just Forside / Historien / DM Tools / Logistik. Sessions, Lore, Mål and Tidslinje live behind the "Historien" hub page (same pattern as DM Tools). The homepage still deep-links straight to Sessions/Lore/Mål previews, same as it deep-links to Karakterer under DM Tools.

**One-time step needed**: run the latest `schema.sql` once in Supabase → SQL Editor → New query → Run. Safe to re-run any time. It adds (among earlier additions) `loot_items`, `party_treasury`, the campaign-day counter on `logistics`, the NPC attitude/status fields on `lore_entries`, `characters.has_inspiration`, the new `quests` table, `characters.teaser`/`owner_email`, and the new `character_private_notes` table.

**Personal accounts (Min Karakter)**: each player can now sign up for their own account — separate from the shared login — to write a public teaser and a fully private backstory for their character. This needs no setup from you beyond running `schema.sql`; players self-serve via "Rediger din karakter" on the Karakterer page, and self-claim their character from a list (one-time, can't be taken back once claimed — if someone claims the wrong one, fix it in the SQL editor: `update characters set owner_email = null where id = '...'`). One thing worth checking once in the Supabase dashboard: **Authentication → Providers → Email → "Confirm email"**. If that's turned on, a new player has to click a confirmation link before they can log in after signing up (they'll see a message telling them to check their inbox); if it's off, they're logged in immediately after signup. Either works, it's just good to know which one your project is set to.

The private backstory is genuinely private: it lives in its own table with RLS that only ever matches the owning player's own login — not the shared account, not other players' personal accounts. Nobody but the player (and you, if you ever query it directly with the service_role key) can read it.

Automatic D&D Beyond refresh is fully set up: the Edge Function is deployed, the "Opdater nu" button on Karakterer works, and a `pg_cron` job (`refresh-characters-nightly`) refreshes every character automatically at 03:00 UTC. See `CHARACTERS_SETUP.md` if it ever needs to be redeployed or rescheduled.

## Day to day

- Adding a session, lore entry, or updating logistics: log into the live site and use the forms — no redeploy needed, it reads/writes straight from Supabase.
- Attaching a picture: click into a session or lore text field and paste (Ctrl+V) an image straight from your clipboard — it lands inline, right where the cursor was.
- Changing the site's design or adding pages: edit the files here and `git push` — GitHub Pages redeploys automatically within a minute or two.
- **Cache-busting**: `css/styles.css`, `js/app.js`, `js/config.js` and `js/shops.js` are all referenced with a `?v=1` query string. GitHub Pages caches these for 10 minutes, so browsers can otherwise keep serving an old copy after a change. Whenever one of those files changes, bump the `?v=` number everywhere it's referenced in the same commit (Claude does this automatically when it edits those files) — that's what forces browsers to fetch the new version immediately instead of waiting out the cache.
- No domain yet — you're on the `sejrgitgood.github.io/website/` URL. Ask any time if you want one added later.
- The theme switcher (top right of the nav) is saved per browser via `localStorage`, not in the database — each player picks their own, it doesn't affect anyone else.
