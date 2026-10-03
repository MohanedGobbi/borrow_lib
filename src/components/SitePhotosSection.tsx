import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiSiteImages } from "@/api";
import { invalidateSiteImages } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { errorMessage, translateCode } from "@/lib/errors";
import {
  fallbackSrc, siteImage, SITE_IMAGE_MAX_BYTES, SITE_IMAGE_MIN_WIDTH, SITE_IMAGE_SLOTS, SITE_IMAGE_TEXT_MAX,
  SITE_IMAGE_TYPES, useSiteImages, type SiteImageSlot,
} from "@/lib/siteImages";
import { fmtDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ErrorState, Panel, RowsSkeleton } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SiteImageData } from "@/types";

/**
 * Admin-only, on the Settings page: the three photographs of the site, each with its place, a preview at its real
 * proportions, "Replace photo" and "Restore default". The server checks every upload; this only helps early.
 */
export function SitePhotosSection() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useSiteImages();
  const [replacing, setReplacing] = useState<SiteImageSlot | null>(null);
  const [restoring, setRestoring] = useState<SiteImageSlot | null>(null);

  const restore = useMutation({
    mutationFn: (slot: SiteImageSlot) => apiSiteImages.restore(slot),
    onSuccess: () => {
      toast.success(t("photos.restored"));
      return invalidateSiteImages(qc);
    },
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
  });

  return (
    <section aria-labelledby="site-photos-title" className="space-y-4 pt-4">
      <div>
        <h2 id="site-photos-title" className="type-title text-ink">{t("photos.title")}</h2>
        <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">{t("photos.sub")}</p>
      </div>

      {isPending ? (
        <Panel flush><RowsSkeleton rows={3} /></Panel>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <Panel flush>
          <ul className="divide-y">
            {SITE_IMAGE_SLOTS.map((slot) => {
              const image = siteImage(slot, data, lang);
              const stored = data[slot];
              const portrait = image.height > image.width;
              const slotName = t(`photos.slot.${slot}`);
              return (
                <li key={slot} className="grid gap-x-8 gap-y-4 px-4 py-5 sm:grid-cols-[auto_minmax(0,1fr)]">
                  <div className={cn("w-full overflow-hidden rounded-sm border bg-ink", portrait ? "max-w-[8rem]" : "sm:w-64")}>
                    <img
                      src={fallbackSrc(image)} alt={t("photos.previewAlt", { slot: slotName })}
                      width={image.width} height={image.height} loading="lazy" decoding="async"
                      className={cn("block size-full object-cover", slot === "auth" && "grayscale")}
                      style={{ aspectRatio: `${image.width} / ${image.height}`, objectPosition: image.position }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-ink">{slotName}</h3>
                    <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t(`photos.where.${slot}`)}</p>
                    <p className="mt-3 text-sm text-ink">
                      {stored ? t("photos.statusCustom", { when: fmtDateTime(stored.updatedAt) }) : t("photos.statusDefault")}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {image.credit
                        // The credit is free text in any script: isolate it so it cannot reorder the sentence around it.
                        ? t("photos.creditShown", { credit: `⁨${image.credit.kind === "unsplash" ? `${image.credit.name} (Unsplash)` : image.credit.text}⁩` })
                        : t("photos.creditNone")}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="bg-white" onClick={() => setReplacing(slot)}>
                        {t("photos.replace")}
                      </Button>
                      {stored && (
                        <Button type="button" variant="outline" className="bg-white" disabled={restore.isPending} onClick={() => setRestoring(slot)}>
                          {t("photos.restore")}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {/* Mounted only while open, so the fields and the chosen file start fresh every time. */}
      {replacing && (
        <ReplaceDialog slot={replacing} current={data?.[replacing] ?? null} onClose={() => setReplacing(null)} />
      )}

      <AlertDialog open={restoring !== null} onOpenChange={(open) => { if (!open) setRestoring(null); }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("photos.restoreTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {restoring && t("photos.restoreBody", { slot: t(`photos.slot.${restoring}`) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => restoring && restore.mutate(restoring)}>
              {t("photos.restoreConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ReplaceDialog({ slot, current, onClose }: { slot: SiteImageSlot; current: SiteImageData | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [alt, setAlt] = useState({ en: current?.alt.en ?? "", fr: current?.alt.fr ?? "", ar: current?.alt.ar ?? "" });
  const [credit, setCredit] = useState(current?.credit ?? "");
  const [failure, setFailure] = useState<string | null>(null);
  const minWidth = SITE_IMAGE_MIN_WIDTH[slot];

  // The preview is a temporary address for the chosen file; release it when the file changes or the dialog closes.
  const objectUrl = useRef<string | null>(null);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  const choose = (chosen: File | null) => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = chosen ? URL.createObjectURL(chosen) : null;
    setPreviewUrl(objectUrl.current);
    setFile(chosen);
    setNaturalWidth(null);
    setUnreadable(false);
    setFailure(null);
  };

  // What can be told before uploading. The server checks all of it again, and also the pixel count and the real format.
  const fileProblem = !file ? null
    : file.size > SITE_IMAGE_MAX_BYTES ? translateCode(t, "err", "image_too_large", { maxMb: SITE_IMAGE_MAX_BYTES / 2 ** 20 })
      : file.type && !SITE_IMAGE_TYPES.includes(file.type) ? translateCode(t, "err", "image_type_not_allowed")
        : unreadable ? t("photos.unreadable")
          : naturalWidth !== null && naturalWidth < minWidth ? translateCode(t, "err", "image_too_small", { minWidth })
            : null;
  const complete = !!file && !fileProblem && !!alt.en.trim() && !!alt.fr.trim() && !!alt.ar.trim();

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set("file", file!);
      form.set("altEn", alt.en.trim());
      form.set("altFr", alt.fr.trim());
      form.set("altAr", alt.ar.trim());
      form.set("credit", credit.trim());
      return apiSiteImages.replace(slot, form);
    },
    onSuccess: () => {
      toast.success(t("photos.replaced"));
      onClose();
      return invalidateSiteImages(qc);
    },
    onError: (e) => setFailure(errorMessage(t, e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (complete && !upload.isPending) {
      setFailure(null);
      upload.mutate();
    }
  };

  const altFields: { lang: "en" | "fr" | "ar"; dir: "ltr" | "rtl" }[] = [
    { lang: "en", dir: "ltr" }, { lang: "fr", dir: "ltr" }, { lang: "ar", dir: "rtl" },
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !upload.isPending) onClose(); }}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto bg-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("photos.dialogTitle", { slot: t(`photos.slot.${slot}`) })}</DialogTitle>
          <DialogDescription>{t("photos.dialogSub")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="grid gap-5" aria-busy={upload.isPending}>
          <div className="space-y-2">
            <Label htmlFor="photo-file">{t("photos.file")}</Label>
            <Input
              id="photo-file" type="file" accept={SITE_IMAGE_TYPES.join(",")} className="h-auto py-2"
              aria-describedby="photo-file-help" aria-invalid={!!fileProblem || undefined}
              disabled={upload.isPending}
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
            />
            <p id="photo-file-help" className="text-xs text-muted-foreground">{t("photos.requirements", { min: minWidth })}</p>
            {fileProblem && <p role="alert" className="text-sm font-medium text-danger">{fileProblem}</p>}
            {file && previewUrl && !unreadable && (
              <img
                src={previewUrl} alt={t("photos.localPreview")}
                onLoad={(e) => setNaturalWidth(e.currentTarget.naturalWidth)}
                onError={() => setUnreadable(true)}
                className="mt-1 max-h-48 w-auto max-w-full rounded-sm border bg-surface object-contain"
              />
            )}
          </div>

          <fieldset className="grid gap-3">
            <legend className="sr-only">{t("photos.altHelp")}</legend>
            {altFields.map(({ lang, dir }) => (
              <div key={lang} className="space-y-2">
                <Label htmlFor={`photo-alt-${lang}`}>{t(`photos.alt${lang === "en" ? "En" : lang === "fr" ? "Fr" : "Ar"}`)}</Label>
                <Input
                  id={`photo-alt-${lang}`} dir={dir} lang={lang} autoComplete="off" required maxLength={SITE_IMAGE_TEXT_MAX}
                  value={alt[lang]} disabled={upload.isPending}
                  aria-describedby="photo-alt-help"
                  onChange={(e) => setAlt((a) => ({ ...a, [lang]: e.target.value }))}
                />
              </div>
            ))}
            <p id="photo-alt-help" className="text-xs text-muted-foreground">{t("photos.altHelp")}</p>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="photo-credit">{t("photos.credit")}</Label>
            <Input
              id="photo-credit" autoComplete="off" maxLength={SITE_IMAGE_TEXT_MAX} dir="auto"
              placeholder={t("photos.creditPlaceholder")} value={credit} disabled={upload.isPending}
              aria-describedby="photo-credit-help" onChange={(e) => setCredit(e.target.value)}
            />
            <p id="photo-credit-help" className="text-xs text-muted-foreground">{t("photos.creditHelp")}</p>
          </div>

          {failure && <p role="alert" className="text-sm font-medium text-danger">{failure}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={upload.isPending} onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={!complete || upload.isPending}>
              {upload.isPending ? t("photos.uploading") : t("photos.upload")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
