# Karakterer: automatisk opdatering fra D&D Beyond

This needs one deploy step that can't be done through the Supabase SQL editor — it's a real backend function. Everything below is safe to have in the public repo; the one secret involved (your service_role key) is never written to any file here — see the last section.

## 1. Install the Supabase CLI

Pick one:
```bash
npm install -g supabase
```
or (Windows, via Scoop):
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```
Full options: https://supabase.com/docs/guides/cli/getting-started

## 2. Log in and link this project

From the `website` folder:
```bash
supabase login
```
(opens a browser window — log into the same Supabase account the project is under)

```bash
supabase link --project-ref YOUR_PROJECT_REF
```
Find `YOUR_PROJECT_REF` in the Supabase dashboard: **Project Settings → General → Reference ID** (also visible in your project's URL).

## 3. Deploy the function

```bash
supabase functions deploy refresh-characters
```

That's it for the deploy — the function now exists at:
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/refresh-characters`

The "Opdater nu" button on the Karakterer page already calls it by name, so it'll work as soon as this deploy finishes — no other file needs to change.

## 4. Schedule it to run automatically (the one step with a secret)

This part needs your **service_role** key (Project Settings → API → service_role secret — NOT the publishable/anon key used elsewhere on the site). This key has full database access, so:

- **Never** paste it into any file in this repo.
- Only paste it directly into Supabase's own SQL Editor, run it once, then close/discard it.

In the SQL Editor, run (replacing both placeholders):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'refresh-characters-nightly',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/refresh-characters',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

This runs every night at 03:00 UTC and refreshes every character's data automatically — no one needs to click anything. The "Opdater nu" button still works any time for an on-demand refresh.

To change the schedule later, or stop it:
```sql
select cron.unschedule('refresh-characters-nightly');
```
