import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isHalloweenSeason, isChristmasSeason } from "./season";

type ThemeContext = { halloween: boolean; christmas: boolean; halloweenAvailable: boolean; toggleHalloween: () => void; toggleChristmas: () => void };
const Ctx = createContext<ThemeContext>({ halloween: false, christmas: false, halloweenAvailable: false, toggleHalloween: () => {}, toggleChristmas: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [halloween, setHalloween] = useState(false);
  const [christmas, setChristmas] = useState(false);
  const [halloweenAvailable, setHalloweenAvailable] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const halloweenSeason = isHalloweenSeason(now);
      const christmasSeason = isChristmasSeason(now) && !halloweenSeason;
      setHalloweenAvailable(halloweenSeason);
      setChristmas(christmasSeason);
      let optedOut = false;
      try { optedOut = window.localStorage.getItem("streamly-theme") === `blue:${now.getFullYear()}`; } catch {}
      setHalloween(halloweenSeason && !optedOut);
    };
    update();
    const ready = window.requestAnimationFrame(() => document.documentElement.classList.add("streamly-theme-ready"));
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => { window.cancelAnimationFrame(ready); window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("halloween", halloween && !christmas);
    document.documentElement.classList.toggle("christmas", christmas);
    const favicon = document.querySelector<HTMLLinkElement>('link[data-streamly-favicon]');
    if (favicon) favicon.href = christmas ? "/favicon-christmas.svg" : halloween ? "/favicon-halloween.svg" : "/favicon.svg";
  }, [halloween, christmas]);

  const toggleHalloween = () => {
    if (!isHalloweenSeason(new Date())) return;
    setHalloween(current => {
      const next = !current;
      try { window.localStorage.setItem("streamly-theme", next ? `halloween:${new Date().getFullYear()}` : `blue:${new Date().getFullYear()}`); } catch {}
      return next;
    });
  };
  // Christmas is automatic during its date window; it cannot be enabled early.
  const toggleChristmas = () => {};
  return <Ctx.Provider value={{ halloween, christmas, halloweenAvailable, toggleHalloween, toggleChristmas }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
