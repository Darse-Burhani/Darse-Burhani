"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Cake,
  Mail,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Sparkles,
  User,
  Heart,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Calendar,
  X,
  Check,
  Users,
  Edit3,
  RotateCcw,
  BookOpen,
  Sliders,
  UserCheck,
  KeyRound,
  GraduationCap,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface WarasStudent {
  celebrantType?: "STUDENT" | "FACULTY";
  studentProfileId: string;
  teacherProfileId?: string;
  studentId: string;
  fullName: string;
  nameAr?: string | null;
  grade?: string;
  section?: string;
  roleTitle?: string;
  department?: string;
  avatarUrl?: string | null;
  dobGregorian?: string | null;
  dobHijri?: string | null;
  hijriDay?: number;
  hijriMonth?: number;
  hijriMonthName?: string;
  studentEmail?: string | null;
  fatherEmail?: string | null;
  motherEmail?: string | null;
  linkedParentEmails?: string[];
  fatherName?: string | null;
  motherName?: string | null;
  mobile?: string | null;
  daysUntil?: number;
  birthDateStr?: string;
  isHijriMatch?: boolean;
  isGregorianMatch?: boolean;
}

interface SmtpStatus {
  configured: boolean;
  activeMailbox: string;
  hasDedicatedLeaveCreds: boolean;
  adminMailbox: string;
}

interface CustomTemplateForm {
  salutation: string;
  recipientName: string;
  occasionTitle: string;
  arabicKalam: string;
  dawatKalam: string;
  englishKalam: string;
  blessingParagraph: string;
  signOffTitle: string;
  signOffSubtitle: string;
  signOffLocation: string;
}

const DEFAULT_TEMPLATE_PRESETS = [
  {
    id: "aljamea_amn_aafiyah",
    name: "Aljamea Standard: Health & Well-being (الأمن والعافية)",
    arabicKalam: "افضل ما نال العبد الامن والعافية",
    dawatKalam: "افضل ما افضل چیز کوئی بندہ نے ملی ھوئی\nیه سوں چهے که - امان آنے عافیة.",
    englishKalam: "Safety and well-being are the greatest blessings one ever received.",
    blessingParagraph:
      "You are a valued member of our esteemed institution. In light of this kalam mubarak, we pray that by the grace of Syedna al-Dai al-Ajal TUS you be blessed with the best of health and happiness and may you succeed in all your endeavors.",
  },
  {
    id: "talab_ilm",
    name: "Ilm & Knowledge (طلب العلم)",
    arabicKalam: "طلب العلم فريضة على كل مسلم ومسلمة",
    dawatKalam: "علم طلب كرو ہر مومن پر فرض چهے\nعلم نور چهے آنے نجات نو راستو چهے.",
    englishKalam: "The pursuit of divine knowledge is a noble obligation upon every faithful believer.",
    blessingParagraph:
      "On this auspicious anniversary of your birth, we pray that Maula TUS's nazaraat and blessings illuminate your intellect with the light of Quran and Hikmat in all your academic stages.",
  },
  {
    id: "barakat_tawfeeq",
    name: "Khidmat & Longevity (طول العمر والبركات)",
    arabicKalam: "بارك الله لكم في اعماركم واعمالكم",
    dawatKalam: "خدا تعالى تہماری عمر آنے عمل ما بركت عطاء فرماوے\nآنے ہمیشه مولا نی خدمت ما حاضر راكهے.",
    englishKalam: "May Allah Ta'ala bless your life and deeds with divine grace, longevity, and joy.",
    blessingParagraph:
      "In light of this blessed milestone, Maktab Masool al-Aam prays for your prosperity, unwavering health, and radiant success in the holy shade of Dawat-e-Hadiyah.",
  },
];

