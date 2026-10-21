// Albers-style nested squares, colors sampled from the MasterClass subject cards.
// [frame, outer, middle, inner]
export const PALETTES: [string, string, string, string][] = [
  ["#D9655F", "#3E3F6B", "#D7AA88", "#B57262"], // Strategy & Operations
  ["#CF4B21", "#EE7E33", "#4652A8", "#5B98D5"], // AI for Leaders
  ["#232489", "#4650A8", "#F1C643", "#5A9A5C"], // Modern Marketing
  ["#2F3176", "#3B3D7E", "#6E79B6", "#A9C8E4"], // Finance & Data
  ["#2F6141", "#2C7B2A", "#F0A83A", "#4651A7"], // Product Innovation
  ["#2B5E93", "#3E8CA9", "#87BA7F", "#2E7C79"], // AI Foundations
  ["#76A16F", "#2F5F22", "#3F8B35", "#F0A83A"], // High-Output Thinking
  ["#3F80BC", "#5F97D0", "#F1C643", "#E8792F"], // Leadership Principles
  ["#D06B41", "#EFA93B", "#F1C643", "#F5E8B5"], // Career Power
  ["#7A3429", "#C36A4B", "#D28F6C", "#F1C643"], // Power & Influence
  ["#1F1F1F", "#F2C94C", "#1F1F1F", "#F2C94C"], // House yellow
  ["#3B3D7E", "#232489", "#D9655F", "#F5E8B5"],
];

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Every color used on the MasterClass subject cards.
const COLORS = [...new Set(PALETTES.slice(0, 10).flat())];

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// Small seeded PRNG (mulberry32) so a person's colors are random but stable.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A randomly mixed square for each person: four colors drawn from the
// MasterClass palette, each ring clearly distinct from the one around it.
// Seeded by the member id, so it's the same on every visit and device.
export function squareFor(id: string): [string, string, string, string] {
  const rand = rng(hash(id));
  const out: string[] = [];
  for (let ring = 0; ring < 4; ring++) {
    const prev = out[ring - 1];
    let pick = COLORS[Math.floor(rand() * COLORS.length)];
    for (let tries = 0; prev && tries < 40 && (out.includes(pick) || contrast(pick, prev) < 1.45); tries++) {
      pick = COLORS[Math.floor(rand() * COLORS.length)];
    }
    out.push(pick);
  }
  return out as [string, string, string, string];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
