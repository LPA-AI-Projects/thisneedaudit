-- ============================================================
-- The Needs Audit — Railway PostgreSQL schema
-- Idempotent: safe to run on every deploy.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- One row per learner (matched by email on re-login)
CREATE TABLE IF NOT EXISTS learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);

-- One row per learner per case file (round1..round4, workbench)
CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  case_id text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',   -- in_progress | complete
  score numeric,
  max_score numeric,
  badge text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, case_id)
);

-- One row per graded judgement inside an attempt
CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  phase text NOT NULL,              -- phase1 | phase2 | phase3
  item_id text NOT NULL,
  item_label text,
  learner_choice text,
  correct_choice text,
  is_correct boolean,
  points_earned numeric,
  points_possible numeric,
  explain_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Single-row switch the trainer uses to release learners from the waiting page
CREATE TABLE IF NOT EXISTS session_control (
  id int PRIMARY KEY DEFAULT 1,
  is_live boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO session_control (id, is_live) VALUES (1, false)
  ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_attempts_learner_id ON attempts(learner_id);
CREATE INDEX IF NOT EXISTS idx_responses_attempt_id ON responses(attempt_id);
