import type { CSSProperties } from "react";
import { useI18n } from "@/i18n";
import { fallbackSrc, siteImage, srcSetOf, useSiteImages, type SiteImageSlot } from "@/lib/siteImages";

/**
 * One of the site's photographs, responsive. Phones (below 768px) are only offered the 640 and 1200 files.
 * `priority` is for the landing hero alone; every other photograph loads lazily.
 * The bundled photographs are decorative (the words around them carry the meaning), so their alt text is empty;
 * a photograph an admin uploaded comes with a description in each language, which is used.
 */
export function SitePhoto({
  slot, sizes, priority = false, className, style,
}: { slot: SiteImageSlot; sizes: string; priority?: boolean; className?: string; style?: CSSProperties }) {
  const { lang } = useI18n();
  const { data } = useSiteImages();
  const image = siteImage(slot, data, lang);
  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={srcSetOf(image, 1200)} sizes="100vw" />
      <img
        src={fallbackSrc(image)}
        srcSet={srcSetOf(image)}
        sizes={sizes}
        width={image.width}
        height={image.height}
        alt={image.alt}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className={className}
        style={{ objectPosition: image.position, ...style }}
      />
    </picture>
  );
}
