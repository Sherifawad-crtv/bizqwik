import { Children, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { STANDARD_MS } from "../motion/motion";

type Item = { key: string; el: ReactElement; state: "idle" | "in" | "out" };
const keyOf = (el: ReactElement) => String(el.key);

/** A list whose rows arrive and leave the iOS way: a new row grows in and
 * fades up while the rows below make room; a removed row fades and folds away
 * while the rows below slide up to close the gap. Rows that were there when the
 * list first appeared don't animate (the whole list already fades in).
 * Children must be keyed elements. `gap` is the space between rows (the
 * container's own gap would not fold away with a leaving row). */
export function MotionList({ children, gap = 0 }: { children: ReactNode; gap?: number }) {
  const kids = Children.toArray(children).filter(isValidElement) as ReactElement[];
  const sig = kids.map(keyOf).join("|");
  const [items, setItems] = useState<Item[]>(() => kids.map((el) => ({ key: keyOf(el), el, state: "idle" as const })));
  const [seen, setSeen] = useState(sig);

  if (sig !== seen) {
    setSeen(sig);
    const now = new Set(kids.map(keyOf));
    const before = new Map(items.map((it, i) => [it.key, i]));
    const next: Item[] = kids.map((el) => {
      const k = keyOf(el);
      const was = before.get(k);
      // A list filling up for the first time (it was empty while loading) arrives
      // as a whole, with the screen's own fade; only later additions grow in.
      if (items.length === 0) return { key: k, el, state: "idle" as const };
      return { key: k, el, state: was === undefined || items[was].state === "out" ? "in" : "idle" };
    });
    // Leaving rows stay where they were while they fold away.
    items.forEach((it, i) => {
      if (!now.has(it.key)) next.splice(Math.min(i, next.length), 0, { ...it, state: "out" });
    });
    setItems(next);
  }

  // Once a row has folded away, drop it.
  useEffect(() => {
    if (!items.some((i) => i.state === "out")) return;
    const id = window.setTimeout(() => setItems((cur) => cur.filter((i) => i.state !== "out")), STANDARD_MS + 40);
    return () => window.clearTimeout(id);
  }, [items]);

  const live = new Map(kids.map((k) => [keyOf(k), k]));
  return (
    <>
      {items.map((it, i) => (
        <div key={it.key} className="bq-li" data-state={it.state}>
          <div style={{ minHeight: 0, overflow: "hidden" }}>
            <div style={{ paddingTop: i > 0 ? gap : 0 }}>{it.state === "out" ? it.el : live.get(it.key) ?? it.el}</div>
          </div>
        </div>
      ))}
    </>
  );
}
