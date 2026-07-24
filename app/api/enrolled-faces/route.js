import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const faces = await prisma.enrolledFace.findMany({
    where: { ownerId: session.userId },
    select: { name: true, descriptor: true },
  });
  return Response.json({ faces });
}

export async function POST(request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { name, descriptor } = await request.json();
  if (!name || !Array.isArray(descriptor)) {
    return Response.json({ error: "name and descriptor are required" }, { status: 400 });
  }

  await prisma.enrolledFace.upsert({
    where: { ownerId_name: { ownerId: session.userId, name } },
    update: { descriptor },
    create: { ownerId: session.userId, name, descriptor },
  });

  return Response.json({ ok: true });
}
