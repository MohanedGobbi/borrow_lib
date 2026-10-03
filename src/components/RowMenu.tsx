import { useState } from "react";
import { FileText, MoreHorizontal } from "lucide-react";
import { useI18n } from "@/i18n";
import { RequestDocDialog } from "@/components/RequestDocButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BorrowRecord } from "@/types";

/**
 * The secondary actions of a desk row, kept out of the way so each row has one primary button.
 * Today that is the receipt; the dialog lives outside the menu so it survives the menu closing.
 */
export function RowMenu({ record }: { record: BorrowRecord }) {
  const { t } = useI18n();
  const [receipt, setReceipt] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-ink"
            aria-label={t("aria.moreActions", { title: record.bookTitle })}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setReceipt(true)}>
            <FileText className="size-4" aria-hidden /> {t("receipt.button")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RequestDocDialog record={record} open={receipt} onOpenChange={setReceipt} />
    </>
  );
}
