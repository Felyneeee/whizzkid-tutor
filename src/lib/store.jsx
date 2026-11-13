"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { buildSeed } from "./seed";
import { addDays, rangeDates } from "./dates";

const Ctx = createContext(null);

const BUSINESS_ACTIONS = [
  "notify", "markNotificationsRead", "markMessageNotificationsRead", "sendMessage",
  "saveTuteeProfile", "saveTutorProfile", "requestAssessment", "scheduleAssessment", "completeAssessment", "cancelAssessment", "cancelTutorialBooking",
  "bookPlaygroup", "submitTutorialBooking", "placeOrder", "rateSession", "submitAvailability", "submitLeave",
  "scheduleInterview", "evaluateApplicant", "verifyExistingTutor", "setTutorPay", "approveAvailability",
  "adminEditTutorAvailability", "setTutorWeeklySchedule", "rejectAvailability", "decideLeave", "adminLeave", "proposeBookingSchedule",
  "decideBookingScheduleProposal", "confirmBooking", "confirmBookingSession", "confirmReadingAssignment", "rejectReadingAssignment", "rejectBooking", "terminateBooking", "completeSession",
  "submitProgressReport", "checkInSession", "reassignSession", "proposeSessionReschedule", "cancelSession",
  "updateCohort", "addCohort", "removeFromCohort", "assignPlaygroupBooking", "assignPlaygroupWeekday", "approvePlaygroupBooking", "updatePurchase", "addMaterial", "updateMaterial",
  "deleteMaterial", "logMaterialAccess",
];

async function requestJson(path, { method = "GET", body } = {}) {
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
}

function cleanLegacyState(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.users)) return null;
  const copy = structuredClone(value);
  copy.users = copy.users.map(({ password, ...user }) => user);
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
  const [ready, setReady] = useState(false);
  const [meId, setMeId] = useState(null);
  const [actionFeedback, setActionFeedback] = useState("idle");
  const dbRef = useRef(db);
  const legacyDbRef = useRef(null);
  const pendingActions = useRef(0);
  const actionFeedbackTimers = useRef([]);

  const acceptState = useCallback((next) => {
    dbRef.current = next;
    setDb(next);
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
      if (!result.ok) return { ok: false, error: result.error };
      if (result.payload.db) acceptState(result.payload.db);
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
    acceptState(data.db);
    return { ok: true, payload: data };
  }, [acceptState]);

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

  const me = useMemo(() => db.users?.find((user) => user.id === meId) ?? null, [db, meId]);

  const store = useMemo(() => {
    const refreshState = async (user) => {
      const loaded = await loadState(user);
      if (!loaded.ok) return { ok: false, error: loaded.error };
      return { ok: true };
    };

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
      db, ready, me, actionFeedback,
      login,
      logout() {
        void requestJson("/api/auth/logout", { method: "POST" });
        setMeId(null);
        void loadPublicState().then(acceptState);
      },
      resetDemo() { this.logout(); },
      registerTutee(value) { return register("/api/auth/register/tutee", value); },
      registerTutor(value) { return register("/api/auth/register/tutor", value); },
      ...actions,
    };
  }, [acceptState, actionFeedback, db, loadState, ready, me, runBusinessAction]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export { addDays, rangeDates };
