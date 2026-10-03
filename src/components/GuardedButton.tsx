import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A Button that can say why it does nothing. With a `reason` it stays focusable (`aria-disabled`, not
 * `disabled`), ignores clicks, and shows the reason in a tooltip on hover and focus; screen readers get it
 * as the button's description. Without a `reason` it is an ordinary Button.
 */
export function GuardedButton({
  reason, className, onClick, ...props
}: ComponentProps<typeof Button> & { reason?: string }) {
  const reasonId = useId();
  if (!reason) return <Button className={className} onClick={onClick} {...props} />;
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            {...props}
            aria-disabled="true"
            aria-describedby={reasonId}
            className={cn("cursor-not-allowed opacity-50", className)}
            onClick={(e) => e.preventDefault()}
          />
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{reason}</TooltipContent>
      </Tooltip>
      <span id={reasonId} className="sr-only">{reason}</span>
    </>
  );
}
