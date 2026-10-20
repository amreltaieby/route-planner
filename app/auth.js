const BASE = process.env.NEXT_PUBLIC_AUTH_EMAIL_BASE || "";
const DOM = process.env.NEXT_PUBLIC_AUTH_DOMAIN || "";

export const cleanUser = (u) => String(u || "").trim().toLowerCase();
export const validUser = (u) => /^[a-z0-9._-]{3,30}$/.test(u);

export const toEmail = (u) => {
  const user = cleanUser(u);
  const i = BASE.lastIndexOf("@");
  if (i > 0) return `${BASE.slice(0, i)}+${user}@${BASE.slice(i + 1)}`;
  if (DOM) return `${user}@${DOM}`;
  return `${user}@routiq.app`;
};