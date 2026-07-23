import { prisma } from "@/lib/prisma";

export const MICROSOFT_SCOPES = "openid profile email offline_access Tasks.ReadWrite User.Read User.ReadBasic.All";

export async function getValidMicrosoftAccessToken(userId) {
  const account = await prisma.microsoftAccount.findUnique({ where: { userId } });

  if (!account) {
    throw new Error("No linked Microsoft account for this user.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (account.accessToken && account.expiresAt > nowSeconds + 60) {
    return account.accessToken;
  }

  const res = await fetch(`https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
      scope: MICROSOFT_SCOPES,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to refresh Microsoft token: ${data.error_description || data.error}`);
  }

  const newExpiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  await prisma.microsoftAccount.update({
    where: { userId },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || account.refreshToken,
      expiresAt: newExpiresAt,
    },
  });

  return data.access_token;
}
