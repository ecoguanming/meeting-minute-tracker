import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/googleAuth";
import { sendGmail } from "@/lib/gmail";
import { createCalendarEvent } from "@/lib/googleCalendar";

const STATUS_LABEL = { grey: "not started", yellow: "in progress", green: "completed", red: "delayed" };

function buildMinutesText(meeting, matters) {
  const lines = [];
  lines.push(`${meeting.series.title} — ${meeting.date || "undated"}${meeting.venue ? " — " + meeting.venue : ""}`);
  lines.push("");
  lines.push("ATTENDEES");
  meeting.attendees.forEach((a) => lines.push(`- ${a.name || a.email}${a.attended ? "" : " (absent)"}`));
  lines.push("");
  if (meeting.professionalMinutes && meeting.professionalMinutes.trim()) {
    lines.push(meeting.professionalMinutes.trim());
    lines.push("");
  }
  lines.push("ACTION ITEMS");
  matters.forEach((m) => {
    lines.push(
      `${m.no}. ${m.matter} — action: ${m.actionParty || "unassigned"} — due: ${m.deadline || "n/a"} — status: ${STATUS_LABEL[m.status] || m.status}`
    );
  });
  lines.push("");
  if (meeting.nextDate) lines.push(`NEXT MEETING: ${meeting.nextDate}${meeting.venue ? " at " + meeting.venue : ""}`);
  return lines.join("\n");
}

export async function POST(request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { meetingId } = await request.json();

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { series: true, attendees: true },
  });
  if (!meeting) return Response.json({ error: "not found" }, { status: 404 });

  const matters = await prisma.matter.findMany({
    where: { seriesId: meeting.seriesId },
    orderBy: { createdAt: "asc" },
  });

  const toEmails = meeting.attendees.filter((a) => a.email).map((a) => a.email);
  if (!toEmails.length) {
    return Response.json({ error: "No attendee emails to send to." }, { status: 400 });
  }

  const remindable = matters.filter((m) => m.deadline && m.actionPartyEmail && m.status !== "green");
  const minutesText = buildMinutesText(meeting, matters);

  let emailSent = false;
  let eventsCreated = 0;
  const notes = [];

  try {
    const accessToken = await getValidAccessToken(session.userId);

    try {
      await sendGmail(accessToken, {
        to: toEmails,
        subject: `Meeting minutes: ${meeting.series.title} (${meeting.date || "undated"})`,
        bodyText: minutesText,
      });
      emailSent = true;
    } catch (err) {
      notes.push(`Email failed: ${err.message}`);
    }

    for (const m of remindable) {
      const emails = (m.actionPartyEmail || "").split(",").map((e) => e.trim()).filter(Boolean);
      if (!emails.length) continue;
      const deadlineDate = new Date(`${m.deadline}T09:00:00`);
      const reminderDate = new Date(deadlineDate.getTime() - 3 * 24 * 60 * 60 * 1000);
      try {
        await createCalendarEvent(accessToken, {
          summary: `Reminder: ${m.matter} (due ${m.deadline})`,
          startDateTime: reminderDate.toISOString(),
          attendeeEmails: emails,
        });
        eventsCreated += 1;
      } catch (err) {
        notes.push(`Reminder for "${m.matter}" failed: ${err.message}`);
      }
    }

    await prisma.meeting.update({ where: { id: meetingId }, data: { status: "dispatched" } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  return Response.json({
    email_sent: emailSent,
    events_created: eventsCreated,
    remindable_count: remindable.length,
    notes: notes.join(" ") || undefined,
  });
}
