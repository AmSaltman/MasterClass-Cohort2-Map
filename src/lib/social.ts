// Builds safe outbound links from whatever members typed (URL, @handle, or number).
// Every link is forced to https:// (or mailto:/tel:/sms:) so a profile can never
// inject a javascript: URL.

export type SocialKind = "linkedin" | "instagram" | "facebook" | "x" | "tiktok" | "youtube" | "website";

function handleFrom(value: string): string {
  let v = value.trim();
  try {
    if (/^https?:\/\//i.test(v)) {
      const u = new URL(v);
      v = u.pathname.split("/").filter(Boolean).pop() || "";
    }
  } catch {
    /* fall through to cleanup */
  }
  return v.replace(/^@/, "").replace(/[^A-Za-z0-9._-]/g, "");
}

function safeHttps(value: string): string | null {
  const v = value.trim();
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.protocol = "https:";
    return u.toString();
  } catch {
    return null;
  }
}

export function profileUrl(kind: SocialKind, value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  const v = value.trim();
  if (kind === "website") return safeHttps(v);
  if (kind === "linkedin") {
    if (/linkedin\.com\//i.test(v)) return safeHttps(v);
    const h = handleFrom(v);
    return h ? `https://www.linkedin.com/in/${h}` : null;
  }
  if (kind === "youtube" && /youtube\.com\/|youtu\.be\//i.test(v)) return safeHttps(v);
  const h = handleFrom(v);
  if (!h) return null;
  switch (kind) {
    case "instagram": return `https://instagram.com/${h}`;
    case "facebook": return `https://facebook.com/${h}`;
    case "x": return `https://x.com/${h}`;
    case "tiktok": return `https://www.tiktok.com/@${h}`;
    case "youtube": return `https://www.youtube.com/@${h}`;
  }
  return null;
}

// Direct-message deep links where the platform supports them.
export function dmUrl(kind: "instagram" | "facebook", value: string | null | undefined): string | null {
  if (!value) return null;
  const h = handleFrom(value);
  if (!h) return null;
  if (kind === "instagram") return `https://ig.me/m/${h}`;
  return `https://m.me/${h}`;
}

export function digits(phone: string | null | undefined): string {
  return (phone || "").replace(/[^\d+]/g, "");
}

export function whatsappUrl(value: string | null | undefined): string | null {
  const d = digits(value).replace(/^\+/, "");
  return d.length >= 7 ? `https://wa.me/${d}` : null;
}

export function vcard(m: {
  full_name: string; email: string | null; phone: string | null; company: string | null;
  title: string | null; website: string | null; linkedin: string | null; city: string | null;
  region: string | null; country: string | null;
}): string {
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const parts = m.full_name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop()! : "";
  const lines = [
    "BEGIN:VCARD", "VERSION:3.0",
    `N:${esc(last)};${esc(parts.join(" "))};;;`,
    `FN:${esc(m.full_name)}`,
    m.company && `ORG:${esc(m.company)}`,
    m.title && `TITLE:${esc(m.title)}`,
    m.email && `EMAIL;TYPE=INTERNET:${esc(m.email)}`,
    m.phone && `TEL;TYPE=CELL:${esc(m.phone)}`,
    `ADR;TYPE=WORK:;;;${esc(m.city || "")};${esc(m.region || "")};;${esc(m.country || "")}`,
    profileUrl("website", m.website) && `URL:${profileUrl("website", m.website)}`,
    profileUrl("linkedin", m.linkedin) && `X-SOCIALPROFILE;TYPE=linkedin:${profileUrl("linkedin", m.linkedin)}`,
    "NOTE:MasterClass Executive cohort",
    "END:VCARD",
  ];
  return lines.filter(Boolean).join("\r\n");
}
