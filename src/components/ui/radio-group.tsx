import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"
import { springInteraction } from "@/lib/motion"

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive data-slot="radio-group" className={cn("grid gap-2", className)} {...props} />
  )
}
RadioGroup.displayName = "RadioGroup"

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "aspect-square h-[1.125rem] w-[1.125rem] rounded-full border border-border bg-card text-primary-foreground ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 transition-colors data-checked:bg-primary data-checked:border-primary data-checked:shadow-[var(--shadow-primary-inset-sm)]",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        keepMounted
        className="size-full relative flex items-center justify-center"
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>
            <AnimatePresence initial={false}>
              {state.checked && (
                <motion.div
                  key="dot"
                  className="absolute top-1/2 left-1/2 h-[0.4375rem] w-[0.4375rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={springInteraction}
                />
              )}
            </AnimatePresence>
          </span>
        )}
      />
    </RadioPrimitive.Root>
  )
}
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
