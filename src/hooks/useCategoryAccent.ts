import { useEffect } from "react";

const DEFAULT = "#C55221";

/**
 * Category theming: sets --cat-accent on <html> so key chrome
 * (hero bands, buttons, chips) follows the active category color.
 */
export function useCategoryAccent(color: string | null | undefined) {
  useEffect(() => {
    document.documentElement.style.setProperty("--cat-accent", color ?? DEFAULT);
    return () => {
      document.documentElement.style.setProperty("--cat-accent", DEFAULT);
    };
  }, [color]);
}
