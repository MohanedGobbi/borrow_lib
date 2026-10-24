import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/** True when the visitor asked the system for less motion; follows the setting live. */
export function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const change = () => setReduced(mq.matches);
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, []);
  return reduced;
}

/**
 * Weighted, smoothed scrolling (Lenis) for as long as the calling page is mounted. Menus, dialogs and other
 * scrollable popovers keep the browser's own scrolling.
 */
export function useSmoothScroll(enabled: boolean) {
  const lenis = useRef<Lenis | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const instance = new Lenis({
      autoRaf: true,
      lerp: 0.085,
      prevent: (node) => !!node.closest?.("[role=menu], [role=dialog], [data-radix-popper-content-wrapper]"),
    });
    lenis.current = instance;
    return () => {
      instance.destroy();
      lenis.current = null;
    };
  }, [enabled]);
  return lenis;
}
