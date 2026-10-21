"use client";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { LngLatBounds, Map as MLMap, Marker, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
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
  home: [number, number] | null;
  routeIds: string[] | null; // draw flight paths from me to these members // [lng, lat] to open on; defaults to the US
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

// The great circle between two [lng, lat] points, split into segments
// wherever it crosses the date line (so polar / Pacific routes draw cleanly).
function greatCircle(a: [number, number], b: [number, number], steps = 96): [number, number][][] {
  const rad = Math.PI / 180;
  const toVec = ([lng, lat]: [number, number]) => [Math.cos(lat * rad) * Math.cos(lng * rad), Math.cos(lat * rad) * Math.sin(lng * rad), Math.sin(lat * rad)];
  const [p, q] = [toVec(a), toVec(b)];
  const omega = Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
  if (omega < 1e-6) return [[a, b]];
  const segments: [number, number][][] = [[]];
  let prev: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s1 = Math.sin((1 - t) * omega) / Math.sin(omega), s2 = Math.sin(t * omega) / Math.sin(omega);
    const [x, y, z] = [0, 1, 2].map((k) => s1 * p[k] + s2 * q[k]);
    const lng = Math.atan2(y, x) / rad, lat = Math.atan2(z, Math.hypot(x, y)) / rad;
    if (prev !== null && Math.abs(lng - prev) > 180) segments.push([]);
    segments[segments.length - 1].push([lng, lat]);
    prev = lng;
  }
  return segments.filter((seg) => seg.length > 1);
}

// Marching-ants dash sequence for the "in flight" effect.
const DASHES = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];

type Entry = { marker: Marker; el: HTMLDivElement; lngLat: [number, number]; slot: [number, number] };

// Members in the same city form a tidy mosaic of squares around the city point.
function groupKey(m: Member) {
  const city = (m.city || "").trim().toLowerCase();
  const country = (m.country || "").trim().toLowerCase();
  return city ? `${city}|${country}` : `${Math.round(m.lat! * 4) / 4}|${Math.round(m.lng! * 4) / 4}`;
}

export default function Globe({ members, matchIds, selectedId, meId, onSelect, home, routeIds, handleRef }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef(new Map<string, Entry>());
  const size = useRef(16);
  const [styleReady, setStyleReady] = useState(false);
  const homeRef = useRef<[number, number]>(home || US_CENTER);
  // Entry fly-in: plays every time the map opens (skipped for reduced motion).
  const entry = useRef<{ start: number } | null>(null);
  const homeZoomFor = () => homeZoom(box.current?.clientHeight || 800) + 0.35;
  const selectRef = useRef(onSelect);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  const place = (e: Entry) => e.marker.setOffset([e.slot[0] * (size.current + GAP), e.slot[1] * (size.current + GAP)]);

  // Create the map once.
  useEffect(() => {
    if (!box.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const play = !reduced;
    const [homeLng, homeLat] = homeRef.current;
    const startLng = homeLng + 170; // start on the far side of the world, spin west to you
    if (play) entry.current = { start: startLng };
    const finalZoom = homeZoom(box.current.clientHeight) + 0.35;
    const m = new MLMap({
      container: box.current,
      style: mapStyle,
      center: play ? [startLng, Math.max(-20, Math.min(40, homeLat - 10))] : homeRef.current,
      zoom: play ? finalZoom - 0.9 : finalZoom,
      minZoom: 0.8,
      maxZoom: 13,
      renderWorldCopies: false,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    m.touchZoomRotate.disableRotation();
    m.on("load", () => {
      m.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "routes-glow", type: "line", source: "routes", layout: { "line-cap": "round" }, paint: { "line-color": "#F2C94C", "line-width": 6, "line-opacity": 0.08, "line-blur": 4 } });
      m.addLayer({ id: "routes-base", type: "line", source: "routes", layout: { "line-cap": "round" }, paint: { "line-color": "#F2C94C", "line-width": 1, "line-opacity": 0.35 } });
      m.addLayer({ id: "routes-dash", type: "line", source: "routes", paint: { "line-color": "#F2C94C", "line-width": 1.4, "line-opacity": 0.7, "line-dasharray": DASHES[0] } });
      setStyleReady(true);
      if (play) m.easeTo({ center: homeRef.current, zoom: finalZoom, duration: 4200, easing: (t) => 1 - Math.pow(1 - t, 3) });
    });
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
    // During the entry fly-in, squares "plot" in the order the globe sweeps past them.
    const intro = entry.current;
    const order = new Map<string, number>();
    if (intro) {
      const spread = members.filter((x) => x.lng !== null).sort((a, b) => ((intro.start - a.lng! + 720) % 360) - ((intro.start - b.lng! + 720) % 360));
      const step = Math.min(18, 2400 / Math.max(1, spread.length));
      spread.forEach((x, k) => order.set(x.id, 350 + k * step));
      entry.current = null;
    }
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
        if (order.has(mem.id)) {
          el.classList.add("enter");
          el.style.setProperty("--d", `${order.get(mem.id)}ms`);
          setTimeout(() => el.classList.remove("enter"), (order.get(mem.id) || 0) + 1200);
        }
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

  // Flight paths from my city to each saved contact.
  useEffect(() => {
    const m = map.current;
    if (!m || !styleReady) return;
    const src = m.getSource("routes") as GeoJSONSource | undefined;
    const from = meId ? markers.current.get(meId)?.lngLat : undefined;
    const targets = (routeIds || []).map((id) => markers.current.get(id)?.lngLat).filter((p): p is [number, number] => !!p);
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: from ? targets.map((to) => ({ type: "Feature" as const, properties: {}, geometry: { type: "MultiLineString" as const, coordinates: greatCircle(from, to) } })) : [],
    });
    if (!from || !targets.length) return;
    let step = 0, last = 0, raf = 0;
    const tick = (t: number) => {
      if (t - last > 140) { // slow, gentle drift
        step = (step + 1) % DASHES.length;
        if (m.getLayer("routes-dash")) m.setPaintProperty("routes-dash", "line-dasharray", DASHES[step]);
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [routeIds, meId, members, styleReady]);

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
