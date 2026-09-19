import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-semibold tracking-tight transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] select-none cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white border border-emerald-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_2px_8px_0_rgba(2,44,34,0.18)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_8px_20px_-4px_rgba(4,120,87,0.35)]",
        destructive:
          "bg-gradient-to-br from-rose-600 via-red-600 to-rose-700 text-white border border-rose-500/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_2px_8px_rgba(225,29,72,0.2)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_8px_20px_-4px_rgba(225,29,72,0.35)]",
        outline:
          "border border-slate-200/90 bg-white/90 backdrop-blur-md text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-slate-50 hover:border-emerald-500/50 hover:text-emerald-950 hover:shadow-[0_6px_18px_-2px_rgba(4,120,87,0.12)] hover:-translate-y-0.5",
        secondary:
          "bg-slate-100/90 hover:bg-slate-200/90 text-slate-800 border border-slate-200/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.03)] hover:-translate-y-0.5",
        ghost:
          "text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-950 active:bg-emerald-100/80",
        link:
          "text-emerald-800 underline-offset-4 hover:underline decoration-emerald-500/60 font-semibold",

        /* ── Fatimi Luxury Variants ── */
        "fatimi-gold":
          "bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white border border-amber-400/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_2px_8px_rgba(217,119,6,0.25)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_8px_22px_-4px_rgba(217,119,6,0.38)]",
        "fatimi-emerald":
          "bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white border border-emerald-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_2px_8px_0_rgba(2,44,34,0.18)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_8px_20px_-4px_rgba(4,120,87,0.35)]",
        "fatimi-lapis":
          "bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white border border-indigo-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_2px_8px_rgba(79,70,229,0.2)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_8px_20px_-4px_rgba(79,70,229,0.35)]",
        "fatimi-yaqoot":
          "bg-gradient-to-br from-rose-700 via-rose-800 to-slate-900 text-white border border-rose-600/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_2px_8px_rgba(225,29,72,0.2)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_8px_20px_-4px_rgba(225,29,72,0.35)]",
        "fatimi-subtle":
          "bg-white/90 border border-slate-200/90 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-amber-400/60 hover:bg-amber-50/30 hover:text-slate-950 hover:shadow-[0_6px_18px_-2px_rgba(217,119,6,0.12)] hover:-translate-y-0.5 font-medium",

        /* ── Unified Portal Aliases ── */
        admin:
          "bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white border border-emerald-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_2px_8px_0_rgba(2,44,34,0.18)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_8px_20px_-4px_rgba(4,120,87,0.35)]",
        teacher:
          "bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white border border-emerald-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_2px_8px_0_rgba(2,44,34,0.18)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_8px_20px_-4px_rgba(4,120,87,0.35)]",
        student:
          "bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white border border-emerald-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_2px_8px_0_rgba(2,44,34,0.18)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_8px_20px_-4px_rgba(4,120,87,0.35)]",
        parent:
          "bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white border border-emerald-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_2px_8px_0_rgba(2,44,34,0.18)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_8px_20px_-4px_rgba(4,120,87,0.35)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-xl px-3 text-xs",
        lg: "h-11 rounded-2xl px-7 text-sm font-bold",
        xl: "h-12 rounded-2xl px-9 text-base font-bold",
        icon: "h-10 w-10 rounded-2xl",
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
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
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
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading...
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
