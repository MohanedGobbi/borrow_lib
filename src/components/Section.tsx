import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Collapsible dashboard section with editorial header (mono label + rule). */
export function Section({
  kicker,
  title,
  count,
  tone = "cream",
  defaultOpen = true,
  children,
}: {
  kicker: string;
  title: string;
  count?: number;
  tone?: "cream" | "white";
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={cn(
        "rounded-md border border-border",
        tone === "cream" ? "bg-cream" : "bg-white"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-burnt">
          {kicker}
        </span>
        <span className="text-lg font-semibold text-ink">{title}</span>
        {count !== undefined && (
          <span className="rounded-sm bg-ink px-2 py-0.5 font-mono text-xs font-bold text-white">
            {count}
          </span>
        )}
        <span className="mx-2 h-px flex-1 bg-ink/15" />
        <ChevronDown
          className={cn("size-5 shrink-0 text-ink/50 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}
