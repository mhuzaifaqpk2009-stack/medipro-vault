import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onKeyDown, onChange, min, inputMode, ...props }, ref) => {
    const isNumber = type === "number";
    return (
      <input
        type={type}
        inputMode={isNumber ? inputMode ?? "decimal" : inputMode}
        min={isNumber && min === undefined ? 0 : min}
        onKeyDown={(e) => {
          if (isNumber) {
            // Block negatives, exponent, and plus signs.
            if (["-", "+", "e", "E"].includes(e.key)) {
              e.preventDefault();
              return;
            }
          }
          onKeyDown?.(e);
        }}
        onChange={(e) => {
          if (isNumber) {
            const v = e.target.value;
            if (v !== "" && Number(v) < 0) {
              e.target.value = "0";
            }
          }
          onChange?.(e);
        }}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
