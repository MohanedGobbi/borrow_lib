import type { CSSProperties } from "react";
import { fallbackSrc, siteImage, srcSetOf, type SiteImageSlot } from "@/lib/siteImages";

/**
 * One of the site's photographs, responsive. Phones (below 768px) are only offered the 640 and 1200 files.
 * `priority` is for the landing hero alone; every other photograph loads lazily.
 * Decorative: the words around a photograph carry the meaning, so its alt text is empty.
 */
export function SitePhoto({
  slot, sizes, priority = false, className, style,
}: { slot: SiteImageSlot; sizes: string; priority?: boolean; className?: string; style?: CSSProperties }) {
  const image = siteImage(slot);
  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={srcSetOf(image, 1200)} sizes="100vw" />
      <img
        src={fallbackSrc(image)}
        srcSet={srcSetOf(image)}
        sizes={sizes}
        width={image.width}
        height={image.height}
        alt=""
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className={className}
        style={{ objectPosition: image.position, ...style }}
      />
    </picture>
  );
}
