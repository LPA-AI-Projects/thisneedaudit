"use strict";

const express = require("express");
const path = require("path");
const cookieSession = require("cookie-session");
const { getPool } = require("./db/pool");

const app = express();
const PORT = process.env.PORT || 3000;
const TRAINER_CODE = process.env.TRAINER_CODE || "2468";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-me-in-railway";
const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT);

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(
  cookieSession({
    name: "tna_session",
    keys: [SESSION_SECRET],
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
  })
);

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function requireLearner(req, res, next) {
  if (!req.session || req.session.role !== "learner" || !req.session.learnerId) {
    return res.status(401).json({ error: "Learner login required" });
  }
  next();
}

function requireTrainer(req, res, next) {
  if (!req.session || req.session.role !== "trainer") {
    return res.status(401).json({ error: "Trainer login required" });
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.role) {
    return res.status(401).json({ error: "Login required" });
  }
  next();
}

async function assertAttemptOwnedByLearner(client, attemptId, learnerId) {
  const res = await client.query(
    "SELECT id, learner_id FROM attempts WHERE id = $1",
    [attemptId]
  );
  if (!res.rows[0]) {
    const err = new Error("Attempt not found");
    err.status = 404;
    throw err;
  }
  if (res.rows[0].learner_id !== learnerId) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  return res.rows[0];
}

/* ============================================================
   AUTH
   ============================================================ */

app.post(
  "/api/learner/login",
  asyncHandler(async (req, res) => {
    const name = String((req.body && req.body.name) || "").trim();
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    if (!name || !email || email.indexOf("@") === -1) {
      return res.status(400).json({ error: "Name and valid email are required" });
    }

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO learners (name, email)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, email, created_at`,
      [name, email]
    );

    const learner = result.rows[0];
    req.session = { role: "learner", learnerId: learner.id };
    res.json(learner);
  })
);

app.post(
  "/api/trainer/login",
  asyncHandler(async (req, res) => {
    const code = String((req.body && req.body.code) || "").trim();
    if (code !== TRAINER_CODE) {
      return res.status(401).json({ error: "Incorrect code" });
    }
    req.session = { role: "trainer" };
    res.json({ ok: true });
  })
);

app.post("/api/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  if (!req.session || !req.session.role) {
    return res.json({ role: null });
  }
  res.json({
    role: req.session.role,
    learnerId: req.session.learnerId || null,
  });
});

/* ============================================================
   SESSION CONTROL
   ============================================================ */

app.get(
  "/api/session/live",
  requireAuth,
  asyncHandler(async (req, res) => {
    const pool = getPool();
    const result = await pool.query(
      "SELECT is_live FROM session_control WHERE id = 1"
    );
    res.json({ is_live: !!(result.rows[0] && result.rows[0].is_live) });
  })
);

app.post(
  "/api/session/live",
  requireTrainer,
  asyncHandler(async (req, res) => {
    const isLive = !!(req.body && req.body.is_live);
    const pool = getPool();
    await pool.query(
      "UPDATE session_control SET is_live = $1, updated_at = now() WHERE id = 1",
      [isLive]
    );
    res.json({ is_live: isLive });
  })
);

/* ============================================================
   ATTEMPTS + RESPONSES
   ============================================================ */

app.post(
  "/api/attempts/start",
  requireLearner,
  asyncHandler(async (req, res) => {
    const caseId = String((req.body && req.body.caseId) || "").trim();
    const maxScore =
      req.body && req.body.maxScore != null ? req.body.maxScore : null;
    if (!caseId) return res.status(400).json({ error: "caseId is required" });

    const learnerId = req.session.learnerId;
    const pool = getPool();

    const existing = await pool.query(
      "SELECT * FROM attempts WHERE learner_id = $1 AND case_id = $2",
      [learnerId, caseId]
    );
    if (existing.rows[0]) return res.json(existing.rows[0]);

    const inserted = await pool.query(
      `INSERT INTO attempts (learner_id, case_id, status, max_score)
       VALUES ($1, $2, 'in_progress', $3)
       RETURNING *`,
      [learnerId, caseId, maxScore]
    );
    res.json(inserted.rows[0]);
  })
);

app.post(
  "/api/responses",
  requireLearner,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const attemptId = body.attempt_id || body.attemptId;
    if (!attemptId) return res.status(400).json({ error: "attempt_id is required" });

    const pool = getPool();
    const client = await pool.connect();
    try {
      await assertAttemptOwnedByLearner(client, attemptId, req.session.learnerId);
      const inserted = await client.query(
        `INSERT INTO responses (
           attempt_id, phase, item_id, item_label, learner_choice,
           correct_choice, is_correct, points_earned, points_possible, explain_text
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          attemptId,
          body.phase,
          body.item_id,
          body.item_label || null,
          body.learner_choice || null,
          body.correct_choice || null,
          body.is_correct == null ? null : !!body.is_correct,
          body.points_earned == null ? null : body.points_earned,
          body.points_possible == null ? null : body.points_possible,
          body.explain_text || null,
        ]
      );
      res.json(inserted.rows[0]);
    } finally {
      client.release();
    }
  })
);

