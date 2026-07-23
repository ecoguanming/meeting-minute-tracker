import { auth } from "@/auth";
import { getValidMicrosoftAccessToken } from "@/lib/microsoftAuth";

async function findUserIdByEmail(accessToken, email) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}?$select=id,displayName,mail`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.id || null;
}

export async function POST(request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { planId, matters } = body;
  if (!planId) return Response.json({ error: "No Teams plan selected." }, { status: 400 });

  try {
    const accessToken = await getValidMicrosoftAccessToken(session.userId);

    const bucketsRes = await fetch(`https://graph.microsoft.com/v1.0/planner/plans/${planId}/buckets`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const bucketsData = await bucketsRes.json();
    if (!bucketsRes.ok) {
      return Response.json({ error: bucketsData.error?.message || "Failed to load buckets" }, { status: 502 });
    }

    let bucket = (bucketsData.value || []).find((b) => b.name === "Meeting Minutes");
    if (!bucket) {
      const createBucketRes = await fetch("https://graph.microsoft.com/v1.0/planner/buckets", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Meeting Minutes", planId, orderHint: " !" }),
      });
      bucket = await createBucketRes.json();
      if (!createBucketRes.ok) {
        return Response.json({ error: bucket.error?.message || "Failed to create bucket" }, { status: 502 });
      }
    }

    let created = 0;
    const notes = [];
    const userIdCache = new Map();

    for (const m of matters || []) {
      const emails = (m.actionPartyEmail || "").split(",").map((e) => e.trim()).filter(Boolean);
      const assignments = {};

      for (const email of emails) {
        let msUserId = userIdCache.get(email);
        if (msUserId === undefined) {
          msUserId = await findUserIdByEmail(accessToken, email);
          userIdCache.set(email, msUserId);
        }
        if (msUserId) {
          assignments[msUserId] = { "@odata.type": "#microsoft.graph.plannerAssignment", orderHint: " !" };
        } else {
          notes.push(`Couldn't find a Microsoft account for ${email}`);
        }
      }

      const taskBody = {
        planId,
        bucketId: bucket.id,
        title: m.matter || "Untitled action item",
        assignments,
      };
      if (m.deadline) {
        taskBody.dueDateTime = new Date(`${m.deadline}T17:00:00Z`).toISOString();
      }

      const taskRes = await fetch("https://graph.microsoft.com/v1.0/planner/tasks", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(taskBody),
      });

      if (taskRes.ok) {
        created += 1;
      } else {
        const err = await taskRes.json();
        notes.push(`"${m.matter}" failed: ${err.error?.message || "unknown error"}`);
      }
    }

    return Response.json({ created, total: (matters || []).length, notes: notes.join(" ") || undefined });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
