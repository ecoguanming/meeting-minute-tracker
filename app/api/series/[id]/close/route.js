import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { meetingId } = body;

  const matters = await prisma.matter.findMany({ where: { seriesId: id } });

  const toDelete = [];
  const toUpdate = [];
  matters.forEach((m) => {
    if (m.status === "green") {
      const newStreak = (m.greenStreak || 0) + 1;
      if (newStreak >= 2) {
        toDelete.push(m.id);
      } else {
        toUpdate.push({ id: m.id, greenStreak: newStreak });
      }
    } else if (m.greenStreak) {
      toUpdate.push({ id: m.id, greenStreak: 0 });
    }
  });

  await prisma.$transaction([
    ...toDelete.map((matterId) => prisma.matter.delete({ where: { id: matterId } })),
    ...toUpdate.map((u) => prisma.matter.update({ where: { id: u.id }, data: { greenStreak: u.greenStreak } })),
    ...(meetingId ? [prisma.meeting.update({ where: { id: meetingId }, data: { status: "closed" } })] : []),
  ]);

  const updated = await prisma.matter.findMany({ where: { seriesId: id }, orderBy: { createdAt: "asc" } });
  return Response.json({ matters: updated });
}
