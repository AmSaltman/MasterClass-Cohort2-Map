"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/TopBar";
import { ProfileForm } from "@/components/ProfileForm";
import { Square } from "@/components/Square";
import { api, sb } from "@/lib/supabase-browser";
import { EMPTY_PROFILE, type ProfileInput } from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const [initial, setInitial] = useState<ProfileInput | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await sb().auth.getSession();
      if (!data.session) return router.replace("/login");
      const res = await api<{ profile: Record<string, unknown> | null; account: { email: string; full_name: string } }>("/api/profile");
      const base: ProfileInput = { ...EMPTY_PROFILE, email: res.account.email || "", full_name: res.account.full_name || "" };
      if (res.profile) {
        for (const k of Object.keys(EMPTY_PROFILE) as (keyof ProfileInput)[]) {
          const v = res.profile[k];
          if (v !== null && v !== undefined) (base as Record<string, unknown>)[k] = v;
        }
      }
      setIsNew(!res.profile);
      setFirstName((base.full_name || "").split(" ")[0]);
      setInitial(base);
    })().catch(() => router.replace("/login"));
  }, [router]);

  if (!initial) return <div className="loading-screen"><Square seed="loading" className="pulse" /></div>;

  return (
    <main className="page">
      <header className="topbar"><Logo href="/map" /></header>
      <div className="form-hero grid-bg">
        <h1>
          <span className="y">{firstName ? `Hi ${firstName},` : "Hi,"}</span><br />
          {isNew ? "finish your profile to appear on the map" : "here's how classmates see you"}<span className="dot-y" />
        </h1>
        <p>Every save is re-organized by our AI — industry, search tags, and a short summary — so the right people can find you.</p>
      </div>
      <ProfileForm mode="edit" initial={initial} />
    </main>
  );
}
