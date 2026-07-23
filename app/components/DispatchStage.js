"use client";

import { useEffect, useState } from "react";

const STATUS_META = {
  grey: { label: "not started", color: "var(--grey)" },
  yellow: { label: "in progress", color: "var(--yellow)" },
  green: { label: "completed", color: "var(--green)" },
  red: { label: "delayed", color: "var(--red)" },
};

export default function DispatchStage({ seriesId, meetingId, attendees, matters, onClosed }) {
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState("");
  const [result, setResult] = useState(null);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);

  const [msConnected, setMsConnected] = useState(false);
  const [msEmail, setMsEmail] = useState(null);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [sendingTasks, setSendingTasks] = useState(false);
  const [taskResult, setTaskResult] = useState(null);
  const [taskError, setTaskError] = useState("");

  const emails = (attendees || []).filter((a) => a.email).map((a) => a.email);
  const remindable = (matters || []).filter((m) => m.deadline && m.actionPartyEmail && m.status !== "green");
  const assignable = (matters || []).filter((m) => m.matter && m.actionPartyEmail && m.status !== "green");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/microsoft/status");
        const data = await res.json();
        if (cancelled) return;
        setMsConnected(!!data.connected);
        setMsEmail(data.email || null);
        if (data.connected) loadPlans();
      } catch {
        // ignore — treat as not connected
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPlans() {
    setPlansLoading(true);
    setPlansError("");
    try {
      const res = await fetch("/api/microsoft/plans");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to load Teams plans");
      setPlans(data.plans || []);
      if (data.plans?.length) setSelectedPlanId(data.plans[0].id);
    } catch (err) {
      setPlansError(err.message);
    } finally {
      setPlansLoading(false);
    }
  }

  async function handleSendTasks() {
    setSendingTasks(true);
    setTaskError("");
    try {
      const res = await fetch("/api/microsoft/dispatch-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId, matters: assignable }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to send tasks");
      setTaskResult(data);
    } catch (err) {
      setTaskError(err.message);
    } finally {
      setSendingTasks(false);
    }
  }

  async function handleDispatch() {
    setDispatching(true);
    setDispatchError("");
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "dispatch failed");
      setResult(data);
    } catch (err) {
      setDispatchError(err.message);
    } finally {
      setDispatching(false);
    }
  }

  async function handleClose() {
    setClosing(true);
    try {
      const res = await fetch(`/api/series/${seriesId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });
      await res.json();
      setClosed(true);
    } finally {
      setClosing(false);
    }
  }

  return (
    <div>
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--rule)",
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 6 }}>
          to
        </div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>
          {emails.length ? emails.join(", ") : <span style={{ color: "var(--danger)" }}>no attendee emails set</span>}
        </div>
        <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 6 }}>
          reminders (3 days before deadline)
        </div>
        <div style={{ fontSize: 13 }}>
          {remindable.length
            ? remindable.map((m, i) => (
                <div key={i}>
                  {m.matter} — {m.actionParty} — due {m.deadline}
                </div>
              ))
            : "none pending"}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 6 }}>
          status legend
        </div>
        {Object.keys(STATUS_META).map((k) => (
          <span key={k} style={{ marginRight: 14, fontSize: 12 }}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: STATUS_META[k].color,
                marginRight: 6,
                verticalAlign: -1,
              }}
            />
            {STATUS_META[k].label}
          </span>
        ))}
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid var(--rule)",
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 10 }}>
          send action items to Microsoft Teams
        </div>

        {!msConnected && (
          <a
            href="/api/microsoft/connect"
            style={{
              display: "inline-block",
              background: "var(--brass)",
              color: "#fff",
              border: "none",
              padding: "9px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Connect Microsoft account
          </a>
        )}

        {msConnected && (
          <div>
            <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 10 }}>
              connected as {msEmail}
            </div>

            {plansLoading && <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>loading your Teams plans…</div>}
            {plansError && <div style={{ fontSize: 12, color: "var(--danger)" }}>{plansError}</div>}

            {!plansLoading && !plansError && plans.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                No Planner plans found — you need to be a member of at least one Team with a Planner board.
              </div>
            )}

            {plans.length > 0 && (
              <>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--rule)",
                    borderRadius: 8,
                    fontSize: 13,
                    marginBottom: 10,
                    marginRight: 10,
                  }}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!assignable.length || sendingTasks}
                  onClick={handleSendTasks}
                  style={{
                    background: "var(--brass)",
                    color: "#fff",
                    border: "none",
                    padding: "9px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    opacity: assignable.length && !sendingTasks ? 1 : 0.5,
                    cursor: assignable.length && !sendingTasks ? "pointer" : "not-allowed",
                  }}
                >
                  {sendingTasks ? "sending…" : `Send ${assignable.length} action item(s) to Teams`}
                </button>
              </>
            )}

            {taskError && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 10 }}>{taskError}</div>}

            {taskResult && (
              <div style={{ fontSize: 13, marginTop: 10, color: "var(--pine)" }}>
                Created {taskResult.created} of {taskResult.total} task(s) in Teams.
                {taskResult.notes && (
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>{taskResult.notes}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        disabled={!emails.length || dispatching}
        onClick={handleDispatch}
        style={{
          background: "var(--pine)",
          color: "#fff",
          border: "none",
          padding: "11px 20px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          opacity: emails.length && !dispatching ? 1 : 0.5,
          cursor: emails.length && !dispatching ? "pointer" : "not-allowed",
        }}
      >
        {dispatching ? "sending…" : "Generate, send and remind"}
      </button>

      {dispatchError && (
        <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 10 }}>{dispatchError}</div>
      )}

      {result && (
        <div
          style={{
            marginTop: 24,
            border: `2px solid ${result.email_sent ? "var(--pine)" : "var(--danger)"}`,
            borderRadius: 10,
            padding: "18px 20px",
            background: "#fff",
          }}
        >
          <div
            className="mma-h"
            style={{ fontWeight: 600, color: result.email_sent ? "var(--pine)" : "var(--danger)", marginBottom: 8 }}
          >
            {result.email_sent ? "DISPATCHED" : "NEEDS ATTENTION"}
          </div>
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            Email to {emails.join(", ")}: <strong>{result.email_sent ? "sent" : "not confirmed"}</strong>
          </div>
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            Reminders created: <strong>{result.events_created ?? 0}</strong> of {result.remindable_count ?? remindable.length}
          </div>
          {result.notes && (
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-soft)",
                marginTop: 10,
                borderTop: "1px solid var(--rule)",
                paddingTop: 10,
              }}
            >
              {result.notes}
            </div>
          )}
        </div>
      )}

      {result && !closed && (
        <div style={{ marginTop: 16 }}>
          <button
            disabled={closing}
            onClick={handleClose}
            style={{
              background: "var(--brass)",
              color: "#fff",
              border: "none",
              padding: "11px 20px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {closing ? "closing…" : "Close meeting and carry matters forward"}
          </button>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 8 }}>
            Completed items get struck through next time, then drop off the meeting after that.
          </div>
        </div>
      )}

      {closed && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: "var(--pine)", marginBottom: 12 }}>
            Meeting closed.
          </div>
          <button
            onClick={onClosed}
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              border: "none",
              padding: "11px 20px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Start a new meeting
          </button>
        </div>
      )}
    </div>
  );
}
