"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Home,
  Star,
  Moon,
  Sun,
  Heart,
  BookOpen,
  Loader2,
  Clock,
  Sparkles,
  ListChecks,
  CalendarRange,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const eventColors: Record<string, string> = {
  eid: "bg-emerald-500",
  milad: "bg-amber-500",
  urs: "bg-indigo-500",
  commemoration: "bg-red-500",
  fast: "bg-cyan-500",
  observance: "bg-purple-500",
};

const eventBgColors: Record<string, string> = {
  eid: "bg-emerald-50 border-emerald-200",
  milad: "bg-amber-50 border-amber-200",
  urs: "bg-indigo-50 border-indigo-200",
  commemoration: "bg-red-50 border-red-200",
  fast: "bg-cyan-50 border-cyan-200",
  observance: "bg-purple-50 border-purple-200",
};

const eventTextColors: Record<string, string> = {
  eid: "text-emerald-700",
  milad: "text-amber-700",
  urs: "text-indigo-700",
  commemoration: "text-red-700",
  fast: "text-cyan-700",
  observance: "text-purple-700",
};

const eventIcons: Record<string, React.ElementType> = {
  eid: Star,
  milad: Heart,
  urs: BookOpen,
  commemoration: Moon,
  fast: Sun,
  observance: Clock,
};

