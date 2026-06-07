// Ported from grayhavenindustries/components/ui/badge.tsx.
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils.js"

const badgeVariants = cva(
  "inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-spec-wide transition-colors focus:outline-hidden focus:ring-1 focus:ring-ring",
  {
    variants: {
      variant: {
        default: "border-foreground/50 bg-transparent text-foreground",
        secondary: "border-border bg-transparent text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        accent: "border-accent bg-transparent text-accent",
        destructive: "border-destructive/50 bg-transparent text-destructive"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
