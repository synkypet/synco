import * as React from "react"
import { cn } from "@/lib/utils"

export interface TactileCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "flat" | "elevated"
}

const TactileCard = React.forwardRef<HTMLDivElement, TactileCardProps>(
  ({ className, variant = "elevated", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl bg-anthracite-surface transition-all duration-300",
          variant === "elevated" ? "shadow-skeuo-elevated" : "shadow-skeuo-flat",
          "border-none glass-edge", // No-Line rule + Glass depth
          className
        )}
        {...props}
      />
    )
  }
)
TactileCard.displayName = "TactileCard"

export { TactileCard }
