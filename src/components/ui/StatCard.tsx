'use client';

import Link from "next/link"
import React from "react"
import { cn } from "@/lib/utils"
import { TactileCard, TactileCardProps } from "./TactileCard"
import { Badge } from "./badge"

interface StatCardProps extends Omit<TactileCardProps, 'variant'> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    positive?: boolean;
  };
  description?: string;
  variant?: "flat" | "elevated" | "premium";
  colorScheme?: "default" | "kinetic" | "success" | "destructive";
  href?: string;
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, label, value, icon, trend, description, variant = "elevated", colorScheme = "default", href, ...props }, ref) => {
    
    const CardContent = () => {
      if (variant === "premium") {
        return (
          <TactileCard
            ref={ref}
            variant="elevated"
            className={cn(
              "p-8 flex flex-col justify-between group transition-all duration-300 relative overflow-hidden h-full",
              colorScheme === "kinetic" && "bg-kinetic-orange/[0.03] hover:bg-kinetic-orange/[0.06]",
              colorScheme === "success" && "bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06]",
              href && "cursor-pointer",
              className
            )}
            {...props}
          >
            {/* Header & Icon */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] block">
                  {label}
                </span>
              </div>
              {icon && (
                <div className={cn(
                  "w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/20 transition-colors group-hover:bg-white/10",
                  colorScheme === "kinetic" && "text-kinetic-orange/40 group-hover:text-kinetic-orange/60",
                  colorScheme === "success" && "text-emerald-500/40 group-hover:text-emerald-500/60"
                )}>
                  {React.cloneElement(icon as React.ReactElement, { size: 14 })}
                </div>
              )}
            </div>

            {/* Main Value */}
            <div className="mt-8 mb-6">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black text-white tracking-tighter">
                  {value}
                </span>
                {trend && (
                  <Badge variant="outline" className={cn(
                    "h-5 text-[8px] font-black border-none uppercase tracking-widest",
                    trend.positive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-500"
                  )}>
                    {trend.positive ? "+" : "-"}{trend.value}
                  </Badge>
                )}
              </div>
            </div>

            {/* Footer Description */}
            <div className="flex items-center gap-2">
               {description && (
                  <span className="text-[9px] font-bold uppercase text-white/20 tracking-widest">
                    {description}
                  </span>
               )}
            </div>
            
            {/* Hover Indicator */}
            {href && (
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-1.5 h-1.5 rounded-full bg-kinetic-orange shadow-glow-orange" />
              </div>
            )}
          </TactileCard>
        );
      }

      return (
        <TactileCard
          ref={ref}
          variant={variant}
          className={cn(
            "p-5 flex flex-col justify-between group transition-all duration-300 h-full",
            colorScheme === "kinetic" && "border-kinetic-orange/10 bg-kinetic-orange/[0.03] hover:bg-kinetic-orange/[0.06]",
            colorScheme === "success" && "border-emerald-500/10 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06]",
            colorScheme === "destructive" && "border-red-500/10 bg-red-500/[0.03] hover:bg-red-500/[0.06]",
            href && "cursor-pointer",
            className
          )}
          {...props}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em]">
              {label}
            </span>
            {icon && (
              <div className={cn(
                "p-2 rounded-lg bg-white/5 border border-white/5 shadow-skeuo-flat group-hover:shadow-glow-orange/10 transition-all",
                colorScheme === "kinetic" && "text-kinetic-orange",
                colorScheme === "success" && "text-emerald-500",
                colorScheme === "destructive" && "text-red-500",
                colorScheme === "default" && "text-white/40"
              )}>
                {icon}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black italic text-white/90 font-headline tracking-tight">
                {value}
              </span>
              {trend && (
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-tight",
                  trend.positive ? "text-emerald-500" : "text-red-500"
                )}>
                  {trend.positive ? "↑" : "↓"} {trend.value}
                </span>
              )}
            </div>
            {description && (
              <p className="text-[9px] font-bold uppercase text-white/20 tracking-widest italic">
                {description}
              </p>
            )}
          </div>
          
          {/* Hover Indicator */}
          {href && (
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-1 h-1 rounded-full bg-kinetic-orange shadow-glow-orange" />
            </div>
          )}
        </TactileCard>
      );
    };

    if (href) {
      return (
        <Link href={href} className="block h-full">
          <CardContent />
        </Link>
      );
    }

    return <CardContent />;
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
