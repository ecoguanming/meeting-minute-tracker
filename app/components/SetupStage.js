"use client";

import { useEffect, useState } from "react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n) {
  return String(n).padStart(2, "0");
}
function dateStr(y, m, d) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

export default function SetupStage({ onResolved }) {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth()); // 0-11
  const [eventsByDay, setEventsByDay] = useState({});
  const [status, setStatus] = useState("");
  const [createForDate, setCreateForDate] = useState(null);
  const [newSubject, setNewSubject] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [newLocation, setNewLocation] = useState("");
  const [newAttendees, setNewAttendees] = useState("");
  const [creating, setCreating] = useState(false);

  const [pendingEvent, setPendingEvent] = useState(null);
  const [needsSeriesName, setNeedsSeriesName] = useState(false);
  const [seriesNameInput, setSeriesNameInput] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    loadMonth(calYear, calMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calYear, calMonth]);

  async function loadMonth(year, month) {
    setStatus("loading Google Calendar…");
    try {
      const res = await fetch(`/api/calendar/events?year=${year}&month=${month + 1}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to load calendar");
      const byDay = {};
      (data.events || []).forEach((e) => {
        const d = (e.start || "").slice(0, 10);
        if (!d) return;
        (byDay[d] = byDay[d] || []).push(e);
      });
      setEventsByDay(byDay);
      setStatus(data.events.length ? `${data.events.length} event(s) this month` : "no events found this month");
    } catch (err) {
      setStatus(`Couldn't load the calendar (${err.message}). Click any day to create a meeting instead.`);
      setEventsByDay({});
    }
  }

  async function resolveMeeting(event, seriesName) {
    setResolving(true);
    try {
      const res = await fetch("/api/meetings/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: event.subject,
          date: (event.start || "").slice(0, 10),
          venue: event.location,
          attendees: event.attendees,
          seriesName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to start meeting");

      if (data.needsName) {
        setPendingEvent(event);
        setNeedsSeriesName(true);
        setSeriesNameInput(event.subject || "");
        return;
      }

      setNeedsSeriesName(false);
      setPendingEvent(null);
      onResolved({
        seriesId: data.seriesId,
        seriesTitle: data.seriesTitle,
        ccList: data.ccList,
        meetingId: data.meetingId,
        matters: data.matters,
        attendees: data.attendees,
        title: event.subject,
        date: (event.start || "").slice(0, 10),
        venue: event.location,
      });
    } catch (err) {
      setStatus(`Couldn't start this meeting (${err.message}).`);
    } finally {
      setResolving(false);
    }
  }

  async function submitNewEvent() {
    if (!newSubject.trim() || !createForDate) return;
    setCreating(true);
    try {
      const attendeeEmails = newAttendees
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newSubject.trim(),
          date: createForDate,
          time: newTime,
          location: newLocation.trim(),
          attendeeEmails,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to create event");
      setCreateForDate(null);
      setNewSubject("");
      setNewLocation("");
      setNewAttendees("");
      loadMonth(calYear, calMonth);
      resolveMeeting(data.event);
    } catch (err) {
      setStatus(`Couldn't create the event (${err.message}).`);
    } finally {
      setCreating(false);
    }
  }

  const monthLabel = new Date(calYear, calMonth, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const firstWeekday = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = dateStr(now.getFullYear(), now.getMonth(), now.getDate());

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  if (needsSeriesName) {
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--brass)",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 10 }}>
          this looks like a new meeting — name its series (matters will carry forward under this name each time)
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={seriesNameInput}
            onChange={(e) => setSeriesNameInput(e.target.value)}
            placeholder="e.g. ODC Hub MEP Technical"
            style={{
              flex: 1,
              padding: "9px 12px",
              border: "1px solid var(--rule)",
              borderRadius: 8,
              fontSize: 14,
            }}
          />
          <button
            disabled={resolving || !seriesNameInput.trim()}
            onClick={() => resolveMeeting(pendingEvent, seriesNameInput.trim())}
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              border: "none",
              padding: "0 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--rule)",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button
            onClick={() => {
              const d = new Date(calYear, calMonth - 1, 1);
              setCalYear(d.getFullYear());
              setCalMonth(d.getMonth());
            }}
            style={{ background: "none", border: "1px solid var(--rule)", borderRadius: 6, padding: "2px 10px" }}
          >
            &larr;
          </button>
          <div className="mma-h" style={{ fontSize: 15, fontWeight: 600 }}>{monthLabel}</div>
          <button
            onClick={() => {
              const d = new Date(calYear, calMonth + 1, 1);
              setCalYear(d.getFullYear());
              setCalMonth(d.getMonth());
            }}
            style={{ background: "none", border: "1px solid var(--rule)", borderRadius: 6, padding: "2px 10px" }}
          >
            &rarr;
          </button>
        </div>
        <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 8 }}>
          {resolving ? "starting meeting…" : status}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, marginBottom: 1 }}>
          {DAY_NAMES.map((d) => (
            <div key={d} className="mma-mono" style={{ textAlign: "center", fontSize: 12, color: "var(--ink-soft)", padding: "6px 0" }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, background: "var(--rule)", border: "1px solid var(--rule)", borderRadius: 6, overflow: "hidden" }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={{ background: "var(--paper-dim)", minHeight: 130 }} />;
            const ds = dateStr(calYear, calMonth, d);
            const dayEvents = eventsByDay[ds] || [];
            const isToday = ds === today;
            return (
              <div
                key={i}
                onClick={() => {
                  setCreateForDate(ds);
                  setNewSubject("");
                }}
                style={{
                  background: "#fff",
                  minHeight: 130,
                  padding: 8,
                  cursor: "pointer",
                  boxShadow: isToday ? "inset 0 0 0 2px var(--brass)" : "none",
                }}
              >
                <div className="mma-mono" style={{ fontSize: 12, color: isToday ? "var(--brass)" : "var(--ink-soft)", marginBottom: 4 }}>
                  {d}
                </div>
                {dayEvents.slice(0, 4).map((e, ei) => (
                  <div
                    key={ei}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      resolveMeeting(e);
                    }}
                    title={e.subject}
                    style={{
                      background: "rgba(62,107,92,0.14)",
                      color: "var(--pine)",
                      fontSize: 12,
                      lineHeight: 1.3,
                      padding: "3px 6px",
                      borderRadius: 4,
                      marginBottom: 3,
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                    }}
                  >
                    {e.subject}
                  </div>
                ))}
                {dayEvents.length > 4 && (
                  <div className="mma-mono" style={{ fontSize: 10, color: "var(--ink-soft)" }}>
                    +{dayEvents.length - 4} more
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {createForDate && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--rule)", paddingTop: 14 }}>
            <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 10 }}>
              new meeting on {createForDate}
            </div>
            <input
              type="text"
              placeholder="Meeting subject"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 13, marginBottom: 8 }}
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 13 }}
              />
              <input
                type="text"
                placeholder="Location"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                style={{ flex: 2, padding: "8px 10px", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 13 }}
              />
            </div>
            <input
              type="text"
              placeholder="attendee emails, comma separated"
              value={newAttendees}
              onChange={(e) => setNewAttendees(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 13, marginBottom: 10 }}
            />
            <button
              disabled={creating || !newSubject.trim()}
              onClick={submitNewEvent}
              style={{ background: "var(--brass)", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}
            >
              {creating ? "creating…" : "Create event & continue"}
            </button>
            <button
              onClick={() => setCreateForDate(null)}
              style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 12, marginLeft: 8, textDecoration: "underline" }}
            >
              cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
