# Daggerford-Krøniken — setup

Everything the code needs is written. These are the one-time steps only you can do (account creation and payment aren't things I'm able to do on your behalf).

## 1. Supabase (database + login) — free

1. Go to supabase.com, sign up, click **New project**. Pick any name/region, set a database password (save it somewhere, you likely won't need it again).
2. Once the project is ready, open **SQL Editor → New query**, paste the entire contents of `schema.sql` (in this folder), and click **Run**. This creates the three tables and locks them to logged-in users only.
3. Go to **Authentication → Providers** and confirm **Email** is enabled.
4. Go to **Authentication → Settings** (or "Sign In / Providers" settings depending on the current Supabase UI) and **turn off "Allow new users to sign up"**. This is what keeps the site to just your group — nobody else can create an account.
5. Go to **Authentication → Users → Invite user**, and invite the five email addresses (yours + your four friends'). Each of you will get an email to confirm; after that, logging in on the site (via the magic-link box) will work for that address.
6. Go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key (NOT the service_role key — that one is secret and should never go in this site).

## 2. Fill in the config

Open `js/config.js` and replace the two placeholder values with the ones from step 1.6:

```js
window.SUPABASE_CONFIG = {
  url: "https://xxxxxxxx.supabase.co",
  anonKey: "eyJ..."
};
```

The anon key is meant to be public (it ships in every Supabase frontend) — the real protection is the row-level security policies in `schema.sql` plus the signup lock in step 1.4.

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
