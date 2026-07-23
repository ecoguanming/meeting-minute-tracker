import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { venue, nextDate, ccList } = body;

  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) return Response.json({ error: "not found" }, { status: 404 });

  await prisma.meeting.update({
    where: { id },
    data: {
      ...(venue !== undefined ? { venue } : {}),
      ...(nextDate !== undefined ? { nextDate } : {}),
    },
  });

  if (ccList !== undefined) {
    await prisma.series.update({
      where: { id: meeting.seriesId },
      data: { ccList },
    });
  }

  return Response.json({ ok: true });
}
