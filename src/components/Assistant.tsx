"use client";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { I } from "./Icons";
import { ShiftSquare, Square } from "./Square";
import { VoiceSession, type VoiceState } from "@/lib/voice";
import { api } from "@/lib/supabase-browser";
import type { AssistantReply, ChatTurn } from "@/lib/types";

export type AssistantHandle = { ask: (text: string) => void };

const SUGGESTIONS = [
  "Who in the cohort is near me?",
  "Find people in the healthcare industry",
  "I'm looking for people near Seattle",
  "Who could help me raise capital?",
  "I have a suggestion for this map",
];

const YELLOW: [string, string, string, string] = ["#1F1F1F", "#F2C94C", "#1F1F1F", "#F2C94C"];
const STORE = "cohort-ai-chat";
const THINK: [string, string, string, string] = ["#D06B41", "#F2C94C", "#F5E8B5", "#EFA93B"];
const VOICE_LABEL: Record<VoiceState, string> = {
  connecting: "Connecting…",
  listening: "Listening — just talk",
  thinking: "Searching the cohort…",
  speaking: "Speaking…",
};

function Wave({ state }: { state: VoiceState }) {
  return <span className={`wave ${state}`} aria-hidden>{Array.from({ length: 7 }, (_, i) => <i key={i} />)}</span>;
}

export function Assistant({
  firstName, onResult, ref,
}: {
  firstName: string;
  onResult: (r: AssistantReply, question: string) => void;
  ref?: Ref<AssistantHandle>;
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const msgsRef = useRef<ChatTurn[]>([]);
  msgsRef.current = msgs;
  const [voice, setVoice] = useState<VoiceState | null>(null);
  const voiceRef = useRef<VoiceSession | null>(null);
  const lastSpoken = useRef("");

  // Finalize any in-progress (streaming) transcript bubbles.
  const settle = () => setMsgs((m) => m.map((x) => (x.live ? { ...x, live: false, text: x.text.trim() } : x)).filter((x) => x.text));

  function startVoice() {
    if (voiceRef.current) return;
    setOpen(true);
    lastSpoken.current = "";
    const session = new VoiceSession({
      onState: setVoice,
      onTranscript: (role, text) => {
        if (role === "user") lastSpoken.current += text;
        setMsgs((m) => {
          const last = m[m.length - 1];
          if (last && last.live && last.role === role) return [...m.slice(0, -1), { ...last, text: last.text + text }];
          const settled = m.map((x) => (x.live ? { ...x, live: false, text: x.text.trim() } : x));
          if (role === "user") lastSpoken.current = text;
          return [...settled, { role, text: text.trimStart(), voice: true, live: true }];
        });
      },
      onTurnComplete: settle,
      onEffect: (e) => onResult({ reply: "", matchIds: e.matchIds ?? null, focus: e.focus ?? null, select: e.select ?? null }, lastSpoken.current.trim() || "Voice search"),
      onEnd: (error) => {
        voiceRef.current = null;
        setVoice(null);
        settle();
        if (error) setMsgs((m) => [...m, { role: "assistant", text: error }]);
      },
    });
    voiceRef.current = session;
    void session.start();
  }

  useEffect(() => () => voiceRef.current?.stop(), []);

  useEffect(() => {
    try { setMsgs(JSON.parse(sessionStorage.getItem(STORE) || "[]")); } catch { /* fresh chat */ }
  }, []);
  useEffect(() => {
    sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-20)));
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 250); }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setOpen(true);
    setInput("");
    const next: ChatTurn[] = [...msgsRef.current, { role: "user", text: q }];
    setMsgs(next);
    setBusy(true);
    try {
      const history = next.filter((m) => m.text.trim()).slice(-12).map(({ role, text }) => ({ role, text: text.slice(0, 4000) }));
      const r = await api<AssistantReply>("/api/assistant", { method: "POST", body: JSON.stringify({ messages: history }) });
      setMsgs((m) => [...m, { role: "assistant", text: r.reply }]);
      onResult(r, q);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "Something went wrong — try again." }]);
    } finally {
      setBusy(false);
    }
  }

  useImperativeHandle(ref, () => ({ ask: (t: string) => void send(t) }));

  return (
    <>
      <button className="ai-fab sq-host" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close assistant" : "Open AI assistant"} aria-expanded={open}>
        <Square colors={YELLOW} className="flat" hot={busy} />
        <span className="badge">AI</span>
      </button>

      <section className={`ai-panel ${open ? "" : "closed"}`} aria-label="Cohort AI assistant" aria-hidden={!open}>
        <div className="ai-head">
          <Square colors={YELLOW} className="flat" hot={busy} />
          <div style={{ flex: 1 }}>
            <b>Cohort Concierge</b>
            <span>{voice ? "Live voice · Gemini 3.8 · Zephyr" : "Find classmates by place, industry or niche"}</span>
          </div>
          {msgs.length > 0 && <button className="muted" style={{ fontSize: 12 }} onClick={() => setMsgs([])}>Clear</button>}
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant"><I.close /></button>
        </div>

        <div className="ai-msgs" ref={list} aria-live="polite">
          {msgs.length === 0 && (
            <>
              <div className="msg assistant">
                <span className="who">Concierge</span>
                Hi {firstName || "there"} — tell me who you&rsquo;d like to meet. I&rsquo;ll light them up on the globe and gray out everyone else. You can also send me ideas to improve this map.
              </div>
              <div className="ai-sugg">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
              </div>
            </>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role} ${m.voice ? "voice" : ""} ${m.live ? "live" : ""}`}>
              {m.role === "assistant" && <span className="who">Concierge{m.voice && <I.wave width={13} height={13} />}</span>}
              {m.role === "user" && m.voice && <I.wave width={13} height={13} className="said" />}
              {m.text}
            </div>
          ))}
          {busy && (
            <div className="msg assistant thinking" role="status">
              <ShiftSquare colors={THINK} className="tiny" />
              <span>Thinking</span>
            </div>
          )}
        </div>

        {voice ? (
          <div className="voice-bar" role="status" aria-live="polite">
            <Wave state={voice} />
            <span className="voice-status">{VOICE_LABEL[voice]}</span>
            <button className="voice-end" onClick={() => voiceRef.current?.stop()}>End</button>
          </div>
        ) : (
        <form className="ai-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <textarea
            ref={inputRef}
            value={input}
            placeholder="e.g. founders in fintech near London"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            aria-label="Message the assistant"
            maxLength={2000}
          />
          <button type="button" className="voice-btn" aria-label="Talk with voice (Gemini Live)" title="Talk with voice" onClick={startVoice} disabled={busy}><I.wave /></button>
          <button aria-label="Send" disabled={busy}><I.send /></button>
        </form>
        )}
      </section>
    </>
  );
}
