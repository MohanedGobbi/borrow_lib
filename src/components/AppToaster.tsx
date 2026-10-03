import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { Toaster } from "sonner";
import { useI18n } from "@/i18n";

/**
 * The app's transient messages, in the system's own tokens: white surface, hairline border, 6px radius,
 * a leading icon in green (success) or red (error), and the Undo action as a secondary button.
 * They sit at the end of the reading direction: bottom-right in LTR, bottom-left in RTL.
 */
export function AppToaster() {
  const { dir } = useI18n();
  return (
    <Toaster
      position={dir === "rtl" ? "bottom-left" : "bottom-right"}
      dir={dir}
      icons={{
        success: <CheckCircle2 className="size-[18px] text-brand" aria-hidden />,
        error: <AlertCircle className="size-[18px] text-danger" aria-hidden />,
        warning: <TriangleAlert className="size-[18px] text-ink" aria-hidden />,
        info: <Info className="size-[18px] text-brand" aria-hidden />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-lg border border-border bg-white p-4 text-[15px] text-ink shadow-[0_1px_3px_rgb(16_24_20/0.06)]",
          icon: "flex shrink-0 items-center",
          content: "flex-1",
          title: "font-medium",
          description: "text-sm text-muted-foreground",
          actionButton:
            "ms-auto inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-secondary px-3.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80",
          cancelButton:
            "inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-white px-3.5 text-sm font-medium text-ink hover:bg-secondary",
        },
      }}
    />
  );
}
