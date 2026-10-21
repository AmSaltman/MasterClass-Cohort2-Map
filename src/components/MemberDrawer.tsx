"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ContactGrid } from "./Contacts";
import { I } from "./Icons";
import { Square } from "./Square";
import { api } from "@/lib/supabase-browser";
import { vcard } from "@/lib/social";
import type { Member } from "@/lib/types";

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
  const location = m ? [m.city, m.region, m.country].filter(Boolean).join(", ") : "";

  return (
    <aside className={`drawer ${m ? "open" : ""}`} aria-hidden={!m} aria-label="Member profile">
      {m && (
        <div className="drawer-scroll">
          <div className={`drawer-art sq-host ${m.avatar_url ? "with-photo" : ""}`}>
            <Square seed={m.id} hot />
            {m.avatar_url && <img className="drawer-portrait photo" src={m.avatar_url} alt={`${m.full_name}`} />}
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

            <div className="kv">
              <span className="label">{isMe ? "How classmates reach you" : "Reach out"}</span>
              <ContactGrid
                member={m}
                message={intro}
                extra={!isMe && <button className="contact" onClick={saveContact}><I.download />Save contact</button>}
              />
              {isMe && (
                <Link href="/profile" className="muted" style={{ fontSize: 13, textDecoration: "underline", marginTop: 4 }}>
                  Edit your contact info and what the AI says about you
                </Link>
              )}
            </div>

            {m.ai_summary && <p className="serif" style={{ fontSize: 19, lineHeight: 1.4 }}>{m.ai_summary}</p>}

            {(m.industries?.length || m.industry) && (
              <div className="kv">
                <span className="label">{(m.industries?.length || 0) > 1 ? "Industries" : "Industry"}</span>
                <div className="tags strong">{(m.industries?.length ? m.industries : [m.industry!]).map((t) => <span key={t}>{t}</span>)}</div>
              </div>
            )}
            {m.bio && <div className="kv"><span className="label">What they do</span><span style={{ whiteSpace: "pre-wrap" }}>{m.bio}</span></div>}
            {m.looking_for && <div className="kv"><span className="label">Looking for</span><span>{m.looking_for}</span></div>}
            {m.can_help_with && <div className="kv"><span className="label">Can help with</span><span>{m.can_help_with}</span></div>}
            {m.tags.length > 0 && <div className="tags">{m.tags.map((t) => <span key={t}>{t}</span>)}</div>}

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
