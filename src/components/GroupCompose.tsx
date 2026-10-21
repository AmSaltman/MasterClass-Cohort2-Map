"use client";
import { useState } from "react";
import { I } from "./Icons";
import { api } from "@/lib/supabase-browser";
import type { Member } from "@/lib/types";

// Some mail apps truncate very long mailto: links; past this we suggest copying.
const MAILTO_SAFE = 1900;

export function GroupCompose({
  members, draft, onClose,
}: {
  members: Member[];
  draft: { subject?: string; body?: string } | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"bcc" | "group">("bcc");
  const [subject, setSubject] = useState(draft?.subject || "");
  const [body, setBody] = useState(draft?.body || "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const emails = [...new Set(members.map((m) => m.email).filter((e): e is string => !!e))];
  const hidden = members.length - members.filter((m) => m.email).length;
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const href = mode === "group" ? `mailto:${emails.join(",")}?${q}` : `mailto:?bcc=${emails.join(",")}&${q}`;
  const tooLong = href.length > MAILTO_SAFE;

  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1800);
  }

  async function draftWithAI() {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ subject: string; body: string }>("/api/group-draft", {
        method: "POST",
        body: JSON.stringify({ ids: members.map((m) => m.id), note }),
      });
      setSubject(r.subject); setBody(r.body);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't draft that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="compose" role="dialog" aria-label="Email the selected group">
      <div className="compose-head">
        <div>
          <b>Email {members.length} {members.length === 1 ? "person" : "people"}</b>
          <span>{emails.length} with email{hidden > 0 ? ` · ${hidden} hid their email` : ""}</span>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close compose"><I.close /></button>
      </div>

      <div className="seg" role="radiogroup" aria-label="How to address">
        <button role="radio" aria-checked={mode === "bcc"} className={mode === "bcc" ? "on" : ""} onClick={() => setMode("bcc")}>BCC · private</button>
        <button role="radio" aria-checked={mode === "group"} className={mode === "group" ? "on" : ""} onClick={() => setMode("group")}>Group · everyone sees all</button>
      </div>

      <div className="compose-ai">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's it about? e.g. dinner in Seattle Saturday" maxLength={500} />
        <button className="btn ghost sm" onClick={draftWithAI} disabled={busy}><I.sparkle width={15} height={15} />{busy ? "Drafting…" : "Draft with AI"}</button>
      </div>
      <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" />
      <textarea className="input" rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" aria-label="Message" />
      {err && <span className="error">{err}</span>}
      {tooLong && <span className="hint">That&rsquo;s a big list for an email link — if your mail app cuts it off, use Copy emails and paste into {mode === "bcc" ? "BCC" : "To"}.</span>}

      <div className="compose-actions">
        <a className={`btn sm ${emails.length ? "" : "disabled"}`} href={emails.length ? href : undefined} aria-disabled={!emails.length}>
          <I.mail width={15} height={15} />Open in email app
        </a>
        <button className="btn ghost sm" onClick={() => copy(emails.join(", "), "emails")} disabled={!emails.length}>
          <I.copy width={15} height={15} />{copied === "emails" ? "Copied" : "Copy emails"}
        </button>
        {body && (
          <button className="btn ghost sm" onClick={() => copy(`${subject}\n\n${body}`, "msg")}>
            {copied === "msg" ? "Copied" : "Copy message"}
          </button>
        )}
      </div>
    </div>
  );
}
