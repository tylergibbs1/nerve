// shadcn/ui structure with the tokenbase filled-input look: quiet fill,
// no border; focus comes from the global sunset outline.
import * as React from "react"
import { cn } from "../lib/utils.js"

export type InputProps = React.ComponentProps<"input">

function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-full border border-transparent bg-input/50 px-3 py-1 text-sm font-normal text-foreground transition-[color,background-color] duration-200",
        "file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
