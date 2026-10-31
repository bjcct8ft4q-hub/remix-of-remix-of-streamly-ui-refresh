import { Infinity as InfinityIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-1.5 text-primary">
      <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center"><InfinityIcon className="h-9 w-9" strokeWidth={2.75} /><span aria-hidden="true" className="streamly-santa-hat pointer-events-none absolute -top-3 -left-1 hidden select-none text-[23px] leading-none">🎅</span></span>
      <span className="streamly-logo-wordmark font-display text-2xl font-black italic tracking-tight text-foreground">
        Stream<span className="text-primary">ly</span>
      </span>
    </Link>
  );
}
