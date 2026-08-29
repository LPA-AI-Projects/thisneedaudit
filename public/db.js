// ============================================================
// The Needs Audit — data access layer
//
// Exposes one object, DB, with the same async methods regardless of
// backend. If config.js still has placeholder Supabase values, DB runs
// in LOCAL PREVIEW MODE (everything works in one browser, nothing syncs
// across devices) — this is also what lets the whole app be tested
// without a live Supabase project.
// ============================================================

var DB = (function () {
  "use strict";

  var cfg = window.APP_CONFIG || {};
  var isConfigured = cfg.SUPABASE_URL && cfg.SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
                      cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  /* ============================================================
     LOCAL PREVIEW BACKEND
     ============================================================ */
  function makeLocalBackend() {
    var STORAGE_KEY = "tna_local_db_v1";
    var store = loadStore();
    var listeners = { learners: [], session: [] };

    function loadStore() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return { learners: {}, attempts: {}, responses: {}, session_control: { is_live: false } };
    }
    function persist() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch (e) {}
    }
    function notifyLearners() { listeners.learners.forEach(function (cb) { cb(assembleLearners()); }); }
    function notifySession() { listeners.session.forEach(function (cb) { cb(store.session_control.is_live); }); }

    function assembleLearners() {
      return Object.keys(store.learners).map(function (id) {
        var l = store.learners[id];
        var attempts = Object.keys(store.attempts)
          .map(function (aid) { return store.attempts[aid]; })
          .filter(function (a) { return a.learner_id === id; });
        return { id: l.id, name: l.name, email: l.email, created_at: l.created_at, attempts: attempts };
      }).sort(function (a, b) { return (a.created_at || "").localeCompare(b.created_at || ""); });
    }

    return {
      mode: "local",

      loginLearner: function (name, email) {
        var existingId = localStorage.getItem("tna_local_learner_id");
        var id = existingId && store.learners[existingId] ? existingId : uuid();
        store.learners[id] = { id: id, name: name, email: email, created_at: store.learners[id] ? store.learners[id].created_at : new Date().toISOString() };
        localStorage.setItem("tna_local_learner_id", id);
        persist(); notifyLearners();
        return Promise.resolve(store.learners[id]);
      },

      loginTrainer: function (code) {
        return code === (cfg.TRAINER_CODE || "2468");
      },

      getSessionLive: function () { return Promise.resolve(store.session_control.is_live); },
      setSessionLive: function (val) {
        store.session_control.is_live = !!val; persist(); notifySession();
        return Promise.resolve(store.session_control.is_live);
      },
      subscribeSessionLive: function (cb) { listeners.session.push(cb); return function () {}; },

      startAttempt: function (learnerId, caseId, maxScore) {
        var existing = Object.keys(store.attempts).map(function (k) { return store.attempts[k]; })
          .find(function (a) { return a.learner_id === learnerId && a.case_id === caseId; });
        if (existing) return Promise.resolve(existing);
        var id = uuid();
        var row = { id: id, learner_id: learnerId, case_id: caseId, status: "in_progress", score: null, max_score: maxScore, badge: null, started_at: new Date().toISOString(), completed_at: null, updated_at: new Date().toISOString() };
        store.attempts[id] = row; persist(); notifyLearners();
        return Promise.resolve(row);
      },

      saveResponse: function (attemptId, resp) {
        var id = uuid();
        store.responses[id] = Object.assign({ id: id, attempt_id: attemptId, created_at: new Date().toISOString() }, resp);
        persist();
        return Promise.resolve(store.responses[id]);
      },

      resetAttempt: function (attemptId) {
        Object.keys(store.responses).forEach(function (k) { if (store.responses[k].attempt_id === attemptId) delete store.responses[k]; });
        if (store.attempts[attemptId]) {
          store.attempts[attemptId].status = "in_progress";
          store.attempts[attemptId].score = null; store.attempts[attemptId].badge = null; store.attempts[attemptId].completed_at = null;
        }
        persist(); notifyLearners();
        return Promise.resolve(true);
      },

      completeAttempt: function (attemptId, score, maxScore, badge) {
        var a = store.attempts[attemptId];
        if (a) { a.status = "complete"; a.score = score; a.max_score = maxScore; a.badge = badge; a.completed_at = new Date().toISOString(); a.updated_at = a.completed_at; }
        persist(); notifyLearners();
        return Promise.resolve(a);
      },

      subscribeLearners: function (cb) { listeners.learners.push(cb); cb(assembleLearners()); return function () {}; },
      fetchAllLearnersWithProgress: function () { return Promise.resolve(assembleLearners()); },

      fetchStudentDetail: function (learnerId) {
        var l = store.learners[learnerId];
        if (!l) return Promise.resolve(null);
        var attempts = Object.keys(store.attempts).map(function (k) { return store.attempts[k]; })
          .filter(function (a) { return a.learner_id === learnerId; })
          .map(function (a) {
            var responses = Object.keys(store.responses).map(function (k) { return store.responses[k]; })
              .filter(function (r) { return r.attempt_id === a.id; });
            return Object.assign({}, a, { responses: responses });
          });
        return Promise.resolve({ learner: l, attempts: attempts });
      }
    };
  }

  /* ============================================================
     SUPABASE BACKEND
     ============================================================ */
  function makeSupabaseBackend() {
    var client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    var currentLearnerId = null;

    function ensureAnonSession() {
      return client.auth.getSession().then(function (res) {
        if (res.data && res.data.session) return res.data.session;
        return client.auth.signInAnonymously().then(function (res2) {
          if (res2.error) throw res2.error;
          return res2.data.session;
        });
      });
    }

    return {
      mode: "supabase",

      loginLearner: function (name, email) {
        return ensureAnonSession().then(function () {
          return client.auth.getUser();
        }).then(function (userRes) {
          var uid = userRes.data.user.id;
          return client.from("learners").upsert({ user_id: uid, name: name, email: email }, { onConflict: "user_id" }).select().single();
        }).then(function (res) {
          if (res.error) throw res.error;
          currentLearnerId = res.data.id;
          return res.data;
        });
      },

      loginTrainer: function (code) {
        return code === (cfg.TRAINER_CODE || "2468");
      },

      getSessionLive: function () {
        return client.from("session_control").select("is_live").eq("id", 1).single().then(function (res) {
          if (res.error) throw res.error;
          return !!(res.data && res.data.is_live);
        });
      },
      setSessionLive: function (val) {
        return client.from("session_control").update({ is_live: !!val, updated_at: new Date().toISOString() }).eq("id", 1).then(function (res) {
          if (res.error) throw res.error;
          return !!val;
        });
      },
      subscribeSessionLive: function (cb) {
        var ch = client.channel("session-live")
          .on("postgres_changes", { event: "*", schema: "public", table: "session_control" }, function (payload) {
            cb(!!(payload.new && payload.new.is_live));
          }).subscribe();
        return function () { client.removeChannel(ch); };
      },

      startAttempt: function (learnerId, caseId, maxScore) {
        return client.from("attempts").select("*").eq("learner_id", learnerId).eq("case_id", caseId).maybeSingle().then(function (res) {
          if (res.error) throw res.error;
          if (res.data) return res.data;
          return client.from("attempts").insert({ learner_id: learnerId, case_id: caseId, status: "in_progress", max_score: maxScore }).select().single().then(function (r2) {
            if (r2.error) throw r2.error;
            return r2.data;
          });
        });
      },

      saveResponse: function (attemptId, resp) {
        var row = Object.assign({ attempt_id: attemptId }, resp);
        return client.from("responses").insert(row).select().single().then(function (res) {
          if (res.error) throw res.error;
          return res.data;
        });
      },

      resetAttempt: function (attemptId) {
        return client.from("responses").delete().eq("attempt_id", attemptId).then(function (res) {
          if (res.error) throw res.error;
          return client.from("attempts").update({ status: "in_progress", score: null, badge: null, completed_at: null, updated_at: new Date().toISOString() }).eq("id", attemptId);
        }).then(function (res) {
          if (res.error) throw res.error;
          return true;
        });
      },

      completeAttempt: function (attemptId, score, maxScore, badge) {
        return client.from("attempts").update({ status: "complete", score: score, max_score: maxScore, badge: badge, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", attemptId).select().single().then(function (res) {
          if (res.error) throw res.error;
          return res.data;
        });
      },

      fetchAllLearnersWithProgress: function () {
        return client.from("learners").select("id,name,email,created_at,attempts(case_id,status,score,max_score,badge,completed_at,updated_at)").order("created_at", { ascending: true }).then(function (res) {
          if (res.error) throw res.error;
          return res.data;
        });
      },

      subscribeLearners: function (cb) {
        var self = this;
        var refresh = function () { self.fetchAllLearnersWithProgress().then(cb).catch(function () {}); };
        refresh();
        var ch = client.channel("trainer-dashboard")
          .on("postgres_changes", { event: "*", schema: "public", table: "learners" }, refresh)
          .on("postgres_changes", { event: "*", schema: "public", table: "attempts" }, refresh)
          .on("postgres_changes", { event: "*", schema: "public", table: "responses" }, refresh)
          .subscribe();
        return function () { client.removeChannel(ch); };
      },

      fetchStudentDetail: function (learnerId) {
        return client.from("learners").select("id,name,email,attempts(id,case_id,status,score,max_score,badge,completed_at,responses(*))").eq("id", learnerId).single().then(function (res) {
          if (res.error) throw res.error;
          return { learner: { id: res.data.id, name: res.data.name, email: res.data.email }, attempts: res.data.attempts || [] };
        });
      }
    };
  }

  var backend = isConfigured ? makeSupabaseBackend() : makeLocalBackend();
  backend.isLocalPreview = !isConfigured;
  return backend;
})();
