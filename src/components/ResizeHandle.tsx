import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Thin draggable edge that resizes a chrome panel. The cursor turns into a
 * resize cursor on hover; drag outward to enlarge, inward to shrink.
 */
export function ResizeHandle({
  orientation,
  value,
  min,
  max,
  invert = false,
  onChange,
  className,
}: {
  orientation: "vertical" | "horizontal";
  value: number;
  min: number;
  max: number;
  /** Invert the drag direction (e.g. bottom panels grow when dragged up). */
  invert?: boolean;
  onChange: (v: number) => void;
  className?: string;
}) {
  const drag = useRef<{ start: number; base: number } | null>(null);
  const isV = orientation === "vertical";

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      const delta = (isV ? e.clientX - d.start : e.clientY - d.start) * (invert ? -1 : 1);
      onChange(Math.round(Math.min(max, Math.max(min, d.base + delta))));
    };
    const up = () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [isV, invert, min, max, onChange]);

  return (
    <div
      onMouseDown={(e) => {
        drag.current = { start: isV ? e.clientX : e.clientY, base: value };
        document.body.style.userSelect = "none";
        document.body.style.cursor = isV ? "col-resize" : "row-resize";
      }}
      onDoubleClick={() => onChange(value)}
      className={cn(
        "z-40 transition-colors hover:bg-primary/30",
        isV ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize",
        className,
      )}
      role="separator"
      aria-orientation={isV ? "vertical" : "horizontal"}
    />
  );
}