const typeLabel: Record<string, string> = {
  eid: "Eid",
  milad: "Milad",
  urs: "Urs",
  commemoration: "Commemoration",
  fast: "Fasting",
  observance: "Observance",
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayNamesAr = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function EventIcon({ type, className }: { type: string; className?: string }) {
  const Icon = eventIcons[type] || Star;
  return <Icon className={className} />;
}

export default function FatimiCalendarPage() {
  const { data: session } = useSession();
  const dashboardHref =
    session?.user?.role === "STUDENT"
      ? "/talabat"
      : session?.user?.role
        ? `/${session.user.role.toLowerCase()}`
        : "/login";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hy, setHy] = useState(0);
  const [hm, setHm] = useState(0);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (hy > 0) params.set("hy", String(hy));
      if (hm > 0) params.set("hm", String(hm));
      const res = await fetch(`/api/fatimi-calendar?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [hy, hm]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const goNextMonth = () => {
    if (!data?.navigation?.next) return;
    setHy(data.navigation.next.year);
    setHm(data.navigation.next.month);
  };

  const goPrevMonth = () => {
    if (!data?.navigation?.prev) return;
    setHy(data.navigation.prev.year);
    setHm(data.navigation.prev.month);
  };

  const goNextYear = () => {
    const y = (data?.month?.year || 0) + 1;
    setHy(y);
    if (hm > 0) setHm(hm);
  };

  const goPrevYear = () => {
    const y = (data?.month?.year || 0) - 1;
    setHy(y);
    if (hm > 0) setHm(hm);
  };

  const goToToday = () => {
    setHy(0);
    setHm(0);
  };

  const jumpToMonth = (month: number) => {
    setHy(data?.month?.year || 0);
    setHm(month);
    setYearPickerOpen(false);
  };

  const jumpToYear = (year: number) => {
    setHy(year);
    if (hm > 0) setHm(hm);
    setYearPickerOpen(false);
  };

  const month = data?.month;
  const today = data?.today;
  const upcoming = data?.upcoming || [];
  const yearEvents = data?.yearEvents || [];
  const months = data?.months || [];

  const years = useMemo(() => {
    if (!month?.year) return [];
    const y = month.year;
    return Array.from({ length: 25 }, (_, i) => y - 12 + i);
  }, [month?.year]);

  const selectedDayEvents = selectedDay?.events || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="fatimi-header-banner" style={{ background: "linear-gradient(135deg, #064e3b 0%, #0d9488 100%)" }}>
          <div className="absolute top-0 left-0 w-32 h-32 opacity-10">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path d="M50 5L95 50L50 95L5 50Z" fill="none" stroke="#d4af37" strokeWidth="1" />
              <circle cx="50" cy="50" r="25" fill="none" stroke="#d4af37" strokeWidth="0.5" />
            </svg>
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }}>
                <CalendarDays className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white" style={{ letterSpacing: "-0.02em" }}>
                  Darse Burhani Calendar
                </h1>
                <p className="text-emerald-50 text-sm mt-1 flex items-center gap-2">
                  {today ? `${today.hijri.monthName} ${today.hijri.day}, ${today.hijri.year} AH` : "Dawoodi Bohra Hijri Calendar"}
                  {today?.hijri?.monthNameAr && (
                    <span className="font-arabic text-teal-200/90" dir="rtl">{today.hijri.monthNameAr}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to={dashboardHref}>
                <Button
                  size="sm"
                  className="bg-white/20 text-white hover:bg-white/30 backdrop-blur"
                >
                  <Home className="w-4 h-4 mr-1" /> Dashboard
                </Button>
              </Link>
              <Button
                onClick={goToToday}
                size="sm"
                className="bg-white/20 text-white hover:bg-white/30 backdrop-blur"
              >
                <Star className="w-4 h-4 mr-1" /> Today
              </Button>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, transparent, #d4af37, transparent)" }} />
        </div>
      </motion.div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        </div>
      ) : month ? (
        <>
          {/* Navigation Toolbar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="bg-white rounded-2xl border border-emerald-200/60 shadow-sm p-3 flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Prev/Next Year + Month */}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={goPrevYear} className="h-9 w-9" title="Previous year">
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={goPrevMonth} className="h-9 w-9" title="Previous month">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <button
                  onClick={() => setYearPickerOpen(!yearPickerOpen)}
                  className="px-4 py-2 rounded-xl hover:bg-emerald-50 transition-colors text-center min-w-[150px]"
                >
                  <span className="block text-base font-bold text-gray-900">
                    {month.monthName}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {month.year} AH <span className="font-arabic text-gray-500" dir="rtl">{month.monthNameAr}</span>
                  </span>
                </button>
                <Button variant="ghost" size="icon" onClick={goNextMonth} className="h-9 w-9" title="Next month">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={goNextYear} className="h-9 w-9" title="Next year">
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Month quick-jump */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin max-w-full">
                {months.map((m: any) => (
                  <button
                    key={m.index}
                    onClick={() => jumpToMonth(m.index)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                      m.index === month.month
                        ? "bg-teal-600 text-white shadow-sm"
                        : "text-gray-600 hover:bg-teal-50 hover:text-teal-700",
                    )}
                  >
                    {m.short}
                  </button>
                ))}
              </div>
            </div>

            {/* Year picker */}
            {yearPickerOpen && (
              <div className="mt-2 bg-white rounded-2xl border border-emerald-200/60 shadow-lg p-4 animate-scale-in">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <CalendarRange className="w-4 h-4 text-teal-600" />
                    Jump to Year
                  </p>
                  <button onClick={() => setYearPickerOpen(false)} className="text-gray-500 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                  {years.map((y) => (
                    <button
                      key={y}
                      onClick={() => jumpToYear(y)}
                      className={cn(
                        "px-2 py-2 rounded-xl text-sm font-medium transition-all border",
                        y === month.year
                          ? "bg-teal-600 text-white border-teal-600 shadow-md"
                          : "bg-gray-50 text-gray-700 border-gray-100 hover:border-teal-300 hover:bg-teal-50",
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Today's Highlight */}
          {today?.event && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <Card className={`border-2 ${eventBgColors[today.event.type] || "border-teal-200 bg-teal-50"}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${eventColors[today.event.type] || "bg-teal-500"} text-white`}>
                    <EventIcon type={today.event.type} className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`${eventTextColors[today.event.type]} bg-white/80`}>
                        {typeLabel[today.event.type] || today.event.type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {today.hijri.monthNameShort} {today.hijri.day}, {today.hijri.year} AH
                      </span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 mt-1">{today.event.name}</p>
                    {today.event.nameAr && (
                      <p className="text-lg font-arabic text-gray-600 mt-0.5" dir="rtl">{today.event.nameAr}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-0.5">{today.event.description}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Calendar Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2"
            >
              <Card className="fatimi-card">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-teal-600" />
                        {month.monthName}
                      </CardTitle>
                      <p className="text-xs text-gray-500 mt-1">
                        {month.year} AH &middot; {month.days} days
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={goPrevMonth} className="p-2 rounded-lg hover:bg-teal-50 text-gray-500 hover:text-teal-600 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-xs text-gray-500 font-medium w-16 text-center">
                        {month.monthNameShort}
                      </span>
                      <button onClick={goNextMonth} className="p-2 rounded-lg hover:bg-teal-50 text-gray-500 hover:text-teal-600 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {dayNames.map((name, i) => (
                      <div key={name} className="text-center">
                        <div className="text-xs font-medium text-gray-500 py-1">{name}</div>
                        <div className="text-[9px] text-gray-500 font-arabic" dir="rtl">{dayNamesAr[i]}</div>
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: month.startDay }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}

                    {month.calendarDays?.map((day: any) => {
                      const isToday = day.isToday;
                      const hasEvents = day.events?.length > 0;
                      const isWeekend = day.dayOfWeek === 5 || day.dayOfWeek === 6;

                      return (
                        <button
                          key={day.day}
                          onClick={() => setSelectedDay(day)}
                          className={cn(
                            "aspect-square rounded-xl flex flex-col items-center justify-center text-sm transition-all relative cursor-pointer group",
                            isToday ? "bg-teal-600 text-white shadow-md scale-105 z-10" : "",
                            !isToday && hasEvents ? eventBgColors[day.events[0]?.type] || "bg-teal-50" : "",
                            !isToday && !hasEvents && isWeekend ? "bg-gray-50" : "",
                            !isToday && !hasEvents && !isWeekend ? "hover:bg-gray-100" : "",
                            hasEvents && !isToday ? "hover:shadow-md" : "",
                          )}
                          title={day.events?.map((e: any) => e.name).join(", ") || `${month.monthNameShort} ${day.day}`}
                        >
                          <span className={cn("text-sm font-medium", isToday ? "text-white" : hasEvents ? "text-gray-900" : "text-gray-600")}>
                            {day.day}
                          </span>
                          <span className={cn("text-[8px]", isToday ? "text-white" : "text-gray-500")}>
                            {day.gregorian?.day}/{day.gregorian?.month}
                          </span>
                          {hasEvents && (
                            <div className="flex items-center gap-0.5 mt-0.5">
                              {day.events.slice(0, 3).map((e: any, i: number) => (
                                <span key={i} className={cn("w-1.5 h-1.5 rounded-full", eventColors[e.type] || "bg-teal-400")} />
                              ))}
                              {day.events.length > 3 && (
                                <span className={cn("text-[8px] font-semibold", isToday ? "text-white" : "text-gray-500")}>+{day.events.length - 3}</span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                    {Object.entries(typeLabel).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full", eventColors[key] || "bg-gray-400")} />
                        <span className="text-xs text-gray-500">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Gregorian range */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>
                        {month.gregorianStart?.month}/{month.gregorianStart?.day}/{month.gregorianStart?.year}
                        &nbsp;&ndash;&nbsp;
                        {month.gregorianEnd?.month}/{month.gregorianEnd?.day}/{month.gregorianEnd?.year}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-teal-700">
                      {month.days} days
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Month Events List */}
              {month.calendarDays?.some((d: any) => d.events?.length > 0) && (
                <Card className="fatimi-card mt-6">
                  <div className="fatimi-card-header" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <ListChecks className="w-4 h-5 text-amber-600" />
                      Events in {month.monthName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {month.calendarDays
                        .filter((d: any) => d.events?.length > 0)
                        .flatMap((day: any) =>
                          day.events.map((event: any, i: number) => (
                            <div
                              key={`${day.day}-${i}`}
                              className={cn("flex items-start gap-3 p-3 rounded-xl border", eventBgColors[event.type] || "bg-gray-50 border-gray-200")}
                            >
                              <div className={cn("p-2 rounded-lg text-white", eventColors[event.type] || "bg-gray-500")}>
                                <EventIcon type={event.type} className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-gray-900">{event.name}</span>
                                  <Badge variant="secondary" className={cn("text-[10px]", eventTextColors[event.type], "bg-white/80")}>
                                    {typeLabel[event.type] || event.type}
                                  </Badge>
                                </div>
                                {event.nameAr && (
                                  <p className="text-xs text-gray-600 mt-0.5 font-arabic" dir="rtl">{event.nameAr}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {month.monthNameShort} {day.day}, {month.year} AH
                                </p>
                                <p className="text-xs text-gray-500">{event.description}</p>
                              </div>
                            </div>
                          ))
                        )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>

            {/* Sidebar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {/* Today's Date */}
              <Card className="fatimi-card">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-5 text-teal-600" />
                    Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {today && (
                    <div className="text-center py-4">
                      <div className="text-4xl font-bold text-teal-600 mb-1">
                        {today.hijri.day}
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {today.hijri.monthName}
                      </p>
                      <p className="font-arabic text-gray-500 text-sm mt-0.5" dir="rtl">
                        {today.hijri.monthNameAr}
                      </p>
                      <p className="text-xs text-gray-500">
                        {today.hijri.year} AH
                      </p>
                      <div className="w-8 h-px bg-teal-200 mx-auto my-3" />
                      <p className="text-sm text-gray-700">{today.hijri.dayOfWeek}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date().toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <button onClick={goPrevMonth} className="flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600 transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5" />
                      {data?.navigation?.prev && (
                        <span>{data.navigation.prev.month < 10 ? "0" : ""}{data.navigation.prev.month}</span>
                      )}
                    </button>
                    <span className="text-xs font-medium text-gray-700">{month.monthNameShort} {month.year}</span>
                    <button onClick={goNextMonth} className="flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600 transition-colors">
                      {data?.navigation?.next && (
                        <span>{data.navigation.next.month < 10 ? "0" : ""}{data.navigation.next.month}</span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming Events */}
              <Card className="fatimi-card">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-5 text-amber-600" />
                    Upcoming Events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {upcoming.length > 0 ? (
                    <div className="space-y-3">
                      {upcoming.slice(0, 8).map((item: any, i: number) => {
                        const event = item.event;
                        const date = item.date;
                        const days = item.daysUntil;
                        return (
                          <div
                            key={`${event.name}-${i}`}
                            className={cn("flex items-start gap-3 p-2.5 rounded-xl", days === 0 ? eventBgColors[event.type] || "bg-teal-50" : "hover:bg-gray-50", "transition-colors")}
                          >
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0", eventColors[event.type] || "bg-gray-500")}>
                              <EventIcon type={event.type} className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold text-gray-900 truncate">{event.name}</p>
                                {days === 0 && (
                                  <Badge className="text-[9px] bg-teal-100 text-teal-700 border-teal-200 shrink-0">Today</Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {date.monthNameShort} {date.day}, {date.year} AH
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {days > 0 ? `In ${days} day${days > 1 ? "s" : ""}` : "Today"}
                                &nbsp;&middot;&nbsp;
                                {typeLabel[event.type] || event.type}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CalendarDays className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                      <p className="text-xs text-gray-500">No upcoming events</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Year Miqaat List */}
              <Card className="fatimi-card">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ListChecks className="w-4 h-5 text-teal-600" />
                    All Miqaat of {month.year} AH
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-[520px] overflow-y-auto scrollbar-thin pr-1">
                    {months.map((m: any) => {
                      const events = yearEvents.filter((e: any) => e.month === m.index);
                      if (events.length === 0) return null;
                      return (
                        <div key={m.index}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <button
                              onClick={() => jumpToMonth(m.index)}
                              className={cn(
                                "text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md transition-colors",
                                m.index === month.month
                                  ? "bg-teal-600 text-white"
                                  : "bg-teal-50 text-teal-700 hover:bg-teal-100",
                              )}
                            >
                              {m.short}
                            </button>
                            <span className="text-[10px] text-gray-500 font-arabic" dir="rtl">{m.ar}</span>
                          </div>
                          <div className="space-y-1">
                            {events.map((e: any, i: number) => (
                              <div key={`${e.month}-${e.day}-${i}`} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", eventColors[e.type] || "bg-teal-400")} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-800">{e.name}</p>
                                  {e.nameAr && (
                                    <p className="text-[10px] text-gray-500 font-arabic" dir="rtl">{e.nameAr}</p>
                                  )}
                                  <p className="text-[9px] text-gray-500">
                                    {m.short} {e.day}
                                    {e.day2 && e.day2 > e.day ? `–${e.day2}` : ""}, {month.year} AH &middot; Gregorian {e.gregorian?.month}/{e.gregorian?.day}/{e.gregorian?.year}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Month Names Reference */}
              <Card className="fatimi-card">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BookOpen className="w-4 h-5 text-teal-600" />
                    Hijri Months
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {months.map((m: any) => (
                      <div
                        key={m.index}
                        className={cn(
                          "flex items-center justify-between px-3 py-1.5 rounded-lg text-xs",
                          m.index === month.month
                            ? "bg-teal-50 text-teal-700 font-semibold"
                            : "text-gray-600 hover:bg-gray-50",
                        )}
                      >
                        <button
                          onClick={() => jumpToMonth(m.index)}
                          className="flex items-center justify-between w-full cursor-pointer"
                        >
                          <span className="font-medium">{m.short}</span>
                          <span className="text-gray-500 font-arabic" dir="rtl">{m.ar}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      ) : (
        <Card className="fatimi-card">
          <CardContent className="p-12 text-center text-gray-500">
            Failed to load calendar data
          </CardContent>
        </Card>
      )}

      {/* Day Detail Modal */}
      <Modal open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-teal-600" />
              {month?.monthNameShort} {selectedDay?.day}, {month?.year} AH
            </ModalTitle>
            <ModalDescription>
              {selectedDay && (
                <span>
                  Gregorian {selectedDay.gregorian?.day}/{selectedDay.gregorian?.month}/{selectedDay.gregorian?.year}
                  &nbsp;&middot;&nbsp;{dayNames[selectedDay.dayOfWeek]}
                  {selectedDay.isToday && (
                    <Badge className="ml-2 bg-teal-100 text-teal-700 border-teal-200">Today</Badge>
                  )}
                </span>
              )}
            </ModalDescription>
          </ModalHeader>

          {selectedDayEvents.length > 0 ? (
            <div className="space-y-2">
              {selectedDayEvents.map((event: any, i: number) => (
                <div
                  key={i}
                  className={cn("flex items-start gap-3 p-3 rounded-xl border", eventBgColors[event.type] || "bg-gray-50 border-gray-200")}
                >
                  <div className={cn("p-2 rounded-lg text-white", eventColors[event.type] || "bg-gray-500")}>
                    <EventIcon type={event.type} className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{event.name}</span>
                      <Badge variant="secondary" className={cn("text-[10px]", eventTextColors[event.type], "bg-white/80")}>
                        {typeLabel[event.type] || event.type}
                      </Badge>
                    </div>
                    {event.nameAr && (
                      <p className="text-sm text-gray-600 mt-0.5 font-arabic" dir="rtl">{event.nameAr}</p>
                    )}
                    {event.description && (
                      <p className="text-xs text-gray-500 mt-1">{event.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CalendarDays className="w-10 h-10 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">No miqaat on this day</p>
            </div>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
