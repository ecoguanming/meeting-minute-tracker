export async function createCalendarEvent(accessToken, { summary, startDateTime, attendeeEmails }) {
  const start = new Date(startDateTime);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: (attendeeEmails || []).map((email) => ({ email })),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Calendar event creation failed");
  }
  return data;
}
