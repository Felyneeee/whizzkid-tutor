"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { buildSeed } from "./seed";
import { addDays, rangeDates } from "./dates";

const Ctx = createContext(null);
const pendingGetRequests = new Map();

const BUSINESS_ACTIONS = [
  "notify", "markNotificationsRead", "markBookingNotificationsRead", "markMessageNotificationsRead", "sendMessage",
  "saveTuteeProfile", "saveTutorProfile", "saveAdminProfile", "requestAssessment", "scheduleAssessment", "completeAssessment", "renewReadingAssessment", "cancelAssessment", "cancelTutorialBooking",
  "bookPlaygroup", "cancelPlaygroupBooking", "submitTutorialBooking", "rateSession", "submitLeave",
  "scheduleInterview", "evaluateApplicant", "verifyExistingTutor", "setTutorPay",
  "adminEditTutorAvailability", "setTutorWeeklySchedule", "flagTutorSessionsForReassignment", "decideLeave", "adminLeave", "proposeBookingSchedule",
  "decideBookingScheduleProposal", "confirmBooking", "confirmBookingSession", "confirmReadingAssignment", "rejectReadingAssignment", "rejectBooking", "terminateBooking", "completeSession",
  "checkInSession", "reassignSession", "reassignPlaygroupSession", "proposeSessionReschedule", "cancelSession",
  "updateCohort", "addCohort", "deleteCohort", "removeFromCohort", "assignPlaygroupBooking", "assignPlaygroupWeekday", "approvePlaygroupBooking", "addMaterial", "updateMaterial", "managePaymentSettings",
  "deleteMaterial", "logMaterialAccess",
];

async function requestJson(path, { method = "GET", body } = {}) {
  const dedupeKey = method === "GET" ? path : null;
  if (dedupeKey && pendingGetRequests.has(dedupeKey)) return pendingGetRequests.get(dedupeKey);
  const request = (async () => {
  try {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: payload.error || "The request could not be completed.", status: response.status, payload };
    return { ok: true, payload };
  } catch {
    return { ok: false, error: "Could not reach the server. Check that the app is running and try again." };
  }
  })();
  if (dedupeKey) pendingGetRequests.set(dedupeKey, request);
  try {
    return await request;
  } finally {
    if (dedupeKey && pendingGetRequests.get(dedupeKey) === request) pendingGetRequests.delete(dedupeKey);
  }
}

function cleanLegacyState(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.users)) return null;
  const copy = structuredClone(value);
  copy.users = copy.users.map(({ password, ...user }) => user);
  delete copy.progressReports;
  return copy;
}

async function loadPublicState() {
  const fresh = buildSeed();
  const result = await requestJson("/api/public");
  if (result.ok) fresh.hirings = result.payload.hirings || [];
  return fresh;
}

export function useStore() {
  const store = useContext(Ctx);
  if (!store) throw new Error("useStore outside provider");
  return store;
}

