export async function sendGmail(accessToken, { to, subject, bodyText }) {
  const messageLines = [
    `To: ${to.join(", ")}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "",
    bodyText,
  ];
  const message = messageLines.join("\r\n");
  const encoded = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encoded }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Gmail send failed");
  }
  return data;
}