app.post(
  "/api/attempts/:id/reset",
  requireLearner,
  asyncHandler(async (req, res) => {
    const attemptId = req.params.id;
    const pool = getPool();
    const client = await pool.connect();
    try {
      await assertAttemptOwnedByLearner(client, attemptId, req.session.learnerId);
      await client.query("DELETE FROM responses WHERE attempt_id = $1", [attemptId]);
      await client.query(
        `UPDATE attempts
         SET status = 'in_progress', score = NULL, badge = NULL,
             completed_at = NULL, updated_at = now()
         WHERE id = $1`,
        [attemptId]
      );
      res.json({ ok: true });
    } finally {
      client.release();
    }
  })
);

app.post(
  "/api/attempts/:id/complete",
  requireLearner,
  asyncHandler(async (req, res) => {
    const attemptId = req.params.id;
    const body = req.body || {};
    const pool = getPool();
    const client = await pool.connect();
    try {
      await assertAttemptOwnedByLearner(client, attemptId, req.session.learnerId);
      const updated = await client.query(
        `UPDATE attempts
         SET status = 'complete', score = $2, max_score = $3, badge = $4,
             completed_at = now(), updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          attemptId,
          body.score == null ? null : body.score,
          body.maxScore == null ? null : body.maxScore,
          body.badge || null,
        ]
      );
      res.json(updated.rows[0]);
    } finally {
      client.release();
    }
  })
);

/* ============================================================
   TRAINER / LEARNER READS
   ============================================================ */

app.get(
  "/api/learners",
  requireTrainer,
  asyncHandler(async (req, res) => {
    const pool = getPool();
    const result = await pool.query(
      `SELECT
         l.id, l.name, l.email, l.created_at,
         COALESCE(
           json_agg(
             json_build_object(
               'case_id', a.case_id,
               'status', a.status,
               'score', a.score,
               'max_score', a.max_score,
               'badge', a.badge,
               'completed_at', a.completed_at,
               'updated_at', a.updated_at
             )
             ORDER BY a.started_at
           ) FILTER (WHERE a.id IS NOT NULL),
           '[]'
         ) AS attempts
       FROM learners l
       LEFT JOIN attempts a ON a.learner_id = l.id
       GROUP BY l.id
       ORDER BY l.created_at ASC`
    );
    res.json(result.rows);
  })
);

app.get(
  "/api/learners/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const learnerId = req.params.id;
    if (req.session.role === "learner" && req.session.learnerId !== learnerId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const pool = getPool();
    const learnerRes = await pool.query(
      "SELECT id, name, email FROM learners WHERE id = $1",
      [learnerId]
    );
    if (!learnerRes.rows[0]) return res.status(404).json({ error: "Not found" });

    const attemptsRes = await pool.query(
      `SELECT
         a.id, a.case_id, a.status, a.score, a.max_score, a.badge, a.completed_at,
         COALESCE(
           json_agg(
             json_build_object(
               'id', r.id,
               'phase', r.phase,
               'item_id', r.item_id,
               'item_label', r.item_label,
               'learner_choice', r.learner_choice,
               'correct_choice', r.correct_choice,
               'is_correct', r.is_correct,
               'points_earned', r.points_earned,
               'points_possible', r.points_possible,
               'explain_text', r.explain_text,
               'created_at', r.created_at
             )
             ORDER BY r.created_at
           ) FILTER (WHERE r.id IS NOT NULL),
           '[]'
         ) AS responses
       FROM attempts a
       LEFT JOIN responses r ON r.attempt_id = a.id
       WHERE a.learner_id = $1
       GROUP BY a.id
       ORDER BY a.started_at`,
      [learnerId]
    );

    res.json({
      learner: learnerRes.rows[0],
      attempts: attemptsRes.rows,
    });
  })
);

/* ============================================================
   HEALTH
   ============================================================ */

app.get(
  "/health",
  asyncHandler(async (req, res) => {
    try {
      const pool = getPool();
      await pool.query("SELECT 1");

      const tablesRes = await pool.query(
        `SELECT c.relname AS name, COALESCE(s.n_live_tup, 0)::bigint AS approx_rows
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
         WHERE n.nspname = 'public'
           AND c.relkind = 'r'
           AND c.relname = ANY($1::text[])`,
        [["learners", "attempts", "responses", "session_control"]]
      );

      const tables = {};
      const required = ["learners", "attempts", "responses", "session_control"];
      required.forEach(function (name) {
        tables[name] = null;
      });
      tablesRes.rows.forEach(function (row) {
        tables[row.name] = Number(row.approx_rows);
      });

      const missing = required.filter(function (name) {
        return tables[name] === null;
      });
      if (missing.length) {
        return res.status(503).json({
          ok: false,
          db: "up",
          error: "Missing tables: " + missing.join(", "),
          tables: tables,
        });
      }

      res.json({ ok: true, db: "up", tables: tables });
    } catch (err) {
      res.status(503).json({
        ok: false,
        db: "down",
        error: err.message || "Database unreachable",
      });
    }
  })
);

/* ============================================================
   STATIC + ERRORS
   ============================================================ */

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || "Server error" });
});

async function start() {
  // Fail fast if DATABASE_URL missing
  getPool();
  app.listen(PORT, () => {
    console.log(`The Needs Audit listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
