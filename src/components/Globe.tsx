"use client";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { LngLatBounds, Map as MLMap, Marker, setWorkerUrl } from "maplibre-gl";
import { mapStyle } from "./mapStyle";
import { squareHTML } from "./Square";
import type { Member } from "@/lib/types";

export type GlobeHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  fitMembers: (ids: string[]) => void;
};

type Props = {
  members: Member[];
  matchIds: Set<string> | null; // null = no filter, everyone bright
  selectedId: string | null;
  meId: string | null;
  onSelect: (id: string) => void;
  home: [number, number] | null; // [lng, lat] to open on; defaults to the US
  handleRef: Ref<GlobeHandle>; // plain prop so it survives next/dynamic
};

// Served from /public (copied by the postinstall script) because bundlers
// rewrite MapLibre's own worker URL.
setWorkerUrl("/maplibre-gl-worker.mjs");

const US_CENTER: [number, number] = [-98, 38];
const GAP = 3;

// Zoom where the globe fills ~80% of the stage height.
function homeZoom(h: number) {
  return Math.min(Math.max(Math.log2((0.8 * h * Math.PI) / 512), 0.9), 3);
}

function markerSize(zoom: number) {
  if (zoom < 2.5) return 16;
  if (zoom < 4) return 20;
  if (zoom < 6) return 26;
  return 32;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type Entry = { marker: Marker; el: HTMLDivElement; lngLat: [number, number]; slot: [number, number] };

// Members in the same city form a tidy mosaic of squares around the city point.
function groupKey(m: Member) {
  const city = (m.city || "").trim().toLowerCase();
  const country = (m.country || "").trim().toLowerCase();
  return city ? `${city}|${country}` : `${Math.round(m.lat! * 4) / 4}|${Math.round(m.lng! * 4) / 4}`;
}

export default function Globe({ members, matchIds, selectedId, meId, onSelect, home, handleRef }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef(new Map<string, Entry>());
  const size = useRef(16);
  const homeRef = useRef<[number, number]>(home || US_CENTER);
  const homeZoomFor = () => homeZoom(box.current?.clientHeight || 800) + 0.35;
  const selectRef = useRef(onSelect);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  const place = (e: Entry) => e.marker.setOffset([e.slot[0] * (size.current + GAP), e.slot[1] * (size.current + GAP)]);

  // Create the map once.
  useEffect(() => {
    if (!box.current) return;
    const m = new MLMap({
      container: box.current,
      style: mapStyle,
      center: homeRef.current,
      zoom: homeZoom(box.current.clientHeight) + 0.35,
      minZoom: 0.8,
      maxZoom: 13,
      renderWorldCopies: false,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    m.touchZoomRotate.disableRotation();
    const sizeUp = () => {
      const next = markerSize(m.getZoom());
      if (next === size.current && box.current?.style.getPropertyValue("--mk")) return;
      size.current = next;
      box.current?.style.setProperty("--mk", `${next}px`);
      markers.current.forEach(place);
    };
    m.on("zoom", sizeUp);
    sizeUp();
    map.current = m;
    const all = markers.current;
    return () => {
      all.forEach(({ marker }) => marker.remove());
      all.clear();
      m.remove();
      map.current = null;
    };
  }, []);

  // Sync markers with the member list.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const groups = new Map<string, Member[]>();
    for (const mem of members) {
      if (mem.lat === null || mem.lng === null) continue;
      const k = groupKey(mem);
      groups.set(k, [...(groups.get(k) || []), mem]);
    }
    const seen = new Set<string>();
    for (const group of groups.values()) {
      group.sort((a, b) => a.id.localeCompare(b.id));
      const anchor: [number, number] = [
        group.reduce((t, g) => t + g.lng!, 0) / group.length,
        group.reduce((t, g) => t + g.lat!, 0) / group.length,
      ];
      const cols = Math.ceil(Math.sqrt(group.length));
      const rows = Math.ceil(group.length / cols);
      group.forEach((mem, i) => {
        seen.add(mem.id);
        const slot: [number, number] = [(i % cols) - (cols - 1) / 2, Math.floor(i / cols) - (rows - 1) / 2];
        const tip = `<div class="tip">${mem.avatar_url && /^https:\/\//.test(mem.avatar_url) ? `<img src="${esc(mem.avatar_url)}" alt="">` : ""}<div class="tip-text"><b>${esc(mem.full_name)}</b><span>${esc([mem.title, mem.company].filter(Boolean).join(" · ") || mem.city || "")}</span></div></div>`;
        const existing = markers.current.get(mem.id);
        if (existing) {
          existing.marker.setLngLat(anchor);
          existing.el.innerHTML = squareHTML(mem.id) + tip;
          existing.lngLat = anchor;
          existing.slot = slot;
          place(existing);
          return;
        }
        const el = document.createElement("div");
        el.className = "mk";
        el.innerHTML = squareHTML(mem.id) + tip;
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        el.setAttribute("aria-label", `${mem.full_name}${mem.city ? `, ${mem.city}` : ""}`);
        el.addEventListener("click", (e) => { e.stopPropagation(); selectRef.current(mem.id); });
        el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectRef.current(mem.id); } });
        const marker = new Marker({ element: el, anchor: "center", opacityWhenCovered: 0 }).setLngLat(anchor).addTo(m);
        const entry = { marker, el, lngLat: anchor, slot };
        place(entry);
        markers.current.set(mem.id, entry);
      });
    }
    for (const [id, { marker }] of markers.current) {
      if (!seen.has(id)) { marker.remove(); markers.current.delete(id); }
    }
  }, [members]);

  // Bright matches, grayed-out everyone else.
  useEffect(() => {
    for (const [id, { el }] of markers.current) {
      const hit = matchIds ? matchIds.has(id) : false;
      el.classList.toggle("dim", !!matchIds && !hit);
      el.classList.toggle("hit", hit);
      el.classList.toggle("sel", id === selectedId);
      el.classList.toggle("me", id === meId);
    }
  }, [matchIds, selectedId, meId, members]);

  useImperativeHandle(handleRef, () => ({
    zoomIn: () => map.current?.zoomIn({ duration: 400 }),
    zoomOut: () => map.current?.zoomOut({ duration: 400 }),
    reset: () => map.current?.flyTo({ center: homeRef.current, zoom: homeZoomFor(), duration: 1400 }),
    flyTo: (lat, lng, zoom = 5) => map.current?.flyTo({ center: [lng, lat], zoom, duration: 1800, essential: true }),
    fitMembers: (ids) => {
      const m = map.current;
      if (!m) return;
      const pts = ids.map((id) => markers.current.get(id)?.lngLat).filter(Boolean) as [number, number][];
      if (!pts.length) return;
      if (pts.length === 1) return void m.flyTo({ center: pts[0], zoom: 7, duration: 1600 });
      const b = new LngLatBounds(pts[0], pts[0]);
      pts.forEach((p) => b.extend(p));
      // Spread across continents: show the whole globe turned toward them.
      if (b.getEast() - b.getWest() > 50 || b.getNorth() - b.getSouth() > 35) {
        const c = b.getCenter();
        return void m.flyTo({ center: [c.lng, Math.max(-50, Math.min(50, c.lat))], zoom: homeZoom(box.current?.clientHeight || 800), duration: 1400 });
      }
      m.fitBounds(b, { padding: { top: 140, bottom: 120, left: 120, right: 120 }, maxZoom: 8, duration: 1600 });
    },
  }), []);

  return <div ref={box} className="map" />;
}
