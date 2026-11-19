import { useState } from "react";
import { fmt } from "../lib/format";
import { useMeasuredWidth } from "../lib/chartHelpers";
import { useTween } from "../lib/useTween";
import { EASE, QUICK_MS } from "../lib/motion";

export interface BarDatum {
  key: string;
  label: string;
  /** The larger, lighter bar behind (e.g. revenue). */
  a: number;
  /** The darker bar in front (e.g. payouts). Optional. */
  b?: number;
  tip: { title: string; lines: string[] };
}

const LIGHT = "var(--color-bg-fill-accent-strong)";
const DEEP = "var(--color-bg-fill-primary-default)";

function niceStep(max: number): number {
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

const short = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : fmt(v));

/** One chart for the app's money pictures: soft rounded bars (one tone laid over
 * the other, like a stacked silhouette), faint gridlines with the scale on the
 * left, plain labels underneath and a round-dot legend. Tap or hover a bar for
 * the exact figures. */
export function BarChart({ data, aLabel, bLabel, ariaLabel }: { data: BarDatum[]; aLabel: string; bLabel?: string; ariaLabel: string }) {
  const [ref, W] = useMeasuredWidth(320);
  const [pick, setPick] = useState<number | null>(null);
  const H = 220;
  const padL = 34;
  const top = 10;
  const bottom = 190;
  const rawMax = Math.max(...data.map((d) => Math.max(d.a, d.b ?? 0)), 1);
  const step = niceStep(rawMax);
  const max = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const plotW = Math.max(1, W - padL);
  const slot = plotW / data.length;
  const barW = Math.max(10, Math.min(36, slot * 0.62));
  const r = Math.min(barW / 2, 14);
  // Bars grow up from the baseline when the chart appears, and glide to their
  // new heights when the range changes (matched by month, so new months grow in).
  const tweened = useTween(
    data.flatMap((d) => [d.a, d.b ?? 0]),
    data.flatMap((d) => [`${d.key}:a`, `${d.key}:b`]),
  );
  const shownA = (i: number) => tweened[i * 2] ?? 0;
  const shownB = (i: number) => tweened[i * 2 + 1] ?? 0;

  // A bar with a round top and a square foot on the baseline.
  const bar = (x: number, v: number, fill: string, key: string) => {
    const yt = y(v);
    const rr = Math.min(r, Math.max(0, bottom - yt));
    const d = `M${x},${bottom} L${x},${yt + rr} Q${x},${yt} ${x + rr},${yt} L${x + barW - rr},${yt} Q${x + barW},${yt} ${x + barW},${yt + rr} L${x + barW},${bottom} Z`;
    return <path key={key} d={d} fill={fill} />;
  };

  return (
    <div ref={ref} style={{ width: "100%", position: "relative" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={y(t)} x2={W} y2={y(t)} stroke="var(--color-border-primary-default)" strokeWidth={1} />
            <text x={0} y={y(t) + 4} style={{ font: "500 var(--text-caption-2-size) var(--font-family-body)", fill: "var(--color-text-tertiary-default)" }}>
              {short(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const aVal = shownA(i);
          const bVal = shownB(i);
          // The taller one goes behind, so the other always shows in front of it.
          const aBehind = (d.a ?? 0) >= (d.b ?? 0);
          return (
            <g
              key={d.key}
              // A mouse shows figures on hover; a finger taps a bar to show them and taps it again to hide.
              onPointerEnter={(e) => e.pointerType === "mouse" && setPick(i)}
              onPointerLeave={(e) => e.pointerType === "mouse" && setPick(null)}
              onPointerUp={(e) => e.pointerType !== "mouse" && setPick(pick === i ? null : i)}
              style={{ cursor: "pointer" }}
            >
              <rect x={padL + i * slot} y={0} width={slot} height={H} fill="transparent" />
              {aBehind ? (
                <>
                  {aVal > 0.5 && bar(x, aVal, LIGHT, "a")}
                  {bVal > 0.5 && bar(x, bVal, DEEP, "b")}
                </>
              ) : (
                <>
                  {bVal > 0.5 && bar(x, bVal, DEEP, "b")}
                  {aVal > 0.5 && bar(x, aVal, LIGHT, "a")}
                </>
              )}
              <text x={padL + i * slot + slot / 2} y={H - 8} textAnchor="middle" style={{ font: "500 var(--text-caption-1-size) var(--font-family-body)", fill: "var(--color-text-secondary-default)" }}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 18, marginTop: 4 }}>
        {[[aLabel, LIGHT], ...(bLabel ? [[bLabel, DEEP]] : [])].map(([label, color]) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 7, font: "500 var(--text-caption-1-size) var(--font-family-body)", color: "var(--color-text-secondary-default)" }}>
            <i style={{ width: 10, height: 10, borderRadius: 999, background: color, display: "block" }} />
            {label}
          </span>
        ))}
      </div>
      {pick !== null && (
        <div
          key={pick}
          style={{
            animation: `bqFade ${QUICK_MS}ms ${EASE} both`,
            position: "absolute",
            top: 6,
            left: Math.min(Math.max(padL + (pick + 0.5) * slot - 80, 0), W - 160),
            width: 160,
            background: "var(--color-text-primary-default)",
            color: "var(--color-bg-surface-primary-default)",
            borderRadius: "var(--radius-chip)",
            padding: "8px 12px",
            font: "600 var(--text-caption-1-size)/1.6 var(--font-family-mono)",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 800 }}>{data[pick].tip.title}</div>
          {data[pick].tip.lines.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
