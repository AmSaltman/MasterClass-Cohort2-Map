"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Square } from "@/components/Square";
import { I } from "@/components/Icons";
import { sb } from "@/lib/supabase-browser";

const TILES = Array.from({ length: 160 }, (_, i) => `tile-${i * 7919}`);

export default function Landing() {
  const [hot, setHot] = useState<Set<number>>(new Set());
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    sb().auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    // A few tiles "breathe" at a time so the wall feels alive.
    const t = setInterval(() => {
      setHot(new Set(Array.from({ length: 6 }, () => Math.floor(Math.random() * TILES.length))));
    }, 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="landing">
      <div className="mosaic" aria-hidden>
        {TILES.map((seed, i) => (
          <div key={seed} className="tile sq-host">
            <Square seed={seed} hot={hot.has(i)} />
          </div>
        ))}
      </div>
      <div className="landing-shade" />
      <section className="landing-center">
        <p className="eyebrow">Welcome to the Fall &rsquo;26 Cohort</p>
        <h1 className="landing-title logo">
          <span className="mc">MasterClass</span> <span className="ex">Executive</span>
        </h1>
        <p className="landing-sub">
          The cohort map. Find classmates by city, industry, or what they&rsquo;re building &mdash; and reach them in one tap.
        </p>
        <div className="landing-actions">
          <Link href={signedIn ? "/map" : "/join"} className="round-cta">
            <span className="circle"><I.arrow /></span>
            {signedIn ? "Open the map" : "Get Started"}
          </Link>
          {!signedIn && (
            <p className="signin">Already joined? <Link href="/login">Sign in</Link></p>
          )}
        </div>
      </section>
    </main>
  );
}
