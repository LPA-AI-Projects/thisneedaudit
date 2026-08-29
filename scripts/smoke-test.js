"use strict";

/**
 * End-to-end API smoke test against a running server + Postgres.
 * Usage: node scripts/smoke-test.js [baseUrl]
 */

const BASE = process.argv[2] || "http://127.0.0.1:3000";

function parseSetCookie(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (raw && raw.length) return raw.map((c) => c.split(";")[0]).join("; ");
  const single = res.headers.get("set-cookie");
  return single ? single.split(",")[0].split(";")[0] : "";
}

async function req(path, { method = "GET", body, cookie } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  const setCookie = parseSetCookie(res);
  return { status: res.status, data, setCookie };
}

async function main() {
  const email = "smoke-" + Date.now() + "@example.com";
  let cookie = "";

  // Unauthorized session read should 401
  let r = await req("/api/session/live");
  if (r.status !== 401) throw new Error("Expected 401 without session, got " + r.status);

  // Learner login
  r = await req("/api/learner/login", {
    method: "POST",
    body: { name: "Smoke Tester", email },
  });
  if (r.status !== 200 || !r.data.id) throw new Error("Learner login failed: " + JSON.stringify(r));
  cookie = r.setCookie || cookie;
  const learnerId = r.data.id;
  console.log("OK learner login", learnerId);

  // Session live
  r = await req("/api/session/live", { cookie });
  if (r.status !== 200) throw new Error("get session failed");
  console.log("OK session live =", r.data.is_live);

  // Start attempt
  r = await req("/api/attempts/start", {
    method: "POST",
    body: { caseId: "round1", maxScore: 10 },
    cookie,
  });
  if (r.status !== 200 || !r.data.id) throw new Error("startAttempt failed");
  const attemptId = r.data.id;
  console.log("OK start attempt", attemptId);

  // Save response
  r = await req("/api/responses", {
    method: "POST",
    body: {
      attempt_id: attemptId,
      phase: "phase1",
      item_id: "e1",
      item_label: "test",
      learner_choice: "skill",
      correct_choice: "skill",
      is_correct: true,
      points_earned: 1,
      points_possible: 1,
      explain_text: "ok",
    },
    cookie,
  });
  if (r.status !== 200) throw new Error("saveResponse failed: " + JSON.stringify(r));
  console.log("OK save response");

  // Complete
  r = await req("/api/attempts/" + attemptId + "/complete", {
    method: "POST",
    body: { score: 1, maxScore: 10, badge: "Field Trainee" },
    cookie,
  });
  if (r.status !== 200 || r.data.status !== "complete") throw new Error("complete failed");
  console.log("OK complete attempt");

  // Learner cannot list all learners
  r = await req("/api/learners", { cookie });
  if (r.status !== 401) throw new Error("Learner should not list all learners");
  console.log("OK learner blocked from /api/learners");

  // Trainer wrong code
  r = await req("/api/trainer/login", { method: "POST", body: { code: "wrong" } });
  if (r.status !== 401) throw new Error("Bad trainer code should 401");
  console.log("OK bad trainer code rejected");

  // Trainer login
  r = await req("/api/trainer/login", {
    method: "POST",
    body: { code: process.env.TRAINER_CODE || "2468" },
  });
  if (r.status !== 200) throw new Error("Trainer login failed");
  const trainerCookie = r.setCookie;
  console.log("OK trainer login");

  r = await req("/api/learners", { cookie: trainerCookie });
  if (r.status !== 200 || !Array.isArray(r.data)) throw new Error("Trainer list failed");
  if (!r.data.find((l) => l.id === learnerId)) throw new Error("Learner missing from dashboard");
  console.log("OK trainer sees learner");

  r = await req("/api/session/live", {
    method: "POST",
    body: { is_live: true },
    cookie: trainerCookie,
  });
  if (r.status !== 200 || r.data.is_live !== true) throw new Error("set live failed");
  console.log("OK trainer set session live");

  r = await req("/api/learners/" + learnerId, { cookie: trainerCookie });
  if (r.status !== 200 || !r.data.attempts || !r.data.attempts.length) {
    throw new Error("trainer student detail failed");
  }
  console.log("OK student detail with responses");

  console.log("\nAll smoke checks passed.");
}

main().catch((err) => {
  console.error("SMOKE FAILED:", err.message);
  process.exit(1);
});
