"use strict";

/* ============================================================
   HELPERS
   ============================================================ */
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
function labelForChoice(choice) { return { knowledge: "Knowledge Gap", skill: "Skill Gap", attitude: "Attitude Gap", "not-training": "Not a Training Problem" }[choice] || choice; }

var LOGO_DATA_URL = null;
(function preloadLogo() {
  var img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = function () {
    try {
      var c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      LOGO_DATA_URL = c.toDataURL("image/png");
    } catch (e) { LOGO_DATA_URL = null; }
  };
  img.src = "/logo-dark.png";
})();

/* ============================================================
   BADGES
   ============================================================ */
function getBadge(scorePct) {
  if (scorePct >= 90) return { tier: "gold", icon: "\uD83C\uDFC6", label: "Master Analyst", remark: "Outstanding \u2014 your calls matched the evidence almost every time. You're ready to run a real TNA with minimal supervision." };
  if (scorePct >= 75) return { tier: "teal", icon: "\uD83E\uDD48", label: "Sharp Investigator", remark: "Strong work \u2014 you caught most of the traps. Revisit anything you missed before applying this on real data." };
  if (scorePct >= 60) return { tier: "blue", icon: "\uD83E\uDD49", label: "Solid Diagnostician", remark: "A solid pass \u2014 the core method is landing. Slow down on the \u201cnot a training problem\u201d calls, that's where most of the gap tends to be." };
  return { tier: "orange", icon: "\uD83D\uDD0D", label: "Field Trainee", remark: "You've got the shape of the method. Re-run this case and read the explanations closely on what you missed \u2014 that's exactly what they're there for." };
}

/* ============================================================
   STATE
   ============================================================ */
var STATE = {
  screen: "boot",             // boot | landing | waiting | field-office | round | workbench | trainer-dashboard | trainer-answerkey | trainer-student
  role: null,                 // 'learner' | 'trainer'
  learner: null,               // {id, name, email}
  loginError: "",
  trainerError: "",
  sessionLive: false,
  unsubSession: null,
  roundState: {},
  currentRound: null,
  workbench: { phase: "intro", budget: 40, cards: [], nextCardNum: 1, activeCardId: null, modalStep: "choose", pendingChoice: null, pendingDept: null, reported: false, attemptId: null },
  trainer: { learners: [], unsub: null, selectedLearnerId: null, selectedDetail: null, startingSession: false }
};

