import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiBooks, apiCategories } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Book } from "@/types";

/** Library binding cloth colors used for generated covers of new books. */
const BINDINGS = ["#1F4D3A", "#6E2A2A", "#2B3F52", "#4A4E45", "#5C4630", "#29463F"];

/** Book editor: every field, category and (for existing books) a cover image upload. */
export function BookEditDialog({
  book, open, onOpenChange, onSaved,
}: {
  book: Book | null; // null → create mode
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { data: categories } = useApi(() => apiCategories.list(), []);
  const [form, setForm] = useState({
    title: "", author: "", isbn: "", publisher: "", year: "",
    totalCopies: "1", shelfLocation: "", description: "", categoryId: "",
  });
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: book?.title ?? "",
      author: book?.author ?? "",
      isbn: book?.isbn ?? "",
      publisher: book?.publisher ?? "",
      year: book?.year ? String(book.year) : "",
      totalCopies: book ? String(book.totalCopies) : "1",
      shelfLocation: book?.shelfLocation ?? "",
      description: book?.description ?? "",
      categoryId: book ? String(book.category.id) : "",
    });
    setCover(null);
  }, [open, book]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = form.title.trim() && form.author.trim() && form.isbn.trim() && form.categoryId;

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(), author: form.author.trim(), isbn: form.isbn.trim(),
        publisher: form.publisher.trim(), year: form.year ? parseInt(form.year) : null,
        totalCopies: Math.max(1, parseInt(form.totalCopies) || 1),
        shelfLocation: form.shelfLocation.trim(), description: form.description.trim(),
        categoryId: parseInt(form.categoryId),
      };
      if (book && cover) {
        // multipart path carries the image plus all text fields
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, String(v ?? "")));
        fd.append("coverImage", cover);
        await apiBooks.updateWithCover(book.id, fd);
      } else if (book) {
        await apiBooks.update(book.id, payload);
      } else {
        await apiBooks.create({ ...payload, coverColor: BINDINGS[Math.floor(Math.random() * BINDINGS.length)] });
      }
      toast.success(book ? t("toast.bookSaved") : t("toast.bookAdded"));
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  const req = <span className="text-danger" aria-hidden>*</span>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>{book ? t("edit.titleEdit") : t("edit.titleNew")}</DialogTitle>
        </DialogHeader>
        <form
          className="grid grid-cols-2 gap-4"
          onSubmit={(e) => { e.preventDefault(); if (valid) save(); }}
        >
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="bk-title">{t("field.title")} {req}</Label>
            <Input id="bk-title" required value={form.title} onChange={set("title")} />
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label htmlFor="bk-author">{t("field.author")} {req}</Label>
            <Input id="bk-author" required value={form.author} onChange={set("author")} />
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label htmlFor="bk-isbn">{t("field.isbn")} {req}</Label>
            <Input id="bk-isbn" required dir="ltr" value={form.isbn} onChange={set("isbn")} disabled={!!book} />
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label>{t("field.category")} {req}</Label>
            <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
              <SelectTrigger aria-label={t("field.category")}><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: c.color }} aria-hidden />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label htmlFor="bk-copies">{t("field.totalCopies")}</Label>
            <Input id="bk-copies" type="number" min={1} value={form.totalCopies} onChange={set("totalCopies")} />
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label htmlFor="bk-pub">{t("field.publisher")}</Label>
            <Input id="bk-pub" value={form.publisher} onChange={set("publisher")} />
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label htmlFor="bk-year">{t("field.year")}</Label>
            <Input id="bk-year" inputMode="numeric" value={form.year} onChange={set("year")} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="bk-shelf">{t("field.shelf")}</Label>
            <Input id="bk-shelf" dir="ltr" value={form.shelfLocation} onChange={set("shelfLocation")} placeholder="FIC-A-21" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="bk-desc">{t("field.description")}</Label>
            <Textarea id="bk-desc" rows={4} value={form.description} onChange={set("description")} />
          </div>
          {book && (
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="bk-cover">{t("field.cover")}</Label>
              <Input id="bk-cover" type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground">{t("edit.coverHelp")}</p>
            </div>
          )}
          <div className="col-span-2 flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={busy || !valid}>
              {busy ? t("edit.saving") : book ? t("edit.save") : t("edit.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
