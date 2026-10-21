"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/TopBar";
import { sb } from "@/lib/supabase-browser";

export default function ResetPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The reset link signs the user in via the URL; wait for that session.
    const { data } = sb().auth.onAuthStateChange((_e, session) => { if (session) setReady(true); });
    sb().auth.getSession().then(({ data: d }) => { if (d.session) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sb().auth.updateUser({ password });
    if (error) return setError(error.message);
    router.push("/map");
  }

  return (
    <main className="page">
      <header className="topbar"><Logo /></header>
      <div className="form-hero grid-bg" style={{ textAlign: "center" }}>
        <h1 style={{ margin: "0 auto" }}><span className="y">Set a new password</span><span className="dot-y" /></h1>
      </div>
      <form className="auth-card" onSubmit={save} style={{ paddingTop: 44 }}>
        {!ready && <p className="notice">Open this page from the link in your reset email.</p>}
        <div className="field">
          <label htmlFor="password">New password</label>
          <input id="password" className="input" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={!ready}>Save password</button>
      </form>
    </main>
  );
}
