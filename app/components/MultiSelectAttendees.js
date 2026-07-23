"use client";

import { useEffect, useRef, useState } from "react";

export default function MultiSelectAttendees({ attendees, selectedNames, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(name) {
    const isSelected = selectedNames.includes(name);
    const next = isSelected ? selectedNames.filter((n) => n !== name) : [...selectedNames, name];
    onChange(next);
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: "100%",
          textAlign: "left",
          border: "none",
          background: "transparent",
          fontSize: 12,
          padding: 4,
          cursor: "pointer",
          color: selectedNames.length ? "var(--ink)" : "var(--ink-soft)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {selectedNames.length ? selectedNames.join(", ") : "—"}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 20,
            background: "#fff",
            border: "1px solid var(--rule)",
            borderRadius: 8,
            padding: 8,
            minWidth: 180,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          }}
        >
          {(attendees || []).length === 0 && (
            <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              no attendees yet
            </div>
          )}
          {(attendees || []).map((a, i) => {
            const name = a.name || a.email;
            return (
              <label
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  padding: "4px 2px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedNames.includes(name)}
                  onChange={() => toggle(name)}
                />
                {name}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
