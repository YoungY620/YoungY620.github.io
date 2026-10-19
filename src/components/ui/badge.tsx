import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Kanban Glass Badge — the board's category / priority labels.
// Soft-tinted pills in the board's multi-hue label palette (High / Medium / Low /
// Info / Grape), plus the indigo primary and neutral chips. Each colored variant
// is a low-alpha tint of its hue with a matching ink, the way the board's labels
// read on white cards.

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[var(--radius-sm)] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Neutral chip
        default:
          "bg-secondary text-secondary-foreground border border-border",
        secondary:
          "bg-muted text-muted-foreground border border-border",
        // Indigo accent
        primary: "bg-primary text-primary-foreground",
        outline: "border border-border text-foreground bg-transparent",
        // ── Board label hues ──
        high:
          "bg-[var(--label-high-soft)] text-[color:var(--label-high-ink)]",
        medium:
          "bg-[var(--label-medium-soft)] text-[color:var(--label-medium-ink)]",
        low:
          "bg-[var(--label-low-soft)] text-[color:var(--label-low-ink)]",
        info:
          "bg-[var(--label-info-soft)] text-[color:var(--label-info-ink)]",
        grape:
          "bg-[var(--label-grape-soft)] text-[color:var(--label-grape-ink)]",
        destructive: "bg-destructive text-destructive-foreground",
      },
      size: {
        sm: "h-5 gap-1 px-2 text-[0.6875rem] font-semibold",
        default: "h-6 gap-1.5 px-2.5 text-xs",
        lg: "h-7 gap-1.5 px-3 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
