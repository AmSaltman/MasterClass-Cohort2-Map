"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/TopBar";
import { ProfileForm } from "@/components/ProfileForm";
import { sb } from "@/lib/supabase-browser";
import { EMPTY_PROFILE } from "@/lib/types";

export default function JoinPage() {
  const router = useRouter();
  useEffect(() => {
    sb().auth.getSession().then(({ data }) => { if (data.session) router.replace("/profile"); });
  }, [router]);

  return (
    <main className="page">
      <header className="topbar"><Logo /></header>
      <div className="form-hero grid-bg">
        <h1>
          <span className="y">Join the map,</span><br />
          and meet the executives in your cohort<span className="dot-y" />
        </h1>
        <p>Two minutes. Add where you are, what you do, and how to reach you — our AI organizes it so classmates can find you by city, industry, or niche.</p>
      </div>
      <ProfileForm mode="join" initial={EMPTY_PROFILE} />
    </main>
  );
}
