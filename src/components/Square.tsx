import type { CSSProperties } from "react";
import { squareFor } from "@/lib/squares";

type Props = {
  seed?: string;
  colors?: [string, string, string, string];
  hot?: boolean;
  className?: string;
  style?: CSSProperties;
};

// Albers-style nested squares. Hover (via a .sq-host parent) or `hot`
// grows the rings outward and reveals new ones — the "zoom in" effect.
export function Square({ seed = "", colors, hot, className = "", style }: Props) {
  const [c0, c1, c2, c3] = colors || squareFor(seed);
  return (
    <div
      className={`sq ${hot ? "hot" : ""} ${className}`}
      style={{ "--c0": c0, "--c1": c1, "--c2": c2, "--c3": c3, ...style } as CSSProperties}
      aria-hidden
    >
      <div className="o">
        <i className="a" />
        <i className="b" />
        <i className="c" />
        <i className="d" />
      </div>
    </div>
  );
}

// Same markup as a string, for MapLibre's DOM markers.
export function squareHTML(seed: string): string {
  const [c0, c1, c2, c3] = squareFor(seed);
  return `<div class="sq" style="--c0:${c0};--c1:${c1};--c2:${c2};--c3:${c3}"><div class="o"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i></div></div>`;
}
