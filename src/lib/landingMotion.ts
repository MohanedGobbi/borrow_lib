/**
 * The landing page's scroll motion. Loaded lazily by `useLandingMotion` (its own chunk), never on other routes.
 *
 * Two scroll moments, each tied to what the reader is doing:
 *  - "How borrowing works": the line between the four steps draws itself as the section scrolls in,
 *    and each step's numeral turns green when the line reaches it (the text stays at full contrast);
 *  - the feature photograph drifts slowly inside its frame (a calm parallax).
 * Plus Lenis smooth scrolling for mouse and trackpad. Touch scrolling is left to the phone.
 *
 * The markup's resting state is the finished state (line drawn, every step lit), so the page is complete
 * before this runs, without it, and after `stop()`.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export function startLandingMotion(root: HTMLElement, { rtl }: { rtl: boolean }): () => void {
  let lenis: Lenis | null = null;
  let tick: ((time: number) => void) | null = null;

  if (window.matchMedia("(pointer: fine)").matches) {
    lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false,
      // Menus and dialogs scroll on their own.
      prevent: (node) => !!node.closest("[data-radix-popper-content-wrapper], [role='dialog'], [role='menu']"),
    });
    const instance = lenis;
    instance.on("scroll", ScrollTrigger.update);
    tick = (time) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
  }

  const mm = gsap.matchMedia(root);

  const list = root.querySelector<HTMLElement>("[data-steps]");
  if (list) {
    const steps = gsap.utils.toArray<HTMLElement>("[data-step]", list);
    const fills = gsap.utils.toArray<HTMLElement>("[data-step-fill]", list);
    const light = (progress: number) => {
      steps.forEach((step, i) => step.setAttribute("data-lit", String(progress >= i / fills.length - 0.001)));
    };

    mm.add({ wide: "(min-width: 768px)", narrow: "(max-width: 767px)" }, (context) => {
      const wide = !!context.conditions?.wide;
      const axis = wide ? "scaleX" : "scaleY";
      gsap.set(fills, {
        [axis]: 0,
        transformOrigin: wide ? (rtl ? "right center" : "left center") : "center top",
      });
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: list,
          start: wide ? "top 80%" : "top 75%",
          end: wide ? "top 35%" : "bottom 55%",
          scrub: 0.6,
        },
        onUpdate: () => light(timeline.progress()),
      });
      fills.forEach((fill) => timeline.to(fill, { [axis]: 1, ease: "none", duration: 1 }));
      light(timeline.progress());
      return () => steps.forEach((step) => step.setAttribute("data-lit", "true"));
    });
  }

  const frame = root.querySelector<HTMLElement>("[data-parallax-frame]");
  const photo = frame?.querySelector<HTMLElement>("img");
  if (photo && frame) {
    mm.add("(min-width: 0px)", () => {
      gsap.fromTo(
        photo,
        { yPercent: -6 },
        {
          yPercent: 6,
          ease: "none",
          scrollTrigger: { trigger: frame, start: "top bottom", end: "bottom top", scrub: true },
        },
      );
    });
  }

  // The shelf of books arrives after the first render and changes the page height: re-measure the triggers.
  let pending = 0;
  const resize = new ResizeObserver(() => {
    window.clearTimeout(pending);
    pending = window.setTimeout(() => ScrollTrigger.refresh(), 120);
  });
  resize.observe(root);

  return () => {
    window.clearTimeout(pending);
    resize.disconnect();
    mm.revert();
    if (tick) {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
    }
    lenis?.destroy();
  };
}
