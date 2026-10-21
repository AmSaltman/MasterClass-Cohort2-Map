"use client";
import { useEffect, useRef, useState } from "react";

export type Place = { city: string; region: string; country: string; lat: number; lng: number };

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; state?: string; country?: string; type?: string };
};

// City autocomplete backed by Photon (OpenStreetMap, free, no key).
export function CityInput({
  value, onText, onPick, pinned,
}: {
  value: string;
  onText: (v: string) => void;
  onPick: (p: Place) => void;
  pinned: boolean;
}) {
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skip = useRef(false);
  const typed = useRef(false); // don't search for a city that was just loaded from the profile

  useEffect(() => {
    if (!typed.current) return;
    if (skip.current) { skip.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    timer.current = setTimeout(async () => {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=7&lang=en&layer=city&layer=locality&layer=district`;
        const res = await fetch(url, { signal: ctrl.signal });
        const data = (await res.json()) as { features: PhotonFeature[] };
        const seen = new Set<string>();
        const places: Place[] = [];
        for (const f of data.features || []) {
          const p = f.properties;
          if (!p.name) continue;
          const key = `${p.name}|${p.state}|${p.country}`;
          if (seen.has(key)) continue;
          seen.add(key);
          places.push({
            city: p.name, region: p.state || "", country: p.country || "",
            lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
          });
        }
        setResults(places);
        setActive(0);
        setOpen(true);
      } catch {
        /* typing again aborts the previous request */
      }
    }, 250);
    return () => { ctrl.abort(); if (timer.current) clearTimeout(timer.current); };
  }, [value]);

  const shown = value.trim().length >= 2 ? results : [];

  function pick(p: Place) {
    skip.current = true;
    onPick(p);
    setOpen(false);
  }

  return (
    <div className="city-wrap">
      <input
        className="input"
        id="city"
        value={value}
        placeholder="Start typing your city…"
        autoComplete="off"
        role="combobox"
        aria-expanded={open && shown.length > 0}
        aria-controls="city-list"
        onChange={(e) => { typed.current = true; onText(e.target.value); }}
        onFocus={() => shown.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !shown.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); pick(shown[active]); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && shown.length > 0 && (
        <div className="city-list" id="city-list" role="listbox">
          {shown.map((p, i) => (
            <button
              type="button" key={`${p.city}${p.region}${p.country}${i}`} role="option"
              aria-selected={i === active} className={i === active ? "active" : ""}
              onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}
            >
              {p.city}<small>{[p.region, p.country].filter(Boolean).join(", ")}</small>
            </button>
          ))}
        </div>
      )}
      {!pinned && value.trim().length > 1 && (
        <span className="hint" style={{ display: "block", marginTop: 6 }}>
          Pick from the list for an exact pin — otherwise our AI will place you.
        </span>
      )}
    </div>
  );
}
