// Ported from grayhavenindustries/components/ui/textarea.tsx (box style).
import * as React from "react"
import { cn } from "../lib/utils.js"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full border border-border bg-background px-4 py-3 text-base font-normal text-foreground transition-colors duration-200",
          "placeholder:font-mono placeholder:text-sm placeholder:tracking-spec-wide placeholder:text-muted-foreground",
          "hover:border-muted-foreground",
          "focus-visible:outline-hidden focus-visible:border-accent",
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
