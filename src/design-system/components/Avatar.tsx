import { useState } from "react";
import { initialsOf } from "../format";

export function Avatar({ name, size = 40, src }: { name: string; size?: number; src?: string | null }) {
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const showImage = !!src && src !== brokenSrc;

  return (
    <div className="bq-avatar-row"
      style={{ width: size, height: size, font: `800 ${Math.round(size * 0.34)}px var(--font-family-body)` }}
    >
      {showImage ? (
        <img className="bq-avatar-img"
          src={src}
          alt=""
          onError={() => setBrokenSrc(src)}
        />
      ) : (
        initialsOf(name)
      )}
    </div>
  );
}
