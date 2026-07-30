import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiBooks, apiCategories } from "@/api";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Book } from "@/types";

/** Full book editor: all fields, description, category, cover image upload. */
export function BookEditDialog({
  book,
  open,
  onOpenChange,
  onSaved,
}: {
  book: Book | null; // null → create mode
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { data: categories } = useApi(() => apiCategories.list(), []);
  const [form, setForm] = useState({
    title: "", author: "", isbn: "", publisher: "", year: "",
    totalCopies: "1", shelfLocation: "", description: "", categoryId: "",
  });
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
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
    }
  }, [open, book]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

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
        await apiBooks.create({ ...payload, coverColor: ["#C55221", "#CC8800", "#111827", "#3E5C76", "#2F6B4F"][Math.floor(Math.random() * 5)] });
      }
      toast.success(book ? "Book updated." : "Book added to the catalog.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>{book ? `Edit · ${book.title}` : "Add a new book"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Title *</Label>
            <Input value={form.title} onChange={set("title")} />
          </div>
          <div className="space-y-1">
            <Label>Author *</Label>
            <Input value={form.author} onChange={set("author")} />
          </div>
          <div className="space-y-1">
            <Label>ISBN *</Label>
            <Input value={form.isbn} onChange={set("isbn")} disabled={!!book} />
          </div>
          <div className="space-y-1">
            <Label>Category *</Label>
            <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Total copies</Label>
            <Input type="number" min={1} value={form.totalCopies} onChange={set("totalCopies")} />
          </div>
          <div className="space-y-1">
            <Label>Publisher</Label>
            <Input value={form.publisher} onChange={set("publisher")} />
          </div>
          <div className="space-y-1">
            <Label>Year</Label>
            <Input value={form.year} onChange={set("year")} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Shelf location</Label>
            <Input value={form.shelfLocation} onChange={set("shelfLocation")} placeholder="FIC-A-21" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Description (shown on the book page)</Label>
            <Textarea rows={4} value={form.description} onChange={set("description")} />
          </div>
          {book && (
            <div className="col-span-2 space-y-1">
              <Label>Cover image (replaces the letter cover)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
            </div>
          )}
          <Button
            className="col-span-2 bg-burnt text-white hover:bg-burnt-dark"
            disabled={busy || !form.title.trim() || !form.author.trim() || !form.isbn.trim() || !form.categoryId}
            onClick={save}
          >
            {busy ? "Saving…" : book ? "Save changes" : "Add book"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
