import { motion } from "framer-motion";
import { Construction, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function ModulePlaceholder({
  title,
  description,
  icon,
  features,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  features: string[];
}) {
  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-6 flex items-center gap-3"
      >
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft">
          {icon}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </motion.header>

      <div className="surface-card overflow-hidden">
        <div className="border-b bg-gradient-to-r from-primary/5 via-transparent to-transparent px-6 py-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <Construction className="h-3.5 w-3.5" />
            Shipping in the next build phase
          </div>
        </div>

        <ul className="grid gap-2 p-6 sm:grid-cols-2">
          {features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