export default function WarasMubarakAdminPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayList, setTodayList] = useState<WarasStudent[]>([]);
  const [upcomingList, setUpcomingList] = useState<WarasStudent[]>([]);
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatus | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WarasStudent[]>([]);
  const [searching, setSearching] = useState(false);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"today" | "upcoming" | "search">("today");
  const [celebrantFilter, setCelebrantFilter] = useState<"ALL" | "STUDENT" | "FACULTY">("ALL");

  const filteredTodayList = useMemo(() => {
    if (celebrantFilter === "ALL") return todayList;
    return todayList.filter((c) => (c.celebrantType || "STUDENT") === celebrantFilter);
  }, [todayList, celebrantFilter]);

  const filteredUpcomingList = useMemo(() => {
    if (celebrantFilter === "ALL") return upcomingList;
    return upcomingList.filter((c) => (c.celebrantType || "STUDENT") === celebrantFilter);
  }, [upcomingList, celebrantFilter]);

  const todayStudentCount = useMemo(() => todayList.filter((c) => (c.celebrantType || "STUDENT") === "STUDENT").length, [todayList]);
  const todayFacultyCount = useMemo(() => todayList.filter((c) => c.celebrantType === "FACULTY").length, [todayList]);

  // Preview & Send Modal state
  const [previewStudent, setPreviewStudent] = useState<WarasStudent | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendToStudent, setSendToStudent] = useState(true);
  const [sendToParents, setSendToParents] = useState(true);
  const [testEmailOverride, setTestEmailOverride] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);

  // Full Editable Template State
  const [editorTab, setEditorTab] = useState<"edit" | "preview" | "split">("split");
  const [templateForm, setTemplateForm] = useState<CustomTemplateForm>({
    salutation: "Baad al-Salaam al-Jameel",
    recipientName: "",
    occasionTitle: "Waras Mubarak!",
    arabicKalam: DEFAULT_TEMPLATE_PRESETS[0].arabicKalam,
    dawatKalam: DEFAULT_TEMPLATE_PRESETS[0].dawatKalam,
    englishKalam: DEFAULT_TEMPLATE_PRESETS[0].englishKalam,
    blessingParagraph: DEFAULT_TEMPLATE_PRESETS[0].blessingParagraph,
    signOffTitle: "Maktab Masool al-Aam",
    signOffSubtitle: "Idarah Darse Burhani",
    signOffLocation: "Galiakot",
  });

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Fetch today & upcoming celebrants
  const fetchData = async (overrideDate?: string) => {
    try {
      setRefreshing(true);
      const queryDate = overrideDate !== undefined ? overrideDate : selectedDate;
      const res = await fetch(`/api/admin/waras-mubarak/today?date=${queryDate}&daysAhead=30`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.data) {
        setTodayList(data.data.today || []);
        setUpcomingList(data.data.upcoming || []);
        setSmtpStatus(data.data.smtpStatus || null);
      }
    } catch (err: any) {
      toast({
        title: "Failed to load Waras Mubarak celebrants",
        description: err?.message || "Please check network connection",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  // Handle Search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await fetch(`/api/admin/waras-mubarak/search?q=${encodeURIComponent(searchQuery.trim())}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.data || []);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Request updated HTML preview with current custom template values
  const refreshLivePreview = async (form: CustomTemplateForm, studentId: string) => {
    try {
      setPreviewLoading(true);
      const res = await fetch(`/api/admin/waras-mubarak/preview/${studentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ customTemplate: form }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setPreviewHtml(data.data.html);
      }
    } catch (err) {
      console.error("Error refreshing live preview:", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Open Preview Modal and initialize template form
  const openPreview = (student: WarasStudent) => {
    const isFaculty = student.celebrantType === "FACULTY";
    const initialForm: CustomTemplateForm = {
      salutation: isFaculty ? "Baad al-Salaam al-Jameel Janab Mohtaram Ustaaz" : "Baad al-Salaam al-Jameel",
      recipientName: student.fullName || (isFaculty ? `Ustaaz ${student.studentId}` : `Talib ${student.studentId}`),
      occasionTitle: "Waras Mubarak!",
      arabicKalam: DEFAULT_TEMPLATE_PRESETS[0].arabicKalam,
      dawatKalam: DEFAULT_TEMPLATE_PRESETS[0].dawatKalam,
      englishKalam: DEFAULT_TEMPLATE_PRESETS[0].englishKalam,
      blessingParagraph: isFaculty
        ? "You are an esteemed faculty pillar of our institution. In light of this kalam mubarak, we pray that by the grace of Syedna al-Dai al-Ajal TUS you be blessed with the best of health, happiness, long life, and divine tawfeeq in your khidmat of taaleem and tarbiyat."
        : DEFAULT_TEMPLATE_PRESETS[0].blessingParagraph,
      signOffTitle: "Maktab Masool al-Aam",
      signOffSubtitle: "Idarah Darse Burhani",
      signOffLocation: "Galiakot",
    };

    setPreviewStudent(student);
    setTemplateForm(initialForm);
    setTestEmailOverride("");
    setSendToStudent(true);
    setSendToParents(true);
    setEditorTab("split");

    refreshLivePreview(initialForm, student.studentProfileId);
  };

  // Live update template form and debounce preview reload
  const handleTemplateChange = (field: keyof CustomTemplateForm, value: string) => {
    const updated = { ...templateForm, [field]: value };
    setTemplateForm(updated);
  };

  // Debounce preview update when template changes
  useEffect(() => {
    if (!previewStudent) return;
    const timer = setTimeout(() => {
      refreshLivePreview(templateForm, previewStudent.studentProfileId);
    }, 400);
    return () => clearTimeout(timer);
  }, [templateForm]);

  // Apply a preset
  const handleApplyPreset = (presetId: string) => {
    const preset = DEFAULT_TEMPLATE_PRESETS.find((p) => p.id === presetId);
    if (!preset || !previewStudent) return;

    const updated: CustomTemplateForm = {
      ...templateForm,
      arabicKalam: preset.arabicKalam,
      dawatKalam: preset.dawatKalam,
      englishKalam: preset.englishKalam,
      blessingParagraph: preset.blessingParagraph,
    };
    setTemplateForm(updated);
  };

  // Reset to default Aljamea template
  const handleResetToDefault = () => {
    if (!previewStudent) return;
    const initialForm: CustomTemplateForm = {
      salutation: "Baad al-Salaam al-Jameel",
      recipientName: previewStudent.fullName,
      occasionTitle: "Waras Mubarak!",
      arabicKalam: DEFAULT_TEMPLATE_PRESETS[0].arabicKalam,
      dawatKalam: DEFAULT_TEMPLATE_PRESETS[0].dawatKalam,
      englishKalam: DEFAULT_TEMPLATE_PRESETS[0].englishKalam,
      blessingParagraph: DEFAULT_TEMPLATE_PRESETS[0].blessingParagraph,
      signOffTitle: "Maktab Masool al-Aam",
      signOffSubtitle: "Idarah Darse Burhani",
      signOffLocation: "Galiakot",
    };
    setTemplateForm(initialForm);
  };

  // Dispatch customized greeting
  const handleSendGreeting = async () => {
    if (!previewStudent) return;
    try {
      setSendingEmail(true);
      const res = await fetch("/api/admin/waras-mubarak/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentProfileId: previewStudent.studentProfileId,
          sendToStudent,
          sendToParents,
          overrideRecipientEmail: testEmailOverride.trim() || undefined,
          customTemplate: templateForm,
        }),
      });
      const data = await res.json();

      if (data.success) {
        const delivered = data.data?.recipientsDelivered || [];
        toast({
          title: "🎉 Waras Mubarak Greeting Dispatched!",
          description: `Customized greeting sent to ${delivered.length} address${delivered.length === 1 ? "" : "es"} (${delivered.join(", ")})`,
          variant: "success",
        });
        setPreviewStudent(null);
      } else {
        toast({
          title: "Dispatch Notice",
          description: data.error || data.data?.error || "Could not complete delivery",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Dispatch Failed",
        description: err?.message || "Network error while sending email",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Bulk dispatch to all today's celebrants
  const handleBulkSendToday = async () => {
    if (todayList.length === 0) {
      toast({
        title: "No celebrants today",
        description: "No students have birthdays matching today's date.",
      });
      return;
    }

    try {
      setBulkSending(true);
      const res = await fetch("/api/admin/waras-mubarak/send-bulk-today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: "🎉 Bulk Waras Mubarak Dispatched!",
          description: `Successfully sent greetings for ${data.successfulDispatches || 0} celebrants to student & parent mailboxes.`,
          variant: "success",
        });
        fetchData();
      } else {
        toast({
          title: "Bulk dispatch notice",
          description: data.error || "Some dispatches could not be completed",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Bulk Dispatch Failed",
        description: err?.message || "Network error",
        variant: "destructive",
      });
    } finally {
      setBulkSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf7f0] text-slate-800 p-4 md:p-8 space-y-6">
      {/* ── People & Directory Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="People & Directory"
        hubDescription="Manage user accounts, student profiles, parent directory, and official Waras Mubarak greetings."
        tabs={[
          { label: "All Accounts", href: "/admin/users", icon: Users },
          { label: "User Passwords Vault", href: "/admin/passwords", icon: KeyRound },
          { label: "Talabat (Students)", href: "/admin/students", icon: GraduationCap },
          { label: "Waras Mubarak (Salgirah)", href: "/admin/waras-mubarak", icon: Cake },
          { label: "Parents Directory", href: "/admin/parents", icon: Heart },
          { label: "Portal Roles & Permissions", href: "/admin/portal-assignments", icon: UserCheck },
        ]}
      />

      {/* Top Cockpit Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-amber-200/60">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0b2545] to-[#133e68] flex items-center justify-center text-[#f3b833] shadow-md border border-[#f3b833]/30">
              <Cake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#0b2545] font-serif">
                  Waras Mubarak (Salgirah) Hub
                </h1>
                <Badge className="bg-[#a91d22] text-white border-none font-semibold text-xs px-2.5 py-0.5">
                  Official Greetings
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-slate-600 mt-1">
                Fully editable Aljamea-standard milestone template dispatched to Talabat and Parents from{" "}
                <span className="font-mono text-[#0b2545] font-semibold">admin.galiakot@darseburhani.org</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Sender Address */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/80 border border-amber-200 shadow-sm text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-500">From:</span>
            <span className="font-mono font-semibold text-[#0b2545]">admin.galiakot@darseburhani.org</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData()}
            disabled={refreshing}
            className="border-amber-300 text-slate-700 hover:bg-amber-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
            Sync
          </Button>

          {todayList.length > 0 && (
            <Button
              onClick={handleBulkSendToday}
              disabled={bulkSending}
              className="bg-gradient-to-r from-[#a91d22] to-[#b91c1c] text-white hover:from-[#8d181d] hover:to-[#a91d22] shadow-md font-semibold text-xs md:text-sm"
            >
              <Send className="w-4 h-4 mr-2" />
              {bulkSending ? "Dispatching..." : `Shoot Waras Mubarak Today (${todayList.length})`}
            </Button>
          )}
        </div>
      </div>

      {/* ── Target Celebration Date Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-amber-200/80 shadow-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#a91d22]" />
          <span className="text-xs font-bold text-[#0b2545]">Target Celebration Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs rounded-lg border border-amber-300 px-3 py-1.5 bg-amber-50/20 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#0b2545]"
          />
        </div>

        {/* Quick Date Shortcuts */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
            className={cn(
              "px-2.5 py-1 text-xs rounded-md font-semibold transition-all border cursor-pointer",
              selectedDate === new Date().toISOString().slice(0, 10)
                ? "bg-[#0b2545] text-[#f3b833] border-[#0b2545]"
                : "bg-white text-slate-700 border-amber-200 hover:bg-amber-50"
            )}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().slice(0, 10));
            }}
            className="px-2.5 py-1 text-xs rounded-md font-semibold bg-white text-slate-700 border border-amber-200 hover:bg-amber-50 transition-all cursor-pointer"
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 4);
              setSelectedDate(d.toISOString().slice(0, 10));
            }}
            className="px-2.5 py-1 text-xs rounded-md font-semibold bg-white text-slate-700 border border-amber-200 hover:bg-amber-50 transition-all cursor-pointer"
          >
            Nov 11 (Next)
          </button>
        </div>
      </div>

      {/* Tab Selectors & Celebrant Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-amber-200/50 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab("today")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer",
              activeTab === "today"
                ? "bg-[#0b2545] text-[#f3b833] shadow"
                : "text-slate-600 hover:text-slate-900 hover:bg-amber-100/50"
            )}
          >
            <Cake className="w-4 h-4" />
            Celebrants on Date
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-bold",
                activeTab === "today" ? "bg-[#f3b833] text-[#0b2545]" : "bg-slate-200 text-slate-700"
              )}
            >
              {filteredTodayList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("upcoming")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer",
              activeTab === "upcoming"
                ? "bg-[#0b2545] text-[#f3b833] shadow"
                : "text-slate-600 hover:text-slate-900 hover:bg-amber-100/50"
            )}
          >
            <Calendar className="w-4 h-4" />
            Upcoming (Next 30 Days)
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-bold",
                activeTab === "upcoming" ? "bg-[#f3b833] text-[#0b2545]" : "bg-slate-200 text-slate-700"
              )}
            >
              {filteredUpcomingList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("search")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer",
              activeTab === "search"
                ? "bg-[#0b2545] text-[#f3b833] shadow"
                : "text-slate-600 hover:text-slate-900 hover:bg-amber-100/50"
            )}
          >
            <Search className="w-4 h-4" />
            Directory Search &amp; Custom Template
          </button>
        </div>

        {/* Celebrant Role Filter (Students vs Faculty) */}
        {activeTab !== "search" && (
          <div className="flex items-center gap-1 bg-amber-100/60 p-1 rounded-xl border border-amber-300/60 shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setCelebrantFilter("ALL")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                celebrantFilter === "ALL"
                  ? "bg-[#0b2545] text-[#f3b833] shadow-xs"
                  : "text-slate-700 hover:text-slate-900"
              )}
            >
              All Celebrants ({activeTab === "today" ? todayList.length : upcomingList.length})
            </button>
            <button
              type="button"
              onClick={() => setCelebrantFilter("STUDENT")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                celebrantFilter === "STUDENT"
                  ? "bg-[#0b2545] text-[#f3b833] shadow-xs"
                  : "text-slate-700 hover:text-slate-900"
              )}
            >
              Talabat ({activeTab === "today" ? todayStudentCount : upcomingList.filter((c) => (c.celebrantType || "STUDENT") === "STUDENT").length})
            </button>
            <button
              type="button"
              onClick={() => setCelebrantFilter("FACULTY")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                celebrantFilter === "FACULTY"
                  ? "bg-[#0b2545] text-[#f3b833] shadow-xs"
                  : "text-slate-700 hover:text-slate-900"
              )}
            >
              Asaatizah / Faculty ({activeTab === "today" ? todayFacultyCount : upcomingList.filter((c) => c.celebrantType === "FACULTY").length})
            </button>
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-[#0b2545] border-t-transparent rounded-full mb-3" />
          <p className="text-sm font-medium text-slate-600">Gathering institutional birthday records...</p>
        </div>
      ) : activeTab === "today" ? (
        <div>
          {filteredTodayList.length === 0 ? (
            <Card className="bg-white/80 border-amber-200 text-center py-12 px-6">
              <CardContent className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto text-[#0b2545]">
                  <Cake className="w-8 h-8 text-[#a91d22]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    No {celebrantFilter === "FACULTY" ? "Faculty" : celebrantFilter === "STUDENT" ? "Talabat" : ""} Birthdays on This Date
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                    No celebrants match the selected date and filters. Check upcoming birthdays or look up any student or faculty member directly.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("upcoming")}
                  className="border-amber-300 text-[#0b2545]"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  View Upcoming Birthdays ({upcomingList.length})
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTodayList.map((student) => (
                <StudentCard
                  key={student.studentProfileId}
                  student={student}
                  isToday
                  onPreview={() => openPreview(student)}
                />
              ))}
            </div>
          )}
        </div>
      ) : activeTab === "upcoming" ? (
        <div>
          {filteredUpcomingList.length === 0 ? (
            <Card className="bg-white/80 border-amber-200 text-center py-12 px-6">
              <CardContent>
                <Clock className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-800">No upcoming birthdays in the next 30 days</h3>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredUpcomingList.map((student) => (
                <StudentCard
                  key={student.studentProfileId}
                  student={student}
                  onPreview={() => openPreview(student)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Search Tab */
        <div className="space-y-6">
          <Card className="bg-white border-amber-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-[#0b2545]">Lookup Student for Waras Mubarak</CardTitle>
              <CardDescription>
                Search by Student Name, ITS number, or Darajah. You can customize the complete template text before shooting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by full name, ITS (e.g. 50420813), or class..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-[#0b2545] text-sm bg-amber-50/20"
                />
                {searching && (
                  <RefreshCw className="w-4 h-4 animate-spin absolute right-3.5 top-3.5 text-slate-400" />
                )}
              </div>
            </CardContent>
          </Card>

          {searchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {searchResults.map((student) => (
                <StudentCard
                  key={student.studentProfileId}
                  student={student}
                  onPreview={() => openPreview(student)}
                />
              ))}
            </div>
          ) : searchQuery.length >= 2 && !searching ? (
            <p className="text-center text-sm text-slate-500 py-8">
              No students found matching "{searchQuery}"
            </p>
          ) : null}
        </div>
      )}

      {/* Live Interactive Template Editor & Shoot Modal */}
      {previewStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-7xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-amber-200 max-h-[95vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-[#0b2545] to-[#133e68] text-white flex items-center justify-between border-b border-amber-300/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#f3b833] text-[#0b2545] flex items-center justify-center font-bold">
                  <Cake className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base md:text-lg font-bold font-serif leading-tight">
                      Edit Waras Mubarak Template & Shoot
                    </h3>
                    <Badge className="bg-[#f3b833] text-[#0b2545] text-[10px] font-bold">
                      Interactive Live Editor
                    </Badge>
                  </div>
                  <p className="text-xs text-amber-200/90">
                    {previewStudent.fullName} · ITS: {previewStudent.studentId} · Darajah {previewStudent.grade}
                  </p>
                </div>
              </div>

              {/* View Mode Controls on Mobile / Tablet */}
              <div className="flex items-center gap-2">
                <div className="flex lg:hidden bg-white/10 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setEditorTab("edit")}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-medium transition-colors",
                      editorTab === "edit" ? "bg-white text-[#0b2545] shadow" : "text-white"
                    )}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setEditorTab("preview")}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-medium transition-colors",
                      editorTab === "preview" ? "bg-white text-[#0b2545] shadow" : "text-white"
                    )}
                  >
                    Preview
                  </button>
                </div>

                <button
                  onClick={() => setPreviewStudent(null)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Split view (Interactive Editor on Left + Live Preview on Right) */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-amber-200">
              
              {/* Left Column: Full Template Editor */}
              <div
                className={cn(
                  "lg:col-span-6 p-4 sm:p-5 bg-[#faf7f0] overflow-y-auto space-y-4",
                  editorTab === "preview" ? "hidden lg:block" : "block"
                )}
              >
                {/* Preset & Reset Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-xl border border-amber-200 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0b2545]">
                    <Sliders className="w-3.5 h-3.5 text-[#a91d22]" />
                    <span>Kalam Mubarak Presets:</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <select
                      className="text-xs bg-amber-50/50 border border-amber-200 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0b2545]"
                      onChange={(e) => handleApplyPreset(e.target.value)}
                      defaultValue={DEFAULT_TEMPLATE_PRESETS[0].id}
                    >
                      {DEFAULT_TEMPLATE_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetToDefault}
                      className="h-7 text-[11px] text-slate-600 hover:text-slate-900 hover:bg-amber-100/60"
                      title="Reset all fields to default Aljamea standard"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Reset
                    </Button>
                  </div>
                </div>

                {/* Form Fields Section */}
                <div className="space-y-3.5 text-xs">
                  
                  {/* Salutation & Recipient Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm space-y-1.5">
                      <label className="font-bold text-slate-700 flex items-center gap-1">
                        <Edit3 className="w-3 h-3 text-[#a91d22]" />
                        Salutation
                      </label>
                      <input
                        type="text"
                        value={templateForm.salutation}
                        onChange={(e) => handleTemplateChange("salutation", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded border border-amber-200 font-serif text-slate-900 focus:ring-1 focus:ring-[#0b2545] focus:outline-none bg-amber-50/10"
                        placeholder="Baad al-Salaam al-Jameel"
                      />
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm space-y-1.5">
                      <label className="font-bold text-slate-700 flex items-center gap-1">
                        <User className="w-3 h-3 text-[#0b2545]" />
                        Recipient Full Name
                      </label>
                      <input
                        type="text"
                        value={templateForm.recipientName}
                        onChange={(e) => handleTemplateChange("recipientName", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded border border-amber-200 font-serif font-bold text-slate-900 focus:ring-1 focus:ring-[#0b2545] focus:outline-none bg-amber-50/10"
                        placeholder="Student full name"
                      />
                    </div>
                  </div>

                  {/* Occasion Title */}
                  <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm space-y-1.5">
                    <label className="font-bold text-slate-700 flex items-center gap-1">
                      <Cake className="w-3 h-3 text-[#a91d22]" />
                      Occasion Title
                    </label>
                    <input
                      type="text"
                      value={templateForm.occasionTitle}
                      onChange={(e) => handleTemplateChange("occasionTitle", e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-amber-200 font-serif font-bold text-[#a91d22] focus:ring-1 focus:ring-[#0b2545] focus:outline-none bg-amber-50/10"
                      placeholder="Waras Mubarak!"
                    />
                  </div>

                  {/* Arabic Kalam (RTL) */}
                  <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-[#a91d22]" />
                        Arabic Kalam Mubarak (الحديث الشريف / الكلام المبارك)
                      </label>
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        RTL
                      </span>
                    </div>
                    <input
                      type="text"
                      dir="rtl"
                      value={templateForm.arabicKalam}
                      onChange={(e) => handleTemplateChange("arabicKalam", e.target.value)}
                      className="w-full px-3 py-2 rounded border border-amber-200 text-slate-900 text-base font-bold text-center focus:ring-1 focus:ring-[#0b2545] focus:outline-none bg-amber-50/10 font-serif"
                      style={{ fontFamily: "'Amiri', 'Traditional Arabic', serif" }}
                      placeholder="افضل ما نال العبد الامن والعافية"
                    />
                  </div>

                  {/* Lisan al-Dawat Kalam (RTL) */}
                  <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#a91d22]" />
                        Lisan al-Dawat Kalam (لسان الدعوة)
                      </label>
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        RTL Multi-line
                      </span>
                    </div>
                    <textarea
                      dir="rtl"
                      rows={2}
                      value={templateForm.dawatKalam}
                      onChange={(e) => handleTemplateChange("dawatKalam", e.target.value)}
                      className="w-full px-3 py-2 rounded border border-amber-200 text-slate-900 text-sm font-medium text-center focus:ring-1 focus:ring-[#0b2545] focus:outline-none bg-amber-50/10 font-serif leading-relaxed"
                      style={{ fontFamily: "'Amiri', 'Traditional Arabic', serif" }}
                      placeholder="افضل ما افضل چیز کوئی بندہ نے ملی ھوئی..."
                    />
                  </div>

                  {/* English Translation */}
                  <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm space-y-1.5">
                    <label className="font-bold text-slate-700 flex items-center gap-1">
                      <Heart className="w-3 h-3 text-[#a91d22]" />
                      English Kalam Translation
                    </label>
                    <input
                      type="text"
                      value={templateForm.englishKalam}
                      onChange={(e) => handleTemplateChange("englishKalam", e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-amber-200 font-serif text-[#a91d22] text-center focus:ring-1 focus:ring-[#0b2545] focus:outline-none bg-amber-50/10"
                      placeholder="Safety and well-being are the greatest blessings..."
                    />
                  </div>

                  {/* Institutional Blessing Paragraph */}
                  <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm space-y-1.5">
                    <label className="font-bold text-slate-700 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#0b2545]" />
                      Institution Blessing Paragraph (Syedna TUS Grace)
                    </label>
                    <textarea
                      rows={3}
                      value={templateForm.blessingParagraph}
                      onChange={(e) => handleTemplateChange("blessingParagraph", e.target.value)}
                      className="w-full px-2.5 py-2 rounded border border-amber-200 text-slate-800 leading-relaxed focus:ring-1 focus:ring-[#0b2545] focus:outline-none bg-amber-50/10 text-xs"
                      placeholder="You are a valued member of our esteemed institution..."
                    />
                  </div>

                  {/* Sign-Off Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-amber-200 shadow-sm">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600 text-[11px]">Sign-off Title</label>
                      <input
                        type="text"
                        value={templateForm.signOffTitle}
                        onChange={(e) => handleTemplateChange("signOffTitle", e.target.value)}
                        className="w-full px-2 py-1 rounded border border-amber-200 text-xs focus:outline-none font-semibold text-[#0b2545]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600 text-[11px]">Institution</label>
                      <input
                        type="text"
                        value={templateForm.signOffSubtitle}
                        onChange={(e) => handleTemplateChange("signOffSubtitle", e.target.value)}
                        className="w-full px-2 py-1 rounded border border-amber-200 text-xs focus:outline-none text-slate-700"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600 text-[11px]">Location</label>
                      <input
                        type="text"
                        value={templateForm.signOffLocation}
                        onChange={(e) => handleTemplateChange("signOffLocation", e.target.value)}
                        className="w-full px-2 py-1 rounded border border-amber-200 text-xs focus:outline-none text-slate-700"
                      />
                    </div>
                  </div>

                  {/* Target Recipients Box */}
                  <div className="p-3.5 rounded-xl bg-white border border-amber-200 shadow-sm space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#0b2545] flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" />
                      Select Target Mailboxes
                    </div>

                    {previewStudent.celebrantType === "FACULTY" ? (
                      <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={sendToStudent}
                          onChange={(e) => setSendToStudent(e.target.checked)}
                          className="mt-0.5 rounded text-[#a91d22] focus:ring-[#a91d22]"
                        />
                        <div>
                          <span className="font-semibold text-slate-800">Faculty Member Institutional Mailbox</span>
                          <div className="text-slate-500 font-mono text-[11px] truncate max-w-[280px]">
                            {previewStudent.studentEmail || "No faculty email on file"}
                          </div>
                        </div>
                      </label>
                    ) : (
                      <>
                        <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={sendToStudent}
                            onChange={(e) => setSendToStudent(e.target.checked)}
                            className="mt-0.5 rounded text-[#a91d22] focus:ring-[#a91d22]"
                          />
                          <div>
                            <span className="font-semibold text-slate-800">Talib Personal Mailbox</span>
                            <div className="text-slate-500 font-mono text-[11px] truncate max-w-[280px]">
                              {previewStudent.studentEmail || "No personal email on file"}
                            </div>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={sendToParents}
                            onChange={(e) => setSendToParents(e.target.checked)}
                            className="mt-0.5 rounded text-[#a91d22] focus:ring-[#a91d22]"
                          />
                          <div>
                            <span className="font-semibold text-slate-800">Parents' Mailboxes (Father &amp; Mother)</span>
                            <div className="text-slate-500 font-mono text-[11px] truncate max-w-[280px]">
                              {[previewStudent.fatherEmail, previewStudent.motherEmail]
                                .filter(Boolean)
                                .join(", ") || "No parent email on file"}
                            </div>
                          </div>
                        </label>
                      </>
                    )}

                    <div className="pt-2 border-t border-amber-100 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" /> Test Dispatch Override (Optional)
                      </span>
                      <input
                        type="email"
                        placeholder="Leave empty or enter email to shoot a test copy..."
                        value={testEmailOverride}
                        onChange={(e) => setTestEmailOverride(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs rounded border border-amber-200 focus:outline-none focus:ring-1 focus:ring-[#0b2545]"
                      />
                    </div>
                  </div>

                  {/* Shoot Button */}
                  <div className="pt-2">
                    <Button
                      onClick={handleSendGreeting}
                      disabled={sendingEmail || (!sendToStudent && !sendToParents && !testEmailOverride)}
                      className="w-full bg-[#a91d22] hover:bg-[#8e171b] text-white font-bold py-3 shadow-lg flex items-center justify-center gap-2 text-sm"
                    >
                      <Send className={cn("w-4 h-4", sendingEmail && "animate-spin")} />
                      {sendingEmail ? "Dispatching Greeting..." : "Shoot Waras Mubarak Greeting Now"}
                    </Button>
                    <p className="text-[11px] text-center text-slate-500 mt-1.5">
                      Officially dispatched from Maktab Masool al-Aam (admin.galiakot@darseburhani.org)
                    </p>
                  </div>

                </div>
              </div>

              {/* Right Column: Live Rendered Card Preview */}
              <div
                className={cn(
                  "lg:col-span-6 bg-[#f4efe6] p-3 sm:p-5 flex flex-col items-center justify-center min-h-[500px] overflow-hidden",
                  editorTab === "edit" ? "hidden lg:flex" : "flex"
                )}
              >
                <div className="w-full max-w-[540px] flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <Eye className="w-3.5 h-3.5 text-[#0b2545]" />
                    <span>Real-Time Email Render</span>
                  </div>
                  {previewLoading && (
                    <span className="text-[11px] text-amber-800 font-semibold flex items-center gap-1 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Updating preview...
                    </span>
                  )}
                </div>

                <div className="w-full max-w-[540px] bg-white rounded-xl shadow-xl border border-amber-200/90 overflow-hidden relative">
                  <iframe
                    srcDoc={previewHtml}
                    title="Waras Mubarak Card"
                    className="w-full h-[580px] border-none"
                  />
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// Celebrant Card Component (Students & Faculty)
function StudentCard({
  student,
  isToday = false,
  onPreview,
}: {
  student: WarasStudent;
  isToday?: boolean;
  onPreview: () => void;
}) {
  const isFaculty = student.celebrantType === "FACULTY";

  const initials = (student.fullName || (isFaculty ? "U" : "T"))
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const englishWarasDate = student.birthDateStr || (student.dobGregorian
    ? new Date(student.dobGregorian).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—");

  return (
    <Card
      className={cn(
        "transition-all duration-200 border bg-white overflow-hidden shadow-sm hover:shadow-md",
        isToday ? "border-[#a91d22] ring-1 ring-[#a91d22]/40" : "border-amber-200"
      )}
    >
      {isToday && (
        <div className="bg-gradient-to-r from-[#a91d22] to-[#b91c1c] text-white px-3.5 py-1 text-xs font-bold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Cake className="w-3.5 h-3.5" />
            {isFaculty ? "Faculty Waras Mubarak Today!" : "Waras Mubarak Today!"}
          </span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Today</span>
        </div>
      )}

      <CardContent className="p-4 space-y-3.5">
        <div className="flex items-start gap-3">
          {/* Profile Picture */}
          <div className="relative shrink-0">
            {student.avatarUrl ? (
              <img
                src={student.avatarUrl}
                alt={student.fullName}
                className="w-14 h-14 rounded-full object-cover border-2 border-[#f3b833] shadow-sm"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                  const fallback = (e.target as HTMLElement).nextElementSibling;
                  if (fallback) fallback.classList.remove("hidden");
                }}
              />
            ) : null}
            <div
              className={cn(
                "w-14 h-14 rounded-full bg-gradient-to-br from-[#0b2545] to-[#173f6c] border-2 border-[#f3b833] shadow-sm flex items-center justify-center text-[#f3b833] font-serif font-bold text-base",
                student.avatarUrl ? "hidden" : "flex"
              )}
            >
              {initials}
            </div>
          </div>

          {/* Celebrant Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  "text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                  isFaculty
                    ? "bg-purple-100 text-purple-900 border border-purple-200"
                    : "bg-emerald-100 text-emerald-900 border border-emerald-200"
                )}
              >
                {isFaculty ? "Faculty" : "Talib"}
              </span>
              <span className="font-mono text-[10px] text-slate-500 font-semibold">
                ITS {student.studentId}
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 truncate font-serif mt-0.5" title={student.fullName}>
              {student.fullName}
            </h4>

            <p className="text-xs text-slate-600 truncate">
              {isFaculty
                ? (student.roleTitle || student.department || "Faculty Pillar")
                : (student.grade ? `Darajah ${student.grade}${student.section ? ` · ${student.section}` : ""}` : "Student")}
            </p>

            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {englishWarasDate !== "—" && (
                <span className="inline-flex items-center text-[11px] font-bold text-[#0b2545] bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                  <Calendar className="w-3 h-3 mr-1 text-[#a91d22]" />
                  {englishWarasDate}
                </span>
              )}
              {isToday ? (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.5 rounded">
                  Today
                </span>
              ) : student.daysUntil !== undefined ? (
                <span className="text-[10px] font-semibold text-pink-700 bg-pink-50 border border-pink-200 px-1.5 py-0.5 rounded">
                  In {student.daysUntil} day{student.daysUntil === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Contact Status Badges */}
        <div className="pt-2 border-t border-amber-100 flex flex-wrap gap-1.5 text-[10.5px]">
          {isFaculty ? (
            <>
              {student.studentEmail ? (
                <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Faculty Mail
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500">No Mail on File</span>
              )}
              {student.mobile && (
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                  📞 {student.mobile}
                </span>
              )}
            </>
          ) : (
            <>
              {student.studentEmail ? (
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Talib Mail
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500">No Talib Mail</span>
              )}

              {student.fatherEmail || student.motherEmail || (student.linkedParentEmails && student.linkedParentEmails.length > 0) ? (
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Parent Mail
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500">No Parent Mail</span>
              )}
            </>
          )}
        </div>

        {/* Action Button */}
        <Button
          onClick={onPreview}
          size="sm"
          className={cn(
            "w-full text-xs font-semibold flex items-center justify-center gap-1.5 mt-2 cursor-pointer",
            isToday
              ? "bg-[#a91d22] hover:bg-[#8e171b] text-white shadow"
              : "bg-[#0b2545] hover:bg-[#133e68] text-white"
          )}
        >
          <Edit3 className="w-3.5 h-3.5" />
          Edit Template &amp; Shoot
        </Button>
      </CardContent>
    </Card>
  );
}
