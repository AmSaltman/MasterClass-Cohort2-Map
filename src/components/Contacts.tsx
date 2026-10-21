"use client";
import type { ReactNode } from "react";
import { I } from "./Icons";
import { digits, dmUrl, profileUrl, whatsappUrl } from "@/lib/social";
import type { Member } from "@/lib/types";

export type ContactLink = { key: string; label: string; href: string; icon: ReactNode };

// Every one-tap way to reach a member, in priority order. `message` (an AI
// intro) pre-fills email, text and WhatsApp where the platform allows it.
export function contactLinks(m: Member, message?: string | null): ContactLink[] {
  const body = message ? encodeURIComponent(message) : "";
  const phone = digits(m.phone);
  const wa = whatsappUrl(m.whatsapp || m.phone);
  const links: (ContactLink | null)[] = [
    m.email ? { key: "email", label: "Email", icon: <I.mail />, href: `mailto:${m.email}${body ? `?subject=${encodeURIComponent("MasterClass Executive — hello")}&body=${body}` : ""}` } : null,
    phone ? { key: "sms", label: "Text", icon: <I.sms />, href: `sms:${phone}${body ? `?&body=${body}` : ""}` } : null,
    phone ? { key: "tel", label: "Call", icon: <I.phone />, href: `tel:${phone}` } : null,
    wa ? { key: "wa", label: "WhatsApp", icon: <I.whatsapp />, href: wa + (body ? `?text=${body}` : "") } : null,
    link("linkedin", "LinkedIn", <I.linkedin />, profileUrl("linkedin", m.linkedin)),
    link("ig", "Instagram DM", <I.instagram />, dmUrl("instagram", m.instagram)),
    link("fb", "Messenger", <I.facebook />, dmUrl("facebook", m.facebook)),
    link("x", "X", <I.x />, profileUrl("x", m.x)),
    link("tiktok", "TikTok", <I.tiktok />, profileUrl("tiktok", m.tiktok)),
    link("yt", "YouTube", <I.youtube />, profileUrl("youtube", m.youtube)),
    link("web", "Website", <I.link />, profileUrl("website", m.website)),
  ];
  return links.filter((l): l is ContactLink => !!l);
}

function link(key: string, label: string, icon: ReactNode, href: string | null): ContactLink | null {
  return href ? { key, label, icon, href } : null;
}

const ext = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});

// Icon-only row for list items. Clicks don't bubble to the row.
export function QuickContacts({ member, max = 6 }: { member: Member; max?: number }) {
  const links = contactLinks(member).slice(0, max);
  if (!links.length) return null;
  return (
    <div className="quick-contacts" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {links.map((l) => (
        <a key={l.key} href={l.href} {...ext(l.href)} title={`${l.label} ${member.full_name}`} aria-label={`${l.label} ${member.full_name}`}>
          {l.icon}
        </a>
      ))}
    </div>
  );
}

// Labeled grid for the profile drawer.
export function ContactGrid({ member, message, extra }: { member: Member; message?: string | null; extra?: ReactNode }) {
  return (
    <div className="contact-grid">
      {contactLinks(member, message).map((l) => (
        <a key={l.key} className="contact" href={l.href} {...ext(l.href)}>{l.icon}{l.label}</a>
      ))}
      {extra}
    </div>
  );
}
