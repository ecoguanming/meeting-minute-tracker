"use client";

import { useState } from "react";
import SetupStage from "./SetupStage";
import AttendanceStage from "./AttendanceStage";

const STAGES = [
  { title: "Setup", blurb: "Pick or create the meeting on your Google Calendar." },
  { title: "Attendance", blurb: "Confirm who actually showed up." },
  { title: "Matters", blurb: "Write up the minutes and track action items." },
  { title: "Dispatch", blurb: "Email the minutes and set deadline reminders." },
];

export default function MinutesDesk() {
  const [current, setCurrent] = useState(0);
  const [meeting, setMeeting] = useState(null); // { seriesId, seriesTitle, meetingId, title, date, venue, attendees, matters }
  const [nextDate, setNextDate] = useState("");
  const [venue, setVenue] = useState("");
  const [saving, setSaving] = useState(false);

  function handleResolved(payload) {
    setMeeting(payload);
    setVenue(payload.venue || "");
  }

  async function handleContinue() {
    setSaving(true);
    try {
      await fetch(`/api/meetings/${meeting.meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venue, nextDate }),
      });
      setCurrent(1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        width: "100%",
        margin: "16px 0 40px",
        background: "var(--paper)",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid var(--rule)",
      }}
    >
      <div style={{ display: "flex", minHeight: "calc(100vh - 140px)" }}>
        <div
          style={{
            width: 220,
            background: "var(--paper-dim)",
            borderRight: "1px solid var(--rule)",
            padding: "24px 0",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: "0 20px 20px",
              borderBottom: "1px solid var(--rule)",
              marginBottom: 16,
            }}
          >
            <div className="mma-h" style={{ fontSize: 18, fontWeight: 600 }}>
              Minutes desk
            </div>
            <div
              className="mma-mono"
              style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}
            >
              {meeting ? meeting.seriesTitle : "no series loaded"}
            </div>
          </div>
          <div>
            {STAGES.map((s, i) => {
              const isActive = i === current;
              const isDone = i < current;
              const clickable = meeting && i <= current;
              return (
                <button
                  key={s.title}
                  onClick={() => clickable && setCurrent(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    padding: "10px 20px",
                    cursor: clickable ? "pointer" : "default",
                  }}
                >
                  <span
                    className="mma-mono"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: `1px solid ${isActive || isDone ? "transparent" : "var(--rule)"}`,
                      background: isActive ? "var(--ink)" : isDone ? "var(--pine)" : "transparent",
                      color: isActive || isDone ? "var(--paper)" : "var(--ink)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: isActive ? "var(--ink)" : "var(--ink-soft)",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, padding: "36px 48px", overflowY: "auto" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="mma-h" style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>
            {STAGES[current].title}
          </div>
          <div style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 24 }}>
            {STAGES[current].blurb}
          </div>

          {current === 0 && !meeting && <SetupStage onResolved={handleResolved} />}

          {current === 0 && meeting && (
            <div>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid var(--rule)",
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div className="mma-h" style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  {meeting.title}
                </div>
                <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 12 }}>
                  {meeting.date} · series &quot;{meeting.seriesTitle}&quot; · {meeting.matters.length} matter(s) carried forward · {meeting.attendees.length} attendee(s) from the invite
                </div>

                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 6 }}>
                  Venue
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 14, marginBottom: 16 }}
                />

                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 6 }}>
                  Next meeting date (for the calendar invite in minutes)
                </label>
                <input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 14 }}
                />
              </div>
              <button
                disabled={saving}
                onClick={handleContinue}
                style={{ background: "var(--ink)", color: "var(--paper)", border: "none", padding: "11px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}
              >
                {saving ? "saving…" : "Continue to attendance →"}
              </button>
            </div>
          )}

          {current === 1 && meeting && (
            <AttendanceStage
              meetingId={meeting.meetingId}
              initialAttendees={meeting.attendees}
              onContinue={(attendees) => {
                setMeeting((prev) => ({ ...prev, attendees }));
                setCurrent(2);
              }}
            />
          )}

          {current > 1 && (
            <div
              style={{
                background: "#fff",
                border: "1px dashed var(--rule)",
                borderRadius: 10,
                padding: 20,
                fontSize: 13,
                color: "var(--ink-soft)",
              }}
            >
              This stage isn&apos;t wired up yet — it&apos;s coming in a later step of the build.
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