function getRoundState(roundId) {
  if (!STATE.roundState[roundId]) {
    STATE.roundState[roundId] = {
      phase: "intro", phase1: {}, phase2: {}, phase3: {}, phase3Submitted: false,
      reported: false, score: 0, maxScore: 0, activeCardId: null, activeNeedId: null,
      modalStep: "choose", pendingDept: null, attemptId: null,
      challengeIdx: null, challengeRevealed: false, challengeAnswer: ""
    };
  }
  return STATE.roundState[roundId];
}
function roundStatus(roundId) {
  var rs = STATE.roundState[roundId];
  if (!rs) return "not-started";
  if (rs.phase3Submitted) return "complete";
  if (Object.keys(rs.phase1).length > 0) return "in-progress";
  return "not-started";
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function goto(screen) { STATE.screen = screen; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }

/* ============================================================
   RENDER: LANDING (dual login)
   ============================================================ */
function renderLanding() {
  return '\
  <div class="login-shell">\
    <div class="login-hero">\
      <img src="/logo-dark.png" alt="Learners Point" class="login-logo">\
      <h1 class="login-title">The Needs Audit</h1>\
      <p class="login-sub">A hands-on Training Needs Analysis practice series</p>\
    </div>\
    <div class="login-cards">\
      <div class="login-card">\
        <p class="login-card-eyebrow">Learner</p>\
        <h2 class="login-card-title">Jump in</h2>\
        <p class="login-card-note">Just your name and email \u2014 no account, no registration.</p>\
        <div class="field"><label for="ln-name">Full name</label><input id="ln-name" type="text" placeholder="e.g. Aisha Khan" maxlength="80"></div>\
        <div class="field"><label for="ln-email">Email</label><input id="ln-email" type="email" placeholder="you@company.com" maxlength="120"></div>\
        ' + (STATE.loginError ? '<div class="field-error">' + esc(STATE.loginError) + "</div>" : "") + '\
        <button class="btn btn-primary btn-block" id="learner-login-btn">Start Practicing \u2192</button>\
      </div>\
      <div class="login-card login-card-trainer">\
        <p class="login-card-eyebrow">Trainer / Admin</p>\
        <h2 class="login-card-title">Dashboard access</h2>\
        <p class="login-card-note">Enter the access code to open the live dashboard.</p>\
        <div class="field"><label for="tr-code">Access code</label><input id="tr-code" type="password" placeholder="\u2022\u2022\u2022\u2022" maxlength="20"></div>\
        ' + (STATE.trainerError ? '<div class="field-error">' + esc(STATE.trainerError) + "</div>" : "") + '\
        <button class="btn btn-dark btn-block" id="trainer-login-btn">Enter Dashboard \u2192</button>\
      </div>\
    </div>\
  </div>';
}

/* ============================================================
   RENDER: WAITING ROOM
   ============================================================ */
function renderWaiting() {
  return '\
  <div class="waiting-shell">\
    <img src="/logo-dark.png" alt="Learners Point" class="waiting-logo">\
    <div class="waiting-pulse" aria-hidden="true"></div>\
    <h1 class="waiting-title">You\'re in, ' + esc((STATE.learner && STATE.learner.name) || "") + '.</h1>\
    <p class="waiting-sub">Sit tight \u2014 your trainer will start the session shortly.</p>\
    <button class="btn btn-secondary" id="enter-anyway-btn">Enter anyway \u2192</button>\
  </div>';
}

/* ============================================================
   RENDER: FIELD OFFICE (hub)
   ============================================================ */
function renderFieldOffice() {
  var tiles = ROUND_ORDER.map(function (id) {
    var round = ROUNDS[id];
    var status = roundStatus(id);
    var rstate = STATE.roundState[id];
    var badgeHtml = status === "complete" ? '<span class="chip chip-complete">' + getBadge(pct(rstate.score, rstate.maxScore)).icon + " " + pct(rstate.score, rstate.maxScore) + "%</span>" :
      (status === "in-progress" ? '<span class="chip chip-progress">In Progress</span>' : '<span class="chip chip-idle">Not Started</span>');
    var cta = status === "not-started" ? "Open Case \u2192" : (status === "in-progress" ? "Continue \u2192" : "Review Brief \u2192");
    return '\
    <div class="case-tile-g">\
      <div class="case-tile-top"><span class="industry-tag-g">' + esc(round.industry) + " \u00b7 Case " + esc(round.caseNo) + (round.isFinalCase ? " \u00b7 FINAL" : "") + '</span>' + badgeHtml + '</div>\
      <h3>' + esc(round.company) + '</h3>\
      <div class="case-tile-loc">' + esc(round.location) + '</div>\
      <button class="btn btn-primary btn-block" data-open-round="' + id + '">' + cta + "</button>\
    </div>";
  }).join("");

  return '\
  <div class="hub-shell">\
    <div class="hub-header">\
      <div><p class="eyebrow-g">Field Office</p><h1 class="page-title-g">Welcome, ' + esc(STATE.learner.name) + '</h1></div>\
      <button class="btn btn-ghost" id="logout-btn">Log out</button>\
    </div>\
    <p class="hub-lede-g">Four cases, one method: triage the evidence, map the level, prioritise the budget, defend the brief.</p>\
    <div class="hub-grid-g">' + tiles + '</div>\
    <button class="btn btn-secondary btn-block" style="margin-top:18px;" id="open-workbench-btn">Open Your Workbench (bring your own evidence) \u2192</button>\
  </div>';
}

/* ============================================================
   ROUND ENGINE (adapted from the validated single-file build)
   ============================================================ */
function phase1CompleteR(round, rstate) { return round.evidence.every(function (e) { return rstate.phase1[e.id]; }); }
function phase2CompleteR(round, rstate) { return round.needs.every(function (n) { return rstate.phase2[n.id]; }); }
function usedBudgetR(rstate) { return Object.keys(rstate.phase3).reduce(function (s, k) { return s + (rstate.phase3[k] || 0); }, 0); }
function lvlColor(level) { return { organizational: "var(--teal)", task: "var(--blue)", person: "var(--orange)" }[level]; }

function renderRoundTabs(round, rstate) {
  var p1done = phase1CompleteR(round, rstate), p2done = phase2CompleteR(round, rstate);
  var html = '<button class="rtab back" data-home="1">\u2190 Field Office</button>';
  TAB_META.forEach(function (t, i) {
    var unlocked = t.key === "phase1" || (t.key === "phase2" && p1done) || (t.key === "phase3" && p2done) || (t.key === "phase4" && rstate.phase3Submitted);
    var done = (t.key === "phase1" && p1done) || (t.key === "phase2" && p2done) || (t.key === "phase3" && rstate.phase3Submitted);
    var cls = "rtab" + (rstate.phase === t.key ? " active" : "") + (done ? " done" : "") + (!unlocked ? " locked" : "");
    html += '<button class="' + cls + '" ' + (unlocked ? "" : "disabled") + ' data-goto-rphase="' + t.key + '"><span class="n">' + (i + 1) + "</span>" + t.label + "</button>";
  });
  return html;
}

function renderRoundIntro(round) {
  return '\
  <div class="memo-g">\
    <div class="memo-g-field"><b>TO:</b> Training Needs Analyst</div>\
    <div class="memo-g-field"><b>FROM:</b> ' + esc(round.memo.from) + '</div>\
    <div class="memo-g-field"><b>RE:</b> ' + esc(round.memo.re) + '</div>\
    <div class="memo-g-body">' + round.memo.body + '</div>\
    <div class="memo-g-sign">' + esc(round.memo.sign) + '</div>\
  </div>\
  <div class="panel-g">\
    <p class="eyebrow-g">Case ' + esc(round.caseNo) + " \u00b7 " + esc(round.industry) + '</p>\
    <h1 class="page-title-g">Before you recommend anything, find out what is actually broken.</h1>\
    <p class="lede-g">' + round.evidence.length + " raw signals from " + esc(round.company) + '. Some are real training needs. Some are not \u2014 ship those into a workshop and you waste everyone\'s time.</p>\
    <button class="btn btn-primary" id="start-round-btn">Open the Case File \u2192</button>\
  </div>';
}

function renderRoundPhase1(round, rstate) {
  var filedCount = Object.keys(rstate.phase1).length;
  var earned = round.evidence.reduce(function (s, e) { var f = rstate.phase1[e.id]; return s + (f && f.correct ? 1 : 0); }, 0);
  var cardsHtml = round.evidence.map(function (e) {
    var filed = rstate.phase1[e.id];
    var stamp = filed ? '<div class="stamp-g ' + (filed.correct ? "correct" : "incorrect") + '">' + (filed.correct ? "+1 \u2713" : "\u2717") + "</div>" : "";
    return '<button class="ev-card-g ' + (filed ? "filed" : "") + '" data-card="' + e.id + '">' + stamp + '\
      <div class="ev-tag-g">' + e.tag + '</div>\
      <div class="ev-source-g">' + esc(e.source) + '</div>\
      <div class="ev-text-g">' + e.text + '</div>\
      <div class="ev-cta-g">' + (filed ? "View filing \u2192" : "Review & File \u2192") + "</div></button>";
  }).join("");
  var allDone = phase1CompleteR(round, rstate);
  return '\
  <div class="panel-g">\
    <div class="hud-bar"><span>Phase 1 \u2014 Intake Desk</span><span class="hud-points">' + earned + " / " + round.evidence.length + ' pts</span></div>\
    <h1 class="page-title-g">Sort each signal before it becomes a training decision.</h1>\
    <p class="board-note-g">File each card as a Knowledge, Skill, or Attitude Gap \u2014 or <b>Not a Training Problem</b>.</p>\
    <div class="legend-g">\
      <span><i class="sw" style="background:var(--blue)"></i>Knowledge</span>\
      <span><i class="sw" style="background:var(--teal)"></i>Skill</span>\
      <span><i class="sw" style="background:var(--orange)"></i>Attitude</span>\
      <span><i class="sw" style="background:var(--gray)"></i>Not Training</span>\
    </div>\
    <div class="corkboard-g">' + cardsHtml + '</div>\
    <div class="progress-track-g"><div class="progress-fill-g" style="width:' + pct(filedCount, round.evidence.length) + '%"></div></div>\
    <div class="btn-row-g">\
      <button class="btn btn-primary" id="to-round-phase2" ' + (allDone ? "" : "disabled") + '>Continue to Mapping \u2192</button>\
      ' + (allDone ? "" : '<span class="hint-g">File all cards to continue.</span>') + "\
    </div>\
  </div>";
}

function renderRoundCardModal(round, rstate) {
  var e = round.evidence.find(function (x) { return x.id === rstate.activeCardId; });
  if (!e) return "";
  var filed = rstate.phase1[e.id];
  if (filed) {
    return '<div class="overlay-g" id="overlay"><div class="modal-g">\
      <div class="modal-g-tag">' + e.tag + " \u00b7 " + esc(e.source) + '</div>\
      <div class="modal-g-text">' + e.text + '</div>\
      <div class="feedback-g ' + (filed.correct ? "correct" : "incorrect") + '">\
        <span class="verdict-g">' + (filed.correct ? "Correctly filed" : "Misfiled") + " \u2014 " + labelForChoice(filed.choice) + (filed.dept ? " \u2192 " + DEPTS[filed.dept].label : "") + '</span>\
        ' + e.explain + '\
      </div>\
      <button class="btn btn-secondary" id="close-modal">Close</button>\
    </div></div>';
  }
  if (rstate.modalStep === "dept") {
    var deptButtons = Object.keys(DEPTS).map(function (k) { return '<button class="dept-btn-g" data-dept="' + k + '">' + DEPTS[k].label + "<br><small>" + DEPTS[k].note + "</small></button>"; }).join("");
    return '<div class="overlay-g" id="overlay"><div class="modal-g">\
      <div class="modal-g-tag">' + e.tag + " \u00b7 " + esc(e.source) + '</div>\
      <div class="modal-g-text">' + e.text + '</div>\
      <div class="modal-g-prompt">Not a training problem \u2014 where should this be routed?</div>\
      <div class="dept-grid-g">' + deptButtons + "</div>\
    </div></div>";
  }
  return '<div class="overlay-g" id="overlay"><div class="modal-g">\
    <div class="modal-g-tag">' + e.tag + " \u00b7 " + esc(e.source) + '</div>\
    <div class="modal-g-text">' + e.text + '</div>\
    <div class="modal-g-prompt">File this as:</div>\
    <div class="choice-grid-g">\
      <button class="choice-btn-g k" data-choice="knowledge">Knowledge Gap<br><small>Doesn\'t know what to do</small></button>\
      <button class="choice-btn-g s" data-choice="skill">Skill Gap<br><small>Knows, can\'t yet do it well</small></button>\
      <button class="choice-btn-g a" data-choice="attitude">Attitude Gap<br><small>Can, but chooses not to</small></button>\
      <button class="choice-btn-g n" data-choice="not-training">Not a Training Problem<br><small>System, pay, or conduct issue</small></button>\
    </div>\
  </div></div>';
}

function renderRoundPhase2(round, rstate) {
  var cardsHtml = round.needs.map(function (n) {
    var filed = rstate.phase2[n.id];
    var stamp = filed ? '<div class="stamp-g ' + (filed.correct ? "correct" : "incorrect") + '">' + (filed.correct ? "+1 \u2713" : "\u2717") + "</div>" : "";
    return '<button class="ev-card-g ' + (filed ? "filed" : "") + '" data-need="' + n.id + '">' + stamp + '\
      <div class="ev-tag-g">VALIDATED NEED</div>\
      <div class="ev-text-g">' + n.text + '</div>\
      <div class="ev-cta-g">' + (filed ? "View mapping \u2192" : "Map this need \u2192") + "</div></button>";
  }).join("");
  var allDone = phase2CompleteR(round, rstate);
  var earned = round.needs.reduce(function (s, n) { var f = rstate.phase2[n.id]; return s + (f && f.correct ? 1 : 0); }, 0);
  return '\
  <div class="panel-g">\
    <div class="hud-bar"><span>Phase 2 \u2014 Level Mapping</span><span class="hud-points">' + earned + " / " + round.needs.length + ' pts</span></div>\
    <h1 class="page-title-g">These are your real needs. Place each at the right level.</h1>\
    <div class="legend-g">\
      <span><i class="sw" style="background:var(--teal)"></i>Organisational</span>\
      <span><i class="sw" style="background:var(--blue)"></i>Task</span>\
      <span><i class="sw" style="background:var(--orange)"></i>Individual</span>\
    </div>\
    <div class="corkboard-g">' + cardsHtml + '</div>\
    <div class="btn-row-g">\
      <button class="btn btn-primary" id="to-round-phase3" ' + (allDone ? "" : "disabled") + '>Continue to Priority \u2192</button>\
      ' + (allDone ? "" : '<span class="hint-g">Map all needs to continue.</span>') + "\
    </div>\
  </div>";
}

function renderRoundNeedModal(round, rstate) {
  var n = round.needs.find(function (x) { return x.id === rstate.activeNeedId; });
  if (!n) return "";
  var filed = rstate.phase2[n.id];
  if (filed) {
    return '<div class="overlay-g" id="overlay"><div class="modal-g">\
      <div class="modal-g-tag">Validated Need</div>\
      <div class="modal-g-text">' + n.text + '</div>\
      <div class="feedback-g ' + (filed.correct ? "correct" : "incorrect") + '">\
        <span class="verdict-g">' + (filed.correct ? "Correctly mapped" : "Reconsider") + " \u2014 " + LEVEL_INFO[filed.choice].label + ' level</span>\
        ' + n.explain + '\
      </div>\
      <button class="btn btn-secondary" id="close-modal">Close</button>\
    </div></div>';
  }
  return '<div class="overlay-g" id="overlay"><div class="modal-g">\
    <div class="modal-g-tag">Validated Need</div>\
    <div class="modal-g-text">' + n.text + '</div>\
    <div class="modal-g-prompt">Map to level:</div>\
    <div class="choice-grid-g" style="grid-template-columns:1fr;">\
      <button class="choice-btn-g org" data-level="organizational">Organisational<br><small>' + LEVEL_INFO.organizational.note + '</small></button>\
      <button class="choice-btn-g task" data-level="task">Task<br><small>' + LEVEL_INFO.task.note + '</small></button>\
      <button class="choice-btn-g person" data-level="person">Individual<br><small>' + LEVEL_INFO.person.note + '</small></button>\
    </div>\
  </div></div>';
}

function renderRoundPhase3(round, rstate) {
  var used = usedBudgetR(rstate);
  var over = used > round.budget;
  var rows = Object.keys(round.interventions).map(function (k) {
    var iv = round.interventions[k]; var hrs = rstate.phase3[k] || 0;
    return '<div class="intervention-g">\
      <div class="iv-head-g"><span class="iv-name-g">' + esc(iv.name) + '</span><span class="badge-chip-g ' + LEVEL_INFO[iv.level].cls + '">' + LEVEL_INFO[iv.level].label + '</span></div>\
      <div class="iv-meta-g">Addresses: ' + esc(iv.needs) + '<br>Urgency: ' + esc(iv.urgency) + '</div>\
      <div class="stepper-g">\
        <button data-radj="' + k + '" data-dir="-1">\u2013</button>\
        <input type="number" min="0" max="' + iv.max + '" value="' + hrs + '" data-rhours="' + k + '">\
        <button data-radj="' + k + '" data-dir="1">+</button>\
        <span class="unit-g">hrs</span>\
      </div>\
    </div>';
  }).join("");
  return '\
  <div class="panel-g">\
    <div class="hud-bar"><span>Phase 3 \u2014 Prioritise &amp; Budget</span><span class="hud-points">' + used + " / " + round.budget + ' hrs</span></div>\
    <h1 class="page-title-g">You have ' + round.budget + ' training hours. Spend them where they matter.</h1>\
    <div class="budget-track-g"><div class="budget-fill-g ' + (over ? "over" : "") + '" style="width:' + Math.min(100, pct(used, round.budget)) + '%"></div></div>\
    ' + rows + '\
    <div class="btn-row-g">\
      <button class="btn btn-primary" id="submit-round-budget" ' + (over ? "disabled" : "") + '>Lock Allocation \u2192</button>\
      ' + (over ? '<span class="hint-g" style="color:var(--orange-dark)">Over budget \u2014 trim an intervention.</span>' : "") + "\
    </div>\
  </div>";
}

function scorePhase1R(round, rstate) {
  return round.evidence.reduce(function (sum, e) {
    var f = rstate.phase1[e.id]; if (!f) return sum;
    var p = f.correct ? 1 : 0;
    if (e.correct === "not-training" && f.dept === e.dept) p += 1;
    return sum + p;
  }, 0);
}
function maxPhase1R(round) { return round.evidence.length + round.evidence.filter(function (e) { return e.correct === "not-training"; }).length; }
function scorePhase2R(round, rstate) { return round.needs.filter(function (n) { return rstate.phase2[n.id] && rstate.phase2[n.id].correct; }).length; }
function scorePhase3R(round, rstate) {
  return Object.keys(round.interventions).reduce(function (sum, k) {
    var diff = Math.abs((rstate.phase3[k] || 0) - round.interventions[k].recommended);
    if (diff <= 3) return sum + 2; if (diff <= 6) return sum + 1; return sum;
  }, 0);
}
function maxPhase3R(round) { return Object.keys(round.interventions).length * 2; }

function buildReviewItems(round, rstate) {
  var items = [];
  round.evidence.forEach(function (e) {
    var f = rstate.phase1[e.id]; if (!f) return;
    items.push({
      phase: "Intake", label: e.source,
      your: labelForChoice(f.choice) + (f.dept ? " \u2192 " + DEPTS[f.dept].label : ""),
      right: labelForChoice(e.correct) + (e.correct === "not-training" ? " \u2192 " + DEPTS[e.dept].label : ""),
      correct: !!f.correct, explain: e.explain
    });
  });
  round.needs.forEach(function (n) {
    var f = rstate.phase2[n.id]; if (!f) return;
    items.push({ phase: "Mapping", label: n.text, your: LEVEL_INFO[f.choice].label, right: LEVEL_INFO[n.level].label, correct: !!f.correct, explain: n.explain });
  });
  return items;
}

function persistPhase3Responses(round, rstate) {
  var calls = Object.keys(round.interventions).map(function (k) {
    var iv = round.interventions[k]; var hrs = rstate.phase3[k] || 0;
    var diff = Math.abs(hrs - iv.recommended);
    var ptsEarned = diff <= 3 ? 2 : (diff <= 6 ? 1 : 0);
    return DB.saveResponse(rstate.attemptId, {
      phase: "phase3", item_id: k, item_label: iv.name,
      learner_choice: String(hrs), correct_choice: String(iv.recommended),
      is_correct: diff <= 3, points_earned: ptsEarned, points_possible: 2, explain_text: iv.urgency
    }).catch(function () {});
  });
  return Promise.all(calls);
}

function hydrateRoundFromAttempt(round, rstate, attempt) {
  rstate.attemptId = attempt.id;
  (attempt.responses || []).forEach(function (r) {
    if (r.phase === "phase1") {
      var parts = String(r.learner_choice).split("|");
      rstate.phase1[r.item_id] = { choice: parts[0], dept: parts[1] || null, correct: !!r.is_correct };
    } else if (r.phase === "phase2") {
      rstate.phase2[r.item_id] = { choice: r.learner_choice, correct: !!r.is_correct };
    } else if (r.phase === "phase3") {
      rstate.phase3[r.item_id] = parseInt(r.learner_choice, 10) || 0;
    }
  });
  if (attempt.status === "complete") {
    rstate.phase3Submitted = true; rstate.reported = true;
    rstate.score = attempt.score; rstate.maxScore = attempt.max_score;
    rstate.phase = "phase4";
  } else {
    if (Object.keys(rstate.phase3).length) rstate.phase = "phase3";
    else if (phase1CompleteR(round, rstate)) rstate.phase = "phase2";
    else rstate.phase = "phase1";
  }
}

function renderRoundPhase4(round, rstate) {
  var p1 = scorePhase1R(round, rstate), p1max = maxPhase1R(round);
  var p2 = scorePhase2R(round, rstate), p2max = round.needs.length;
  var p3 = scorePhase3R(round, rstate), p3max = maxPhase3R(round);
  var total = p1 + p2 + p3, max = p1max + p2max + p3max;
  var scorePct = pct(total, max);
  var badge = getBadge(scorePct);

  if (!rstate.reported) {
    rstate.reported = true; rstate.score = total; rstate.maxScore = max;
    DB.completeAttempt(rstate.attemptId, total, max, badge.label).catch(function () {});
  }

  var reviewItems = buildReviewItems(round, rstate);
  var reviewHtml = reviewItems.map(function (it) {
    return '<div class="review-item-g ' + (it.correct ? "ok" : "bad") + '">\
      <div class="review-item-head"><span class="review-phase-tag">' + it.phase + '</span><span class="review-mark">' + (it.correct ? "\u2713 Correct" : "\u2717 Missed") + '</span></div>\
      <div class="review-label">' + esc(it.label) + '</div>\
      <div class="review-answers"><span>Your answer: <b>' + esc(it.your) + '</b></span>' + (it.correct ? "" : '<span>Correct: <b>' + esc(it.right) + "</b></span>") + '</div>\
      <div class="review-explain">' + it.explain + '</div>\
    </div>';
  }).join("");

  var escalated = round.evidence.filter(function (e) { return e.correct === "not-training"; }).map(function (e) {
    var f = rstate.phase1[e.id];
    var d = f && DEPTS[f.dept] ? DEPTS[f.dept].label : DEPTS[e.dept].label + " (recommended)";
    return "<li>" + esc(e.source) + " \u2192 " + d + "</li>";
  }).join("");

  var nextId = ROUND_ORDER[ROUND_ORDER.indexOf(round.id) + 1];

  var challengeHtml = "";
  if (round.challenges && round.challenges.length) {
    if (rstate.challengeIdx === null) rstate.challengeIdx = Math.floor(Math.random() * round.challenges.length);
    var ch = round.challenges[rstate.challengeIdx];
    challengeHtml = '<div class="panel-g challenge-panel-g">\
      <h3>One Last Thing \u2014 Defend It</h3>\
      <p class="challenge-q">"' + esc(ch.q) + '"</p>\
      <textarea id="round-challenge-answer" rows="3" placeholder="Answer it in your own words first.">' + esc(rstate.challengeAnswer || "") + '</textarea>\
      ' + (rstate.challengeRevealed ? '<div class="feedback-g correct"><span class="verdict-g">Evidence-based approach</span>' + esc(ch.a) + "</div>" : '<button class="btn btn-secondary" id="reveal-challenge-btn">See the evidence-based approach</button>') + '\
    </div>';
  }

  return '\
  <div class="panel-g badge-panel-g badge-tier-' + badge.tier + '">\
    <div class="badge-reveal-g"><div class="badge-icon-g">' + badge.icon + '</div><div class="badge-label-g">' + badge.label + '</div></div>\
    <div class="marks-g">' + total + " / " + max + ' marks <span class="marks-pct">(' + scorePct + '%)</span></div>\
    <p class="remark-g">' + esc(badge.remark) + '</p>\
    <button class="btn btn-dark" id="download-learner-pdf">Download My Report (PDF) \u2193</button>\
  </div>\
  <div class="panel-g">\
    <h2 class="section-title-g">Full Review</h2>\
    <div class="review-list-g">' + reviewHtml + '</div>\
  </div>\
  <div class="panel-g">\
    <h3>Escalated \u2014 Not Training Problems</h3>\
    <ul class="plain-list-g">' + escalated + '</ul>\
  </div>\
  ' + challengeHtml + '\
  <div class="btn-row-g">\
    ' + (nextId ? '<button class="btn btn-primary" id="next-round-btn" data-next-round="' + nextId + '">Next Case: ' + esc(ROUNDS[nextId].company) + " \u2192</button>" : '<button class="btn btn-primary" id="to-hub-btn">Back to Field Office \u2192</button>') + '\
    <button class="btn btn-secondary" id="redo-round-btn">Redo this case</button>\
  </div>';
}

/* ============================================================
   MAIN RENDER DISPATCH
   ============================================================ */
function render() {
  var app = $("app");
  var html = "";

  if (STATE.screen === "landing") html = renderLanding();
  else if (STATE.screen === "waiting") html = renderWaiting();
  else if (STATE.screen === "field-office") html = renderFieldOffice();
  else if (STATE.screen === "round") {
    var round = ROUNDS[STATE.currentRound]; var rstate = getRoundState(STATE.currentRound);
    var body = "";
    if (rstate.phase === "intro") body = renderRoundIntro(round);
    else if (rstate.phase === "phase1") body = renderRoundPhase1(round, rstate) + (rstate.activeCardId ? renderRoundCardModal(round, rstate) : "");
    else if (rstate.phase === "phase2") body = renderRoundPhase2(round, rstate) + (rstate.activeNeedId ? renderRoundNeedModal(round, rstate) : "");
    else if (rstate.phase === "phase3") body = renderRoundPhase3(round, rstate);
    else if (rstate.phase === "phase4") body = renderRoundPhase4(round, rstate);
    html = '<div class="round-shell"><div class="rtabs">' + renderRoundTabs(round, rstate) + "</div>" + body + "</div>";
  }
  else if (STATE.screen === "workbench") html = renderWorkbenchScreen();
  else if (STATE.screen === "trainer-dashboard") html = renderTrainerDashboard();
  else if (STATE.screen === "trainer-answerkey") html = renderTrainerAnswerKey();
  else if (STATE.screen === "trainer-student") html = renderTrainerStudent();
  else html = '<div class="boot-loader"><img src="/logo-dark.png" class="boot-logo" alt="Learners Point"><div class="boot-spinner"></div></div>';

  app.innerHTML = html;
  bindEvents();
}

/* ============================================================
   WORKBENCH (free-form, no answer key)
   ============================================================ */
function wbTrainingCards() { return STATE.workbench.cards.filter(function (c) { return c.choice && c.choice !== "not-training"; }); }
function wbEscalatedCards() { return STATE.workbench.cards.filter(function (c) { return c.choice === "not-training"; }); }
function wbUsedBudget() { return wbTrainingCards().reduce(function (s, c) { return s + (c.hours || 0); }, 0); }

function renderWorkbenchScreen() {
  var w = STATE.workbench;
  var body = "";
  if (w.phase === "intro") body = renderWbIntro();
  else if (w.phase === "phase1") body = renderWbPhase1() + (w.activeCardId ? renderWbCardModal() : "");
  else if (w.phase === "phase2") body = renderWbPhase2() + (w.activeCardId ? renderWbLevelModal() : "");
  else if (w.phase === "phase3") body = renderWbPhase3();
  else if (w.phase === "phase4") body = renderWbPhase4();
  var tabs = '<button class="rtab back" data-home="1">\u2190 Field Office</button>' +
    ["phase1", "phase2", "phase3", "phase4"].map(function (k, i) {
      var labels = { phase1: "Build Desk", phase2: "Mapping", phase3: "Priority", phase4: "Your Brief" };
      return '<button class="rtab ' + (w.phase === k ? "active" : "") + '" data-goto-wphase="' + k + '"><span class="n">' + (i + 1) + "</span>" + labels[k] + "</button>";
    }).join("");
  return '<div class="round-shell"><div class="rtabs">' + tabs + "</div>" + body + "</div>";
}

function renderWbIntro() {
  return '\
  <div class="panel-g">\
    <p class="eyebrow-g">Your Workbench</p>\
    <h1 class="page-title-g">Bring your own evidence. Run the method for real.</h1>\
    <p class="lede-g">No answer key here \u2014 this is your judgement on your own workplace. Add real signals, sort them, and walk away with a brief you can hand to your manager.</p>\
    <button class="btn btn-primary" id="start-wb-btn">Start Building Your Desk \u2192</button>\
  </div>';
}

function renderWbPhase1() {
  var w = STATE.workbench;
  var filedCount = w.cards.filter(function (c) { return c.choice; }).length;
  var cardsHtml = w.cards.map(function (c) {
    var filed = !!c.choice;
    var remove = !filed ? '<button class="wb-remove-g" data-wb-remove="' + c.id + '">\u00d7</button>' : "";
    var stamp = filed ? '<div class="stamp-g neutral">Filed</div>' : "";
    return '<div class="ev-card-g" style="position:relative;">' + remove + stamp + '\
      <div class="ev-tag-g">' + esc(c.source || "Untitled") + '</div>\
      <div class="ev-text-g">' + esc(c.text) + '</div>\
      <button class="ev-cta-g" style="background:none;border:none;cursor:pointer;text-align:left;padding:0;" data-wb-card="' + c.id + '">' + (filed ? "Edit filing \u2192" : "Classify \u2192") + "</button></div>";
  }).join("");
  var allFiled = w.cards.length > 0 && w.cards.every(function (c) { return c.choice; });
  return '\
  <div class="panel-g">\
    <p class="eyebrow-g">Phase 1 \u2014 Build &amp; Triage</p>\
    <h1 class="page-title-g">Add your real signals, then file each one.</h1>\
    <div class="field"><label>Source</label><input type="text" id="wb-source" maxlength="80" placeholder="e.g. Exit interview, March 2026"></div>\
    <div class="field"><label>What did you observe or hear?</label><textarea id="wb-text" rows="3" maxlength="400"></textarea></div>\
    <div class="field-error ' + (w.addError ? "show" : "") + '" id="wb-add-error">Add a source and a description first.</div>\
    <button class="btn btn-secondary" id="wb-add-card" ' + (w.cards.length >= 15 ? "disabled" : "") + '>Add to Desk</button>\
    <div class="corkboard-g" style="margin-top:18px;">' + cardsHtml + '</div>\
    <div class="btn-row-g">\
      <button class="btn btn-primary" id="to-wb-phase2" ' + (allFiled && w.cards.length >= 3 ? "" : "disabled") + '>Continue to Mapping \u2192</button>\
      ' + (allFiled && w.cards.length >= 3 ? "" : '<span class="hint-g">Add and file at least 3 signals.</span>') + "\
    </div>\
  </div>";
}

function renderWbCardModal() {
  var w = STATE.workbench;
  var c = w.cards.find(function (x) { return x.id === w.activeCardId; });
  if (!c) return "";
  if (w.modalStep === "dept") {
    var deptButtons = Object.keys(DEPTS).map(function (k) { return '<button class="dept-btn-g" data-wbdept="' + k + '">' + DEPTS[k].label + "<br><small>" + DEPTS[k].note + "</small></button>"; }).join("");
    return '<div class="overlay-g" id="overlay"><div class="modal-g">\
      <div class="modal-g-tag">' + esc(c.source || "Untitled") + '</div><div class="modal-g-text">' + esc(c.text) + '</div>\
      <div class="modal-g-prompt">Not a training problem \u2014 where should this route?</div>\
      <div class="dept-grid-g">' + deptButtons + "</div></div></div>";
  }
  if (w.modalStep === "note") {
    return '<div class="overlay-g" id="overlay"><div class="modal-g">\
      <div class="modal-g-tag">' + esc(c.source || "Untitled") + '</div><div class="modal-g-text">' + esc(c.text) + '</div>\
      <div class="modal-g-prompt">Filing as: ' + labelForChoice(w.pendingChoice) + (w.pendingDept ? " \u2192 " + DEPTS[w.pendingDept].label : "") + '</div>\
      <div class="field"><label>Why? (optional)</label><textarea id="wb-note" rows="2" maxlength="200"></textarea></div>\
      <button class="btn btn-primary" id="wb-file-card">File It</button>\
    </div></div>';
  }
  return '<div class="overlay-g" id="overlay"><div class="modal-g">\
    <div class="modal-g-tag">' + esc(c.source || "Untitled") + '</div><div class="modal-g-text">' + esc(c.text) + '</div>\
    <div class="modal-g-prompt">File this as:</div>\
    <div class="choice-grid-g">\
      <button class="choice-btn-g k" data-wbchoice="knowledge">Knowledge Gap</button>\
      <button class="choice-btn-g s" data-wbchoice="skill">Skill Gap</button>\
      <button class="choice-btn-g a" data-wbchoice="attitude">Attitude Gap</button>\
      <button class="choice-btn-g n" data-wbchoice="not-training">Not a Training Problem</button>\
    </div>\
  </div></div>';
}

function renderWbPhase2() {
  var items = wbTrainingCards();
  if (items.length === 0) {
    return '<div class="panel-g"><p class="eyebrow-g">Phase 2</p><h1 class="page-title-g">Every signal turned out not to be a training problem.</h1><p class="lede-g">A legitimate finding. Skip straight to your brief.</p><button class="btn btn-primary" id="wb-skip-to-brief">Skip to Brief \u2192</button></div>';
  }
  var cardsHtml = items.map(function (c) {
    var stamp = c.level ? '<div class="stamp-g neutral">' + LEVEL_INFO[c.level].label + "</div>" : "";
    return '<div class="ev-card-g" style="position:relative;">' + stamp + '<div class="ev-tag-g">' + labelForChoice(c.choice) + '</div><div class="ev-text-g">' + esc(c.text) + '</div><button class="ev-cta-g" style="background:none;border:none;cursor:pointer;text-align:left;padding:0;" data-wb-need="' + c.id + '">' + (c.level ? "Edit \u2192" : "Map \u2192") + "</button></div>";
  }).join("");
  var allMapped = items.every(function (c) { return c.level; });
  return '<div class="panel-g"><p class="eyebrow-g">Phase 2</p><h1 class="page-title-g">Place each real need at the right level.</h1><div class="corkboard-g">' + cardsHtml + '</div><div class="btn-row-g"><button class="btn btn-primary" id="to-wb-phase3" ' + (allMapped ? "" : "disabled") + '>Continue \u2192</button></div></div>';
}

function renderWbLevelModal() {
  var w = STATE.workbench; var c = w.cards.find(function (x) { return x.id === w.activeCardId; });
  if (!c) return "";
  return '<div class="overlay-g" id="overlay"><div class="modal-g">\
    <div class="modal-g-text">' + esc(c.text) + '</div>\
    <div class="choice-grid-g" style="grid-template-columns:1fr;">\
      <button class="choice-btn-g org" data-wblevel="organizational">Organisational</button>\
      <button class="choice-btn-g task" data-wblevel="task">Task</button>\
      <button class="choice-btn-g person" data-wblevel="person">Individual</button>\
    </div>\
  </div></div>';
}

function renderWbPhase3() {
  var w = STATE.workbench; var items = wbTrainingCards();
  var used = wbUsedBudget(); var over = used > w.budget;
  var rows = items.map(function (c) {
    return '<div class="intervention-g">\
      <span class="badge-chip-g ' + LEVEL_INFO[c.level].cls + '">' + LEVEL_INFO[c.level].label + '</span>\
      <input type="text" class="wb-ivname-g" data-wbname="' + c.id + '" maxlength="60" placeholder="Name this initiative..." value="' + esc(c.ivName || "") + '">\
      <div class="iv-meta-g">' + esc(c.text) + '</div>\
      <div class="stepper-g"><button data-wbadj="' + c.id + '" data-dir="-1">\u2013</button><input type="number" min="0" value="' + (c.hours || 0) + '" data-wbhours="' + c.id + '"><button data-wbadj="' + c.id + '" data-dir="1">+</button><span class="unit-g">hrs</span></div>\
    </div>';
  }).join("");
  return '<div class="panel-g"><p class="eyebrow-g">Phase 3</p><h1 class="page-title-g">Set your budget and spend it where it matters.</h1>\
    <div class="field"><label>Total budget (hrs)</label><input type="number" min="0" id="wb-budget-input" value="' + w.budget + '"></div>\
    <div class="budget-track-g"><div class="budget-fill-g ' + (over ? "over" : "") + '" style="width:' + (w.budget > 0 ? Math.min(100, pct(used, w.budget)) : 0) + '%"></div></div>\
    ' + rows + '\
    <div class="btn-row-g"><button class="btn btn-primary" id="submit-wb-budget" ' + (over ? "disabled" : "") + '>Generate My Brief \u2192</button></div>\
  </div>';
}

function buildWbBriefText() {
  var w = STATE.workbench; var lines = [];
  lines.push("TRAINING NEEDS ANALYSIS \u2014 WORKBENCH BRIEF");
  lines.push("Learner: " + (STATE.learner ? STATE.learner.name : ""));
  lines.push("Generated: " + new Date().toDateString()); lines.push("");
  var esc_ = wbEscalatedCards();
  lines.push("ESCALATED \u2014 NOT TRAINING PROBLEMS (" + esc_.length + ")");
  esc_.forEach(function (c) { lines.push("- " + (c.source || "Untitled") + " \u2192 " + (DEPTS[c.dept] ? DEPTS[c.dept].label : "Unspecified")); });
  lines.push(""); lines.push("TRAINING NEEDS BY LEVEL");
  ["organizational", "task", "person"].forEach(function (lvl) {
    var items = wbTrainingCards().filter(function (c) { return c.level === lvl; });
    if (!items.length) return;
    lines.push("[" + LEVEL_INFO[lvl].label.toUpperCase() + "]");
    items.forEach(function (c) { lines.push("- " + (c.ivName || c.source || "Untitled") + " \u2014 " + (c.hours || 0) + " hrs"); });
  });
  lines.push(""); lines.push("BUDGET: " + wbUsedBudget() + " / " + STATE.workbench.budget + " hrs allocated");
  return lines.join("\n");
}

function renderWbPhase4() {
  var w = STATE.workbench;
  if (!w.reported) {
    w.reported = true;
    if (w.attemptId) DB.completeAttempt(w.attemptId, null, null, "Workbench Complete").catch(function () {});
  }
  var text = buildWbBriefText();
  return '<div class="panel-g"><p class="eyebrow-g">Your Brief</p><h1 class="page-title-g">This is real \u2014 take it with you.</h1>\
    <div class="btn-row-g" style="margin-top:0;margin-bottom:16px;"><button class="btn btn-secondary" id="wb-copy-btn">Copy to Clipboard</button><button class="btn btn-secondary" id="wb-download-btn">Download .txt</button></div>\
    <pre class="brief-pre-g">' + esc(text) + '</pre>\
    <div class="btn-row-g"><button class="btn btn-primary" id="to-hub-from-wb">Back to Field Office \u2192</button></div>\
  </div>';
}

/* ============================================================
   PDF EXPORTS
   ============================================================ */
function generateLearnerPDF(round, rstate, badge, total, max, scorePctVal) {
  if (!window.jspdf) { alert("PDF library still loading — try again in a moment."); return; }
  var doc = new window.jspdf.jsPDF();
  var y = 15;
  if (LOGO_DATA_URL) { try { doc.addImage(LOGO_DATA_URL, "PNG", 15, y, 45, 6); } catch (e) {} }
  y += 16;
  doc.setFontSize(16); doc.text("Training Needs Analysis \u2014 Case Report", 15, y); y += 8;
  doc.setFontSize(10);
  doc.text("Learner: " + (STATE.learner ? STATE.learner.name : "") + "  (" + (STATE.learner ? STATE.learner.email : "") + ")", 15, y); y += 6;
  doc.text("Case: " + round.company + "  \u00b7  Case " + round.caseNo, 15, y); y += 6;
  doc.text("Score: " + total + " / " + max + " marks (" + scorePctVal + "%)  \u00b7  Badge: " + badge.label, 15, y); y += 10;

  var rows = buildReviewItems(round, rstate).map(function (it) {
    return [it.phase, it.label, it.your, it.correct ? "Correct" : ("Missed \u2014 " + it.right)];
  });
  doc.autoTable({
    startY: y, head: [["Phase", "Item", "Your Answer", "Result"]], body: rows,
    styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [46, 157, 145] }
  });
  var fname = "TNA-" + round.caseNo + "-" + (STATE.learner ? STATE.learner.name.replace(/[^a-z0-9]+/gi, "-") : "learner") + ".pdf";
  doc.save(fname);
}

