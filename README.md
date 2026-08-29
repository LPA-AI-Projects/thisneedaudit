# The Needs Audit — setup

A learner + trainer web app for the TNA practice series (4 case files +
Workbench), with live sync, badges, and PDF reports.

Runs today with **zero setup** in local preview mode (one browser, no
cross-device sync) so you can look at it immediately. To get real live
sync across devices, do the two steps below.

## 1. Supabase (data + live sync)

1. Create a project at supabase.com (or reuse one).
2. Open the SQL editor and run the entire contents of `schema.sql`.
3. Go to **Authentication → Providers** and enable **Anonymous Sign-Ins**.
   (This is how each learner's browser gets a private identity without
   registering — no email/password for them to manage.)
4. Go to **Project Settings → API** and copy the **Project URL** and the
   **anon public** key.
5. Open `public/config.js` and paste them in:
   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: "https://xxxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJ...",
     TRAINER_CODE: "2468"
   };
   ```
   Change `TRAINER_CODE` to whatever you want the trainer access code to
   be. Leaving `SUPABASE_URL`/`SUPABASE_ANON_KEY` as the placeholder
   text keeps the app in local preview mode.

## 2. Deploy to Railway

1. Push this folder to a GitHub repo (or `railway up` directly from here).
2. In Railway: New Project → Deploy from repo (or CLI).
3. Railway auto-detects Node from `package.json` and runs `npm start`.
4. Generate a public domain under Settings → Networking.
5. That's it — open the domain, and you're live.

No environment variables are required on Railway itself; the Supabase
values live in `public/config.js` because this is a static frontend
talking directly to Supabase from the browser.

## What learners and trainers see

- **Learner**: enters name + email (no account) → waits for the trainer
  to start the session (or clicks "Enter anyway") → works through the
  4 case files in order → gets a badge, marks, and a full right/wrong
  review after each one → can download a PDF of that case. A
  Workbench is available for ungraded practice on their own evidence.
- **Trainer**: enters the access code → sees every learner live (name,
  email, completion, score) → can start/pause the session → can open
  the Answer Key (every correct answer, for reference) → can open any
  learner's full right/wrong breakdown → can download one compiled
  PDF report for the whole cohort.

## Hardening the trainer login

Right now the trainer code is a **UI convenience gate, not a hard
security boundary**. Under the hood, the trainer dashboard reads data
using the same public `anon` key every learner's browser uses, with
Supabase Row Level Security policies that allow anyone holding that
key to `SELECT` (read) all learner/attempt/response rows — that's
what lets the dashboard work without a separate trainer account. It
means someone who opens the browser dev tools and reads the deployed
JavaScript could technically query the same read-only data directly,
bypassing the code prompt. Learner data itself is protected by real
per-user isolation (each learner signs in anonymously via Supabase
Auth and can only write their own rows) — it's specifically the
trainer's *read* access that's convenience-gated rather than hardened.

If that matters for how this gets used (e.g. scores need to stay
confidential between cohorts), the clean upgrade path is:

1. Create one real Supabase Auth account for the trainer (email +
   password, via the Supabase dashboard).
2. Replace the three `"read all ..."` policies in `schema.sql` with
   policies that check `auth.uid()` against that specific account
   (or a small `trainers` allow-list table).
3. Change the trainer login screen to authenticate with that account
   instead of just comparing a string client-side.

Happy to build that hardened version if you want it — it's a
contained change, not a rebuild.

## Notes

- All 4 case files and their answer keys are in `public/data.js` — this
  is the same validated content from the single-file build, so scores
  and the answer key will match what's already been reviewed.
- If a learner's browser is closed mid-case and reopened, completed
  cases resume showing the full brief; in-progress cases resume at the
  right phase (not exact mid-phase card selection).
- The Workbench is intentionally ungraded (no answer key exists for a
  learner's own evidence), so it syncs completion status but not a
  score.
