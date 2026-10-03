import { useEffect, type RefObject } from "react";

/**
 * Starts the landing page's scroll motion (Lenis, GSAP, ScrollTrigger) after the first paint.
 * The libraries live in their own lazy chunk, so no other route downloads them, and nothing loads at all
 * when the visitor asks for reduced motion. Without the chunk the page is complete: every element's
 * resting state is its final state.
 */
export function useLandingMotion(root: RefObject<HTMLElement | null>, rtl: boolean) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let stop: (() => void) | undefined;
    let cancelled = false;
    const start = () => {
      import("@/lib/landingMotion")
        .then(({ startLandingMotion }) => {
          if (!cancelled && root.current) stop = startLandingMotion(root.current, { rtl });
        })
        .catch(() => { /* the page already works without motion */ });
    };

    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 1200 })
      : window.setTimeout(start, 250);

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      stop?.();
    };
  }, [root, rtl]);
}
