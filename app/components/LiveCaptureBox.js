"use client";

import { useEffect, useRef, useState } from "react";

// Enrolled faces are saved permanently (as a numeric descriptor, not a
// photo) to the signed-in user's account via /api/enrolled-faces, so
// attendees don't need to be re-enrolled every meeting. The live
// transcript itself is still session-only — only the resulting text
// gets handed up to the parent when recording stops.
export default function LiveCaptureBox({ attendees, onTranscriptCaptured, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceapiRef = useRef(null);
  const matcherRef = useRef(null);
  const descriptorsRef = useRef([]); // [{ label, descriptors: [Float32Array] }]
  const currentSpeakerRef = useRef("Unknown");
  const linesRef = useRef([]);
  const recordingRef = useRef(false);
  const detectTimerRef = useRef(null);
  const recognizerRef = useRef(null);
  const bulkInputRef = useRef(null);

  const [status, setStatus] = useState("Loading face recognition models…");
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [enrolled, setEnrolled] = useState({}); // name -> true
  const [recording, setRecording] = useState(false);
  const [lines, setLines] = useState([]);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const faceapi = await import("@vladmandic/face-api");
        faceapiRef.current = faceapi;
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
        await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
        if (cancelled) return;
        setModelsReady(true);

        try {
          const res = await fetch("/api/enrolled-faces");
          if (res.ok) {
            const { faces } = await res.json();
            descriptorsRef.current = (faces || []).map((f) => ({
              label: f.name,
              descriptors: [new Float32Array(f.descriptor)],
            }));
            rebuildMatcher();
            const attendeeNames = (attendees || []).map((a) => a.name);
            const already = {};
            (faces || []).forEach((f) => {
              if (attendeeNames.includes(f.name)) already[f.name] = true;
            });
            if (!cancelled) setEnrolled(already);
          }
        } catch (err) {
          /* saved faces are a convenience — proceed without them if this fails */
        }

        setStatus("Requesting camera and microphone…");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraReady(true);
        setStatus("Camera ready. Enroll each attendee's face below, then start recording.");
      } catch (err) {
        setStatus(`Could not start: ${err.message}`);
      }
    }

    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) setSpeechSupported(false);

    init();
    return () => {
      cancelled = true;
      stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopEverything() {
    if (detectTimerRef.current) clearInterval(detectTimerRef.current);
    if (recognizerRef.current) {
      try {
        recognizerRef.current.onend = null;
        recognizerRef.current.stop();
      } catch (e) {
        /* already stopped */
      }
    }
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }

  function rebuildMatcher() {
    const faceapi = faceapiRef.current;
    if (!faceapi || descriptorsRef.current.length === 0) {
      matcherRef.current = null;
      return;
    }
    const labeled = descriptorsRef.current.map(
      (d) => new faceapi.LabeledFaceDescriptors(d.label, d.descriptors)
    );
    matcherRef.current = new faceapi.FaceMatcher(labeled, 0.5);
  }

  async function enrollAttendee(name) {
    const faceapi = faceapiRef.current;
    if (!faceapi || !videoRef.current) return;
    setStatus(`Looking for ${name}'s face…`);
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!detection) {
      setStatus(`No face detected — make sure ${name} is facing the camera and try again.`);
      return;
    }
    descriptorsRef.current = descriptorsRef.current.filter((d) => d.label !== name);
    descriptorsRef.current.push({ label: name, descriptors: [detection.descriptor] });
    rebuildMatcher();
    setEnrolled((prev) => ({ ...prev, [name]: true }));
    setStatus(`Enrolled ${name}. Saving…`);
    await saveFace(name, detection.descriptor);
    setStatus(`Enrolled ${name} and saved for future meetings. You can re-enroll anyone at any time if the match seems off.`);
  }

  async function saveFace(name, descriptor) {
    try {
      await fetch("/api/enrolled-faces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, descriptor: Array.from(descriptor) }),
      });
    } catch (err) {
      /* enrollment still works for this session even if saving permanently fails */
    }
  }

  async function forgetFace(name) {
    descriptorsRef.current = descriptorsRef.current.filter((d) => d.label !== name);
    rebuildMatcher();
    setEnrolled((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    try {
      await fetch(`/api/enrolled-faces/${encodeURIComponent(name)}`, { method: "DELETE" });
    } catch (err) {
      /* local state is already updated; the saved copy can be cleared next time */
    }
  }

  function normalizeName(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  async function handleBulkPhotos(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same files later
    const faceapi = faceapiRef.current;
    if (!files.length || !faceapi) return;

    setBulkBusy(true);
    setStatus(`Reading ${files.length} photo(s)…`);

    const names = (attendees || []).map((a) => a.name).filter(Boolean);
    const matched = [];
    const skipped = [];

    for (const file of files) {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const attendeeName = names.find((n) => normalizeName(n) === normalizeName(baseName));
      if (!attendeeName) {
        skipped.push(`${file.name} (no matching attendee name)`);
        continue;
      }
      try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (!detection) {
          skipped.push(`${file.name} (no face found in photo)`);
          continue;
        }
        descriptorsRef.current = descriptorsRef.current.filter((d) => d.label !== attendeeName);
        descriptorsRef.current.push({ label: attendeeName, descriptors: [detection.descriptor] });
        matched.push(attendeeName);
        await saveFace(attendeeName, detection.descriptor);
      } catch (err) {
        skipped.push(`${file.name} (couldn't read photo)`);
      }
    }

    rebuildMatcher();
    if (matched.length) {
      setEnrolled((prev) => {
        const next = { ...prev };
        matched.forEach((n) => (next[n] = true));
        return next;
      });
    }

    const parts = [];
    if (matched.length) parts.push(`Enrolled from photos and saved for future meetings: ${matched.join(", ")}.`);
    if (skipped.length) parts.push(`Skipped: ${skipped.join("; ")}.`);
    setStatus(parts.join(" ") || "No photos matched an attendee name.");
    setBulkBusy(false);
  }

  function addLine(name, text) {
    const entry = { time: new Date().toLocaleTimeString(), name, text };
    linesRef.current = [...linesRef.current, entry];
    setLines(linesRef.current);
  }

  function startRecording() {
    if (!cameraReady || !modelsReady) return;
    linesRef.current = [];
    setLines([]);
    recordingRef.current = true;
    setRecording(true);

    const faceapi = faceapiRef.current;
    detectTimerRef.current = setInterval(async () => {
      if (!videoRef.current || !videoRef.current.videoWidth) return;
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        canvas.width = videoRef.current.clientWidth;
        canvas.height = videoRef.current.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      if (!detection) {
        currentSpeakerRef.current = "Unknown";
        return;
      }

      let label = "Unknown";
      if (matcherRef.current) {
        const match = matcherRef.current.findBestMatch(detection.descriptor);
        if (match.label !== "unknown") label = match.label;
      }
      currentSpeakerRef.current = label;

      if (canvas && ctx) {
        const resized = faceapi.resizeResults(detection, {
          width: canvas.width,
          height: canvas.height,
        });
        const box = resized.detection.box;
        ctx.strokeStyle = label !== "Unknown" ? "#2f8f5b" : "#c0392b";
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = "13px sans-serif";
        ctx.fillText(label, box.x, Math.max(12, box.y - 6));
      }
    }, 600);

    if (speechSupported) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognizer = new SR();
      recognizer.continuous = true;
      recognizer.interimResults = false;
      recognizer.lang = "en-US";
      recognizer.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const text = event.results[i][0].transcript.trim();
            if (text) addLine(currentSpeakerRef.current, text);
          }
        }
      };
      recognizer.onerror = (e) => console.warn("Speech recognition error:", e.error);
      recognizer.onend = () => {
        if (recordingRef.current) {
          try {
            recognizer.start();
          } catch (e) {
            /* already running */
          }
        }
      };
      recognizerRef.current = recognizer;
      try {
        recognizer.start();
      } catch (e) {
        /* ignore */
      }
    }

    setStatus(speechSupported ? "Recording — speak normally." : "Recording video/face only — this browser doesn't support live speech-to-text (try Chrome or Edge).");
  }

  function stopRecording() {
    recordingRef.current = false;
    setRecording(false);
    if (detectTimerRef.current) clearInterval(detectTimerRef.current);
    if (recognizerRef.current) {
      recognizerRef.current.onend = null;
      try {
        recognizerRef.current.stop();
      } catch (e) {
        /* already stopped */
      }
    }

    const transcriptText = linesRef.current
      .map((l) => `[${l.time}] ${l.name}: ${l.text}`)
      .join("\n");

    if (transcriptText) {
      onTranscriptCaptured(transcriptText);
      setStatus(`Captured ${linesRef.current.length} line(s). Transcript sent below — click "Generate minutes & action items" when ready.`);
    } else {
      setStatus("Stopped — no speech was captured, so nothing was sent to the transcript box.");
    }
  }

  function handleClose() {
    stopEverything();
    onClose();
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--rule)",
        borderRadius: 10,
        padding: 16,
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
          record live meeting (experimental)
        </div>
        <button
          onClick={handleClose}
          style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 12, cursor: "pointer" }}
        >
          close ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: 320, flexShrink: 0, background: "#000", borderRadius: 8, overflow: "hidden" }}>
          <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", display: "block" }} />
          <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="mma-mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 6 }}>
            enroll faces (saved for future meetings)
          </div>

          <input
            type="file"
            accept="image/*"
            multiple
            ref={bulkInputRef}
            onChange={handleBulkPhotos}
            style={{ display: "none" }}
          />
          <button
            disabled={!modelsReady || bulkBusy}
            onClick={() => bulkInputRef.current?.click()}
            style={{
              fontSize: 11,
              background: "none",
              border: "1px solid var(--rule)",
              padding: "5px 10px",
              borderRadius: 6,
              cursor: modelsReady && !bulkBusy ? "pointer" : "not-allowed",
              marginBottom: 6,
            }}
          >
            {bulkBusy ? "enrolling from photos…" : "📁 bulk-enroll from photos on this device"}
          </button>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 10 }}>
            Name each photo file exactly like the attendee (e.g. "Tanguanming.jpg"), select them all at once, and they'll be matched and enrolled automatically — no need to face the camera one by one. Only a numeric face description is saved to your account (not the photo itself), so recognition works again next meeting without re-enrolling. Use "forget" next to a name to delete their saved face.
          </div>

          {(attendees || []).filter((a) => a.name).length === 0 && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 10 }}>
              No named attendees yet — add names in the Attendance stage first.
            </div>
          )}
          {(attendees || [])
            .filter((a) => a.name)
            .map((a) => (
              <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: enrolled[a.name] ? "var(--pine)" : "var(--rule)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, flex: 1 }}>{a.name}</span>
                <button
                  disabled={!cameraReady}
                  onClick={() => enrollAttendee(a.name)}
                  style={{
                    fontSize: 11,
                    background: "none",
                    border: "1px solid var(--rule)",
                    padding: "4px 8px",
                    borderRadius: 6,
                    cursor: cameraReady ? "pointer" : "not-allowed",
                  }}
                >
                  {enrolled[a.name] ? "re-enroll" : "enroll face"}
                </button>
                {enrolled[a.name] && (
                  <button
                    onClick={() => forgetFace(a.name)}
                    title="Delete this saved face permanently"
                    style={{
                      fontSize: 11,
                      background: "none",
                      border: "1px solid var(--rule)",
                      color: "var(--danger)",
                      padding: "4px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    forget
                  </button>
                )}
              </div>
            ))}

          <div style={{ marginTop: 14 }}>
            {!recording ? (
              <button
                disabled={!cameraReady}
                onClick={startRecording}
                style={{
                  background: "var(--pine)",
                  color: "#fff",
                  border: "none",
                  padding: "9px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  opacity: cameraReady ? 1 : 0.5,
                  cursor: cameraReady ? "pointer" : "not-allowed",
                }}
              >
                Start recording
              </button>
            ) : (
              <button
                onClick={stopRecording}
                style={{ background: "var(--danger)", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}
              >
                Stop recording
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mma-mono" style={{ fontSize: 12, color: "var(--pine)", marginTop: 12 }}>
        {status}
      </div>

      {lines.length > 0 && (
        <div
          style={{
            marginTop: 10,
            maxHeight: 160,
            overflowY: "auto",
            border: "1px solid var(--rule)",
            borderRadius: 8,
            padding: 10,
            fontSize: 12,
          }}
        >
          {lines.map((l, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <strong>{l.name}</strong> <span style={{ color: "var(--ink-soft)" }}>{l.time}</span> — {l.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
