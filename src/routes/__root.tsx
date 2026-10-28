import { Footer } from "@/components/Footer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { Header } from "@/components/Header";
import { AuthDialog } from "@/components/AuthDialog";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end. You can try refreshing or head back home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Streamly | Discover Anime" },
      { name: "description", content: "Stream the latest series episodes on Streamly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Outfit:wght@600;700;800;900&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml", "data-streamly-favicon": "" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function InteractionEffects() {
  useEffect(() => {
    let context: AudioContext | null = null;
    let lastKeyAt = 0;
    const play = (frequency: number, volume: number, duration: number) => {
      try {
        context ??= new AudioContext();
        if (context.state === "suspended") void context.resume();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.7, context.currentTime + duration);
        gain.gain.setValueAtTime(volume, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + duration + 0.005);
      } catch { /* Sound must never interfere with interaction. */ }
    };
    const enabled = () => { try { return localStorage.getItem("streamly-ui-sounds") === "on"; } catch { return false; } };
    const click = (event: MouseEvent) => {
      if (!enabled()) return;
      const target = event.target;
      if (target instanceof Element && target.closest("button, a, [role=button], [role=tab], select, input[type=checkbox], input[type=radio]")) play(510, 0.012, 0.045);
    };
    const typing = (event: KeyboardEvent) => {
      if (!enabled() || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.key.length !== 1) return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("input:not([type=password]), textarea, [contenteditable=true]")) return;
      const now = performance.now();
      if (now - lastKeyAt < 45) return;
      lastKeyAt = now;
      play(660, 0.005, 0.022);
    };
    document.addEventListener("click", click);
    document.addEventListener("keydown", typing);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("keydown", typing);
      if (context) void context.close();
    };
  }, []);
  return null;
}

function CustomCursor() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduced.matches) return;
    const cursor = document.createElement("div");
    cursor.className = "streamly-custom-cursor";
    cursor.setAttribute("aria-hidden", "true");
    document.body.appendChild(cursor);
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
        cursor.classList.add("streamly-cursor-visible");
        const el = event.target;
        cursor.classList.toggle("streamly-cursor-active", el instanceof Element && !!el.closest("a, button, [role=button], [role=tab], input, textarea, select"));
      });
    };
    const hide = () => cursor.classList.remove("streamly-cursor-visible");
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
      cursor.remove();
    };
  }, []);
  return null;
}

function TrafficTracker() {
  const router = useRouter();
  useEffect(() => {
    let previous = "";
    const record = () => {
      const path = window.location.pathname;
      if (path === previous || path.startsWith("/admin")) return;
      previous = path;
      void (supabase as any).rpc("record_page_view", { page_path: path }).then(() => {}, () => {});
    };
    record();
    const unsubscribe = router.subscribe("onResolved", record);
    return () => unsubscribe();
  }, [router]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <div className="relative min-h-screen">
            <InteractionEffects />
            <CustomCursor />
            <TrafficTracker />
            <Header />
            <Outlet />
            <Footer />
          </div>
          <AuthDialog />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
