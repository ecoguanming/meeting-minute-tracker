import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { MICROSOFT_SCOPES } from "@/lib/microsoftAuth";

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/microsoft/callback`;

  const authorizeUrl = new URL(
    `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`
  );
  authorizeUrl.searchParams.set("client_id", process.env.MICROSOFT_CLIENT_ID);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_mode", "query");
  authorizeUrl.searchParams.set("scope", MICROSOFT_SCOPES);
  authorizeUrl.searchParams.set("state", session.userId);

  return NextResponse.redirect(authorizeUrl.toString());
}
