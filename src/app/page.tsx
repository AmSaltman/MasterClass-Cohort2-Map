"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { I } from "@/components/Icons";
import { ShiftSquare } from "@/components/Square";
import { sb } from "@/lib/supabase-browser";

const CTA: [string, string, string, string] = ["#D06B41", "#F2C94C", "#F5E8B5", "#EFA93B"];

const IntroGlobe = dynamic(() => import("@/components/IntroGlobe"), { ssr: false });

export default function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    sb().auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    // Fallback in case the map can't load (e.g. WebGL off): reveal anyway.
    const t = setTimeout(() => setRevealed(true), 2600);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className={`landing grid-bg ${revealed ? "revealed" : ""}`}>
      <IntroGlobe onPlotted={() => setRevealed(true)} />
      <div className="landing-shade" />
      <section className="landing-center">
        <p className="eyebrow reveal r1">Welcome to the Fall &rsquo;26 Cohort</p>
        <h1 className="landing-title logo reveal r2">
          <span className="mc">MasterClass</span> <span className="ex">Executive</span> <span className="mp">Map</span>
        </h1>
        <p className="landing-sub reveal r3">
          Find classmates by city, industry, or what they&rsquo;re building &mdash; and reach them in one tap.
        </p>
        <div className="landing-actions reveal r4">
          <Link href={signedIn ? "/map" : "/join"} className="join-btn">
            <ShiftSquare colors={CTA} />
            <span className="join-label">{signedIn ? "Open the Map" : "Join the Map"} <I.arrow width={16} height={16} /></span>
          </Link>
          {!signedIn && (
            <p className="signin">Already joined? <Link href="/login">Sign in</Link></p>
          )}
        </div>
      </section>
    </main>
  );
}
