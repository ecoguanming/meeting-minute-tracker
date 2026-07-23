import { auth } from "@/auth";
import { getValidAccessToken } from "@/lib/googleAuth";

function mapEvent(item) {
  return {
    id: item.id,
    subject: item.summary || "Untitled",
    start: item.start?.dateTime || item.start?.date || "",
    location: item.location || "",
    attendees: (item.attendees || [])
      .filter((a) => !a.resource)
      .map((a) => ({ name: a.displayName || a.email, email: a.email })),
  };
}

export async function GET(request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year"), 10);
  const month = parseInt(searchParams.get("month"), 10); // 1-12

  const timeMin = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const timeMax = new Date(Date.UTC(year, month, 1)).toISOString();

  try {
    const accessToken = await getValidAccessToken(session.userId);
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.error?.message || "Google Calendar error" }, { status: 502 });
    }

    return Response.json({ events: (data.items || []).map(mapEvent) });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { subject, date, time, location, attendeeEmails } = body;

  try {
    const accessToken = await getValidAccessToken(session.userId);
    const startDateTime = `${date}T${time || "09:00"}:00`;
    const startDate = new Date(startDateTime);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: subject,
          location: location || "",
          start: { dateTime: startDate.toISOString() },
          end: { dateTime: endDate.toISOString() },
          attendees: (attendeeEmails || []).map((email) => ({ email })),
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.error?.message || "Google Calendar error" }, { status: 502 });
    }

    return Response.json({ event: mapEvent(data) });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