function generateTrainerCompiledPDF(learners) {
  if (!window.jspdf) { alert("PDF library still loading — try again in a moment."); return; }
  var doc = new window.jspdf.jsPDF();
  var y = 15;
  if (LOGO_DATA_URL) { try { doc.addImage(LOGO_DATA_URL, "PNG", 15, y, 45, 6); } catch (e) {} }
  y += 16;
  doc.setFontSize(16); doc.text("The Needs Audit \u2014 Compiled Cohort Report", 15, y); y += 6;
  doc.setFontSize(10); doc.text("Generated: " + new Date().toDateString() + "  \u00b7  " + learners.length + " learners", 15, y); y += 8;

  var rows = learners.map(function (l) {
    var attempts = l.attempts || [];
    var completed = attempts.filter(function (a) { return a.status === "complete" && a.case_id !== "workbench"; });
    var totalScore = completed.reduce(function (s, a) { return s + (a.score || 0); }, 0);
    var totalMax = completed.reduce(function (s, a) { return s + (a.max_score || 0); }, 0);
    var overallPct = totalMax ? Math.round((totalScore / totalMax) * 100) : 0;
    return [l.name, l.email, completed.length + " / " + ROUND_ORDER.length, totalMax ? (totalScore + "/" + totalMax + " (" + overallPct + "%)") : "\u2014"];
  });
  doc.autoTable({
    startY: y, head: [["Name", "Email", "Cases Complete", "Overall Score"]], body: rows,
    styles: { fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [79, 113, 242] }
  });
  doc.save("TNA-cohort-report-" + Date.now() + ".pdf");
}

