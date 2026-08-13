import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type TrendBucket = { label: string; value: number };

function compact(n: number, sym: string) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sym}${(n / 1_000).toFixed(1)}k`;
  return `${sym}${Math.round(n)}`;
}

function linePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

const MIN_PX_PER_BUCKET = 46;

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
  const TOP_PAD = 8;
  const scale = (v: number) => (v / max) * (100 - TOP_PAD);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const step = Math.max(1, Math.ceil(buckets.length / 12));
  const contentWidth = Math.max(100, buckets.length * MIN_PX_PER_BUCKET);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets.length]);

  const scrollBy = (dir: 1 | -1) => scrollRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });

  return (
    <div className="pt-1">
      <div className="flex">
        <div className="relative w-14 shrink-0" style={{ height }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ bottom: `${t * (100 - TOP_PAD)}%` }}
            >
              {compact(max * t, sym)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div style={{ width: `max(100%, ${contentWidth}px)` }}>
              <div className="relative border-b border-l border-border" style={{ height }}>
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-border/60"
                    style={{ bottom: `${t * (100 - TOP_PAD)}%` }}
                  />
                ))}

                {type === "bar" ? (
                  <div className="absolute inset-0 flex items-end gap-1.5 px-2 pt-2">
                    {buckets.map((d, i) => {
                      const barHeight = Math.max(1.5, scale(d.value));
                      return (
                        <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${barHeight}%` }}
                            transition={{ duration: 0.4, delay: i * 0.015 }}
                            className="w-full rounded-t-md bg-gradient-to-t from-primary to-primary-glow shadow-[0_0_0_1px_var(--primary)_inset]"
                          />
                          <span
                            className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[10px] font-medium text-background opacity-0 shadow-lg transition group-hover:opacity-100"
                            style={{ bottom: `calc(${barHeight}% + 6px)` }}
                          >
                            {d.label} · {compact(d.value, sym)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {(() => {
                        const pts = buckets.map((d, i) => ({
                          x: buckets.length === 1 ? 50 : (i / (buckets.length - 1)) * 100,
                          y: 100 - scale(d.value),
                        }));
                        const path = linePath(pts);
                        const areaPath = pts.length
                          ? `${path} L ${pts[pts.length - 1].x} 100 L ${pts[0].x} 100 Z`
                          : "";
                        return (
                          <>
                            {areaPath && <path d={areaPath} fill="url(#trendFill)" stroke="none" />}
                            <path d={path} fill="none" stroke="var(--primary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                          </>
                        );
                      })()}
                    </svg>

                    <div className="pointer-events-none absolute inset-0">
                      {buckets.map((d, i) => {
                        const x = buckets.length === 1 ? 50 : (i / (buckets.length - 1)) * 100;
                        const y = 100 - scale(d.value);
                        return (
                          <div
                            key={i}
                            title={`${d.label} · ${compact(d.value, sym)}`}
                            className="pointer-events-auto absolute h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-[1.6px] border-primary bg-background transition-transform duration-150 hover:scale-125"
                            style={{ left: `${x}%`, top: `${y}%` }}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-2 flex gap-1 px-1">
                {buckets.map((d, i) => (
                  <span key={i} className="flex-1 truncate text-center text-[9px] text-muted-foreground">
                    {i % step === 0 ? d.label : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {canLeft && (
            <button
              onClick={() => scrollBy(-1)}
              className="absolute left-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-muted/80 text-muted-foreground shadow-sm ring-1 ring-border transition hover:bg-muted hover:text-foreground"
              style={{ marginTop: -12 }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
          {canRight && (
            <button
              onClick={() => scrollBy(1)}
              className="absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-muted/80 text-muted-foreground shadow-sm ring-1 ring-border transition hover:bg-muted hover:text-foreground"
              style={{ marginTop: -12 }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
