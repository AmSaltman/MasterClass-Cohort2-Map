"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlobeHandle } from "@/components/Globe";
import { Assistant, type AssistantHandle } from "@/components/Assistant";
import { QuickContacts } from "@/components/Contacts";
import { I } from "@/components/Icons";
import { MemberDrawer } from "@/components/MemberDrawer";
import { ShiftSquare, Square } from "@/components/Square";
import { TopBar } from "@/components/TopBar";
import { api, sb } from "@/lib/supabase-browser";
import type { AssistantReply, Member } from "@/lib/types";

const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

function industriesOf(m: Member): string[] {
  return m.industries?.length ? m.industries : m.industry ? [m.industry] : [];
}

function haystack(m: Member) {
  return [m.full_name, m.title, m.company, ...industriesOf(m), m.city, m.region, m.country, m.bio, m.looking_for, m.can_help_with, ...m.tags]
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
  const [saved, setSaved] = useState<string[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    (async () => {
      if (process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("demo")) {
        const { demoMembers } = await import("@/lib/demo");
        const all = demoMembers();
        setMembers(all); setMeId(all[0].id); setLoaded(true); setDemo(true);
        setSaved([all[3].id, all[9].id, all[14].id, all[20].id]);
        return;
      }
      const { data } = await sb().auth.getSession();
      if (!data.session) return router.replace("/login");
      const res = await api<{ me: string; hasProfile: boolean; members: Member[] }>("/api/members");
      if (!res.hasProfile) return router.replace("/profile");
      setMembers(res.members);
      setMeId(res.me);
      api<{ ids: string[] }>("/api/saved").then((r) => setSaved(r.ids)).catch(() => {});
      setLoaded(true);
    })().catch((e) => setLoadError(e instanceof Error ? e.message : "Couldn't load the cohort."));
  }, [router]);

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const me = meId ? byId.get(meId) : undefined;
  const firstName = me?.full_name.split(" ")[0] || "";
  const index = useMemo(() => members.map((m) => [m, haystack(m)] as const), [members]);

  // Every industry in the cohort, merged case-insensitively ("AI" = "ai"),
  // labelled with its most common spelling, most popular first.
  const allIndustries = useMemo(() => {
    const groups = new Map<string, { count: number; spellings: Map<string, number> }>();
    members.forEach((m) => new Set(industriesOf(m).map((x) => x.trim())).forEach((label) => {
      const key = label.toLowerCase();
      const g = groups.get(key) || { count: 0, spellings: new Map() };
      g.count++;
      g.spellings.set(label, (g.spellings.get(label) || 0) + 1);
      groups.set(key, g);
    }));
    return [...groups.entries()]
      .map(([key, g]) => ({ key, count: g.count, label: [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [members]);
  const [allOpen, setAllOpen] = useState(false);
  const [industryFilter, setIndustryFilter] = useState("");
  const topIndustries = allIndustries.slice(0, 8);
  const selectedExtra = industry && !topIndustries.some((i) => i.key === industry) ? allIndustries.find((i) => i.key === industry) : undefined;
  const countries = useMemo(() => new Set(members.map((m) => m.country).filter(Boolean)).size, [members]);

  const localMatches = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length && !industry) return null;
    return index
      .filter(([m, h]) => (!industry || industriesOf(m).some((x) => x.trim().toLowerCase() === industry)) && tokens.every((t) => h.includes(t)))
      .map(([m]) => m);
  }, [index, query, industry]);

  const savedMembers = useMemo(() => saved.map((id) => byId.get(id)).filter((m): m is Member => !!m), [saved, byId]);

  const matchIds = useMemo(() => {
    if (showSaved) return new Set([...saved, ...(meId ? [meId] : [])]);
    if (ai) return new Set(ai.ids);
    if (localMatches) return new Set(localMatches.map((m) => m.id));
    return null;
  }, [ai, localMatches, showSaved, saved, meId]);

  const listed: Member[] = showSaved
    ? savedMembers
    : ai
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
    setAi(null); setQuery(""); setIndustry(null); setShowSaved(false);
  }

  function openSaved() {
    setAi(null); setQuery(""); setIndustry(null);
    setShowSaved(true);
    setPanelOpen(true);
    const ids = [...saved, ...(meId ? [meId] : [])];
    if (saved.length) setTimeout(() => globe.current?.fitMembers(ids), 50);
  }

  async function toggleSave(id: string) {
    const isSaved = saved.includes(id);
    setSaved((s) => (isSaved ? s.filter((x) => x !== id) : [...s, id]));
    if (demo) return;
    try {
      await api("/api/saved", { method: isSaved ? "DELETE" : "POST", body: JSON.stringify({ id }) });
    } catch {
      setSaved((s) => (isSaved ? [...s, id] : s.filter((x) => x !== id))); // roll back
    }
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
      const ids = members.filter((m) => industriesOf(m).some((x) => x.trim().toLowerCase() === next)).map((m) => m.id);
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
        photo={me?.avatar_url}
        members={members.length}
        countries={countries}
        onGlobe={() => { setPanelOpen(false); globe.current?.reset(); }}
        onDirectory={() => setPanelOpen((o) => !o)}
        onSignOut={signOut}
      />
      <div className={`map-stage ${selected ? "drawer-open" : ""}`}>
        <div className="grid-overlay grid-bg" />
        {loaded && (
          <Globe
            handleRef={globe} members={members} matchIds={matchIds} selectedId={selectedId} meId={meId} onSelect={select}
            home={me && me.lat !== null && me.lng !== null ? [me.lng, me.lat] : null}
            routeIds={showSaved ? saved : null}
          />
        )}

        {!loaded && <div className="loading-screen" style={{ position: "absolute" }}><ShiftSquare seed="loading" label="Loading the cohort" /></div>}

        <div className={`greeting ${panelOpen || selected ? "hide" : ""}`}>
          <span className="y">Hi {firstName || "there"},</span><br />
          your cohort, mapped<span className="dot-y" />
        </div>

        <form className="searchbar" role="search" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
          <I.search />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setAi(null); setShowSaved(false); }}
            placeholder="Search name, company, industry, city…"
            aria-label="Search the cohort"
          />
          {(query || filtering) && <button type="button" className="clear" onClick={clearAll}>Clear</button>}
          <button type="button" className="ask" onClick={() => assistant.current?.ask(query.trim() || "Who should I meet in this cohort?")}>
            <I.sparkle width={16} height={16} /><span>Ask AI</span>
          </button>
        </form>

        {showSaved ? (
          <div className="match-banner" role="status">
            <I.bookmarkFilled width={14} height={14} />
            {saved.length} saved {saved.length === 1 ? "contact" : "contacts"}{me?.lat == null ? "" : " · flight paths from you"}
            <button onClick={clearAll}>Clear</button>
          </div>
        ) : ai ? (
          <div className="match-banner" role="status">
            <I.sparkle width={14} height={14} />
            {ai.ids.length} {ai.ids.length === 1 ? "match" : "matches"} · “{ai.label.length > 42 ? ai.label.slice(0, 40) + "…" : ai.label}”
            <button onClick={clearAll}>Clear</button>
          </div>
        ) : (
          allIndustries.length > 0 && (
            <>
              <div className="filter-chips" role="toolbar" aria-label="Filter by industry">
                {allIndustries.length > topIndustries.length && (
                  <button className={`chip more ${allOpen ? "on" : ""}`} onClick={() => setAllOpen((o) => !o)} aria-expanded={allOpen}>
                    All {allIndustries.length} <I.list width={13} height={13} style={{ verticalAlign: "-2px", marginLeft: 4 }} />
                  </button>
                )}
                {selectedExtra && (
                  <button className="chip on" onClick={() => pickIndustry(selectedExtra.key)} aria-pressed>{selectedExtra.label}</button>
                )}
                {topIndustries.map((i) => (
                  <button key={i.key} className={`chip ${industry === i.key ? "on" : ""}`} onClick={() => pickIndustry(i.key)} aria-pressed={industry === i.key}>{i.label}</button>
                ))}
              </div>
              {allOpen && (
                <div className="industry-pop" role="dialog" aria-label="All industries">
                  <div className="panel-search" style={{ margin: 0 }}>
                    <I.search width={16} height={16} />
                    <input autoFocus value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} placeholder={`Search ${allIndustries.length} industries…`} aria-label="Search industries" />
                    <button onClick={() => setAllOpen(false)} aria-label="Close"><I.close width={14} height={14} /></button>
                  </div>
                  <div className="industry-list">
                    {allIndustries
                      .filter((i) => i.key.includes(industryFilter.trim().toLowerCase()))
                      .map((i) => (
                        <button key={i.key} className={industry === i.key ? "on" : ""} onClick={() => { pickIndustry(i.key); setAllOpen(false); setIndustryFilter(""); }}>
                          <span>{i.label}</span><b>{i.count}</b>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </>
          )
        )}

        <aside className={`panel ${panelOpen ? "open" : ""}`} aria-label="Cohort directory" aria-hidden={!panelOpen}>
          <div className="panel-head">
            <div>
              <h3>{showSaved ? "Saved contacts" : ai ? "AI matches" : localMatches ? "Search results" : "Directory"}</h3>
              <p>{listed.length} {listed.length === 1 ? "member" : "members"}{filtering ? " · lit up on the globe" : ""}</p>
            </div>
            <button className="icon-btn" onClick={() => setPanelOpen(false)} aria-label="Close directory"><I.close /></button>
          </div>
          <div className="panel-search">
            <I.search width={16} height={16} />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setAi(null); }}
              placeholder="Search the directory…"
              aria-label="Search the directory"
            />
            {query && <button onClick={() => setQuery("")} aria-label="Clear search"><I.close width={14} height={14} /></button>}
          </div>
          <div className="panel-body">
            {showSaved && saved.length === 0 && (
              <div className="empty">No saved contacts yet. Open anyone&rsquo;s profile and tap <b>Save contact</b> to add them here.</div>
            )}
            {!showSaved && listed.length === 0 && (
              <div className="empty">
                No one matches that yet.{" "}
                {query && <button style={{ textDecoration: "underline" }} onClick={() => assistant.current?.ask(query)}>Ask the AI instead</button>}
              </div>
            )}
            {listed.map((m) => (
              <div
                key={m.id} className="person sq-host" role="button" tabIndex={0}
                onClick={() => { select(m.id); locate(m); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(m.id); locate(m); } }}
              >
                <span className="thumb">
                  {m.avatar_url ? (
                    <>
                      <img className="photo" src={m.avatar_url} alt="" loading="lazy" />
                      <span className="tag"><Square seed={m.id} /></span>
                    </>
                  ) : <Square seed={m.id} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <b>{m.full_name}{m.id === meId ? " (you)" : ""}{saved.includes(m.id) && <I.bookmarkFilled width={12} height={12} style={{ color: "var(--yellow)", marginLeft: 6, verticalAlign: "-1px" }} />}</b>
                  <div className="meta">{[m.title, m.company].filter(Boolean).join(" · ")}</div>
                  <div className="loc">{[industriesOf(m).join(" · "), [m.city, m.country].filter(Boolean).join(", ")].filter(Boolean).join(" — ")}</div>
                  <QuickContacts member={m} />
                </div>
              </div>
            ))}
          </div>
        </aside>

        <MemberDrawer
          member={selected} isMe={selected?.id === meId} onClose={() => setSelectedId(null)} onLocate={locate}
          saved={!!selected && saved.includes(selected.id)} onToggleSave={toggleSave}
        />

        <div className="zoomctl" aria-label="Map controls">
          <button onClick={() => globe.current?.zoomIn()} aria-label="Zoom in"><I.plus /></button>
          <button onClick={() => globe.current?.zoomOut()} aria-label="Zoom out"><I.minus /></button>
          <button onClick={() => globe.current?.reset()} aria-label="Reset view"><I.globe /></button>
          {me?.lat != null && <button onClick={() => locate(me)} aria-label="Find me"><I.target /></button>}
        </div>

        <nav className="dock" aria-label="Views">
          <button className={!panelOpen ? "on" : ""} onClick={() => { setPanelOpen(false); setShowSaved(false); globe.current?.reset(); }}>Globe</button>
          <button className={panelOpen && !showSaved ? "on" : ""} onClick={() => { setShowSaved(false); setPanelOpen(true); }}>Directory</button>
          <button className={showSaved ? "on" : ""} onClick={openSaved}>
            Saved{saved.length > 0 && <span className="dock-count">{saved.length}</span>}
          </button>
          <Link href="/profile">My Profile</Link>
        </nav>

        <Assistant ref={assistant} firstName={firstName} onResult={onAiResult} />
      </div>
    </div>
  );
}
