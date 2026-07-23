"use client";

import { useState } from "react";

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

  const emails = (attendees || []).filter((a) => a.email).map((a) => a.email);
  const remindable = (matters || []).filter((m) => m.deadline && m.actionPartyEmail && m.status !== "green");

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
