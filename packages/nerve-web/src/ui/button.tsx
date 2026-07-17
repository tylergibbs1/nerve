// Ported from grayhavenindustries/components/ui/button.tsx (the real design
// system). Deliberate deviations from source, all behavior-improving here:
// - added `xs` size for tool-density surfaces
// - default variant hovers bg-accent-hover (source hover:bg-accent is a
//   white-on-white no-op in this all-white-accent theme)
// - secondary/ghost text-muted-foreground (calmer chrome; source uses
//   foreground), destructive text-background (value-identical)
// - added cursor-pointer (Tailwind v4 preflight defaults to cursor:default)
// - removed `glass` variant and `touch-target` (utility not ported)
// - sans medium instead of the source's mono-uppercase voice: label
//   hierarchy comes from weight and color; mono is reserved for code/IDs
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils.js"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.96] motion-reduce:active:scale-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background hover:bg-accent-hover hover:text-background",
        outline:
          "border border-foreground bg-transparent text-foreground hover:border-accent hover:text-accent",
        secondary:
          "border border-border bg-transparent text-muted-foreground hover:border-accent hover:text-accent",
        ghost: "bg-transparent text-muted-foreground hover:text-accent",
        accent: "bg-accent text-background hover:bg-accent-hover",
        destructive: "bg-destructive text-background hover:bg-destructive/90",
        link: "text-foreground underline-offset-4 hover:underline hover:text-accent"
      },
      size: {
        default: "h-12 px-8 py-3",
        sm: "h-10 px-6",
        xs: "h-7 px-3.5 text-xs",
        lg: "h-14 px-12",
        icon: "size-12"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