/* ============================================================
   TRAINER DASHBOARD
   ============================================================ */
function renderTrainerDashboard() {
  var learners = STATE.trainer.learners;
  var rows = learners.map(function (l) {
    var attempts = l.attempts || [];
    var completedCount = attempts.filter(function (a) { return a.status === "complete" && a.case_id !== "workbench"; }).length;
    var totalScore = attempts.filter(function (a) { return a.status === "complete" && a.case_id !== "workbench"; }).reduce(function (s, a) { return s + (a.score || 0); }, 0);
    var totalMax = attempts.filter(function (a) { return a.status === "complete" && a.case_id !== "workbench"; }).reduce(function (s, a) { return s + (a.max_score || 0); }, 0);
    var overallPct = totalMax ? pct(totalScore, totalMax) : null;
    return '<tr>\
      <td>' + esc(l.name) + '</td><td>' + esc(l.email) + '</td>\
      <td>' + completedCount + " / " + ROUND_ORDER.length + '</td>\
      <td>' + (overallPct === null ? "\u2014" : overallPct + "%") + '</td>\
      <td><button class="btn btn-secondary btn-tiny" data-view-student="' + l.id + '">View</button></td>\
    </tr>';
  }).join("");

  return '\
  <div class="trainer-shell">\
    <div class="trainer-header">\
      <img src="/logo-dark.png" alt="Learners Point" class="trainer-logo">\
      <div><h1 class="page-title-g" style="margin:0;">Trainer Dashboard</h1><p class="hub-lede-g" style="margin:2px 0 0;">' + learners.length + ' learner' + (learners.length === 1 ? "" : "s") + ' \u00b7 live</p></div>\
      <button class="btn btn-ghost" id="logout-btn">Log out</button>\
    </div>\
    <div class="trainer-actions">\
      <button class="btn btn-primary" id="toggle-session-btn">' + (STATE.sessionLive ? "\u23f8 Pause Session (learners waiting)" : "\u25b6 Start Session (release waiting learners)") + '</button>\
      <button class="btn btn-secondary" id="open-answerkey-btn">View Answer Key</button>\
      <button class="btn btn-secondary" id="download-compiled-pdf">Download Compiled Report (PDF) \u2193</button>\
    </div>\
    <div class="trainer-table-wrap">\
      <table class="trainer-table-g">\
        <thead><tr><th>Name</th><th>Email</th><th>Completion</th><th>Overall Score</th><th></th></tr></thead>\
        <tbody>' + (rows || '<tr><td colspan="5" class="empty-row">No learners have logged in yet.</td></tr>') + '</tbody>\
      </table>\
    </div>\
  </div>';
}

