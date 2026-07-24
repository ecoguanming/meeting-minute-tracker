import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await prisma.meeting.update({
    where: { id },
    data: { reviewedMinutesFile: buffer, reviewedMinutesFilename: file.name },
  });

  return Response.json({ ok: true, filename: file.name });
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.meeting.update({
    where: { id },
    data: { reviewedMinutesFile: null, reviewedMinutesFilename: null },
  });

  return Response.json({ ok: true });
}
