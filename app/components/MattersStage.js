"use client";

import { useState } from "react";
import MultiSelectAttendees from "./MultiSelectAttendees";
import LiveCaptureBox from "./LiveCaptureBox";

const STATUS_META = {
  grey: { label: "not started", color: "var(--grey)" },
  yellow: { label: "in progress", color: "var(--yellow)" },
  green: { label: "completed", color: "var(--green)" },
  red: { label: "delayed", color: "var(--red)" },
};

function nextNo(matters) {
  const max = matters.length ? Math.max(...matters.map((m) => parseFloat(m.no) || 0)) : 0;
  return (max + 1).toFixed(1);
}

async function extractTextFromPdf(file) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => item.str).join(" "));
  }
  return pageTexts.join("\n\n");
}

export default function MattersStage({ seriesId, meetingId, title, date, initialMinutes, initialMatters, attendees, onContinue }) {
  const [minutes, setMinutes] = useState(initialMinutes || "");
  const [matters, setMatters] = useState(
    (initialMatters || []).map((m) => ({ ...m, no: m.no || "" }))
  );
  const [saving, setSaving] = useState(false);
  const [transcriptLabel, setTranscriptLabel] = useState("click to choose a .txt, .docx, or .pdf transcript");
  const [transcriptText, setTranscriptText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState("");
  const [showLiveCapture, setShowLiveCapture] = useState(false);

  function handleLiveTranscript(text) {
    setTranscriptText(text);
    setTranscriptLabel(`Live recording — ${text.length} characters captured`);
  }

  function updateMatter(i, field, value) {
    setMatters((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  }

  function removeMatter(i) {
    setMatters((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addMatter() {
    setMatters((prev) => [
      ...prev,
      { no: nextNo(prev), matter: "", actionParty: "", actionPartyEmail: "", deadline: "", status: "grey", greenStreak: 0 },
    ]);
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setTranscriptLabel(`reading ${file.name}…`);
    try {
      let text;
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".docx")) {
        const mammoth = (await import("mammoth")).default;
        const buf = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buf });
        text = result.value;
      } else if (lowerName.endsWith(".pdf")) {
        text = await extractTextFromPdf(file);
      } else {
        text = await file.text();
      }
      setTranscriptText(text);
      setTranscriptLabel(`${file.name} — ${text.length} characters loaded`);
    } catch (err) {
      setTranscriptLabel("Couldn't read that file — try a plain .txt export instead.");
      setTranscriptText("");
    }
  }

  async function generateMinutes() {
    setGenerating(true);
    setGenerateStatus("drafting minutes…");
    try {
      const res = await fetch("/api/generate-minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, date, attendees, transcriptText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to generate");

      if (data.professional_minutes) {
        setMinutes((prev) => (prev ? prev + "\n\n" + data.professional_minutes : data.professional_minutes));
      }

      const parsedMatters = data.matters || [];
      if (parsedMatters.length) {
        setMatters((prev) => {
          let running = [...prev];
          parsedMatters.forEach((pm) => {
            const rawNames = (pm.action_party || "")
              .split(/,| and | & /i)
              .map((n) => n.trim())
              .filter(Boolean);
            const resolvedNames = [];
            const resolvedEmails = [];
            rawNames.forEach((rawName) => {
              const match = (attendees || []).find(
                (a) => (a.name || "").toLowerCase() === rawName.toLowerCase()
              );
              resolvedNames.push(match ? match.name || match.email : rawName);
              if (match) resolvedEmails.push(match.email);
            });
            const actionParty = resolvedNames.join(", ");
            const actionPartyEmail = resolvedEmails.join(", ");
            running = [
              ...running,
              {
                no: nextNo(running),
                matter: pm.matter || "",
                actionParty,
                actionPartyEmail,
                deadline: /^\d{4}-\d{2}-\d{2}$/.test(pm.deadline) ? pm.deadline : "",
                status: "grey",
                greenStreak: 0,
              },
            ];
          });
          return running;
        });
      }

      setGenerateStatus(`done — added minutes and ${parsedMatters.length} action item(s).`);
    } catch (err) {
      setGenerateStatus(`Couldn't generate from that transcript (${err.message}).`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleContinue() {
    setSaving(true);
    try {
      await Promise.all([
        fetch(`/api/meetings/${meetingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ professionalMinutes: minutes }),
        }),
        fetch(`/api/series/${seriesId}/matters`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matters }),
        }).then((res) => res.json()),
      ]).then(([, mattersRes]) => {
        onContinue({ professionalMinutes: minutes, matters: mattersRes.matters || matters });
      });
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
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 10 }}>
          generate from transcript
        </div>
        <label
          htmlFor="mma-transcript-file"
          style={{
            display: "block",
            border: "1.5px dashed var(--rule)",
            borderRadius: 8,
            padding: 16,
            textAlign: "center",
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          <input id="mma-transcript-file" type="file" accept=".txt,.docx,.pdf" onChange={handleFileChange} style={{ display: "none" }} />
          <div className="mma-mono" style={{ fontSize: 12, color: "var(--ink-soft)" }}>{transcriptLabel}</div>
        </label>
        <button
          disabled={!transcriptText || generating}
          onClick={generateMinutes}
          style={{
            background: "var(--brass)",
            color: "#fff",
            border: "none",
            padding: "9px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            opacity: transcriptText && !generating ? 1 : 0.5,
            cursor: transcriptText && !generating ? "pointer" : "not-allowed",
          }}
        >
          {generating ? "generating…" : "Generate minutes & action items"}
        </button>
        {generateStatus && (
          <div className="mma-mono" style={{ fontSize: 12, color: "var(--pine)", marginTop: 10 }}>
            {generateStatus}
          </div>
        )}
        {!showLiveCapture && (
          <button
            onClick={() => setShowLiveCapture(true)}
            className="mma-mono"
            style={{ marginTop: 10, fontSize: 11, background: "none", border: "1px solid var(--rule)", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}
          >
            or record live meeting instead →
          </button>
        )}
      </div>

      {showLiveCapture && (
        <LiveCaptureBox
          attendees={attendees}
          onTranscriptCaptured={handleLiveTranscript}
          onClose={() => setShowLiveCapture(false)}
        />
      )}

      <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 6 }}>
        minutes
      </div>
      <textarea
        rows={8}
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        placeholder="Write the minutes here, or paste in the transcript above."
        style={{
          width: "100%",
          padding: 12,
          border: "1px solid var(--rule)",
          borderRadius: 8,
          background: "#fff",
          fontSize: 13,
          marginBottom: 20,
          resize: "vertical",
          fontFamily: "Inter, sans-serif",
        }}
      />

      <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 6 }}>
        action items — no., matter, action party, deadline, status
      </div>
      <div style={{ background: "#fff", border: "1px solid var(--rule)", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              <th style={{ textAlign: "left", padding: "8px 8px", borderBottom: "1px solid var(--rule)", width: 50 }}>no.</th>
              <th style={{ textAlign: "left", padding: "8px 8px", borderBottom: "1px solid var(--rule)" }}>matter</th>
              <th style={{ textAlign: "left", padding: "8px 8px", borderBottom: "1px solid var(--rule)", width: 160 }}>action party</th>
              <th style={{ textAlign: "left", padding: "8px 8px", borderBottom: "1px solid var(--rule)", width: 130 }}>deadline</th>
              <th style={{ textAlign: "left", padding: "8px 8px", borderBottom: "1px solid var(--rule)", width: 130 }}>status</th>
              <th style={{ width: 36, borderBottom: "1px solid var(--rule)" }}></th>
            </tr>
          </thead>
          <tbody>
            {matters.map((m, i) => {
              const struck = (m.greenStreak || 0) >= 1;
              return (
                <tr key={i} className={struck ? "mma-struck" : ""}>
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      type="text"
                      value={m.no}
                      onChange={(e) => updateMatter(i, "no", e.target.value)}
                      style={{ width: "100%", border: "none", fontSize: 13, padding: 4 }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      type="text"
                      value={m.matter}
                      onChange={(e) => updateMatter(i, "matter", e.target.value)}
                      style={{ width: "100%", border: "none", fontSize: 13, padding: 4 }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <MultiSelectAttendees
                      attendees={attendees}
                      selectedNames={m.actionParty ? m.actionParty.split(", ").filter(Boolean) : []}
                      onChange={(names) => {
                        const emails = names.map((name) => {
                          const match = (attendees || []).find((a) => (a.name || a.email) === name);
                          return match ? match.email : "";
                        });
                        updateMatter(i, "actionParty", names.join(", "));
                        updateMatter(i, "actionPartyEmail", emails.filter(Boolean).join(", "));
                      }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      type="date"
                      value={m.deadline}
                      onChange={(e) => updateMatter(i, "deadline", e.target.value)}
                      style={{ width: "100%", border: "none", fontSize: 12, padding: 4 }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <select
                      value={m.status}
                      onChange={(e) => updateMatter(i, "status", e.target.value)}
                      style={{ width: "100%", border: "none", fontSize: 12, padding: 4, background: "transparent" }}
                    >
                      {Object.keys(STATUS_META).map((k) => (
                        <option key={k} value={k}>
                          {STATUS_META[k].label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      onClick={() => removeMatter(i)}
                      style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 16, cursor: "pointer" }}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {matters.length === 0 && (
          <div className="mma-mono" style={{ fontSize: 12, color: "var(--ink-soft)", padding: 14 }}>
            no matters yet
          </div>
        )}
      </div>

      <button
        onClick={addMatter}
        className="mma-mono"
        style={{ marginTop: 10, fontSize: 11, background: "none", border: "1px solid var(--rule)", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}
      >
        + add matter
      </button>

      <div style={{ marginTop: 24 }}>
        <button
          disabled={saving}
          onClick={handleContinue}
          style={{ background: "var(--ink)", color: "var(--paper)", border: "none", padding: "11px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}
        >
          {saving ? "saving…" : "Continue to dispatch →"}
        </button>
      </div>
    </div>
  );
}