function renderTrainerAnswerKey() {
  var sections = ROUND_ORDER.map(function (id) {
    var round = ROUNDS[id];
    var evRows = round.evidence.map(function (e) {
      return "<li><b>" + esc(e.source) + ":</b> " + labelForChoice(e.correct) + (e.correct === "not-training" ? " \u2192 " + DEPTS[e.dept].label : "") + "<br><small>" + e.explain + "</small></li>";
    }).join("");
    var needRows = round.needs.map(function (n) {
      return "<li><b>" + esc(n.text) + ":</b> " + LEVEL_INFO[n.level].label + "<br><small>" + n.explain + "</small></li>";
    }).join("");
    var ivRows = Object.keys(round.interventions).map(function (k) {
      var iv = round.interventions[k]; return "<li><b>" + esc(iv.name) + ":</b> " + iv.recommended + " hrs recommended</li>";
    }).join("");
    return '<div class="panel-g"><h2 class="section-title-g">' + esc(round.company) + " (Case " + round.caseNo + ')</h2>\
      <h3>Intake</h3><ul class="plain-list-g">' + evRows + '</ul>\
      <h3>Level Mapping</h3><ul class="plain-list-g">' + needRows + '</ul>\
      <h3>Recommended Budget (' + round.budget + ' hrs total)</h3><ul class="plain-list-g">' + ivRows + '</ul>\
    </div>';
  }).join("");
  return '<div class="trainer-shell"><div class="trainer-header"><img src="/logo-dark.png" class="trainer-logo" alt="Learners Point"><h1 class="page-title-g" style="margin:0;">Answer Key</h1><button class="btn btn-ghost" data-goto-trainer="1">\u2190 Dashboard</button></div>' + sections + "</div>";
}

