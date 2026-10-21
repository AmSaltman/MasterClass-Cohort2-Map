"use client";
import { useEffect, useState, type ReactNode } from "react";
import { I } from "./Icons";
import { Square } from "./Square";
import { api } from "@/lib/supabase-browser";
import { digits, dmUrl, profileUrl, vcard, whatsappUrl } from "@/lib/social";
import type { Member } from "@/lib/types";

function Contact({ href, icon, label }: { href: string | null; icon: ReactNode; label: string }) {
  if (!href) return null;
  const external = href.startsWith("http");
  return (
    <a className="contact" href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {icon}{label}
    </a>
  );
}

export function MemberDrawer({
  member, isMe, onClose, onLocate,
}: {
  member: Member | null;
  isMe: boolean;
  onClose: () => void;
  onLocate: (m: Member) => void;
}) {
  // Intro state is tagged with the member id so switching people resets it.
  const [introState, setIntroState] = useState<{ id: string; text: string | null; err: string | null } | null>(null);
  const [introBusy, setIntroBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const current = introState && introState.id === member?.id ? introState : null;
  const intro = current?.text || null;
  const introErr = current?.err || null;
  const copied = !!member && copiedId === member.id;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function draftIntro() {
    if (!member) return;
    const id = member.id;
    setIntroBusy(true);
    try {
      const r = await api<{ text: string }>("/api/intro", { method: "POST", body: JSON.stringify({ to: id }) });
      setIntroState({ id, text: r.text, err: null });
    } catch (e) {
      setIntroState({ id, text: intro, err: e instanceof Error ? e.message : "Couldn't draft an intro." });
    } finally {
      setIntroBusy(false);
    }
  }

  async function copyIntro() {
    if (!intro || !member) return;
    await navigator.clipboard.writeText(intro);
    setCopiedId(member.id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  function saveContact() {
    if (!member) return;
    const blob = new Blob([vcard(member)], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${member.full_name.replace(/[^\w ]+/g, "").trim() || "contact"}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const m = member;
  const phone = digits(m?.phone);
  const introBody = intro ? encodeURIComponent(intro) : "";
  const location = m ? [m.city, m.region, m.country].filter(Boolean).join(", ") : "";

  return (
    <aside className={`drawer ${m ? "open" : ""}`} aria-hidden={!m} aria-label="Member profile">
      {m && (
        <div className="drawer-scroll">
          <div className="drawer-art sq-host">
            <Square seed={m.id} hot />
            <button className="drawer-close" onClick={onClose} aria-label="Close profile"><I.close /></button>
          </div>
          <div className="drawer-main">
            <div>
              <h2>{m.full_name}{isMe && <span className="muted" style={{ fontSize: 16, marginLeft: 10, fontFamily: "var(--sans)" }}>(you)</span>}</h2>
              <p className="role">{[m.title, m.company].filter(Boolean).join(" · ")}</p>
              {location && (
                <button className="muted" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 14, marginTop: 8 }} onClick={() => onLocate(m)}>
                  <I.pin width={15} height={15} />{location}
                </button>
              )}
            </div>

            {m.ai_summary && <p className="serif" style={{ fontSize: 19, lineHeight: 1.4 }}>{m.ai_summary}</p>}

            {(m.ai_industry || m.industry) && (
              <div className="kv"><span className="label">Industry</span><span>{m.ai_industry || m.industry}</span></div>
            )}
            {m.bio && <div className="kv"><span className="label">What they do</span><span style={{ whiteSpace: "pre-wrap" }}>{m.bio}</span></div>}
            {m.looking_for && <div className="kv"><span className="label">Looking for</span><span>{m.looking_for}</span></div>}
            {m.can_help_with && <div className="kv"><span className="label">Can help with</span><span>{m.can_help_with}</span></div>}
            {m.tags.length > 0 && <div className="tags">{m.tags.map((t) => <span key={t}>{t}</span>)}</div>}

            {!isMe && (
              <div className="kv">
                <span className="label">Reach out</span>
                <div className="contact-grid">
                  <Contact href={m.email ? `mailto:${m.email}${intro ? `?subject=${encodeURIComponent("MasterClass Executive — hello")}&body=${introBody}` : ""}` : null} icon={<I.mail />} label="Email" />
                  <Contact href={phone ? `sms:${phone}${intro ? `?&body=${introBody}` : ""}` : null} icon={<I.sms />} label="Text" />
                  <Contact href={phone ? `tel:${phone}` : null} icon={<I.phone />} label="Call" />
                  <Contact href={whatsappUrl(m.whatsapp || m.phone) && (whatsappUrl(m.whatsapp || m.phone) + (intro ? `?text=${introBody}` : ""))} icon={<I.whatsapp />} label="WhatsApp" />
                  <Contact href={profileUrl("linkedin", m.linkedin)} icon={<I.linkedin />} label="LinkedIn" />
                  <Contact href={dmUrl("instagram", m.instagram)} icon={<I.instagram />} label="Instagram DM" />
                  <Contact href={dmUrl("facebook", m.facebook)} icon={<I.facebook />} label="Messenger" />
                  <Contact href={profileUrl("x", m.x)} icon={<I.x />} label="X" />
                  <Contact href={profileUrl("tiktok", m.tiktok)} icon={<I.tiktok />} label="TikTok" />
                  <Contact href={profileUrl("youtube", m.youtube)} icon={<I.youtube />} label="YouTube" />
                  <Contact href={profileUrl("website", m.website)} icon={<I.link />} label="Website" />
                  <button className="contact" onClick={saveContact}><I.download />Save contact</button>
                </div>
              </div>
            )}

            {!isMe && (
              <div className="kv">
                <span className="label">AI intro</span>
                {intro ? (
                  <>
                    <div className="intro-box">{intro}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn sm" onClick={copyIntro}><I.copy width={15} height={15} />{copied ? "Copied" : "Copy"}</button>
                      <button className="btn ghost sm" onClick={draftIntro} disabled={introBusy}>Rewrite</button>
                    </div>
                    <span className="muted" style={{ fontSize: 12 }}>Email, Text and WhatsApp above now open with this message. For Instagram, Messenger or LinkedIn, copy it first.</span>
                  </>
                ) : (
                  <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={draftIntro} disabled={introBusy}>
                    <I.sparkle width={15} height={15} />{introBusy ? "Drafting…" : "Draft a personal intro"}
                  </button>
                )}
                {introErr && <span className="error">{introErr}</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
