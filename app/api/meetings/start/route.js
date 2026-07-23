import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

export async function POST(request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, date, venue, attendees, seriesName } = body;

  const slug = slugify(title);
  if (!slug) {
    return Response.json({ error: "A meeting title is required." }, { status: 400 });
  }

  let series = await prisma.series.findUnique({ where: { slug } });

  if (!series) {
    if (!seriesName || !seriesName.trim()) {
      return Response.json({ needsName: true, slug });
    }
    series = await prisma.series.create({
      data: { slug, title: seriesName.trim(), ownerId: session.userId },
    });
  }

  const matters = await prisma.matter.findMany({
    where: { seriesId: series.id },
    orderBy: { createdAt: "asc" },
  });

  const meeting = await prisma.meeting.create({
    data: {
      seriesId: series.id,
      date: date || "",
      venue: venue || "",
      attendees: {
        create: (attendees || []).map((a) => ({
          name: a.name || "",
          email: a.email || "",
          attended: true,
        })),
      },
    },
    include: { attendees: true },
  });

  return Response.json({
    seriesId: series.id,
    seriesTitle: series.title,
    ccList: series.ccList,
    meetingId: meeting.id,
    matters,
    attendees: meeting.attendees,
  });
}
