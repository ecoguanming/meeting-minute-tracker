import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const account = await prisma.microsoftAccount.findUnique({ where: { userId: session.userId } });
  return Response.json({ connected: !!account, email: account?.msEmail || null });
}
