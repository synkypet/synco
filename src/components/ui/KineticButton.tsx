import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

export interface KineticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

const KineticButton = React.forwardRef<HTMLButtonElement, KineticButtonProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
          "bg-kinetic-orange text-white shadow-glow-orange hover:shadow-glow-orange-intense active:shadow-skeuo-pressed",
          "border-none outline-none focus-visible:ring-2 focus-visible:ring-kinetic-orange focus-visible:ring-offset-2", // No-Line rule + Accessibility
          className
        )}
        {...props}
      />
    )
  }
)
KineticButton.displayName = "KineticButton"

export { KineticButton }
