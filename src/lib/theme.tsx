import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isHalloweenSeason } from "./season";

const Ctx = createContext<{ halloween: boolean; christmas: boolean; toggleHalloween: () => void; toggleChristmas: () => void }>({ halloween: false, christmas: false, toggleHalloween: () => {}, toggleChristmas: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [halloween, setHalloween] = useState(false);
  const [christmas, setChristmas] = useState(false);
  useEffect(() => {
    const update = () => {
      try {
        const saved = window.localStorage.getItem("streamly-theme");
        setChristmas(saved === "christmas");
        setHalloween(saved === "halloween" ? true : saved === "blue" || saved === "christmas" ? false : isHalloweenSeason(new Date()));
      } catch {
        setHalloween(isHalloweenSeason(new Date()));
      }
    };
    update();
    const ready = window.requestAnimationFrame(() => document.documentElement.classList.add("streamly-theme-ready"));
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => {
      window.cancelAnimationFrame(ready);
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("halloween", halloween && !christmas);
    document.documentElement.classList.toggle("christmas", christmas);
    const favicon = document.querySelector<HTMLLinkElement>('link[data-streamly-favicon]');
    if (favicon) favicon.href = halloween ? "/favicon-halloween.svg" : "/favicon.svg";
  }, [halloween, christmas]);
  const toggleHalloween = () => {
    setChristmas(false);
    setHalloween((current) => {
      const next = !current;
      try { window.localStorage.setItem("streamly-theme", next ? "halloween" : "blue"); } catch {}
      return next;
    });
  };
  const toggleChristmas = () => {
    const next = !christmas;
    setChristmas(next);
    setHalloween(false);
    try { window.localStorage.setItem("streamly-theme", next ? "christmas" : "blue"); } catch {}
  };
  return <Ctx.Provider value={{ halloween, christmas, toggleHalloween, toggleChristmas }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
