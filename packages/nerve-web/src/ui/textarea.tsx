// Tokenbase filled textarea: quiet fill, no border, ring on focus.
import * as React from "react"
import { cn } from "../lib/utils.js"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full rounded-lg border border-transparent bg-input/50 px-3 py-2 text-sm font-normal text-foreground transition-[color,background-color,box-shadow] duration-200",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
