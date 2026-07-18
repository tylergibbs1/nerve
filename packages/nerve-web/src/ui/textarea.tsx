// shadcn/ui structure with the tokenbase filled look; field-sizing-content
// lets the box grow with its content unless a caller fixes the height.
import * as React from "react"
import { cn } from "../lib/utils.js"

export type TextareaProps = React.ComponentProps<"textarea">

function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-transparent bg-input/50 px-3 py-2 text-sm font-normal text-foreground transition-[color,background-color] duration-200",
        "placeholder:text-muted-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
