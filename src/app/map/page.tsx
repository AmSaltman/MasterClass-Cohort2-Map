"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlobeHandle } from "@/components/Globe";
import { Assistant, type AssistantHandle } from "@/components/Assistant";
import { I } from "@/components/Icons";
import { MemberDrawer } from "@/components/MemberDrawer";
import { Square } from "@/components/Square";
import { TopBar } from "@/components/TopBar";
import { api, sb } from "@/lib/supabase-browser";
import type { AssistantReply, Member } from "@/lib/types";

const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

function haystack(m: Member) {
  return [m.full_name, m.title, m.company, m.industry, m.ai_industry, m.city, m.region, m.country, m.bio, m.looking_for, m.can_help_with, ...m.tags]
    .filter(Boolean).join(" ").toLowerCase();
}

export default function MapPage() {
  const router = useRouter();
  const globe = useRef<GlobeHandle>(null);
  const assistant = useRef<AssistantHandle>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState<string | null>(null);
  const [ai, setAi] = useState<{ ids: string[]; label: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("demo")) {
        const { demoMembers } = await import("@/lib/demo");
        const all = demoMembers();
        setMembers(all); setMeId(all[0].id); setLoaded(true);
        return;
      }
      const { data } = await sb().auth.getSession();
      if (!data.session) return router.replace("/login");
      const res = await api<{ me: string; hasProfile: boolean; members: Member[] }>("/api/members");
      if (!res.hasProfile) return router.replace("/profile");
      setMembers(res.members);
      setMeId(res.me);
      setLoaded(true);
    })().catch((e) => setLoadError(e instanceof Error ? e.message : "Couldn't load the cohort."));
  }, [router]);

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const me = meId ? byId.get(meId) : undefined;
  const firstName = me?.full_name.split(" ")[0] || "";
  const index = useMemo(() => members.map((m) => [m, haystack(m)] as const), [members]);

  const industries = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach((m) => { const k = m.ai_industry || m.industry; if (k) counts.set(k, (counts.get(k) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
  }, [members]);
  const countries = useMemo(() => new Set(members.map((m) => m.country).filter(Boolean)).size, [members]);

  const localMatches = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length && !industry) return null;
    return index
      .filter(([m, h]) => (!industry || (m.ai_industry || m.industry) === industry) && tokens.every((t) => h.includes(t)))
      .map(([m]) => m);
  }, [index, query, industry]);

  const matchIds = useMemo(() => {
    if (ai) return new Set(ai.ids);
    if (localMatches) return new Set(localMatches.map((m) => m.id));
    return null;
  }, [ai, localMatches]);

  const listed: Member[] = ai
    ? ai.ids.map((id) => byId.get(id)).filter((m): m is Member => !!m)
    : localMatches || members;

  const onAiResult = useCallback((r: AssistantReply, question: string) => {
    if (r.matchIds === null) return; // e.g. a saved suggestion — leave the map alone
    setQuery("");
    setIndustry(null);
    setAi(r.matchIds.length ? { ids: r.matchIds, label: question } : null);
    if (r.matchIds.length) setPanelOpen(true);
    if (r.focus) globe.current?.flyTo(r.focus.lat, r.focus.lng, r.focus.zoom);
    else if (r.matchIds.length) globe.current?.fitMembers(r.matchIds);
  }, []);

  function clearAll() {
    setAi(null); setQuery(""); setIndustry(null);
  }

  function submitSearch() {
    const q = query.trim();
    if (!q) return;
    if (localMatches && localMatches.length) {
      setPanelOpen(true);
      globe.current?.fitMembers(localMatches.map((m) => m.id));
    } else {
      assistant.current?.ask(q); // no direct hits — let the AI interpret it
    }
  }

  function pickIndustry(k: string) {
    setAi(null);
    const next = industry === k ? null : k;
    setIndustry(next);
    if (next) {
      const ids = members.filter((m) => (m.ai_industry || m.industry) === next).map((m) => m.id);
      setPanelOpen(true);
      globe.current?.fitMembers(ids);
    }
  }

  function select(id: string) {
    setSelectedId(id);
  }

  function locate(m: Member) {
    if (m.lat !== null && m.lng !== null) globe.current?.flyTo(m.lat, m.lng, 8);
  }

  async function signOut() {
    await sb().auth.signOut();
    router.push("/");
  }

  if (loadError) {
    return (
      <div className="loading-screen" style={{ textAlign: "center" }}>
        <div><p className="error">{loadError}</p><p style={{ marginTop: 14 }}><Link href="/login">Sign in again</Link></p></div>
      </div>
    );
  }

  const selected = selectedId ? byId.get(selectedId) || null : null;
  const filtering = !!(ai || localMatches);

  return (
    <div className="map-page">
      <TopBar
        name={me?.full_name}
        members={members.length}
        countries={countries}
        onGlobe={() => { setPanelOpen(false); globe.current?.reset(); }}
        onDirectory={() => setPanelOpen((o) => !o)}
        onSignOut={signOut}
      />
      <div className={`map-stage ${selected ? "drawer-open" : ""}`}>
        <Globe handleRef={globe} members={members} matchIds={matchIds} selectedId={selectedId} meId={meId} onSelect={select} />
        <div className="grid-overlay grid-bg" />

        {!loaded && <div className="loading-screen" style={{ position: "absolute" }}><Square seed="loading" className="pulse" /></div>}

        <div className={`greeting ${panelOpen || selected ? "hide" : ""}`}>
          <span className="y">Hi {firstName || "there"},</span><br />
          your cohort, mapped<span className="dot-y" />
        </div>

        <form className="searchbar" role="search" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
          <I.search />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setAi(null); }}
            placeholder="Search name, company, industry, city…"
            aria-label="Search the cohort"
          />
          {(query || filtering) && <button type="button" className="clear" onClick={clearAll}>Clear</button>}
          <button type="button" className="ask" onClick={() => assistant.current?.ask(query.trim() || "Who should I meet in this cohort?")}>
            <I.sparkle width={16} height={16} /><span>Ask AI</span>
          </button>
        </form>

        {ai ? (
          <div className="match-banner" role="status">
            <I.sparkle width={14} height={14} />
            {ai.ids.length} {ai.ids.length === 1 ? "match" : "matches"} · “{ai.label.length > 42 ? ai.label.slice(0, 40) + "…" : ai.label}”
            <button onClick={clearAll}>Clear</button>
          </div>
        ) : (
          industries.length > 1 && (
            <div className="filter-chips" role="toolbar" aria-label="Filter by industry">
              {industries.map((k) => (
                <button key={k} className={`chip ${industry === k ? "on" : ""}`} onClick={() => pickIndustry(k)} aria-pressed={industry === k}>{k}</button>
              ))}
            </div>
          )
        )}

        <aside className={`panel ${panelOpen ? "open" : ""}`} aria-label="Cohort directory" aria-hidden={!panelOpen}>
          <div className="panel-head">
            <div>
              <h3>{ai ? "AI matches" : localMatches ? "Search results" : "Directory"}</h3>
              <p>{listed.length} {listed.length === 1 ? "member" : "members"}{filtering ? " · lit up on the globe" : ""}</p>
            </div>
            <button className="icon-btn" onClick={() => setPanelOpen(false)} aria-label="Close directory"><I.close /></button>
          </div>
          <div className="panel-body">
            {listed.length === 0 && (
              <div className="empty">
                No one matches that yet.{" "}
                {query && <button style={{ textDecoration: "underline" }} onClick={() => assistant.current?.ask(query)}>Ask the AI instead</button>}
              </div>
            )}
            {listed.map((m) => (
              <button key={m.id} className="person sq-host" onClick={() => { select(m.id); locate(m); }}>
                <Square seed={m.id} />
                <div style={{ minWidth: 0 }}>
                  <b>{m.full_name}{m.id === meId ? " (you)" : ""}</b>
                  <div className="meta">{[m.title, m.company].filter(Boolean).join(" · ")}</div>
                  <div className="loc">{[m.ai_industry || m.industry, [m.city, m.country].filter(Boolean).join(", ")].filter(Boolean).join(" — ")}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <MemberDrawer member={selected} isMe={selected?.id === meId} onClose={() => setSelectedId(null)} onLocate={locate} />

        <div className="zoomctl" aria-label="Map controls">
          <button onClick={() => globe.current?.zoomIn()} aria-label="Zoom in"><I.plus /></button>
          <button onClick={() => globe.current?.zoomOut()} aria-label="Zoom out"><I.minus /></button>
          <button onClick={() => globe.current?.reset()} aria-label="Reset view"><I.globe /></button>
          {me?.lat != null && <button onClick={() => locate(me)} aria-label="Find me"><I.target /></button>}
        </div>

        <nav className="dock" aria-label="Views">
          <button className={!panelOpen ? "on" : ""} onClick={() => { setPanelOpen(false); globe.current?.reset(); }}>Globe</button>
          <button className={panelOpen ? "on" : ""} onClick={() => setPanelOpen(true)}>Directory</button>
          <Link href="/profile">My Profile</Link>
        </nav>

        <Assistant ref={assistant} firstName={firstName} onResult={onAiResult} />
      </div>
    </div>
  );
}
