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

// Deterministic "random" square for a person, so it never changes between visits.
export function squareFor(id: string): [string, string, string, string] {
  return PALETTES[hash(id) % PALETTES.length];
}

// Small stable offset (~±6km) so people in the same city don't stack exactly.
export function jitter(id: string): [number, number] {
  const h = hash(id + "j");
  const a = ((h & 0xffff) / 0xffff - 0.5) * 0.11;
  const b = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * 0.11;
  return [a, b];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
