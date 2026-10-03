import { Search } from "lucide-react";
import { useI18n } from "@/i18n";
import { Input } from "@/components/ui/input";

/** Filter box for a staff queue: matches member, student ID, book title, ISBN and shelf mark on the server. */
export function QueueFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="relative w-96 max-w-full">
      <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={t("desk.filter")} aria-label={t("desk.filter")} className="h-9 ps-8"
      />
    </div>
  );
}
