/**
 * Shared table styling for staff lists: hairline rows, a quiet header, restrained hover.
 * Tabular figures come from the body; columns that hold numbers or dates just left-align under their header.
 */
export const tableCls = {
  wrap: "relative overflow-x-auto",
  table: "w-full min-w-[640px] border-collapse text-sm",
  th: "h-10 whitespace-nowrap border-b bg-surface/60 px-4 text-start text-[13px] font-medium text-muted-foreground",
  td: "border-b px-4 py-3.5 align-middle",
  row: "transition-colors hover:bg-surface/50 [&:last-child>td]:border-b-0",
};

/**
 * Opt-in phone layout for the desk's work queues: below `sm` each row becomes a short stack (header hidden,
 * cells one under another, the actions last) instead of a table that scrolls sideways and hides its buttons.
 * Add alongside the base classes: `cn(tableCls.td, tableCls.stack.cell)`.
 */
export const stackCls = {
  table: "max-sm:min-w-0",
  head: "max-sm:sr-only",
  row: "max-sm:block max-sm:border-b max-sm:px-4 max-sm:py-3.5 max-sm:last:border-b-0",
  cell: "max-sm:block max-sm:border-b-0 max-sm:px-0 max-sm:py-1",
  actions: "max-sm:justify-start max-sm:pt-2",
};
