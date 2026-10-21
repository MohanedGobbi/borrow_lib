import { useQuery } from "@tanstack/react-query";
import { apiSiteImages } from "@/api";
import { qk } from "@/api/queryKeys";
import type { Lang } from "@/i18n/locales";
import type { SiteImageData, SiteImages } from "@/types";

/**
 * The site's photographs, by the place they appear. Components read them only through `siteImage()`.
 * An administrator can replace each one (Settings, "Site photos"); the API then returns it and this module
 * uses it. A slot nobody changed shows the bundled photograph in `public/images/`, which is also
 * what shows while the API answers, so the page never waits on it and nothing moves when the answer arrives.
 */
export type SiteImageSlot = "hero" | "feature" | "auth";
export const SITE_IMAGE_SLOTS: SiteImageSlot[] = ["hero", "feature", "auth"];

/** What the server accepts (library/site_images.py): the Settings dialog checks the same limits before uploading. */
export const SITE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const SITE_IMAGE_MAX_PIXELS = 40_000_000;
export const SITE_IMAGE_TEXT_MAX = 200;
export const SITE_IMAGE_MIN_WIDTH: Record<SiteImageSlot, number> = { hero: 1200, feature: 1200, auth: 640 };
export const SITE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Where a photograph comes from: a named Unsplash photographer, or the free text an admin typed. */
export type SiteImageCredit = { kind: "unsplash"; name: string; url: string } | { kind: "text"; text: string };

export interface SiteImage {
  /** Every width that exists, smallest first, for `srcset`. */
  sources: { url: string; width: number }[];
  /** Size of the original, for the aspect ratio. */
  width: number;
  height: number;
  /** `object-position` that keeps the calm part of the picture in frame when it is cropped. */
  position: string;
  /** What the photograph shows, in the active language. Empty for the bundled photographs, which are decorative. */
  alt: string;
  /** Shown in the footer's small print; null when an admin left the credit empty. */
  credit: SiteImageCredit | null;
  /** True when an admin replaced the bundled photograph. */
  custom: boolean;
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
    alt: "",
    credit: { kind: "unsplash", name: photographer, url: `https://unsplash.com/photos/${unsplashId}` },
    custom: false,
  };
}

/** The university's own photographs: one file at its own width, and no credit line. */
function own(name: string, width: number, height: number, position: string): SiteImage {
  return {
    sources: [{ url: `${BASE}images/${name}-${width}.webp`, width }],
    width,
    height,
    position,
    alt: "",
    credit: null,
    custom: false,
  };
}

export const DEFAULTS: Record<SiteImageSlot, SiteImage> = {
  // Every photograph is black and white, so the palette stays green, white and red (uploads are converted the same way).
  // The landing page shows the Faculty of Law and Political Sciences building, in colour, as on the faculty's banner.
  hero: own("faculty-building", 550, 390, "50% 40%"),
  // The university's main building.
  feature: own("university-building", 562, 355, "50% 50%"),
  // Portrait, for the side panel of the sign-in pages.
  auth: bundled("vaulted-aisle", 1333, 2000, "50% 40%", "Frank Huang", "ziEKw11ck_U"),
};

/** The API's photographs. They change only when an admin edits them, so ten minutes is fresh. */
export function useSiteImages() {
  return useQuery({ queryKey: qk.siteImages, queryFn: apiSiteImages.get, staleTime: 10 * 60_000 });
}

/** `"url 640w, url 1200w"` as a list. A candidate is cut at whitespace, so a comma inside a URL is safe. */
function parseSrcSet(srcset: string): SiteImage["sources"] {
  return srcset.split(/,\s+/).flatMap((candidate) => {
    const at = candidate.trim().lastIndexOf(" ");
    const width = Number.parseInt(candidate.slice(at + 1), 10);
    return at > 0 && width > 0 ? [{ url: candidate.slice(0, at).trim(), width }] : [];
  });
}

function fromApi(data: SiteImageData, lang: Lang): SiteImage {
  const sources = parseSrcSet(data.srcset);
  const text = data.credit.trim();
  return {
    sources: sources.length ? sources : [{ url: data.src, width: data.width }],
    width: data.width,
    height: data.height,
    position: "50% 50%",
    alt: data.alt[lang] || data.alt.en,
    credit: text ? { kind: "text", text } : null,
    custom: true,
  };
}

/** The photograph for a slot: the admin's when there is one in `data`, else the bundled one. */
export function siteImage(slot: SiteImageSlot, data?: SiteImages | null, lang: Lang = "en"): SiteImage {
  const custom = data?.[slot];
  return custom ? fromApi(custom, lang) : DEFAULTS[slot];
}

/** `srcset` for an image, optionally capped (phones never need the widest file). */
export function srcSetOf(image: SiteImage, maxWidth = Infinity): string {
  const fits = image.sources.filter((s) => s.width <= maxWidth);
  // A photograph narrower than the cap still has to offer something.
  return (fits.length ? fits : image.sources.slice(0, 1)).map((s) => `${s.url} ${s.width}w`).join(", ");
}

/** The middle width: the `src` fallback for browsers without `srcset`. */
export function fallbackSrc(image: SiteImage): string {
  return image.sources[Math.min(1, image.sources.length - 1)].url;
}

/** Each credit once, in the order the photographs appear: the Unsplash photographers, then the admin's own lines. */
export function siteImageCredits(data?: SiteImages | null): { unsplash: { name: string; url: string }[]; text: string[] } {
  const unsplash = new Map<string, { name: string; url: string }>();
  const text = new Set<string>();
  for (const slot of SITE_IMAGE_SLOTS) {
    const credit = siteImage(slot, data).credit;
    if (credit?.kind === "unsplash") unsplash.set(credit.url, credit);
    else if (credit) text.add(credit.text);
  }
  return { unsplash: [...unsplash.values()], text: [...text] };
}
