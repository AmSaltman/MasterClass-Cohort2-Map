"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AvatarPicker, type AvatarChange } from "./AvatarPicker";
import { CityInput } from "./CityInput";
import { ShiftSquare } from "./Square";
import { api, sb, uploadAvatar } from "@/lib/supabase-browser";
import type { ProfileInput } from "@/lib/types";

type AiResult = { industry: string | null; tags: string[]; summary: string | null; located: boolean };

function Field({ label, hint, full, children, htmlFor }: { label: string; hint?: string; full?: boolean; children: ReactNode; htmlFor?: string }) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function Section({ num, title, text, children }: { num: string; title: string; text: string; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <div className="num">{num}</div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <div className="fields">{children}</div>
    </section>
  );
}

export function ProfileForm({ mode, initial, avatarUrl = null, seed = "you" }: { mode: "join" | "edit"; initial: ProfileInput; avatarUrl?: string | null; seed?: string }) {
  const router = useRouter();
  const [p, setP] = useState<ProfileInput>(initial);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<ReactNode>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [ai, setAi] = useState<AiResult | null>(null);
  const [avatar, setAvatar] = useState<AvatarChange>({ blob: null, remove: false });

  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const text = (k: keyof ProfileInput) => ({
    id: k,
    className: "input",
    value: (p[k] as string) || "",
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (mode === "join") {
        setStage("Creating your account");
        const res = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, email: p.email, password, full_name: p.full_name }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStage(null);
          setError(res.status === 409
            ? <>You already have an account. <Link href="/login">Sign in</Link> to edit your profile.</>
            : body.error || "Couldn't create your account.");
          return;
        }
        const { error: signInError } = await sb().auth.signInWithPassword({ email: p.email.trim().toLowerCase(), password });
        if (signInError) throw signInError;
      }
      setStage("Our AI is organizing your profile");
      const out = await api<{ ai: AiResult }>("/api/profile", { method: "POST", body: JSON.stringify(p) });
      setAi(out.ai);
      if (avatar.blob) {
        setStage("Uploading your photo");
        try { await uploadAvatar(avatar.blob); } catch (e) { console.error(e); /* profile saved; photo can be retried */ }
      } else if (avatar.remove) {
        await api("/api/avatar", { method: "DELETE" }).catch(() => {});
      }
      setStage("Placing you on the map");
      setTimeout(() => router.push("/map"), 2200);
    } catch (err) {
      setStage(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function deleteAccount() {
    if (!confirm("Delete your profile and account? This removes you from the map and can't be undone.")) return;
    try {
      await api("/api/profile", { method: "DELETE" });
      await sb().auth.signOut();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account.");
    }
  }

  return (
    <form onSubmit={submit} className="form-wrap">
      <Section num="01" title={mode === "join" ? "Your account" : "You"} text={mode === "join" ? "Use the cohort access code from your program team." : "How classmates will see your name."}>
        <div className="field full">
          <span className="label">Profile picture</span>
          <AvatarPicker seed={seed} current={avatarUrl} onChange={setAvatar} />
        </div>
        <Field label="Full name" htmlFor="full_name"><input {...text("full_name")} required autoComplete="name" /></Field>
        <Field label="Email" htmlFor="email" hint={mode === "join" ? "You'll sign in with this." : "Shown to classmates if you allow it below."}>
          <input {...text("email")} type="email" required autoComplete="email" />
        </Field>
        {mode === "join" && (
          <>
            <Field label="Password" htmlFor="password" hint="At least 8 characters.">
              <input id="password" className="input" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Cohort access code" htmlFor="code">
              <input id="code" className="input" required value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" placeholder="e.g. EXEC-XXXX" />
            </Field>
          </>
        )}
      </Section>

      <Section num="02" title="Where you are" text="City-level only — we never ask for an address. This places your square on the globe.">
        <Field label="City" full htmlFor="city">
          <CityInput
            value={p.city}
            pinned={p.lat !== null}
            onText={(v) => setP((prev) => ({ ...prev, city: v, region: "", country: "", lat: null, lng: null }))}
            onPick={(pl) => setP((prev) => ({ ...prev, ...pl }))}
          />
        </Field>
        {p.lat !== null && (
          <p className="hint full" style={{ color: "var(--muted)" }}>
            Pinned: {[p.city, p.region, p.country].filter(Boolean).join(", ")}
          </p>
        )}
      </Section>

      <Section num="03" title="Your work" text="The more you share, the better the AI can match you with the right classmates.">
        <Field label="Title" htmlFor="title"><input {...text("title")} placeholder="CEO, Founder, VP Sales…" autoComplete="organization-title" /></Field>
        <Field label="Company" htmlFor="company"><input {...text("company")} autoComplete="organization" /></Field>
        <Field label="Industry" htmlFor="industry"><input {...text("industry")} placeholder="Healthcare, Real Estate, SaaS…" /></Field>
        <Field label="Website" htmlFor="website"><input {...text("website")} placeholder="yourcompany.com" inputMode="url" /></Field>
        <Field label="What you do" full htmlFor="bio" hint="A few sentences on your business, role, and focus.">
          <textarea {...text("bio")} rows={4} />
        </Field>
        <Field label="Looking for" htmlFor="looking_for" hint="Intros, investors, partners, hires, advice…">
          <textarea {...text("looking_for")} rows={3} />
        </Field>
        <Field label="Can help with" htmlFor="can_help_with" hint="Where you can add value for classmates.">
          <textarea {...text("can_help_with")} rows={3} />
        </Field>
      </Section>

      <Section num="04" title="Reach me" text="Usernames or links both work. Classmates get one-tap message buttons for each.">
        <Field label="Phone" htmlFor="phone"><input {...text("phone")} type="tel" placeholder="+1 206 555 0100" autoComplete="tel" /></Field>
        <Field label="WhatsApp" htmlFor="whatsapp"><input {...text("whatsapp")} type="tel" placeholder="Number with country code" /></Field>
        <Field label="LinkedIn" htmlFor="linkedin"><input {...text("linkedin")} placeholder="linkedin.com/in/you" /></Field>
        <Field label="Instagram" htmlFor="instagram"><input {...text("instagram")} placeholder="@you" /></Field>
        <Field label="Facebook" htmlFor="facebook"><input {...text("facebook")} placeholder="facebook.com/you" /></Field>
        <Field label="X / Twitter" htmlFor="x"><input {...text("x")} placeholder="@you" /></Field>
        <Field label="TikTok" htmlFor="tiktok"><input {...text("tiktok")} placeholder="@you" /></Field>
        <Field label="YouTube" htmlFor="youtube"><input {...text("youtube")} placeholder="@channel" /></Field>
      </Section>

      <Section num="05" title="Privacy" text="Only signed-in members of this cohort can see the map. You can change these any time.">
        <label className="toggle full">
          <input type="checkbox" checked={p.show_email} onChange={(e) => set("show_email", e.target.checked)} />
          Show my email to classmates
        </label>
        <label className="toggle full">
          <input type="checkbox" checked={p.show_phone} onChange={(e) => set("show_phone", e.target.checked)} />
          Show my phone &amp; WhatsApp to classmates
        </label>
      </Section>

      {error && <p className="error" role="alert" style={{ marginTop: 24 }}>{error}</p>}

      <div className="form-foot">
        {mode === "edit" ? (
          <button type="button" className="btn danger sm" onClick={deleteAccount}>Delete my profile</button>
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>Already joined? <Link href="/login">Sign in</Link></p>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          {mode === "edit" && <Link href="/map" className="btn ghost">Cancel</Link>}
          <button className="btn" disabled={!!stage}>{mode === "join" ? "Join the map" : "Save profile"}</button>
        </div>
      </div>

      {stage && (
        <div className="processing" role="status" aria-live="polite">
          <div>
            <ShiftSquare seed={p.email || "you"} className="big" />
            <h3>{stage}<span className="dot-y" /></h3>
            {ai ? (
              <p style={{ maxWidth: 460, margin: "10px auto 0" }}>
                Filed under <b style={{ color: "var(--text)" }}>{ai.industry || "your industry"}</b>
                {ai.tags.length > 0 && <> · {ai.tags.slice(0, 5).join(", ")}</>}
              </p>
            ) : (
              <p>Normalizing your industry, tagging your expertise, and making you searchable.</p>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
