import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { venue, nextDate, professionalMinutes } = body;

  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) return Response.json({ error: "not found" }, { status: 404 });

  await prisma.meeting.update({
    where: { id },
    data: {
      ...(venue !== undefined ? { venue } : {}),
      ...(nextDate !== undefined ? { nextDate } : {}),
      ...(professionalMinutes !== undefined ? { professionalMinutes } : {}),
    },
  });

  return Response.json({ ok: true });
}
