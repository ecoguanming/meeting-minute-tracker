import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MICROSOFT_SCOPES } from "@/lib/microsoftAuth";

export async function GET(request) {
  const session = await auth();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${url.origin}/?microsoft_error=${encodeURIComponent(error)}`);
  }
  if (!session || session.userId !== state) {
    return NextResponse.redirect(`${url.origin}/?microsoft_error=session_mismatch`);
  }

  const redirectUri = `${url.origin}/api/microsoft/callback`;

  const tokenRes = await fetch(`https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      scope: MICROSOFT_SCOPES,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${url.origin}/?microsoft_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`
    );
  }

  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json();

  const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

  await prisma.microsoftAccount.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      msUserId: profile.id || "",
      msEmail: profile.mail || profile.userPrincipalName || "",
    },
    update: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      msUserId: profile.id || "",
      msEmail: profile.mail || profile.userPrincipalName || "",
    },
  });

  return NextResponse.redirect(`${url.origin}/?microsoft_connected=1`);
}
