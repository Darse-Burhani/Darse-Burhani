"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:max-w-[420px]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-2xl border p-5 pr-8 shadow-xl backdrop-blur-md transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-slide-up data-[state=closed]:animate-fade-in data-[swipe=end]:animate-fade-out",
  {
    variants: {
      variant: {
        default: "border-slate-200/90 bg-white/95 text-slate-900 shadow-slate-900/5",
        destructive:
          "destructive group border-rose-300 bg-rose-50/95 text-rose-950 shadow-rose-900/10 font-error",
        success:
          "border-emerald-200/90 bg-emerald-50/95 text-emerald-950 shadow-emerald-900/5",
        warning:
          "border-amber-200/90 bg-amber-50/95 text-amber-950 shadow-amber-900/5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root>,
    VariantProps<typeof toastVariants> {
  onUndo?: () => void;
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  ToastProps
>(({ className, variant, onUndo, children, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      <div className="flex-1">{children}</div>
      {onUndo && (
        <button
          onClick={onUndo}
          className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 transition-colors font-info"
        >
          Undo
        </button>
      )}
      <ToastPrimitives.Close className="absolute right-2.5 top-2.5 rounded-xl p-1 text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500">
        <X className="h-4 w-4" />
      </ToastPrimitives.Close>
    </ToastPrimitives.Root>
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-bold font-heading tracking-tight", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs font-normal font-info opacity-90 leading-relaxed mt-0.5", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

export type ToastActionElement = React.ReactElement<typeof ToastPrimitives.Action>;

// Toast store — a single source of truth so multiple notifications stack
// instead of replacing each other, and each dismissal removes only its own toast.
let toastCount = 0;
const MAX_VISIBLE_TOASTS = 5;
const listeners = new Set<(state: ToastState) => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let toastState: ToastState = { toasts: [] };

interface ToastData {
  id?: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success" | "warning";
  duration?: number;
  onUndo?: () => void;
}

interface ToastState {
  toasts: ToastData[];
}

function emitToastState() {
  const snapshot: ToastState = { toasts: [...toastState.toasts] };
  listeners.forEach((listener) => listener(snapshot));
}

function dismissToast(id?: string) {
  if (!id) return;
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const next = toastState.toasts.filter((item) => item.id !== id);
  if (next.length === toastState.toasts.length) return;
  toastState = { toasts: next };
  emitToastState();
}

function toast(data: ToastData | string) {
  const payload: ToastData = typeof data === "string" ? { title: data } : data;
  const id = payload.id || `toast-${++toastCount}`;
  const newToast = { ...payload, id };

  toastState = {
    toasts: [...toastState.toasts, newToast].slice(-MAX_VISIBLE_TOASTS),
  };
  emitToastState();

  if (payload.duration !== Infinity) {
    timers.set(
      id,
      setTimeout(() => dismissToast(id), payload.duration ?? 4500),
    );
  }

  return id;
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: "success" });

toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: "destructive" });

toast.warning = (title: string, description?: string) =>
  toast({ title, description, variant: "warning" });

toast.info = (title: string, description?: string) =>
  toast({ title, description, variant: "default" });

toast.loading = (title: string, description?: string | { id?: string }) =>
  toast({ title, description: typeof description === "string" ? description : undefined, variant: "default", duration: 3000 });

toast.dismiss = dismissToast;

function useToast() {
  const [state, setState] = React.useState<ToastState>(toastState);

  React.useEffect(() => {
    listeners.add(setState);
    setState(toastState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return { ...state, toast };
}

function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          onUndo={t.onUndo}
          duration={Infinity}
          onOpenChange={(open) => {
            if (!open) dismissToast(t.id);
          }}
        >
          {t.title && <ToastTitle>{t.title}</ToastTitle>}
          {t.description && (
            <ToastDescription>{t.description}</ToastDescription>
          )}
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

export {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastProvider,
  ToastViewport,
  useToast,
  toast,
  Toaster,
};
