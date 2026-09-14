import { useState } from "react";
import { initialsOf } from "../lib/format";

export function Avatar({ name, size = 40, src }: { name: string; size?: number; src?: string | null }) {
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const showImage = !!src && src !== brokenSrc;

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
        overflow: "hidden",
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          onError={() => setBrokenSrc(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        initialsOf(name)
      )}
    </div>
  );
}
