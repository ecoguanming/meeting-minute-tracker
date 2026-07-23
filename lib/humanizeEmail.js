export function nameFromEmail(email) {
  if (!email) return "";
  const local = email.split("@")[0];
  const parts = local
    .replace(/[0-9]+/g, " ")
    .split(/[._\-+]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return email;

  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}
