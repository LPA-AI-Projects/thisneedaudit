# The Needs Audit — setup

A learner + trainer web app for the TNA practice series (4 case files +
Workbench), with live sync, badges, and PDF reports.

Data is stored in **Railway PostgreSQL**. The Express app on Railway
creates tables on deploy and serves both the UI and a JSON API.

## Railway setup

### 1. Services

In one Railway project:

1. **PostgreSQL** — add Railway's Postgres plugin/service (you already did this).
2. **Web app** — deploy this GitHub repo (or `railway up`).

### 2. Variables on the web app service

Open the **web app** service → **Variables** and set:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Reference the Postgres service variable `DATABASE_URL` (Variables → Add Reference). Do **not** paste a password into chat. |
| `TRAINER_CODE` | Trainer dashboard access code (e.g. `2468`) |
| `SESSION_SECRET` | Long random string used to sign session cookies |
| `NODE_ENV` | `production` (Railway often sets this for you) |

`PORT` is set automatically by Railway.

### 3. Deploy

Railway runs `npm start`, which:

1. Runs `node db/migrate.js` — creates `learners`, `attempts`, `responses`, `session_control` if missing
2. Starts `node server.js`

After the first successful deploy, open the Postgres service → **Data** (or Query) and you should see those four tables, with one seed row in `session_control`.

### 4. Public domain

Under the web app → **Settings → Networking**, generate a public domain and open it.

## Local development

1. Copy your Railway Postgres public URL into a local env (or use a local Postgres):

   ```powershell
   $env:DATABASE_URL = "postgresql://..."
   $env:TRAINER_CODE = "2468"
   $env:SESSION_SECRET = "local-dev-secret"
   npm install
   npm start
   ```

2. Open http://localhost:3000

## What learners and trainers see

- **Learner**: enters name + email → waits for the trainer to start the session (or clicks "Enter anyway") → works through the 4 case files → gets a badge, marks, and a full right/wrong review → can download a PDF. A Workbench is available for ungraded practice.
- **Trainer**: enters the access code → sees every learner live (name, email, completion, score) → can start/pause the session → Answer Key → learner breakdown → compiled cohort PDF.

## Security notes

- Trainer code is checked **on the server** (`TRAINER_CODE`). It is no longer in public JavaScript.
- Learner and trainer sessions use HTTP-only cookies.
- Learners can only write their own attempts/responses; trainers can read all progress and flip the session switch.

## Notes

- Case content lives in `public/data.js`.
- "Live" dashboard updates use short polling (a few seconds), not websockets.
- If a learner closes the browser mid-case and returns with the same email, their learner row is reused; in-progress cases resume from saved responses.
