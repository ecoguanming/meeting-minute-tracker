function base64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendGmail(accessToken, { to, subject, bodyText, attachment }) {
  let message;

  if (attachment) {
    const boundary = `mma_${Date.now()}_boundary`;
    const attachmentBase64 = attachment.data.toString("base64").replace(/(.{76})/g, "$1\r\n");
    message = [
      `To: ${to.join(", ")}`,
      "MIME-Version: 1.0",
      `Subject: ${subject}`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      bodyText,
      "",
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      attachmentBase64,
      "",
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    message = [
      `To: ${to.join(", ")}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "MIME-Version: 1.0",
      `Subject: ${subject}`,
      "",
      bodyText,
    ].join("\r\n");
  }

  const encoded = base64Url(Buffer.from(message));

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
