# The Needs Audit — setup

A learner + trainer web app for the TNA practice series (4 case files +
Workbench), with live sync, badges, and PDF reports.

Data is stored in **Railway PostgreSQL**. The Express app on Railway
creates tables on deploy and serves both the UI and a JSON API.

## Railway setup

### 1. Services

In one Railway project you need **two** services:

1. **PostgreSQL**
2. **Web app** (this repo)

Seeing host/password under Postgres → **Private Network** is normal. That
screen does **not** wire the web app by itself. You must copy those values
into the **web app** service as Variables (or use Variable References).

### 2. Connect Postgres to the web app (important)

Click your **web app** service (not the Postgres service) → **Variables**.

#### Option A — recommended: Variable Reference

1. Click **+ New Variable** → **Add Reference** (wording may be “Variable Reference”).
2. Choose the **Postgres** service.
3. Select `DATABASE_URL` if it appears.
4. Save and **redeploy** the web app.

If you only see pieces like `PGHOST` / `PGPASSWORD` (no `DATABASE_URL`),
reference **all** of these from Postgres onto the web app:

- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`

The app builds a connection string from those automatically.

#### Option B — manual (from Private Network screen)

On the web app Variables, create:

| Name | Value from Postgres private network |
|------|-------------------------------------|
| `PGHOST` | host (often `*.railway.internal`) |
| `PGPORT` | `5432` |
| `PGUSER` | username (often `postgres`) |
| `PGPASSWORD` | password shown there |
| `PGDATABASE` | database name (often `railway`) |

Do **not** paste passwords into chat.

Also set on the web app:

| Variable | Value |
|----------|--------|
| `TRAINER_CODE` | Trainer access code (e.g. `2468`) |
| `SESSION_SECRET` | Long random string for session cookies |

`PORT` is set by Railway automatically.

### 3. Deploy

Railway runs `npm start`, which:

1. Runs `node db/migrate.js` — creates `learners`, `attempts`, `responses`, `session_control`
2. Starts `node server.js`

After a successful deploy, open Postgres → **Data** (or Query). You should
see those four tables and one seed row in `session_control`.

### 4. Public domain

Web app → **Settings → Networking** → generate a public domain.

## Local development

Private `*.railway.internal` hosts only work **inside Railway**. For your
laptop, use the Postgres **public** URL if you enabled TCP proxy
(`DATABASE_PUBLIC_URL`), or a local Postgres.

```powershell
$env:DATABASE_URL = "postgresql://..."
$env:TRAINER_CODE = "2468"
$env:SESSION_SECRET = "local-dev-secret"
npm install
npm start
```

Open http://localhost:3000

## What learners and trainers see

- **Learner**: name + email → wait for trainer (or Enter anyway) → 4 cases → badge / PDF. Workbench for ungraded practice.
- **Trainer**: access code → live learner list → start/pause session → answer key → student breakdown → cohort PDF.

## Security notes

- Trainer code is checked on the server (`TRAINER_CODE`), not in public JS.
- Sessions use HTTP-only cookies.
- Learners can only write their own attempts/responses.

## Notes

- Case content is in `public/data.js`.
- Dashboard “live” updates use short polling.
- Same email on re-login reuses the learner row.
