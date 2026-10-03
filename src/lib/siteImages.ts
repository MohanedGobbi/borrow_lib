/**
 * The site's photographs, by the place they appear. Components read them only through `siteImage()`:
 * today it returns the bundled Unsplash placeholders in `public/images/`; later the library's own photos,
 * set by an administrator, come from the API through this same function.
 */
export type SiteImageSlot = "hero" | "feature" | "auth";

export interface SiteImage {
  /** Every width that exists, smallest first, for `srcset`. */
  sources: { url: string; width: number }[];
  /** Size of the widest file, for the aspect ratio. */
  width: number;
  height: number;
  /** `object-position` that keeps the calm part of the picture in frame when it is cropped. */
  position: string;
  /** Shown in the footer's small print. */
  credit: { name: string; url: string };
}

const BASE = import.meta.env.BASE_URL;
const WIDTHS = [640, 1200, 2000];

function bundled(
  name: string, width: number, height: number, position: string, photographer: string, unsplashId: string,
): SiteImage {
  return {
    sources: WIDTHS.map((w) => ({ url: `${BASE}images/${name}-${w}.webp`, width: w })),
    width,
    height,
    position,
    credit: { name: photographer, url: `https://unsplash.com/photos/${unsplashId}` },
  };
}

const DEFAULTS: Record<SiteImageSlot, SiteImage> = {
  // Black-and-white architecture, so the palette stays green, white and red.
  hero: bundled("zurich", 2000, 1333, "62% 45%", "Ilia Bronskiy", "HKwQsyTNRoI"),
  // Warm reading room with green lamps: the one colour photograph, for the feature section.
  feature: bundled("study-desk", 2000, 1333, "40% 50%", "Tat Linh Nguyen", "SFUgDVSkfUM"),
  // Portrait, for the side panel of the sign-in pages (shown in black and white).
  auth: bundled("vaulted-aisle", 1333, 2000, "50% 40%", "Frank Huang", "ziEKw11ck_U"),
};

export function siteImage(slot: SiteImageSlot): SiteImage {
  return DEFAULTS[slot];
}

/** `srcset` for an image, optionally capped (phones never need the widest file). */
export function srcSetOf(image: SiteImage, maxWidth = Infinity): string {
  return image.sources
    .filter((s) => s.width <= maxWidth)
    .map((s) => `${s.url} ${s.width}w`)
    .join(", ");
}

/** The middle width: the `src` fallback for browsers without `srcset`. */
export function fallbackSrc(image: SiteImage): string {
  return image.sources[Math.min(1, image.sources.length - 1)].url;
}

/** Each photographer once, in the order the photographs appear. */
export function siteImageCredits(): SiteImage["credit"][] {
  const seen = new Set<string>();
  return (["hero", "feature", "auth"] as SiteImageSlot[])
    .map((slot) => siteImage(slot).credit)
    .filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
}
