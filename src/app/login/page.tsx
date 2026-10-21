"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/TopBar";
import { sb } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await sb().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) return setError(error.message === "Invalid login credentials" ? "Email or password is incorrect." : error.message);
    router.push("/map");
  }

  async function forgot() {
    if (!email.trim()) return setError("Enter your email first, then tap “Forgot password”.");
    setError(null);
    const { error } = await sb().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset`,
    });
    if (error) return setError(error.message);
    setNote("Check your inbox for a reset link.");
  }

  return (
    <main className="page">
      <header className="topbar"><Logo /></header>
      <div className="form-hero grid-bg" style={{ textAlign: "center" }}>
        <h1 style={{ margin: "0 auto" }}><span className="y">Welcome back</span><span className="dot-y" /></h1>
        <p style={{ margin: "18px auto 0" }}>Sign in to open the cohort map.</p>
      </div>
      <form className="auth-card" onSubmit={signIn} style={{ paddingTop: 44 }}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {note && <p className="notice" role="status">{note}</p>}
        <button className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }} className="muted">
          <button type="button" onClick={forgot} style={{ textDecoration: "underline" }}>Forgot password</button>
          <span>New here? <Link href="/join">Join the map</Link></span>
        </div>
      </form>
    </main>
  );
}
