import { Tag } from "../design-system/components/Tag";
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
  return <Tag tone={c === "Kids" ? "logging" : "neutral"}>{c}</Tag>;
}