function decodeResponseDisplay(r) {
  if (r.phase === "phase1") {
    var yourParts = String(r.learner_choice).split("|");
    var rightParts = String(r.correct_choice).split("|");
    var your = labelForChoice(yourParts[0]) + (yourParts[1] ? " \u2192 " + (DEPTS[yourParts[1]] ? DEPTS[yourParts[1]].label : yourParts[1]) : "");
    var right = labelForChoice(rightParts[0]) + (rightParts[1] ? " \u2192 " + (DEPTS[rightParts[1]] ? DEPTS[rightParts[1]].label : rightParts[1]) : "");
    return { your: your, right: right };
  }
  if (r.phase === "phase2") {
    return { your: LEVEL_INFO[r.learner_choice] ? LEVEL_INFO[r.learner_choice].label : r.learner_choice, right: LEVEL_INFO[r.correct_choice] ? LEVEL_INFO[r.correct_choice].label : r.correct_choice };
  }
  return { your: r.learner_choice + " hrs", right: r.correct_choice + " hrs recommended" };
}

function renderTrainerStudent() {
  var detail = STATE.trainer.selectedDetail;
  if (!detail) return '<div class="trainer-shell"><div class="boot-spinner"></div></div>';
  var sections = detail.attempts.filter(function (a) { return a.case_id !== "workbench"; }).map(function (a) {
    var round = ROUNDS[a.case_id];
    var rows = (a.responses || []).map(function (r) {
      var d = decodeResponseDisplay(r);
      return '<div class="review-item-g ' + (r.is_correct ? "ok" : "bad") + '">\
        <div class="review-item-head"><span class="review-phase-tag">' + esc(r.phase) + '</span><span class="review-mark">' + (r.is_correct ? "\u2713" : "\u2717") + '</span></div>\
        <div class="review-label">' + esc(r.item_label || r.item_id) + '</div>\
        <div class="review-answers"><span>Their answer: <b>' + esc(d.your) + '</b></span><span>Correct: <b>' + esc(d.right) + '</b></span></div>\
      </div>';
    }).join("");
    var scorePct = a.max_score ? pct(a.score, a.max_score) : 0;
    return '<div class="panel-g"><h3>' + (round ? esc(round.company) : esc(a.case_id)) + " \u2014 " + (a.status === "complete" ? a.score + "/" + a.max_score + " (" + scorePct + "%) \u00b7 " + esc(a.badge || "") : "In progress") + '</h3><div class="review-list-g">' + rows + "</div></div>";
  }).join("");
  return '<div class="trainer-shell"><div class="trainer-header"><img src="/logo-dark.png" class="trainer-logo" alt="Learners Point"><h1 class="page-title-g" style="margin:0;">' + esc(detail.learner.name) + '</h1><button class="btn btn-ghost" data-goto-trainer="1">\u2190 Dashboard</button></div><p class="hub-lede-g">' + esc(detail.learner.email) + "</p>" + (sections || '<p class="hint-g">No case attempts yet.</p>') + "</div>";
}


/* ============================================================
   LOGIN + SESSION WIRING
   ============================================================ */
function handleLearnerLogin() {
  var name = ($("ln-name").value || "").trim();
  var email = ($("ln-email").value || "").trim();
  if (!name || !email || email.indexOf("@") === -1) {
    STATE.loginError = "Enter your name and a valid email to continue.";
    render(); return;
  }
  STATE.loginError = "";
  DB.loginLearner(name, email).then(function (learner) {
    STATE.role = "learner";
    STATE.learner = learner;
    return DB.getSessionLive();
  }).then(function (live) {
    STATE.sessionLive = live;
    if (live) { goto("field-office"); return; }
    STATE.unsubSession = DB.subscribeSessionLive(function (newVal) {
      STATE.sessionLive = newVal;
      if (newVal && STATE.screen === "waiting") {
        if (STATE.unsubSession) { STATE.unsubSession(); STATE.unsubSession = null; }
        goto("field-office");
      }
    });
    goto("waiting");
  }).catch(function (err) {
    STATE.loginError = "Couldn't log you in — please try again.";
    render();
  });
}

