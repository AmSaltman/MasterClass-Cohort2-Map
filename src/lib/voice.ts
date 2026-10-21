"use client";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { api } from "./supabase-browser";

export type VoiceState = "connecting" | "listening" | "thinking" | "speaking";
export type VoiceEffect = { matchIds?: string[]; focus?: { lat: number; lng: number; zoom: number }; select?: { ids: string[]; subject?: string; body?: string } };

type Handlers = {
  onState: (s: VoiceState) => void;
  // Incremental transcript text; `role` says who is speaking.
  onTranscript: (role: "user" | "assistant", text: string) => void;
  onTurnComplete: () => void;
  onEffect: (e: VoiceEffect) => void;
  onEnd: (error?: string) => void;
};

// Captures raw mic frames on the audio thread.
const WORKLET = `class MicTap extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
}
registerProcessor("mic-tap", MicTap);`;

const IN_RATE = 16000; // Gemini Live input: 16 kHz mono PCM16
const OUT_RATE = 24000; // Gemini Live output: 24 kHz mono PCM16

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Averages input samples down to 16 kHz and converts to 16-bit PCM.
function downsample(input: Float32Array, fromRate: number): Int16Array {
  const ratio = fromRate / IN_RATE;
  const out = new Int16Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio), end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    const v = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

// One live voice conversation with the concierge (Gemini Live, Zephyr voice).
export class VoiceSession {
  private session: Session | null = null;
  private inCtx: AudioContext | null = null;
  private outCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private pending: Int16Array[] = [];
  private pendingLen = 0;
  private playHead = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private ended = false;
  private state: VoiceState = "connecting";

  constructor(private h: Handlers) {}

  private set(s: VoiceState) {
    if (this.state !== s) { this.state = s; this.h.onState(s); }
  }

  // Must be called from a click/tap so browsers allow audio + mic.
  async start() {
    this.h.onState("connecting");
    // Create audio contexts inside the user gesture (required on iOS Safari).
    this.inCtx = new AudioContext();
    this.outCtx = new AudioContext({ sampleRate: OUT_RATE });
    try {
      const [{ token, model }, stream] = await Promise.all([
        api<{ token: string; model: string }>("/api/live/token", { method: "POST" }),
        navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }),
      ]);
      if (this.ended) { stream.getTracks().forEach((t) => t.stop()); return; }
      this.stream = stream;

      const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });
      this.session = await ai.live.connect({
        model,
        config: { responseModalities: [Modality.AUDIO] }, // everything else is locked in the token
        callbacks: {
          onmessage: (m) => this.onMessage(m),
          onerror: () => this.stop("The voice connection dropped."),
          onclose: () => this.stop(),
        },
      });

      const blobUrl = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      await this.inCtx.audioWorklet.addModule(blobUrl);
      URL.revokeObjectURL(blobUrl);
      const src = this.inCtx.createMediaStreamSource(stream);
      const tap = new AudioWorkletNode(this.inCtx, "mic-tap");
      const rate = this.inCtx.sampleRate;
      tap.port.onmessage = (e: MessageEvent<Float32Array>) => this.onMic(downsample(e.data, rate));
      src.connect(tap);
      await Promise.all([this.inCtx.resume(), this.outCtx.resume()]);
      this.set("listening");
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "NotAllowedError"
        ? "Microphone access was blocked. Allow it in your browser to use voice."
        : err instanceof Error ? err.message : "Couldn't start voice mode.";
      this.stop(msg);
    }
  }

  // Batches ~100 ms of audio per message.
  private onMic(chunk: Int16Array) {
    if (!this.session || this.ended) return;
    this.pending.push(chunk);
    this.pendingLen += chunk.length;
    if (this.pendingLen < IN_RATE / 10) return;
    const all = new Int16Array(this.pendingLen);
    let o = 0;
    for (const c of this.pending) { all.set(c, o); o += c.length; }
    this.pending = [];
    this.pendingLen = 0;
    this.session.sendRealtimeInput({ audio: { data: toBase64(new Uint8Array(all.buffer)), mimeType: `audio/pcm;rate=${IN_RATE}` } });
  }

  private onMessage(m: LiveServerMessage) {
    const sc = m.serverContent;
    if (sc?.interrupted) this.stopPlayback(); // user started talking over the reply
    if (sc?.inputTranscription?.text) this.h.onTranscript("user", sc.inputTranscription.text);
    if (sc?.outputTranscription?.text) this.h.onTranscript("assistant", sc.outputTranscription.text);
    for (const part of sc?.modelTurn?.parts || []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/")) this.play(part.inlineData.data);
    }
    if (sc?.turnComplete) {
      this.h.onTurnComplete();
      if (!this.sources.size) this.set("listening");
    }
    if (m.toolCall?.functionCalls?.length) void this.runTools(m.toolCall.functionCalls);
    if (m.goAway) this.stop();
  }

  private async runTools(calls: NonNullable<NonNullable<LiveServerMessage["toolCall"]>["functionCalls"]>) {
    this.set("thinking");
    const functionResponses = await Promise.all(calls.map(async (c) => {
      try {
        const r = await api<{ output: Record<string, unknown>; effect: VoiceEffect }>("/api/live/tool", {
          method: "POST",
          body: JSON.stringify({ name: c.name, args: c.args || {} }),
        });
        if (r.effect.matchIds || r.effect.focus || r.effect.select) this.h.onEffect(r.effect);
        return { id: c.id, name: c.name, response: r.output };
      } catch {
        return { id: c.id, name: c.name, response: { error: "tool failed" } };
      }
    }));
    if (!this.ended) this.session?.sendToolResponse({ functionResponses });
  }

  private play(b64: string) {
    const ctx = this.outCtx;
    if (!ctx) return;
    const bytes = fromBase64(b64);
    const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const buf = ctx.createBuffer(1, pcm.length, OUT_RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    this.playHead = Math.max(this.playHead, ctx.currentTime + 0.02); // gapless queue
    src.start(this.playHead);
    this.playHead += buf.duration;
    this.sources.add(src);
    this.set("speaking");
    src.onended = () => {
      this.sources.delete(src);
      if (!this.sources.size && !this.ended) this.set("listening");
    };
  }

  private stopPlayback() {
    for (const s of this.sources) { try { s.stop(); } catch { /* already stopped */ } }
    this.sources.clear();
    this.playHead = 0;
  }

  stop(error?: string) {
    if (this.ended) return;
    this.ended = true;
    this.stopPlayback();
    try { this.session?.close(); } catch { /* already closed */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.inCtx?.close().catch(() => {});
    void this.outCtx?.close().catch(() => {});
    this.h.onEnd(error);
  }
}
