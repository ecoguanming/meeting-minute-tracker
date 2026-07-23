"use client";

import { useState } from "react";

export default function AttendanceStage({ meetingId, initialAttendees, onContinue }) {
  const [attendees, setAttendees] = useState(
    (initialAttendees || []).map((a) => ({ name: a.name || "", email: a.email || "", attended: a.attended !== false }))
  );
  const [saving, setSaving] = useState(false);

  function updateField(i, field, value) {
    setAttendees((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  }

  function removeAttendee(i) {
    setAttendees((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addAttendee() {
    setAttendees((prev) => [...prev, { name: "", email: "", attended: true }]);
  }

  async function handleContinue() {
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/attendees`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendees }),
      });
      const data = await res.json();
      onContinue(data.attendees || attendees);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--rule)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--rule)" }}>name</th>
              <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--rule)" }}>email</th>
              <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)", width: 80 }}>present</th>
              <th style={{ width: 40, borderBottom: "1px solid var(--rule)" }}></th>
            </tr>
          </thead>
          <tbody>
            {attendees.map((a, i) => (
              <tr key={i}>
                <td style={{ padding: "6px 10px" }}>
                  <input
                    type="text"
                    value={a.name}
                    onChange={(e) => updateField(i, "name", e.target.value)}
                    style={{ width: "100%", border: "none", fontSize: 13, padding: 4 }}
                  />
                </td>
                <td style={{ padding: "6px 10px" }}>
                  <input
                    type="text"
                    placeholder="name@company.com"
                    value={a.email}
                    onChange={(e) => updateField(i, "email", e.target.value)}
                    style={{ width: "100%", border: "none", fontSize: 13, padding: 4 }}
                  />
                </td>
                <td style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={a.attended}
                    onChange={(e) => updateField(i, "attended", e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                </td>
                <td style={{ textAlign: "center" }}>
                  <button
                    onClick={() => removeAttendee(i)}
                    style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 16, cursor: "pointer" }}
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {attendees.length === 0 && (
          <div className="mma-mono" style={{ fontSize: 12, color: "var(--ink-soft)", padding: 14 }}>
            no attendees yet
          </div>
        )}
      </div>

      <button
        onClick={addAttendee}
        className="mma-mono"
        style={{ marginTop: 10, fontSize: 11, background: "none", border: "1px solid var(--rule)", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}
      >
        + add attendee
      </button>

      <div style={{ marginTop: 24 }}>
        <button
          disabled={saving}
          onClick={handleContinue}
          style={{ background: "var(--ink)", color: "var(--paper)", border: "none", padding: "11px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}
        >
          {saving ? "saving…" : "Continue to matters →"}
        </button>
      </div>
    </div>
  );
}
