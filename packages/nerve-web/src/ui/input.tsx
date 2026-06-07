// Ported from grayhavenindustries/components/ui/input.tsx (underline style).
import * as React from "react"
import { cn } from "../lib/utils.js"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full border-0 border-b-2 border-border bg-transparent px-0 py-3 text-base font-normal text-foreground transition-colors duration-200",
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
Input.displayName = "Input"

export { Input }
