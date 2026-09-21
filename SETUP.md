# Daggerford-Krøniken — setup

Everything the code needs is written. These are the one-time steps only you can do (account creation and payment aren't things I'm able to do on your behalf).

## 1. Supabase (database + login) — free

1. Go to supabase.com, sign up, click **New project**. Pick any name/region, set a database password (save it somewhere, you likely won't need it again).
2. Open `schema.sql` (in this folder) and edit the five placeholder emails near the top (`spiller1@eksempel.dk` etc.) to your and your four friends' real addresses. This list is what locks the site to just your group — nobody else can read or write anything, even if they somehow get a login link.
3. In Supabase, open **SQL Editor → New query**, paste the edited file, and click **Run**.
4. Confirm **Email** sign-in is on: look under **Authentication** in the left sidebar for a "Providers" or "Sign In / Providers" page and check Email is enabled (it's on by default on a new project, so this is usually already done).
5. Go to **Project Settings → API Keys** (Supabase renamed this from plain "API" — if you only see "API", that's the same page). Copy the **Project URL** and the **publishable key** (starts with `sb_publishable_...`; if your project instead shows a legacy **anon public** key starting with `eyJ...`, that works exactly the same way — use whichever one is there).

You do *not* need to find any "invite user" or "disable signups" screen — the email allow-list in `schema.sql` does that job instead, and it's easy to edit later (see the bottom of that file).

## 2. Fill in the config

Open `js/config.js` and replace the two placeholder values with the ones from step 1.5:

```js
window.SUPABASE_CONFIG = {
  url: "https://xxxxxxxx.supabase.co",
  anonKey: "sb_publishable_..."   // or the eyJ... anon key, either works
};
```

This key is meant to be public (it ships in every Supabase frontend) — the real protection is the row-level security policies in `schema.sql`, which check the logged-in user's email against your `allowed_users` list.

## 3. Put it on GitHub

From this `website` folder:

```bash
git init
git add .
git commit -m "Daggerford-Krøniken v1"
```

Then create a new **empty** repository on github.com (no README/license — just an empty repo), and push:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

## 4. Turn on GitHub Pages

1. In the repo on GitHub: **Settings → Pages**.
2. Under "Build and deployment", set **Source: Deploy from a branch**, branch **main**, folder **/ (root)**. Save.
3. After a minute, GitHub gives you a URL like `https://<your-username>.github.io/<repo-name>/`. Open it and confirm the login page loads.

## 5. Point your domain at it

1. Buy the domain wherever you like (Cloudflare Registrar, Namecheap, Porkbun — all fine, all cheap).
2. Back in **Settings → Pages** on GitHub, under "Custom domain", enter your domain (e.g. `daggerford.dk` or `www.daggerford.dk`) and save. GitHub will add a `CNAME` file to the repo automatically.
3. At your domain registrar's DNS settings, add the records GitHub Pages asks for — typically:
   - If using the root domain (`daggerford.dk`): four **A** records pointing at GitHub's IPs (GitHub's docs page, linked from the Pages settings screen, lists the current IPs).
   - If using a subdomain (`www.daggerford.dk`): one **CNAME** record pointing at `<your-username>.github.io`.
4. Back in GitHub Pages settings, tick **Enforce HTTPS** once it becomes available (can take up to ~24h after DNS propagates).

## Day to day

- Adding a session, lore entry, or updating logistics: just log into the live site and use the forms — no redeploy needed, it all reads/writes straight from Supabase.
- Changing the site's design or adding new pages: edit the files here and `git push` — GitHub Pages redeploys automatically within a minute or two.
