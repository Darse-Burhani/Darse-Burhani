import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "border-emerald-700/20 bg-emerald-50 text-emerald-900 shadow-[0_1px_2px_rgba(4,120,87,0.06)]",
        secondary:
          "border-slate-200/80 bg-slate-100 text-slate-800",
        destructive:
          "border-rose-200/80 bg-rose-50 text-rose-800 shadow-[0_1px_2px_rgba(225,29,72,0.06)]",
        success:
          "border-emerald-200/80 bg-emerald-50 text-emerald-800 shadow-[0_1px_2px_rgba(5,150,105,0.06)]",
        warning:
          "border-amber-200/80 bg-amber-50 text-amber-900 shadow-[0_1px_2px_rgba(217,119,6,0.06)]",
        outline:
          "border-slate-300/80 bg-white text-slate-700 shadow-2xs",
        bronze: "border-amber-700/30 tier-bronze",
        silver: "border-slate-400/30 tier-silver",
        gold: "border-amber-500/40 tier-gold shadow-[0_1px_4px_rgba(217,119,6,0.15)]",
        platinum: "border-cyan-400/30 tier-platinum",
        diamond: "border-sky-400/40 tier-diamond shadow-[0_1px_4px_rgba(56,189,248,0.2)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
