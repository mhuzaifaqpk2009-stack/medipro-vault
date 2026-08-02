import * as React from "react";
import { Input } from "@/components/ui/input";

/**
 * Search input whose placeholder "types" itself in and out, word by word,
 * while the field is empty and unfocused-or-focused (stops once text exists).
 */
export function useTypingPlaceholder(phrases: string[], active = true) {
  const [text, setText] = React.useState(phrases[0] ?? "");
  const state = React.useRef({ phrase: 0, chars: 0, deleting: false });

  React.useEffect(() => {
    if (!active) return;
    let timer: number;
    const tick = () => {
      const st = state.current;
      const full = phrases[st.phrase % phrases.length] ?? "";
      const words = full.split(" ");
      if (!st.deleting) {
        st.chars += 1;
        if (st.chars >= words.length) { st.deleting = true; timer = window.setTimeout(tick, 1400); }
        else timer = window.setTimeout(tick, 220);
      } else {
        st.chars -= 1;
        if (st.chars <= 0) {
          st.chars = 0;
          st.deleting = false;
          st.phrase += 1;
          timer = window.setTimeout(tick, 400);
        } else timer = window.setTimeout(tick, 140);
      }
      setText(words.slice(0, Math.max(0, st.chars)).join(" "));
    };
    timer = window.setTimeout(tick, 600);
    return () => window.clearTimeout(timer);
  }, [phrases, active]);

  return active ? text : phrases[0] ?? "";
}

type Props = React.ComponentProps<typeof Input> & { phrases?: string[] };

export const SearchInput = React.forwardRef<HTMLInputElement, Props>(
  ({ phrases = ["Search…"], value, ...props }, ref) => {
    const empty = !value || String(value).length === 0;
    const animated = useTypingPlaceholder(phrases, empty);
    return <Input ref={ref} value={value} placeholder={animated || " "} {...props} />;
  },
);
SearchInput.displayName = "SearchInput";
