import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isHalloweenSeason } from "./season";

const Ctx = createContext<{ halloween: boolean; toggleHalloween: () => void }>({ halloween: false, toggleHalloween: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [halloween, setHalloween] = useState(false);
  useEffect(() => {
    const update = () => {
      try {
        const saved = window.localStorage.getItem("streamly-theme");
        setHalloween(saved === "halloween" ? true : saved === "blue" ? false : isHalloweenSeason(new Date()));
      } catch {
        setHalloween(isHalloweenSeason(new Date()));
      }
    };
    update();
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("halloween", halloween);
    const favicon = document.querySelector<HTMLLinkElement>('link[data-streamly-favicon]');
    if (favicon) favicon.href = halloween ? "/favicon-halloween.svg" : "/favicon.svg";
  }, [halloween]);
  const toggleHalloween = () => {
    setHalloween((current) => {
      const next = !current;
      try { window.localStorage.setItem("streamly-theme", next ? "halloween" : "blue"); } catch {}
      return next;
    });
  };
  return <Ctx.Provider value={{ halloween, toggleHalloween }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