function handleTrainerLogin() {
  var code = ($("tr-code").value || "").trim();
  if (!code) {
    STATE.trainerError = "Enter the access code.";
    render(); return;
  }
  STATE.trainerError = "";
  DB.loginTrainer(code).then(function (ok) {
    if (!ok) {
      STATE.trainerError = "Incorrect code.";
      render(); return;
    }
    STATE.role = "trainer";
    DB.getSessionLive().then(function (live) { STATE.sessionLive = live; });
    STATE.trainer.unsub = DB.subscribeLearners(function (learners) {
      STATE.trainer.learners = learners;
      if (STATE.screen === "trainer-dashboard") render();
    });
    goto("trainer-dashboard");
  }).catch(function () {
    STATE.trainerError = "Couldn't log you in — please try again.";
    render();
  });
}

function handleLogout() {
  if (STATE.unsubSession) { STATE.unsubSession(); STATE.unsubSession = null; }
  if (STATE.trainer.unsub) { STATE.trainer.unsub(); STATE.trainer.unsub = null; }
  DB.logout();
  STATE.role = null; STATE.learner = null; STATE.loginError = ""; STATE.trainerError = "";
  STATE.roundState = {}; STATE.currentRound = null;
  STATE.trainer.learners = []; STATE.trainer.selectedDetail = null;
  goto("landing");
}

/* ============================================================
   EVENT BINDING
   ============================================================ */
function bindEvents() {
  // --- landing ---
  var llBtn = $("learner-login-btn"); if (llBtn) llBtn.addEventListener("click", handleLearnerLogin);
  var tlBtn = $("trainer-login-btn"); if (tlBtn) tlBtn.addEventListener("click", handleTrainerLogin);

  // --- waiting ---
  var enterAnyway = $("enter-anyway-btn");
  if (enterAnyway) enterAnyway.addEventListener("click", function () {
    if (STATE.unsubSession) { STATE.unsubSession(); STATE.unsubSession = null; }
    goto("field-office");
  });

  // --- global nav ---
  var homeBtn = document.querySelector("[data-home]");
  if (homeBtn) homeBtn.addEventListener("click", function () { goto("field-office"); });
  var logoutBtn = $("logout-btn"); if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
  document.querySelectorAll("[data-goto-trainer]").forEach(function (b) { b.addEventListener("click", function () { goto("trainer-dashboard"); }); });

  // --- field office ---
  document.querySelectorAll("[data-open-round]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var roundId = btn.getAttribute("data-open-round");
      var round = ROUNDS[roundId];
      var rstate = getRoundState(roundId);
      STATE.currentRound = roundId;
      var maxPossible = maxPhase1R(round) + round.needs.length + maxPhase3R(round);
      if (rstate.attemptId) { goto("round"); return; }
      DB.startAttempt(STATE.learner.id, roundId, maxPossible).then(function (attempt) {
        rstate.attemptId = attempt.id;
        return DB.fetchStudentDetail(STATE.learner.id).then(function (detail) {
          var full = (detail.attempts || []).find(function (a) { return a.case_id === roundId; });
          if (full && (attempt.status === "complete" || (full.responses && full.responses.length))) {
            hydrateRoundFromAttempt(round, rstate, full);
          }
        });
      }).catch(function () {}).then(function () { goto("round"); });
    });
  });
  var openWb = $("open-workbench-btn");
  if (openWb) openWb.addEventListener("click", function () { goto("workbench"); });

  // --- round: nav tabs ---
  document.querySelectorAll("[data-goto-rphase]").forEach(function (btn) {
    btn.addEventListener("click", function () { getRoundState(STATE.currentRound).phase = btn.getAttribute("data-goto-rphase"); render(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  });
  var startRoundBtn = $("start-round-btn");
  if (startRoundBtn) startRoundBtn.addEventListener("click", function () { getRoundState(STATE.currentRound).phase = "phase1"; render(); });

  // --- round: phase1 ---
  document.querySelectorAll("[data-card]").forEach(function (btn) {
    btn.addEventListener("click", function () { var rs = getRoundState(STATE.currentRound); rs.activeCardId = btn.getAttribute("data-card"); rs.modalStep = "choose"; render(); });
  });
  document.querySelectorAll("[data-need]").forEach(function (btn) {
    btn.addEventListener("click", function () { var rs = getRoundState(STATE.currentRound); rs.activeNeedId = btn.getAttribute("data-need"); render(); });
  });
  var overlay = $("overlay");
  if (overlay) overlay.addEventListener("click", function (ev) {
    if (ev.target !== overlay) return;
    if (STATE.screen === "round") { var rs = getRoundState(STATE.currentRound); rs.activeCardId = null; rs.activeNeedId = null; }
    if (STATE.screen === "workbench") { STATE.workbench.activeCardId = null; STATE.workbench.modalStep = "choose"; }
    render();
  });
  var closeModal = $("close-modal");
  if (closeModal) closeModal.addEventListener("click", function () {
    var rs = getRoundState(STATE.currentRound); rs.activeCardId = null; rs.activeNeedId = null; render();
  });
  document.querySelectorAll("[data-choice]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var choice = btn.getAttribute("data-choice");
      var round = ROUNDS[STATE.currentRound]; var rs = getRoundState(STATE.currentRound);
      var e = round.evidence.find(function (x) { return x.id === rs.activeCardId; });
      if (choice === "not-training") { rs.modalStep = "dept"; render(); return; }
      var correct = choice === e.correct;
      rs.phase1[e.id] = { choice: choice, correct: correct };
      DB.saveResponse(rs.attemptId, { phase: "phase1", item_id: e.id, item_label: e.source, learner_choice: choice, correct_choice: e.correct + (e.correct === "not-training" ? "|" + e.dept : ""), is_correct: correct, points_earned: correct ? 1 : 0, points_possible: 1, explain_text: e.explain }).catch(function () {});
      render();
    });
  });
  document.querySelectorAll("[data-dept]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dept = btn.getAttribute("data-dept");
      var round = ROUNDS[STATE.currentRound]; var rs = getRoundState(STATE.currentRound);
      var e = round.evidence.find(function (x) { return x.id === rs.activeCardId; });
      var correct = e.correct === "not-training";
      rs.phase1[e.id] = { choice: "not-training", dept: dept, correct: correct };
      var pts = (correct ? 1 : 0) + (correct && dept === e.dept ? 1 : 0);
      DB.saveResponse(rs.attemptId, { phase: "phase1", item_id: e.id, item_label: e.source, learner_choice: "not-training|" + dept, correct_choice: e.correct + (e.correct === "not-training" ? "|" + e.dept : ""), is_correct: correct, points_earned: pts, points_possible: 2, explain_text: e.explain }).catch(function () {});
      rs.modalStep = "choose"; render();
    });
  });
  var toPhase2 = $("to-round-phase2"); if (toPhase2) toPhase2.addEventListener("click", function () { getRoundState(STATE.currentRound).phase = "phase2"; render(); });

  // --- round: phase2 ---
  document.querySelectorAll("[data-level]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var level = btn.getAttribute("data-level");
      var round = ROUNDS[STATE.currentRound]; var rs = getRoundState(STATE.currentRound);
      var n = round.needs.find(function (x) { return x.id === rs.activeNeedId; });
      var correct = level === n.level;
      rs.phase2[n.id] = { choice: level, correct: correct };
      DB.saveResponse(rs.attemptId, { phase: "phase2", item_id: n.id, item_label: n.text, learner_choice: level, correct_choice: n.level, is_correct: correct, points_earned: correct ? 1 : 0, points_possible: 1, explain_text: n.explain }).catch(function () {});
      render();
    });
  });
  var toPhase3 = $("to-round-phase3"); if (toPhase3) toPhase3.addEventListener("click", function () { getRoundState(STATE.currentRound).phase = "phase3"; render(); });

  // --- round: phase3 ---
  document.querySelectorAll("[data-radj]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var k = btn.getAttribute("data-radj"); var dir = parseInt(btn.getAttribute("data-dir"), 10);
      var round = ROUNDS[STATE.currentRound]; var rs = getRoundState(STATE.currentRound);
      var iv = round.interventions[k]; var val = Math.max(iv.min, Math.min(iv.max, (rs.phase3[k] || 0) + dir * 2));
      rs.phase3[k] = val; render();
    });
  });
  document.querySelectorAll("[data-rhours]").forEach(function (inp) {
    inp.addEventListener("change", function () {
      var k = inp.getAttribute("data-rhours"); var round = ROUNDS[STATE.currentRound]; var rs = getRoundState(STATE.currentRound);
      var iv = round.interventions[k]; var val = parseInt(inp.value, 10); if (isNaN(val)) val = 0;
      rs.phase3[k] = Math.max(iv.min, Math.min(iv.max, val)); render();
    });
  });
  var submitBudget = $("submit-round-budget");
  if (submitBudget) submitBudget.addEventListener("click", function () {
    var round = ROUNDS[STATE.currentRound]; var rs = getRoundState(STATE.currentRound);
    persistPhase3Responses(round, rs).then(function () { rs.phase3Submitted = true; rs.phase = "phase4"; render(); });
  });

  // --- round: phase4 ---
  var nextRoundBtn = $("next-round-btn");
  if (nextRoundBtn) nextRoundBtn.addEventListener("click", function () {
    var nextId = nextRoundBtn.getAttribute("data-next-round");
    STATE.currentRound = nextId; getRoundState(nextId);
    var round = ROUNDS[nextId]; var rs = getRoundState(nextId);
    if (!rs.attemptId) {
      var maxPossible = maxPhase1R(round) + round.needs.length + maxPhase3R(round);
      DB.startAttempt(STATE.learner.id, nextId, maxPossible).then(function (a) { rs.attemptId = a.id; render(); window.scrollTo({ top: 0 }); });
    } else { render(); window.scrollTo({ top: 0 }); }
  });
  var toHubBtn = $("to-hub-btn"); if (toHubBtn) toHubBtn.addEventListener("click", function () { goto("field-office"); });
  var redoBtn = $("redo-round-btn");
  if (redoBtn) redoBtn.addEventListener("click", function () {
    var rs = getRoundState(STATE.currentRound);
    var attemptId = rs.attemptId;
    STATE.roundState[STATE.currentRound] = { phase: "intro", phase1: {}, phase2: {}, phase3: {}, phase3Submitted: false, reported: false, score: 0, maxScore: 0, activeCardId: null, activeNeedId: null, modalStep: "choose", attemptId: attemptId, challengeIdx: null, challengeRevealed: false, challengeAnswer: "" };
    if (attemptId) DB.resetAttempt(attemptId).catch(function () {});
    render();
  });
  var challengeTextarea = $("round-challenge-answer");
  if (challengeTextarea) challengeTextarea.addEventListener("change", function () { getRoundState(STATE.currentRound).challengeAnswer = challengeTextarea.value; });
  var revealChallengeBtn = $("reveal-challenge-btn");
  if (revealChallengeBtn) revealChallengeBtn.addEventListener("click", function () {
    var rs = getRoundState(STATE.currentRound);
    rs.challengeAnswer = $("round-challenge-answer").value; rs.challengeRevealed = true; render();
  });
  var downloadPdfBtn = $("download-learner-pdf");
  if (downloadPdfBtn) downloadPdfBtn.addEventListener("click", function () {
    var round = ROUNDS[STATE.currentRound]; var rs = getRoundState(STATE.currentRound);
    var p1 = scorePhase1R(round, rs), p1max = maxPhase1R(round);
    var p2 = scorePhase2R(round, rs), p2max = round.needs.length;
    var p3 = scorePhase3R(round, rs), p3max = maxPhase3R(round);
    var total = p1 + p2 + p3, max = p1max + p2max + p3max;
    generateLearnerPDF(round, rs, getBadge(pct(total, max)), total, max, pct(total, max));
  });

  // --- workbench ---
  bindWorkbenchEvents();

  // --- trainer ---
  var toggleSession = $("toggle-session-btn");
  if (toggleSession) toggleSession.addEventListener("click", function () {
    DB.setSessionLive(!STATE.sessionLive).then(function (val) { STATE.sessionLive = val; render(); });
  });
  var openAnswerKey = $("open-answerkey-btn"); if (openAnswerKey) openAnswerKey.addEventListener("click", function () { goto("trainer-answerkey"); });
  var downloadCompiled = $("download-compiled-pdf");
  if (downloadCompiled) downloadCompiled.addEventListener("click", function () { generateTrainerCompiledPDF(STATE.trainer.learners); });
  document.querySelectorAll("[data-view-student]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-view-student");
      STATE.trainer.selectedLearnerId = id; STATE.trainer.selectedDetail = null;
      goto("trainer-student");
      DB.fetchStudentDetail(id).then(function (detail) { STATE.trainer.selectedDetail = detail; if (STATE.screen === "trainer-student") render(); });
    });
  });
}

