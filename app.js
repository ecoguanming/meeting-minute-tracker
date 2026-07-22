const STORAGE_KEY = "meeting-minutes";

const form = document.getElementById("meeting-form");
const meetingsEl = document.getElementById("meetings");
const emptyState = document.getElementById("empty-state");

function loadMeetings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveMeetings(meetings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function render() {
  const meetings = loadMeetings();
  meetingsEl.innerHTML = "";
  emptyState.style.display = meetings.length ? "none" : "block";

  meetings
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((meeting) => {
      const card = document.createElement("div");
      card.className = "meeting-card";

      const attendeesLine = meeting.attendees ? `Attendees: ${meeting.attendees}` : "";

      card.innerHTML = `
        <button class="delete-btn" data-id="${meeting.id}">Delete</button>
        <h3>${escapeHtml(meeting.title)}</h3>
        <div class="meeting-meta">${formatDate(meeting.date)}${attendeesLine ? " &middot; " + escapeHtml(attendeesLine) : ""}</div>
        <p class="meeting-notes">${escapeHtml(meeting.notes || "(no notes)")}</p>
      `;
      meetingsEl.appendChild(card);
    });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const meeting = {
    id: crypto.randomUUID(),
    title: document.getElementById("title").value.trim(),
    date: document.getElementById("date").value,
    attendees: document.getElementById("attendees").value.trim(),
    notes: document.getElementById("notes").value.trim(),
  };

  const meetings = loadMeetings();
  meetings.push(meeting);
  saveMeetings(meetings);
  form.reset();
  render();
});

meetingsEl.addEventListener("click", (e) => {
  if (e.target.matches(".delete-btn")) {
    const id = e.target.dataset.id;
    const meetings = loadMeetings().filter((m) => m.id !== id);
    saveMeetings(meetings);
    render();
  }
});

render();