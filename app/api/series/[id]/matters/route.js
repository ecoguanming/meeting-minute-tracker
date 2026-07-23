import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const matters = Array.isArray(body.matters) ? body.matters : [];

  const series = await prisma.series.findUnique({ where: { id } });
  if (!series) return Response.json({ error: "not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.matter.deleteMany({ where: { seriesId: id } }),
    prisma.matter.createMany({
      data: matters.map((m) => ({
        seriesId: id,
        no: m.no || "",
        matter: m.matter || "",
        actionParty: m.actionParty || "",
        actionPartyEmail: m.actionPartyEmail || "",
        deadline: m.deadline || "",
        status: m.status || "grey",
        greenStreak: m.greenStreak || 0,
      })),
    }),
  ]);

  const updated = await prisma.matter.findMany({ where: { seriesId: id }, orderBy: { createdAt: "asc" } });
  return Response.json({ matters: updated });
}
