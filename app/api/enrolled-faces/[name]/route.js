import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { name } = await params;

  await prisma.enrolledFace.deleteMany({
    where: { ownerId: session.userId, name: decodeURIComponent(name) },
  });

  return Response.json({ ok: true });
}
