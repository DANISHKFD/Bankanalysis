import { memo } from "react";

/**
 * Fine-line rosette like the security print on a banknote, drawn in the topic's colour.
 * Each topic gets its own pattern from the seed; purely decorative.
 */
function rosette(R: number, r: number, d: number, steps = 1400) {
  const pts: string[] = [];
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const turns = r / g(Math.round(R), Math.round(r));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return "M" + pts.join("L");
}

const SEEDS: Record<string, [number, number, number][]> = {
  credit: [[150, 52, 70], [150, 52, 46], [150, 52, 24]],
  deposits: [[150, 42, 64], [150, 42, 40], [150, 42, 18]],
  rates: [[150, 66, 80], [150, 66, 52], [150, 66, 28]],
  payments: [[150, 36, 58], [150, 36, 36], [150, 36, 16]],
  regions: [[150, 58, 74], [150, 58, 50], [150, 58, 26]],
  structure: [[150, 48, 66], [150, 48, 42], [150, 48, 20]],
  banks: [[150, 62, 78], [150, 62, 54], [150, 62, 30]],
  nbfcs: [[150, 44, 62], [150, 44, 38], [150, 44, 16]],
  valuations: [[150, 54, 72], [150, 54, 48], [150, 54, 22]],
  about: [[150, 40, 60], [150, 40, 38], [150, 40, 18]],
  home: [[150, 46, 68], [150, 46, 44], [150, 46, 22]],
};

export const Guilloche = memo(function Guilloche({ seed, className = "" }: { seed: string; className?: string }) {
  const set = SEEDS[seed] || SEEDS.home;
  return (
    <svg className={`guilloche ${className}`} viewBox="-230 -230 460 460" aria-hidden="true" focusable="false">
      {set.map(([R, r, d], i) => (
        <path key={i} d={rosette(R, r, d)} fill="none" stroke="currentColor" strokeWidth={i === 0 ? 0.7 : 0.55} opacity={1 - i * 0.22} />
      ))}
      <circle r="212" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.6" />
      <circle r="206" fill="none" stroke="currentColor" strokeWidth="0.4" strokeDasharray="1.5 3" opacity="0.6" />
    </svg>
  );
});
