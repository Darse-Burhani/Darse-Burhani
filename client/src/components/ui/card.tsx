import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "glass" | "gradient" | "premium" }
>(({ className, variant = "default", ...props }, ref) => {
  const variantStyles = {
    default:
      "rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-xs hover:shadow-md hover:border-emerald-300/80 hover:-translate-y-0.5 transition-all duration-200",
    glass:
      "rounded-2xl sm:rounded-3xl border border-slate-200/60 bg-white/80 backdrop-blur-xl shadow-xs hover:shadow-md hover:bg-white/95 hover:border-emerald-300/80 transition-all duration-200",
    gradient:
      "rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 shadow-xs hover:shadow-md hover:border-emerald-300/80 transition-all duration-200",
    premium:
      "rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-sm hover:shadow-lg hover:border-emerald-400/80 hover:-translate-y-1 transition-all duration-200",
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