export function StoreProvider({ children }) {
  const [db, setDb] = useState(() => buildSeed());
  const [revision, setRevision] = useState(null);
  const [ready, setReady] = useState(false);
  const [meId, setMeId] = useState(null);
  const [actionFeedback, setActionFeedback] = useState("idle");
  const dbRef = useRef(db);
  const revisionRef = useRef(null);
  const liveRefreshInFlight = useRef(false);
  const legacyDbRef = useRef(null);
  const pendingActions = useRef(0);
  const actionFeedbackTimers = useRef([]);

  const acceptState = useCallback((next, nextRevision) => {
    dbRef.current = next;
    setDb(next);
    if (nextRevision != null && Number.isFinite(Number(nextRevision))) {
      const normalizedRevision = Number(nextRevision);
      revisionRef.current = normalizedRevision;
      setRevision(normalizedRevision);
    }
  }, []);

  const runBusinessAction = useCallback(async (name, args) => {
    if (pendingActions.current++ === 0) {
      setActionFeedback("idle");
      actionFeedbackTimers.current = [
        setTimeout(() => setActionFeedback("saving"), 160),
        setTimeout(() => setActionFeedback("slow"), 900),
      ];
    }
    try {
      const result = await requestJson("/api/state/action", { method: "POST", body: { action: name, args } });
      if (!result.ok) {
        if (result.payload?.db) acceptState(result.payload.db, result.payload.revision);
        return { ...(result.payload?.result || {}), ok: false, error: result.error };
      }
      if (result.payload.db) acceptState(result.payload.db, result.payload.revision);
      return result.payload.result ?? { ok: true };
    } finally {
      pendingActions.current = Math.max(0, pendingActions.current - 1);
      if (pendingActions.current === 0) {
        actionFeedbackTimers.current.forEach(clearTimeout);
        actionFeedbackTimers.current = [];
        setActionFeedback("idle");
      }
    }
  }, [acceptState]);

  const loadState = useCallback(async (user) => {
    let response = await requestJson("/api/state");
    if (!response.ok) return response;
    let data = response.payload;
    let migratedLegacy = false;
    if (!data.initialized && user.role === "admin") {
      migratedLegacy = legacyDbRef.current !== null;
      response = await requestJson("/api/state/initialize", {
        method: "POST",
        body: { db: legacyDbRef.current || buildSeed() },
      });
      if (!response.ok) return response;
      data = response.payload;
      legacyDbRef.current = null;
    }
    if (migratedLegacy) {
      try { localStorage.removeItem("whizzkids-app-db"); } catch { /* storage may be unavailable */ }
    }
    acceptState(data.db, data.revision);
    return { ok: true, payload: data };
  }, [acceptState]);

  const refreshState = useCallback(async (user) => {
    const loaded = await loadState(user);
    if (!loaded.ok) return { ok: false, error: loaded.error };
    return { ok: true };
  }, [loadState]);

  const refreshSlotAvailability = useCallback(async (request) => {
    const response = await requestJson("/api/state/slot-availability", { method: "POST", body: request });
    if (!response.ok) return { ok: false, error: response.error };
    return { ok: true, available: response.payload.available || {} };
  }, []);

  const me = useMemo(() => db.users?.find((user) => user.id === meId) ?? null, [db, meId]);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const raw = localStorage.getItem("whizzkids-app-db");
        legacyDbRef.current = raw ? cleanLegacyState(JSON.parse(raw)) : null;
      } catch {
        legacyDbRef.current = null;
      }
      const session = await requestJson("/api/auth/me");
      if (cancelled) return;
      if (session.ok && session.payload.user) {
        setMeId(session.payload.user.id);
        await loadState(session.payload.user);
      } else {
        try { localStorage.removeItem("whizzkids-app-session"); } catch { /* storage may be unavailable */ }
        acceptState(await loadPublicState());
      }
      if (!cancelled) setReady(true);
    };
    void start();
    return () => { cancelled = true; };
  }, [acceptState, loadState]);

  useEffect(() => {
    if (!ready || !me || revision == null) return;
    let stopped = false;
    const refreshIfChanged = async () => {
      if (stopped || document.visibilityState !== "visible" || liveRefreshInFlight.current) return;
      liveRefreshInFlight.current = true;
      try {
        const response = await requestJson("/api/state/revision");
        if (!response.ok || !response.payload) return;
        const latestRevision = Number(response.payload.revision);
        if (Number.isFinite(latestRevision) && latestRevision > (revisionRef.current ?? 0)) {
          await loadState(me);
        }
      } finally {
        liveRefreshInFlight.current = false;
      }
    };
    const timer = window.setInterval(() => void refreshIfChanged(), 2000);
    document.addEventListener("visibilitychange", refreshIfChanged);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfChanged);
    };
  }, [ready, me, revision, loadState]);

  const store = useMemo(() => {
    const login = async (identifier, password) => {
      const result = await requestJson("/api/auth/login", { method: "POST", body: { identifier, password } });
      if (!result.ok) return { ok: false, error: result.error };
      setMeId(result.payload.user.id);
      const loaded = await refreshState(result.payload.user);
      if (!loaded.ok) return loaded;
      return { ok: true, user: result.payload.user };
    };

    const register = async (path, value) => {
      const result = await requestJson(path, { method: "POST", body: value });
      if (!result.ok) return { ok: false, error: result.error };
      setMeId(result.payload.user.id);
      const loaded = await refreshState(result.payload.user);
      if (!loaded.ok) return loaded;
      return { ok: true, user: result.payload.user };
    };

    const actions = Object.fromEntries(BUSINESS_ACTIONS.map((name) => [name, (...args) => runBusinessAction(name, args)]));

    return {
      db, ready, me, revision, actionFeedback, refreshSlotAvailability, refreshState,
      login,
      logout() {
        void requestJson("/api/auth/logout", { method: "POST" });
        setMeId(null);
        setRevision(null);
        void loadPublicState().then(acceptState);
      },
      resetDemo() { this.logout(); },
      registerTutee(value) { return register("/api/auth/register/tutee", value); },
      registerTutor(value) { return register("/api/auth/register/tutor", value); },
      ...actions,
    };
  }, [acceptState, actionFeedback, db, ready, me, revision, refreshSlotAvailability, refreshState, runBusinessAction]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export { addDays, rangeDates };
