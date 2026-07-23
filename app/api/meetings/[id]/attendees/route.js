import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const attendees = Array.isArray(body.attendees) ? body.attendees : [];

  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) return Response.json({ error: "not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.attendee.deleteMany({ where: { meetingId: id } }),
    prisma.attendee.createMany({
      data: attendees.map((a) => ({
        meetingId: id,
        name: a.name || "",
        email: a.email || "",
        attended: a.attended !== false,
      })),
    }),
  ]);

  const updated = await prisma.attendee.findMany({ where: { meetingId: id } });
  return Response.json({ attendees: updated });
}
