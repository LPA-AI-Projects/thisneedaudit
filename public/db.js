// ============================================================
// The Needs Audit — data access layer (Railway Postgres via API)
// ============================================================

var DB = (function () {
  "use strict";

  function api(path, options) {
    var opts = options || {};
    return fetch(path, {
      method: opts.method || "GET",
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || ("Request failed (" + res.status + ")"));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function poll(fn, intervalMs, cb) {
    var stopped = false;
    var timer = null;
    function tick() {
      if (stopped) return;
      Promise.resolve()
        .then(fn)
        .then(function (value) { if (!stopped) cb(value); })
        .catch(function () {})
        .then(function () {
          if (!stopped) timer = setTimeout(tick, intervalMs);
        });
    }
    tick();
    return function () {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  return {
    mode: "api",
    isLocalPreview: false,

    loginLearner: function (name, email) {
      return api("/api/learner/login", {
        method: "POST",
        body: { name: name, email: email },
      });
    },

    loginTrainer: function (code) {
      return api("/api/trainer/login", {
        method: "POST",
        body: { code: code },
      }).then(function () {
        return true;
      }).catch(function (err) {
        if (err.status === 401) return false;
        throw err;
      });
    },

    logout: function () {
      return api("/api/logout", { method: "POST" }).catch(function () {});
    },

    getSessionLive: function () {
      return api("/api/session/live").then(function (data) {
        return !!data.is_live;
      });
    },

    setSessionLive: function (val) {
      return api("/api/session/live", {
        method: "POST",
        body: { is_live: !!val },
      }).then(function (data) {
        return !!data.is_live;
      });
    },

    subscribeSessionLive: function (cb) {
      return poll(function () {
        return api("/api/session/live").then(function (data) {
          return !!data.is_live;
        });
      }, 2000, cb);
    },

    startAttempt: function (learnerId, caseId, maxScore) {
      return api("/api/attempts/start", {
        method: "POST",
        body: { caseId: caseId, maxScore: maxScore },
      });
    },

    saveResponse: function (attemptId, resp) {
      var row = Object.assign({ attempt_id: attemptId }, resp);
      return api("/api/responses", { method: "POST", body: row });
    },

    resetAttempt: function (attemptId) {
      return api("/api/attempts/" + encodeURIComponent(attemptId) + "/reset", {
        method: "POST",
        body: {},
      }).then(function () {
        return true;
      });
    },

    completeAttempt: function (attemptId, score, maxScore, badge) {
      return api("/api/attempts/" + encodeURIComponent(attemptId) + "/complete", {
        method: "POST",
        body: { score: score, maxScore: maxScore, badge: badge },
      });
    },

    fetchAllLearnersWithProgress: function () {
      return api("/api/learners");
    },

    subscribeLearners: function (cb) {
      return poll(function () {
        return api("/api/learners");
      }, 3000, cb);
    },

    fetchStudentDetail: function (learnerId) {
      return api("/api/learners/" + encodeURIComponent(learnerId));
    },
  };
})();
