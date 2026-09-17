import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = React.createContext<TabsContextType | null>(null);

export const Tabs = ({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (val: string) => void;
  children: React.ReactNode;
  className?: string;
}) => {
  const [internalTab, setInternalTab] = React.useState(defaultValue || "");
  const currentTab = value !== undefined ? value : internalTab;

  const handleTabChange = (val: string) => {
    if (value === undefined) setInternalTab(val);
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ activeTab: currentTab, setActiveTab: handleTabChange }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-slate-100/90 p-1 text-slate-600 border border-slate-200/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]",
        className
      )}
    >
      {children}
    </div>
  );
};

export const TabsTrigger = ({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) => {
  const ctx = React.useContext(TabsContext);
  const isActive = ctx?.activeTab === value;

  return (
    <button
      type="button"
      onClick={() => ctx?.setActiveTab(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold tracking-tight ring-offset-white transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
        isActive
          ? "bg-white text-emerald-950 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/80 font-bold"
          : "text-slate-600 hover:text-slate-900 hover:bg-white/60 active:scale-[0.98]",
        className
      )}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) => {
  const ctx = React.useContext(TabsContext);
  if (ctx?.activeTab !== value) return null;

  return <div className={cn("mt-2 ring-offset-white focus-visible:outline-none", className)}>{children}</div>;
};
