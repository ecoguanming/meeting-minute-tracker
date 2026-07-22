"use client";

import { useState } from "react";

const STAGES = [
  { title: "Setup", blurb: "Pick or create the meeting on your Google Calendar." },
  { title: "Attendance", blurb: "Confirm who actually showed up." },
  { title: "Matters", blurb: "Write up the minutes and track action items." },
  { title: "Dispatch", blurb: "Email the minutes and set deadline reminders." },
];

export default function MinutesDesk() {
  const [current, setCurrent] = useState(0);

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "40px auto",
        background: "var(--paper)",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid var(--rule)",
      }}
    >
      <div style={{ display: "flex", minHeight: 560 }}>
        <div
          style={{
            width: 190,
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
              milestone 1 — shell only
            </div>
          </div>
          <div>
            {STAGES.map((s, i) => {
              const isActive = i === current;
              const isDone = i < current;
              return (
                <button
                  key={s.title}
                  onClick={() => setCurrent(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    padding: "10px 20px",
                    cursor: "pointer",
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

        <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
          <div className="mma-h" style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
            {STAGES[current].title}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 20 }}>
            {STAGES[current].blurb}
          </div>
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
        </div>
      </div>
    </div>
  );
}
