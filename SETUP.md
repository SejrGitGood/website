# Blessings of Valkyriegade — setup

Live and working: Supabase project, shared login, public repo, GitHub Pages. One new thing to run:

## Enable image pasting

`schema.sql` now adds an `images` column to sessions/lore, plus a public `photos` storage bucket that only the shared account can upload to. Paste the current `schema.sql` into Supabase's **SQL Editor** and run it — safe to run again on top of what's already there.

That's it — after that, pasting an image (Ctrl+V) directly into a session or lore text field on the live site uploads it and attaches it to that entry.

## Day to day

- Adding a session, lore entry, or updating logistics: log into the live site and use the forms — no redeploy needed, it reads/writes straight from Supabase.
- Attaching a picture: click into the session/lore text field you're editing and paste (Ctrl+V) an image straight from your clipboard. A small "×" on each thumbnail removes it before saving.
- Changing the site's design or adding pages: edit the files here and `git push` — GitHub Pages redeploys automatically within a minute or two.
- No domain yet — you're on the `sejrgitgood.github.io/website/` URL. Ask any time if you want one added later.
