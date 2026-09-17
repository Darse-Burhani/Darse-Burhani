import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  labels: Record<string, React.ReactNode>;
  registerLabel: (value: string, label: React.ReactNode) => void;
}

const SelectContext = React.createContext<SelectContextType | null>(null);

export const Select = ({
  value,
  onValueChange,
  children,
  defaultValue,
  className,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  defaultValue?: string;
  className?: string;
}) => {
  const [internalVal, setInternalVal] = React.useState(defaultValue || "");
  const [open, setOpen] = React.useState(false);
  const [labels, setLabels] = React.useState<Record<string, React.ReactNode>>({});
  const currentVal = value !== undefined ? value : internalVal;

  const registerLabel = React.useCallback((val: string, label: React.ReactNode) => {
    setLabels((prev) => {
      if (prev[val] === label) return prev;
      return { ...prev, [val]: label };
    });
  }, []);

  const handleSelect = (v: string) => {
    if (value === undefined) setInternalVal(v);
    onValueChange?.(v);
    setOpen(false);
  };

  return (
    <SelectContext.Provider value={{ value: currentVal, onValueChange: handleSelect, open, setOpen, labels, registerLabel }}>
      <div className={cn("relative inline-block w-full", className)}>{children}</div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const ctx = React.useContext(SelectContext);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => ctx?.setOpen(!ctx.open)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d4af37] disabled:cursor-not-allowed disabled:opacity-50 text-left",
        className
      )}
      {...props}
    >
      <div className="flex-1 truncate">{children}</div>
      <svg className="w-4 h-4 text-gray-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

export const SelectValue = ({ placeholder, children }: { placeholder?: string; children?: React.ReactNode }) => {
  const ctx = React.useContext(SelectContext);
  if (children) {
    return <span className="truncate">{children}</span>;
  }
  const registered = ctx?.value ? ctx.labels[ctx.value] : null;
  const displayText = registered || (ctx?.value ? ctx.value : null) || placeholder || "";
  
  const isPlaceholder = !registered && !ctx?.value;
  return (
    <span className={cn("truncate block", isPlaceholder ? "text-gray-400" : "text-gray-900 font-medium")}>
      {displayText}
    </span>
  );
};

export const SelectContent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const ctx = React.useContext(SelectContext);
  if (!ctx?.open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => ctx.setOpen(false)} />
      <div
        className={cn(
          "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white p-1 text-gray-800 shadow-xl animate-in fade-in-80",
          className
        )}
      >
        {children}
      </div>
    </>
  );
};

export const SelectItem = ({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) => {
  const ctx = React.useContext(SelectContext);
  const isSelected = ctx?.value === value;

  React.useEffect(() => {
    ctx?.registerLabel(value, children);
  }, [value, children, ctx]);

  return (
    <div
      onClick={() => ctx?.onValueChange?.(value)}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 px-3 text-sm outline-none transition-colors hover:bg-amber-50 hover:text-amber-900",
        isSelected && "bg-amber-100 font-semibold text-amber-900",
        className
      )}
    >
      {children}
    </div>
  );
};

