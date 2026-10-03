import { useLayoutEffect, useSyncExternalStore, type RefObject } from "react";

/**
 * How the global header sits over a full-bleed hero photograph.
 * `present`: a hero is on the page, so the header overlaps it instead of pushing it down.
 * `over`: the hero is still behind the header, so the header is transparent with white text.
 * Everywhere else, and once the hero has scrolled away, the header is the white glass bar.
 */
interface HeroHeaderState { present: boolean; over: boolean }

let state: HeroHeaderState = { present: false, over: false };
const listeners = new Set<() => void>();

function set(next: HeroHeaderState) {
  if (next.present === state.present && next.over === state.over) return;
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const SERVER_STATE: HeroHeaderState = { present: false, over: false };

/** Read by the header. */
export function useHeroHeaderState(): HeroHeaderState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

/** The header's height: the hero counts as "behind the header" until its bottom edge passes this line. */
const HEADER_PX = 64;

/** Called by a page with a hero photograph. Layout effect, so the first paint already has the right header. */
export function useHeroHeader(hero: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = hero.current;
    if (!el) return;
    set({ present: true, over: el.getBoundingClientRect().bottom > HEADER_PX });
    const observer = new IntersectionObserver(
      ([entry]) => set({ present: true, over: entry.isIntersecting }),
      { rootMargin: `-${HEADER_PX}px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      set({ present: false, over: false });
    };
  }, [hero]);
}
