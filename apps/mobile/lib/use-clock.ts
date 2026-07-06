import { useEffect, useState } from "react";

/**
 * Minute-resolution clock for desktop chrome. Ticks once per minute, aligned to the minute boundary,
 * so it re-renders the sidebar exactly when the HH:MM label actually changes — not on a blind 30s
 * timer that wasted half its renders (and their nav-count refilters) mid-minute.
 */
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(new Date());
    // Fire on the next minute boundary, then every 60s.
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);
  return now;
}

export const clockLabel = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * The sky, as a color. Nox is the night — so at night the dot is the brand violet (the app is most
 * itself after dark); dawn is a low warm coral, day a soft gold, dusk an ember. Drives the wordmark
 * dot and the faint gradient crowning the sidebar, so the app reads differently at 9am and 11pm.
 */
export function skyColor(d: Date, nightAccent: string): string {
  const h = d.getHours();
  if (h >= 5 && h < 8) return "#D98E62"; // dawn
  if (h >= 8 && h < 17) return "#D9B65C"; // day
  if (h >= 17 && h < 21) return "#C96F52"; // dusk
  return nightAccent; // night — the accent itself
}

/** A human greeting that tracks the actual hour. */
export function greeting(d: Date, name: string): string {
  const h = d.getHours();
  const who = name && name !== "You" ? `, ${name}` : "";
  if (h >= 5 && h < 12) return `Good morning${who}`;
  if (h >= 12 && h < 17) return `Good afternoon${who}`;
  if (h >= 17 && h < 22) return `Good evening${who}`;
  return `Up late${who}`;
}
