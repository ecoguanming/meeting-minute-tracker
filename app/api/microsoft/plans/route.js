import { auth } from "@/auth";
import { getValidMicrosoftAccessToken } from "@/lib/microsoftAuth";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const accessToken = await getValidMicrosoftAccessToken(session.userId);
    const res = await fetch("https://graph.microsoft.com/v1.0/me/planner/plans", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.error?.message || "Failed to list Planner plans" }, { status: 502 });
    }
    return Response.json({
      plans: (data.value || []).map((p) => ({ id: p.id, title: p.title })),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
