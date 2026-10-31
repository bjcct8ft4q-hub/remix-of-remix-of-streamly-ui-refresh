import { Infinity as InfinityIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-1.5 text-primary">
      <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center"><InfinityIcon className="h-9 w-9" strokeWidth={2.75} /><span aria-hidden="true" className="streamly-santa-hat pointer-events-none absolute -top-2 left-0 hidden h-5 w-6 -rotate-12"><span className="absolute bottom-1 left-1 h-3 w-4 -skew-x-12 rounded-tl-full rounded-tr-md bg-red-600" /><span className="absolute bottom-0 left-0 h-1.5 w-6 rounded-full bg-white shadow-sm" /><span className="absolute -top-0.5 right-0 h-2 w-2 rounded-full bg-white" /></span></span>
      <span className="streamly-logo-wordmark font-display text-2xl font-black italic tracking-tight text-foreground">
        Stream<span className="text-primary">ly</span>
      </span>
    </Link>
  );
}
