import { auth } from "@/auth";
import { createNotionTask } from "@/lib/notion";

export async function POST(request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { matters, meetingTitle } = body;

  let created = 0;
  const notes = [];

  for (const m of matters || []) {
    try {
      await createNotionTask({
        matter: m.matter,
        actionParty: m.actionParty,
        deadline: m.deadline,
        status: m.status,
        meetingTitle,
      });
      created += 1;
    } catch (err) {
      notes.push(`"${m.matter}" failed: ${err.message}`);
    }
  }

  return Response.json({ created, total: (matters || []).length, notes: notes.join(" ") || undefined });
}
