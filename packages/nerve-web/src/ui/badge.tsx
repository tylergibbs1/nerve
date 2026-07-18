// Ported from grayhavenindustries/components/ui/badge.tsx.
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils.js"

// Two-tier badge system (tokenbase): colored STATUS pills signal health —
// the thing you act on; muted META tags mark properties with no value color.
const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border border-transparent px-2 py-0.5 text-[11px] font-medium select-none transition-colors focus:outline-hidden focus:ring-1 focus:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        secondary: "bg-muted/60 text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        success: "border-success/30 bg-success/10 text-success",
        accent: "border-warning/30 bg-warning/10 text-warning",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive"
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
