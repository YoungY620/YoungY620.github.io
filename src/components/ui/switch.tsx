import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { springInteraction } from "@/lib/motion"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-[1.5rem] w-[2.75rem] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-disabled:opacity-50 data-unchecked:bg-input data-checked:bg-primary data-checked:shadow-[var(--shadow-primary-inset-sm)]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        render={
          <motion.span
            layout
            transition={springInteraction}
            className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-[var(--shadow-xs)] ring-0 data-checked:translate-x-5 data-unchecked:translate-x-0"
          />
        }
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
