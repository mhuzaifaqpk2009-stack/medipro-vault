import { motion } from "framer-motion";

export type TrendBucket = { label: string; value: number };

function compact(n: number, sym: string) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sym}${(n / 1_000).toFixed(1)}k`;
  return `${sym}${Math.round(n)}`;
}

/**
 * Axis-based trend chart: value scale on the left, dates along the bottom,
 * horizontal gridlines so every column visibly reaches its value line.
 */
export function TrendChart({
  buckets, max, sym, type, height = 240,
}: {
  buckets: TrendBucket[];
  max: number;
  sym: string;
  type: "bar" | "line";
  height?: number;
}) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const step = Math.max(1, Math.ceil(buckets.length / 12));

  return (
    <div>
      <div className="flex" style={{ height }}>
        <div className="relative w-14 shrink-0">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ bottom: `${t * 100}%` }}
            >
              {compact(max * t, sym)}
            </span>
          ))}
        </div>
        <div className="relative flex-1 border-b border-l border-border">
          {ticks.map((t) => (
            <span
              key={t}
              className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-border/60"
              style={{ bottom: `${t * 100}%` }}
            />
          ))}

          {type === "bar" ? (
            <div className="absolute inset-0 flex items-end gap-1 px-1">
              {buckets.map((d, i) => (
                <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(0.5, (d.value / max) * 100)}%` }}
                    transition={{ duration: 0.4, delay: i * 0.015 }}
                    className="w-full rounded-t border border-primary/50 bg-gradient-to-t from-primary/70 to-primary-glow/60"
                  />
                  <span className="pointer-events-none absolute bottom-full mb-1 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background opacity-0 transition group-hover:opacity-100">
                    {d.label} · {compact(d.value, sym)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline
                fill="none"
                stroke="var(--primary)"
                strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"
                points={buckets
                  .map((d, i) => {
                    const x = buckets.length === 1 ? 50 : (i / (buckets.length - 1)) * 100;
                    const y = 100 - (d.value / max) * 100;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
              {buckets.map((d, i) => {
                const x = buckets.length === 1 ? 50 : (i / (buckets.length - 1)) * 100;
                const y = 100 - (d.value / max) * 100;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="3"
                    vectorEffect="non-scaling-stroke"
                    fill="var(--background)"
                    stroke="var(--primary)"
                    strokeWidth="0.8"
                  >
                    <title>{`${d.label} · ${compact(d.value, sym)}`}</title>
                  </circle>
                );
              })}
            </svg>
          )}
        </div>
      </div>
      <div className="ml-14 mt-2 flex gap-1">
        {buckets.map((d, i) => (
          <span key={i} className="flex-1 truncate text-center text-[9px] text-muted-foreground">
            {i % step === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
