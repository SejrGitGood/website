# Daggerford-Krøniken — setup

Where things stand: Supabase project created, `schema.sql` run once, `js/config.js` filled in, code pushed to GitHub (`SejrGitGood/website`, currently **private**). What's left:

## 1. Switch to one shared login

Instead of each of you logging in separately, everyone uses the same email+password.

1. In Supabase: **Authentication → Users → Add user**. Enter an email — it doesn't need to be real or receive mail, e.g. `gruppe@daggerford.local` — and a password you'll all share. **Tick "Auto Confirm User"** so it's usable immediately with no verification email.
2. If you used a different email than `gruppe@daggerford.local`, update it in two places to match exactly:
   - `js/config.js` → `sharedEmail`
   - `schema.sql` → the `insert into allowed_users` line
3. Paste the current `schema.sql` (in this folder) into the SQL Editor and run it — it's written to be safe to run again even if you already ran an earlier version, and it'll set `allowed_users` to just the one email above.
4. Commit and push the `js/config.js` change (and `schema.sql` if you edited the email there too).

Share the password with the group however you'd share anything else — group chat, whatever. Nobody needs their own account anymore.

## 2. Make the repo public, turn on Pages

GitHub Pages needs a public repo on the free plan.

1. Repo → **Settings → General → Danger Zone → Change visibility → Public**.
   - This exposes the site's code and the three static Session 1 pages to anyone with the exact link (not indexed or listed anywhere). The actual session/lore/logistics data stays private — it lives in Supabase, gated by the login above.
   - Keep real secrets out of what's committed: `schema.sql` in the repo should only ever contain the one shared/fake-looking login email, never anything sensitive.
2. **Settings → Pages** → Source: **Deploy from a branch** → Branch **master**, folder **/ (root)** → Save.
3. After a minute, open the URL GitHub gives you (`https://sejrgitgood.github.io/website/`). You should land on the login page; log in with the shared password from step 1.

That's it — no domain needed for now. If you want one later, just ask and I'll walk through pointing it at this same GitHub Pages site.

## Day to day

- Adding a session, lore entry, or updating logistics: log into the live site and use the forms — no redeploy needed, it reads/writes straight from Supabase.
- Changing the site's design or adding pages: edit the files here and `git push` — GitHub Pages redeploys automatically within a minute or two.
