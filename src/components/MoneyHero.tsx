import { useIsMobile } from "../lib/useIsMobile";

interface Stat {
  k: string;
  v: string;
}

export function MoneyHero({ label, value, stats }: { label: string; value: string; stats: Stat[] }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "20px 20px 18px", marginBottom: 14 }}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{label}</div>
        <div className="tabular" style={{ font: "800 56px/1 var(--font-body)", letterSpacing: "-.03em", margin: "6px 0 10px" }}>{value}</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {stats.map((s) => (
            <div key={s.k}>
              <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{s.k}</div>
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)" }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 22 }}>
      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 20 }}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{label}</div>
        <div className="tabular" style={{ font: "800 56px/1 var(--font-body)", letterSpacing: "-.03em", marginTop: 6 }}>{value}</div>
      </div>
      {stats.map((s) => (
        <div key={s.k} data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 20 }}>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{s.k}</div>
          <div style={{ font: "800 30px var(--font-body)", letterSpacing: "-.02em", marginTop: 8 }}>{s.v}</div>
        </div>
      ))}
    </div>
  );
}
