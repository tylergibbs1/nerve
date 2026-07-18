// shadcn/ui structure (new-york-v4: function components, data-slot hooks)
// with the tokenbase visual language: pill shape, luminance-step fills,
// hierarchy from weight and color. Focus comes from the app's single
// global sunset outline, so components declare no ring of their own.
// An invisible ::after grows the hit area on coarse pointers to 44x44
// (WCAG 2.5.5) without changing the visual size.
// FOOTGUN: two small buttons within ~16px of each other overlap hit
// areas on touch — the later-in-DOM one wins the tap.
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils.js"

const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium select-none transition-[color,background-color,border-color,transform] duration-200 motion-safe:active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border aria-invalid:border-destructive after:absolute after:inset-0 after:content-[''] pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background hover:bg-foreground/85",
        outline: "border border-border bg-transparent text-foreground hover:bg-muted",
        secondary:
          "bg-muted text-foreground hover:bg-[color-mix(in_oklch,var(--color-muted),var(--color-foreground)_6%)]",
        ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        accent: "bg-foreground text-background hover:bg-foreground/85",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "text-foreground underline-offset-4 hover:underline"
      },
      size: {
        default: "h-10 px-5 has-[>svg]:px-4",
        sm: "h-8 px-4 has-[>svg]:px-3",
        xs: "h-7 px-3.5 text-xs has-[>svg]:px-2.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-12 px-7 has-[>svg]:px-5",
        icon: "size-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

function Button({ className, variant = "default", size = "default", asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
