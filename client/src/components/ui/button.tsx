import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-semibold tracking-tight overflow-hidden select-none cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/80 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.965] active:translate-y-px hover:shadow-md",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white border border-emerald-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_3px_10px_0_rgba(2,44,34,0.22)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_24px_-4px_rgba(4,120,87,0.4)]",
        destructive:
          "bg-gradient-to-br from-rose-600 via-red-600 to-rose-700 text-white border border-rose-500/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_3px_10px_rgba(225,29,72,0.25)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_24px_-4px_rgba(225,29,72,0.4)]",
        outline:
          "border border-slate-200/90 bg-white/95 backdrop-blur-md text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:bg-slate-50 hover:border-emerald-500/60 hover:text-emerald-950 hover:shadow-[0_8px_20px_-2px_rgba(4,120,87,0.15)] hover:-translate-y-0.5",
        secondary:
          "bg-slate-100/95 hover:bg-slate-200/90 text-slate-800 border border-slate-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_3px_rgba(0,0,0,0.04)] hover:-translate-y-0.5",
        ghost:
          "text-slate-700 hover:bg-emerald-50/80 hover:text-emerald-950 active:bg-emerald-100/90",
        link:
          "text-emerald-800 underline-offset-4 hover:underline decoration-emerald-500/70 font-semibold",

        /* ── 2026 Fatimi Luxury Variants ── */
        "fatimi-gold":
          "bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white border border-amber-400/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_3px_12px_rgba(217,119,6,0.3)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.55),0_10px_26px_-4px_rgba(217,119,6,0.42)]",
        "fatimi-emerald":
          "bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white border border-emerald-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_3px_10px_0_rgba(2,44,34,0.22)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_24px_-4px_rgba(4,120,87,0.4)]",
        "fatimi-lapis":
          "bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white border border-indigo-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_3px_10px_rgba(79,70,229,0.25)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_24px_-4px_rgba(79,70,229,0.4)]",
        "fatimi-yaqoot":
          "bg-gradient-to-br from-rose-700 via-rose-800 to-slate-900 text-white border border-rose-600/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_3px_10px_rgba(225,29,72,0.25)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_24px_-4px_rgba(225,29,72,0.4)]",
        "fatimi-subtle":
          "bg-white/95 border border-slate-200/90 text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-amber-400/70 hover:bg-amber-50/40 hover:text-slate-950 hover:shadow-[0_8px_20px_-2px_rgba(217,119,6,0.15)] hover:-translate-y-0.5 font-medium",
        glass:
          "bg-white/15 backdrop-blur-md text-white border border-white/25 shadow-[0_2px_10px_rgba(0,0,0,0.15)] hover:bg-white/25 hover:border-white/40 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.2)]",

        /* ── Unified Portal Aliases ── */
        admin:
          "bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white border border-emerald-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_3px_10px_0_rgba(2,44,34,0.22)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_24px_-4px_rgba(4,120,87,0.4)]",
        teacher:
          "bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white border border-emerald-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_3px_10px_0_rgba(2,44,34,0.22)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_24px_-4px_rgba(4,120,87,0.4)]",
        student:
          "bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white border border-emerald-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_3px_10px_0_rgba(2,44,34,0.22)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_24px_-4px_rgba(4,120,87,0.4)]",
        parent:
          "bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white border border-emerald-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_3px_10px_0_rgba(2,44,34,0.22)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_24px_-4px_rgba(4,120,87,0.4)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-xl px-3 text-xs gap-1.5",
        lg: "h-11 rounded-2xl px-7 text-sm font-bold gap-2",
        xl: "h-12 rounded-2xl px-9 text-base font-bold gap-2.5",
        icon: "h-10 w-10 rounded-2xl p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          "group",
          // Light shimmer sweep animation on hover
          "before:absolute before:inset-0 before:-translate-x-full before:hover:translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent before:transition-transform before:duration-700 before:pointer-events-none"
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-30"></span>
              <svg
                className="animate-spin relative inline-flex h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3.5"
                />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </span>
            <span>Loading...</span>
          </span>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
