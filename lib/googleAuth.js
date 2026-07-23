import { prisma } from "@/lib/prisma";

export async function getValidAccessToken(userId) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account) {
    throw new Error("No linked Google account for this user.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (account.access_token && account.expires_at && account.expires_at > nowSeconds + 60) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new Error("No refresh token stored — sign out and sign in again to reauthorize.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to refresh Google token: ${data.error_description || data.error}`);
  }

  const newExpiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  await prisma.account.update({
    where: { id: account.id },
    data: { access_token: data.access_token, expires_at: newExpiresAt },
  });

  return data.access_token;
}
