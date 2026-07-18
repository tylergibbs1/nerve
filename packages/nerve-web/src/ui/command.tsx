// shadcn/ui command (cmdk) slimmed to what the workspace search needs —
// input, list, empty, item — with the tokenbase look. cmdk owns the
// combobox semantics: roving selection, arrow keys, enter to select.
import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "../lib/utils.js"

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn("flex w-full flex-col overflow-hidden", className)}
      {...props}
    />
  )
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <CommandPrimitive.Input
      data-slot="command-input"
      className={cn(
        "flex w-full min-w-0 rounded-full border border-transparent bg-input/50 px-3 text-sm font-normal text-foreground transition-[background-color] duration-100 placeholder:text-muted-foreground disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("overflow-x-hidden overflow-y-auto", className)}
      {...props}
    />
  )
}

function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="py-4 text-center text-xs text-muted-foreground"
      {...props}
    />
  )
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 font-mono text-[11px] text-foreground select-none data-[selected=true]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandItem }
