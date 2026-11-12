/** A small spinner for a part of a screen that is loading (a list inside a
 * sheet, a tab's content). Whole screens use <Spinner /> below, which shows
 * the shape of the screen instead. */
export function InlineSpinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40svh" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          border: "3px solid var(--primary-tint)",
          borderTopColor: "var(--primary)",
          animation: "bqSpin .7s linear infinite",
        }}
      />
    </div>
  );
}

const block = (w: string | number, h: number, r = 10) => (
  <div className="bq-skel" style={{ width: w, height: h, borderRadius: r, background: "var(--line)" }} />
);

/** What a whole screen shows while its data loads: the shape of a list, so the
 * content settles into place instead of popping in. Keeps the name Spinner so
 * every screen gets it. */
export function Spinner() {
  return (
    <div role="status" aria-label="Loading" aria-busy="true" data-testid="skeleton" style={{ padding: "8px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
      {block("42%", 22, 8)}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 24, background: "var(--surface)", border: "1px solid var(--line)" }}>
          {block(44, 44, 999)}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {block(i % 2 ? "55%" : "70%", 14, 7)}
            {block("38%", 12, 6)}
          </div>
        </div>
      ))}
    </div>
  );
}
