// "Kids" / "Adults" is just a word at the start of a package's name; it shows
// as a small label so the lists read at a glance. No setting behind it.
const CATEGORIES = ["kids", "adults"];

export function categoryOf(name: string): string | null {
  const first = name.trim().split(/[\s·\-–]/)[0]?.toLowerCase() ?? "";
  return CATEGORIES.includes(first) ? first[0].toUpperCase() + first.slice(1) : null;
}

export function CategoryPill({ name }: { name: string }) {
  const c = categoryOf(name);
  if (!c) return null;
  return (
    <span style={{ flex: "none", font: "700 10px var(--font-mono)", letterSpacing: ".06em", color: c === "Kids" ? "var(--logging-fg)" : "var(--ink-muted)", background: c === "Kids" ? "var(--logging-bg)" : "var(--sunken)", borderRadius: 8, padding: "3px 7px", textTransform: "uppercase" }}>
      {c}
    </span>
  );
}
