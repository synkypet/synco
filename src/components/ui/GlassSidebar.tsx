import * as React from "react"
import { cn } from "@/lib/utils"

export interface GlassSidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

const GlassSidebar = React.forwardRef<HTMLDivElement, GlassSidebarProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <aside
        ref={ref}
        className={cn(
          "h-full w-[280px] bg-deep-void/80 backdrop-blur-xl transition-all duration-300",
          "shadow-[8px_0_32px_rgba(0,0,0,0.6)]", // Strong right elevation
          "border-none relative z-50", // No-Line rule
          className
        )}
        {...props}
      >
        {/* Subtle inner highlight to simulate glass edge depth without 1px border */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-white/5 to-transparent w-[1px]" />
        
        <div className="relative h-full flex flex-col">
          {children}
        </div>
      </aside>
    )
  }
)
GlassSidebar.displayName = "GlassSidebar"

export { GlassSidebar }
