"use client";
import { useEffect, useRef } from "react";
import { Map as MLMap, Marker, setWorkerUrl } from "maplibre-gl";
import { mapStyle } from "./mapStyle";
import { squareHTML } from "./Square";

setWorkerUrl("/maplibre-gl-worker.mjs");

// Decorative only: major world cities, never real member locations
// (the landing page is public).
const CITIES: [number, number][] = [
  [-122.3, 47.6], [-122.4, 37.8], [-118.2, 34.1], [-117.2, 32.7], [-112.1, 33.4], [-104.99, 39.7], [-97.7, 30.3],
  [-96.8, 32.8], [-95.4, 29.8], [-90.1, 29.95], [-87.6, 41.9], [-93.3, 44.98], [-84.4, 33.7], [-80.2, 25.8],
  [-81.4, 28.5], [-77.0, 38.9], [-75.2, 39.95], [-74.0, 40.7], [-71.1, 42.4], [-79.4, 43.7], [-73.6, 45.5],
  [-123.1, 49.3], [-114.1, 51.0], [-86.8, 36.2], [-80.8, 35.2], [-111.9, 40.8], [-115.1, 36.2], [-122.7, 45.5],
  [-83.0, 42.3], [-90.2, 38.6], [-94.6, 39.1], [-157.9, 21.3], [-99.1, 19.4], [-103.3, 20.7], [-100.3, 25.7],
  [-79.5, 9.0], [-74.1, 4.7], [-77.0, -12.0], [-70.7, -33.4], [-58.4, -34.6], [-46.6, -23.6], [-43.2, -22.9],
  [-0.1, 51.5], [-2.2, 53.5], [-3.2, 55.95], [-6.3, 53.3], [2.35, 48.86], [4.9, 52.4], [4.35, 50.85], [13.4, 52.5],
  [11.6, 48.1], [8.7, 50.1], [8.5, 47.4], [6.1, 46.2], [9.2, 45.5], [12.5, 41.9], [-3.7, 40.4], [2.2, 41.4],
  [-9.1, 38.7], [16.4, 48.2], [14.4, 50.1], [21.0, 52.2], [18.1, 59.3], [10.75, 59.9], [12.6, 55.7], [24.9, 60.2],
  [23.7, 37.98], [28.98, 41.0], [34.8, 32.1], [35.5, 33.9], [31.2, 30.0], [55.3, 25.2], [54.4, 24.5], [51.5, 25.3],
  [46.7, 24.7], [39.2, 21.5], [3.4, 6.5], [-0.2, 5.6], [36.8, -1.3], [32.6, 0.3], [38.7, 9.0], [28.0, -26.2],
  [18.4, -33.9], [31.0, -29.9], [-7.6, 33.6], [72.9, 19.1], [77.2, 28.6], [77.6, 12.97], [78.5, 17.4], [88.4, 22.6],
  [80.3, 13.1], [67.0, 24.9], [90.4, 23.8], [100.5, 13.8], [103.8, 1.35], [101.7, 3.1], [106.8, -6.2], [121.0, 14.6],
  [114.2, 22.3], [121.5, 31.2], [116.4, 39.9], [113.3, 23.1], [104.1, 30.7], [127.0, 37.6], [139.7, 35.7], [135.5, 34.7],
  [121.6, 25.0], [151.2, -33.9], [144.96, -37.8], [153.0, -27.5], [115.9, -31.95], [174.8, -36.8], [37.6, 55.8],
  [30.5, 50.45], [44.8, 41.7], [69.2, 41.3], [-66.1, 18.5], [-76.8, 18.0], [-77.3, 25.0], [-64.8, 32.3], [-106.5, 31.8],
  [-121.5, 38.6], [-119.8, 39.5], [-106.6, 35.1], [-97.5, 35.5], [-85.7, 38.3], [-86.2, 39.8], [-82.99, 39.96],
  [-81.7, 41.5], [-79.99, 40.4], [-78.6, 35.8], [-76.6, 39.3], [-72.7, 41.8], [-70.3, 43.7],
];

const START: [number, number] = [-150, 22];
const END: [number, number] = [-55, 30];

// A short scripted "motion graphic": the globe swings in from the Pacific
// while squares get plotted city by city, then it keeps drifting slowly.
export default function IntroGlobe({ onPlotted }: { onPlotted?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const done = useRef(onPlotted);
  useEffect(() => { done.current = onPlotted; }, [onPlotted]);

  useEffect(() => {
    if (!box.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const h = box.current.clientHeight;
    const zoom = Math.min(Math.max(Math.log2((0.86 * h * Math.PI) / 512), 0.9), 3);
    const m = new MLMap({
      container: box.current,
      style: mapStyle,
      center: reduced ? END : START,
      zoom: reduced ? zoom : zoom - 0.6,
      interactive: false,
      attributionControl: false,
      renderWorldCopies: false,
    });
    const markers: Marker[] = [];
    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    m.once("load", () => {
      // Plot in a sweep from west to east so it reads as "filling up the map".
      const order = CITIES.map((c, i) => ({ c, i })).sort((a, b) => a.c[0] - b.c[0]);
      order.forEach(({ c, i }, k) => {
        const el = document.createElement("div");
        el.className = "mk intro-mk";
        el.innerHTML = squareHTML(`intro-${i}`);
        el.style.setProperty("--d", reduced ? "0ms" : `${450 + k * 16}ms`);
        markers.push(new Marker({ element: el, anchor: "center", opacityWhenCovered: 0 }).setLngLat(c).addTo(m));
      });
      if (!reduced) {
        m.easeTo({ center: END, zoom, duration: 3400, easing: (t) => 1 - Math.pow(1 - t, 3) });
      }
      timers.push(setTimeout(() => done.current?.(), reduced ? 0 : 1500));
      // Slow, continuous drift once the intro settles.
      timers.push(setTimeout(() => {
        if (reduced) return;
        const spin = () => {
          const c = m.getCenter();
          m.setCenter([c.lng + 0.02, c.lat]);
          raf = requestAnimationFrame(spin);
        };
        raf = requestAnimationFrame(spin);
      }, 3500));
    });

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      markers.forEach((mk) => mk.remove());
      m.remove();
    };
  }, []);

  return <div ref={box} className="intro-globe" aria-hidden />;
}
