"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function MultiSelectAttendees({ attendees, selectedNames, onChange }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 180 });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        panelRef.current &&
        !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleToggleOpen() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 180) });
    }
    setOpen((prev) => !prev);
  }

  function toggleName(name) {
    const isSelected = selectedNames.includes(name);
    const next = isSelected ? selectedNames.filter((n) => n !== name) : [...selectedNames, name];
    onChange(next);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggleOpen}
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
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
              zIndex: 1000,
              background: "#fff",
              border: "1px solid var(--rule)",
              borderRadius: 8,
              padding: 8,
              maxHeight: 260,
              overflowY: "auto",
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
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
                    onChange={() => toggleName(name)}
                  />
                  {name}
                </label>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
