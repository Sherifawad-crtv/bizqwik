import { initialsOf } from "../lib/format";

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: "var(--avatar-grad)",
        color: "var(--surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
        font: `800 ${Math.round(size * 0.34)}px var(--font-body)`,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}
