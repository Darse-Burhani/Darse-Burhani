import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "glass" | "gradient" | "premium" }
>(({ className, variant = "default", ...props }, ref) => {
  const variantStyles = {
    default:
      "rounded-3xl sm:rounded-[1.75rem] border border-amber-200/35 bg-white shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.9),0_4px_20px_-2px_rgba(6,78,59,0.04),0_2px_6px_-1px_rgba(212,175,55,0.06)] hover:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_14px_34px_-4px_rgba(6,78,59,0.08),0_6px_14px_-2px_rgba(212,175,55,0.16)] hover:border-amber-300/65 hover:-translate-y-0.5 transition-smooth",
    glass:
      "rounded-3xl sm:rounded-[1.75rem] border border-white/40 bg-white/75 backdrop-blur-xl shadow-[0_4px_20px_rgba(6,78,59,0.05)] hover:shadow-[0_12px_30px_rgba(6,78,59,0.1)] hover:bg-white/85 transition-smooth",
    gradient:
      "rounded-3xl sm:rounded-[1.75rem] border border-amber-200/30 bg-gradient-to-br from-white via-amber-50/20 to-emerald-50/15 shadow-[0_4px_20px_-2px_rgba(6,78,59,0.04)] hover:shadow-[0_12px_30px_-4px_rgba(6,78,59,0.09)] transition-smooth",
    premium:
      "rounded-3xl sm:rounded-[1.75rem] border border-amber-200/50 bg-white shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),0_6px_24px_-2px_rgba(6,78,59,0.06),0_3px_8px_-1px_rgba(212,175,55,0.12)] hover:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.98),0_18px_40px_-4px_rgba(6,78,59,0.11),0_8px_18px_-2px_rgba(212,175,55,0.22)] hover:border-amber-300/80 transition-smooth hover:-translate-y-1",
  };

  return (
    <div
      ref={ref}
      className={cn(variantStyles[variant], className)}
      {...props}
    />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6 pb-4", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-base sm:text-lg font-bold font-heading leading-snug tracking-tight text-slate-900",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs sm:text-sm font-info text-slate-500 leading-relaxed", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0 font-info", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