function bindWorkbenchEvents() {
  var w = STATE.workbench;
  var startWb = $("start-wb-btn");
  if (startWb) startWb.addEventListener("click", function () {
    w.phase = "phase1";
    if (!w.attemptId) DB.startAttempt(STATE.learner.id, "workbench", null).then(function (a) { w.attemptId = a.id; render(); });
    else render();
  });
  var addCardBtn = $("wb-add-card");
  if (addCardBtn) addCardBtn.addEventListener("click", function () {
    var src = ($("wb-source").value || "").trim(); var txt = ($("wb-text").value || "").trim();
    if (!src || !txt) { w.addError = true; render(); return; }
    w.addError = false;
    w.cards.push({ id: "wc" + w.nextCardNum, source: src, text: txt, choice: null, dept: null, note: "", level: null, hours: 0, ivName: "" });
    w.nextCardNum++; render();
  });
  document.querySelectorAll("[data-wb-remove]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) { ev.stopPropagation(); w.cards = w.cards.filter(function (c) { return c.id !== btn.getAttribute("data-wb-remove"); }); render(); });
  });
  document.querySelectorAll("[data-wb-card]").forEach(function (btn) {
    btn.addEventListener("click", function () { w.activeCardId = btn.getAttribute("data-wb-card"); w.modalStep = "choose"; render(); });
  });
  document.querySelectorAll("[data-wbchoice]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      w.pendingChoice = btn.getAttribute("data-wbchoice");
      w.modalStep = w.pendingChoice === "not-training" ? "dept" : "note"; render();
    });
  });
  document.querySelectorAll("[data-wbdept]").forEach(function (btn) {
    btn.addEventListener("click", function () { w.pendingDept = btn.getAttribute("data-wbdept"); w.modalStep = "note"; render(); });
  });
  var wbFileCard = $("wb-file-card");
  if (wbFileCard) wbFileCard.addEventListener("click", function () {
    var c = w.cards.find(function (x) { return x.id === w.activeCardId; });
    var noteEl = $("wb-note");
    c.choice = w.pendingChoice; c.dept = w.pendingDept; c.note = noteEl ? noteEl.value.trim() : "";
    w.activeCardId = null; w.modalStep = "choose"; w.pendingChoice = null; w.pendingDept = null; render();
  });
  var toWb2 = $("to-wb-phase2"); if (toWb2) toWb2.addEventListener("click", function () { w.phase = "phase2"; render(); });
  var wbSkip = $("wb-skip-to-brief"); if (wbSkip) wbSkip.addEventListener("click", function () { w.phase = "phase4"; render(); });
  document.querySelectorAll("[data-wb-need]").forEach(function (btn) {
    btn.addEventListener("click", function () { w.activeCardId = btn.getAttribute("data-wb-need"); render(); });
  });
  document.querySelectorAll("[data-wblevel]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var c = w.cards.find(function (x) { return x.id === w.activeCardId; });
      c.level = btn.getAttribute("data-wblevel"); w.activeCardId = null; render();
    });
  });
  var toWb3 = $("to-wb-phase3"); if (toWb3) toWb3.addEventListener("click", function () { w.phase = "phase3"; render(); });
  var wbBudgetInput = $("wb-budget-input");
  if (wbBudgetInput) wbBudgetInput.addEventListener("change", function () { var v = parseInt(wbBudgetInput.value, 10); w.budget = isNaN(v) || v < 0 ? 0 : v; render(); });
  document.querySelectorAll("[data-wbadj]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var c = w.cards.find(function (x) { return x.id === btn.getAttribute("data-wbadj"); });
      c.hours = Math.max(0, (c.hours || 0) + parseInt(btn.getAttribute("data-dir"), 10) * 2); render();
    });
  });
  document.querySelectorAll("[data-wbhours]").forEach(function (inp) {
    inp.addEventListener("change", function () {
      var c = w.cards.find(function (x) { return x.id === inp.getAttribute("data-wbhours"); });
      var v = parseInt(inp.value, 10); c.hours = isNaN(v) || v < 0 ? 0 : v; render();
    });
  });
  document.querySelectorAll("[data-wbname]").forEach(function (inp) {
    inp.addEventListener("change", function () { var c = w.cards.find(function (x) { return x.id === inp.getAttribute("data-wbname"); }); c.ivName = inp.value.trim(); });
  });
  var submitWbBudget = $("submit-wb-budget");
  if (submitWbBudget) submitWbBudget.addEventListener("click", function () { w.phase = "phase4"; render(); });
  var wbCopyBtn = $("wb-copy-btn");
  if (wbCopyBtn) wbCopyBtn.addEventListener("click", function () {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(buildWbBriefText()).catch(function () {});
  });
  var wbDownloadBtn = $("wb-download-btn");
  if (wbDownloadBtn) wbDownloadBtn.addEventListener("click", function () {
    var blob = new Blob([buildWbBriefText()], { type: "text/plain" });
    var url = URL.createObjectURL(blob); var a = document.createElement("a");
    a.href = url; a.download = "tna-workbench-brief.txt"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  });
  var toHubFromWb = $("to-hub-from-wb"); if (toHubFromWb) toHubFromWb.addEventListener("click", function () { goto("field-office"); });
}

/* ============================================================
   INIT
   ============================================================ */
function boot() {
  STATE.screen = "landing";
  render();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
