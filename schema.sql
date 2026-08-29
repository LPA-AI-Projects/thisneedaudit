-- ============================================================
-- The Needs Audit — Supabase schema
-- Run this once in your Supabase project's SQL editor.
-- ============================================================

create extension if not exists "pgcrypto";

-- One row per learner login (tied to an anonymous auth session per browser)
create table if not exists learners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- One row per learner per case file (round1..round4, workbench)
create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  case_id text not null,
  status text not null default 'in_progress',   -- in_progress | complete
  score numeric,
  max_score numeric,
  badge text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (learner_id, case_id)
);

-- One row per graded judgement inside an attempt (used for the trainer's
-- right/wrong breakdown and the Answer Key view)
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  phase text not null,              -- phase1 | phase2 | phase3
  item_id text not null,
  item_label text,
  learner_choice text,
  correct_choice text,
  is_correct boolean,
  points_earned numeric,
  points_possible numeric,
  explain_text text,
  created_at timestamptz not null default now()
);

-- Single-row switch the trainer uses to release learners from the waiting page
create table if not exists session_control (
  id int primary key default 1,
  is_live boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into session_control (id, is_live) values (1, false)
  on conflict (id) do nothing;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table learners enable row level security;
alter table attempts enable row level security;
alter table responses enable row level security;
alter table session_control enable row level security;

-- Learners can fully manage only their own row (matched by their
-- anonymous-auth uid), so one learner's browser cannot alter another's data.
create policy "learners manage own row" on learners
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "learners manage own attempts" on attempts
  for all
  using (learner_id in (select id from learners where user_id = auth.uid()))
  with check (learner_id in (select id from learners where user_id = auth.uid()));

create policy "learners manage own responses" on responses
  for all
  using (attempt_id in (
    select a.id from attempts a join learners l on l.id = a.learner_id
    where l.user_id = auth.uid()
  ))
  with check (attempt_id in (
    select a.id from attempts a join learners l on l.id = a.learner_id
    where l.user_id = auth.uid()
  ));

-- Trainer dashboard: read access for anyone holding the anon key. The
-- trainer login screen gates this in the UI with the access code, but this
-- is a convenience gate, not a hard security boundary — see README.md
-- "Hardening the trainer login" for how to lock this down further.
create policy "read all learners" on learners for select using (true);
create policy "read all attempts" on attempts for select using (true);
create policy "read all responses" on responses for select using (true);

-- Anyone can read the session switch; only an authenticated session can
-- flip it (tighten this further if you add real trainer accounts).
create policy "read session control" on session_control for select using (true);
create policy "update session control" on session_control for update using (true);

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table learners, attempts, responses, session_control;
