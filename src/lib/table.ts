/** Shared table styling for staff lists (Linear / GitHub density). */
export const tableCls = {
  wrap: "relative overflow-x-auto",
  table: "w-full min-w-[640px] border-collapse text-sm",
  th: "h-10 whitespace-nowrap border-b bg-surface px-4 text-start text-xs font-medium text-muted-foreground",
  td: "border-b px-4 py-3 align-middle",
  row: "transition-colors hover:bg-surface/60 [&:last-child>td]:border-b-0",
};
