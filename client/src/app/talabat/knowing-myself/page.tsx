"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Compass,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Save,
  Loader2,
  ShieldCheck,
  Star,
  BookOpen,
  Heart,
  HelpCircle,
  Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

const OBSTACLE_OPTIONS = [
  "Fear of failure",
  "Lack of confidence",
  "Procrastination",
  "Difficulty concentrating",
  "Lack of motivation",
  "Fear of judgment",
  "Digital distractions",
  "Poor time management",
  "Difficulty understanding concepts",
  "Family or academic pressure",
  "Peer pressure",
  "Difficulty asking for help",
  "Other",
];

export default function KnowingMyselfPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  // Student header info
  const [studentName, setStudentName] = useState("");
  const [ageGrade, setAgeGrade] = useState("Darajah 4 (Rabea)");
  const [dateOfAssessment, setDateOfAssessment] = useState(new Date().toISOString().slice(0, 10));

  // Section 1: Strengths & Aspirations
  const [strength1, setStrength1] = useState("");
  const [strength2, setStrength2] = useState("");
  const [strength3, setStrength3] = useState("");
  const [enjoy1, setEnjoy1] = useState("");
  const [enjoy2, setEnjoy2] = useState("");
  const [enjoy3, setEnjoy3] = useState("");
  const [proudAccomplishment, setProudAccomplishment] = useState("");
  const [improveBetterAt, setImproveBetterAt] = useState("");
  const [admirePersonWhy, setAdmirePersonWhy] = useState("");

  // Section 2: Obstacles (Max 3)
  const [selectedObstacles, setSelectedObstacles] = useState<string[]>([]);
  const [otherObstacle, setOtherObstacle] = useState("");

  // Section 3: Further Reflections (14 Compulsory Questions)
  const [difficultResponse, setDifficultResponse] = useState("");
  const [wantToGiveUp, setWantToGiveUp] = useState("");
  const [recoverAfterDisappointment, setRecoverAfterDisappointment] = useState("");
  const [approachForSupport, setApproachForSupport] = useState("");
  const [obstacleWillingToWorkOn, setObstacleWillingToWorkOn] = useState("");
  const [behaviorHurtsMost, setBehaviorHurtsMost] = useState("");
  const [wishOthersUnderstood, setWishOthersUnderstood] = useState("");
  const [successfulPersonMeaning, setSuccessfulPersonMeaning] = useState("");
  const [successBeyondQualifications, setSuccessBeyondQualifications] = useState("");
  const [qualitiesWorthyOfRespect, setQualitiesWorthyOfRespect] = useState("");
  const [continueLearningReason, setContinueLearningReason] = useState("");
  const [khidmatMeaning, setKhidmatMeaning] = useState("");
  const [useSkillsToBenefitOthers, setUseSkillsToBenefitOthers] = useState("");
  const [rememberedFor, setRememberedFor] = useState("");

  useEffect(() => {
    fetchExisting();
  }, []);

  const fetchExisting = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/talabat/profile/knowing-myself");
      if (res.ok) {
        const json = await res.json();
        if (json.student) {
          setStudentName(json.student.name || "");
          const agePart = json.student.age ? `${json.student.age} Yrs` : "";
          const gradePart = `Grade ${json.student.grade || "4"}${json.student.section ? ` (${json.student.section})` : ""}`;
          setAgeGrade(`${agePart} · ${gradePart}`.trim());
        }

        if (json.data) {
          const d = json.data;
          setAlreadySubmitted(true);
          setSubmittedAt(d.submittedAt || null);
          if (d.dateOfAssessment) setDateOfAssessment(d.dateOfAssessment);

          // Strengths & Enjoy
          if (Array.isArray(d.threeStrengths)) {
            setStrength1(d.threeStrengths[0] || "");
            setStrength2(d.threeStrengths[1] || "");
            setStrength3(d.threeStrengths[2] || "");
          }
          if (Array.isArray(d.threeThingsEnjoy)) {
            setEnjoy1(d.threeThingsEnjoy[0] || "");
            setEnjoy2(d.threeThingsEnjoy[1] || "");
            setEnjoy3(d.threeThingsEnjoy[2] || "");
          }
          setProudAccomplishment(d.proudAccomplishment || "");
          setImproveBetterAt(d.improveBetterAt || "");
          setAdmirePersonWhy(d.admirePersonWhy || "");

          // Obstacles
          if (Array.isArray(d.selectedObstacles)) {
            setSelectedObstacles(d.selectedObstacles);
          }
          setOtherObstacle(d.otherObstacle || "");

          // Further reflections
          setDifficultResponse(d.difficultResponse || "");
          setWantToGiveUp(d.wantToGiveUp || "");
          setRecoverAfterDisappointment(d.recoverAfterDisappointment || "");
          setApproachForSupport(d.approachForSupport || "");
          setObstacleWillingToWorkOn(d.obstacleWillingToWorkOn || "");
          setBehaviorHurtsMost(d.behaviorHurtsMost || "");
          setWishOthersUnderstood(d.wishOthersUnderstood || "");
          setSuccessfulPersonMeaning(d.successfulPersonMeaning || "");
          setSuccessBeyondQualifications(d.successBeyondQualifications || "");
          setQualitiesWorthyOfRespect(d.qualitiesWorthyOfRespect || "");
          setContinueLearningReason(d.continueLearningReason || "");
          setKhidmatMeaning(d.khidmatMeaning || "");
          setUseSkillsToBenefitOthers(d.useSkillsToBenefitOthers || "");
          setRememberedFor(d.rememberedFor || "");
        }
      }
    } catch (err) {
      console.error("Failed to fetch assessment:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleObstacle = (item: string) => {
    if (selectedObstacles.includes(item)) {
      setSelectedObstacles((prev) => prev.filter((o) => o !== item));
    } else {
      if (selectedObstacles.length >= 3) {
        toast({
          title: "Maximum 3 Obstacles",
          description: "Please select up to three biggest obstacles that resonate most with you.",
          variant: "warning",
        });
        return;
      }
      setSelectedObstacles((prev) => [...prev, item]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Compulsory check validation
    const missing: string[] = [];
    if (!strength1.trim() || !strength2.trim() || !strength3.trim()) missing.push("Three Greatest Strengths (all 3)");
    if (!enjoy1.trim() || !enjoy2.trim() || !enjoy3.trim()) missing.push("Three Things Genuinely Enjoy Doing (all 3)");
    if (!proudAccomplishment.trim()) missing.push("Proud of accomplishing");
    if (!improveBetterAt.trim()) missing.push("Would like to become better at");
    if (!admirePersonWhy.trim()) missing.push("Someone you admire and why");

    if (selectedObstacles.length === 0) missing.push("Select at least 1 obstacle (up to 3)");
    if (selectedObstacles.includes("Other") && !otherObstacle.trim()) missing.push("Please specify the 'Other' obstacle");

    if (!difficultResponse.trim()) missing.push("What you do when something becomes difficult");
    if (!wantToGiveUp.trim()) missing.push("What makes you want to give up");
    if (!recoverAfterDisappointment.trim()) missing.push("What helps you recover after disappointment");
    if (!approachForSupport.trim()) missing.push("Who you approach when you need support");
    if (!obstacleWillingToWorkOn.trim()) missing.push("One obstacle you are willing to work on");
    if (!behaviorHurtsMost.trim()) missing.push("Behavior from others that hurts or upsets you most");
    if (!wishOthersUnderstood.trim()) missing.push("What you wish others understood about you");
    if (!successfulPersonMeaning.trim()) missing.push("What being a successful person means to you");
    if (!successBeyondQualifications.trim()) missing.push("Is success only about qualifications, money, and recognition?");
    if (!qualitiesWorthyOfRespect.trim()) missing.push("Qualities that make someone worthy of respect");
    if (!continueLearningReason.trim()) missing.push("Why a person should continue learning");
    if (!khidmatMeaning.trim()) missing.push("What Khidmat means to you");
    if (!useSkillsToBenefitOthers.trim()) missing.push("How you can use your skills to benefit others");
    if (!rememberedFor.trim()) missing.push("What you would like people to remember you for");

    if (missing.length > 0) {
      toast({
        title: "All Questions Are Compulsory",
        description: `Please complete: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` and ${missing.length - 3} more...` : ""}.`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        studentName,
        ageGrade,
        dateOfAssessment,
        threeStrengths: [strength1.trim(), strength2.trim(), strength3.trim()],
        threeThingsEnjoy: [enjoy1.trim(), enjoy2.trim(), enjoy3.trim()],
        proudAccomplishment: proudAccomplishment.trim(),
        improveBetterAt: improveBetterAt.trim(),
        admirePersonWhy: admirePersonWhy.trim(),
        selectedObstacles,
        otherObstacle: otherObstacle.trim(),
        difficultResponse: difficultResponse.trim(),
        wantToGiveUp: wantToGiveUp.trim(),
        recoverAfterDisappointment: recoverAfterDisappointment.trim(),
        approachForSupport: approachForSupport.trim(),
        obstacleWillingToWorkOn: obstacleWillingToWorkOn.trim(),
        behaviorHurtsMost: behaviorHurtsMost.trim(),
        wishOthersUnderstood: wishOthersUnderstood.trim(),
        successfulPersonMeaning: successfulPersonMeaning.trim(),
        successBeyondQualifications: successBeyondQualifications.trim(),
        qualitiesWorthyOfRespect: qualitiesWorthyOfRespect.trim(),
        continueLearningReason: continueLearningReason.trim(),
        khidmatMeaning: khidmatMeaning.trim(),
        useSkillsToBenefitOthers: useSkillsToBenefitOthers.trim(),
        rememberedFor: rememberedFor.trim(),
      };

      const res = await fetch("/api/talabat/profile/knowing-myself", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          title: "Assessment Submitted Successfully!",
          description: "Your responses have been securely synced to school administration.",
          variant: "success",
        });
        // Redirect back to profile settings with ?submitted=knowing-myself query
        router.push("/talabat/profile?submitted=knowing-myself");
      } else {
        const json = await res.json().catch(() => ({}));
        toast({
          title: "Submission Failed",
          description: json.error || "Failed to save assessment. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Submission error:", err);
      toast({
        title: "Network Error",
        description: err?.message || "Failed to submit assessment.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm font-medium text-slate-500">Loading reflection questionnaire...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/talabat/profile"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Profile Settings</span>
        </Link>
        {alreadySubmitted && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Submitted {submittedAt ? new Date(submittedAt).toLocaleDateString("en-GB") : ""}</span>
          </span>
        )}
      </div>

      {/* ── Document Hero Header ── */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0c2e22] via-[#0f4030] to-[#082218] text-white p-6 sm:p-8 border border-[#d4af37]/50 shadow-[0_16px_40px_rgba(2,31,24,0.45)]">
        <div className="pointer-events-none absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-[#d4af37]/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -top-12 w-64 h-64 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-[#d4af37]/20 text-[#f5e6b3] border border-[#d4af37]/40 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
              Darajah Rabea (Grade 4) Compulsory Assessment
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-white">
              Knowing Myself
            </h1>
            <p className="text-base sm:text-lg font-medium text-emerald-100/90 italic font-serif">
              My Identity and Aspirations
            </p>
          </div>

          <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl leading-relaxed">
            This comprehensive self-reflection is designed for Darajah Rabea Talabat. Take time to answer honestly and thoughtfully. All questions are compulsory and will be reviewed by school mentors and administration.
          </p>

          {/* Pre-filled meta strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-white/15 text-xs">
            <div className="bg-white/10 rounded-xl p-2.5 backdrop-blur-xs">
              <div className="text-[10px] uppercase font-bold text-emerald-200/80">Student Name</div>
              <div className="font-bold text-white truncate mt-0.5">{studentName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Student"}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5 backdrop-blur-xs">
              <div className="text-[10px] uppercase font-bold text-emerald-200/80">Age / Grade</div>
              <div className="font-bold text-white truncate mt-0.5">{ageGrade || "Darajah 4 (Rabea)"}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5 backdrop-blur-xs">
              <div className="text-[10px] uppercase font-bold text-emerald-200/80">Date of Assessment</div>
              <input
                type="date"
                value={dateOfAssessment}
                onChange={(e) => setDateOfAssessment(e.target.value)}
                className="bg-transparent text-white font-bold text-xs mt-0.5 outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Section 1: Strengths & Aspirations ── */}
        <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/80 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              Part 1: Strengths &amp; Self-Discovery
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Reflect on your personal qualities, passions, and achievements.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-5">
            {/* 1. Three Greatest Strengths */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                <span>My three greatest strengths: <span className="text-rose-500">*</span></span>
                <span className="text-[10px] font-normal text-slate-400">All 3 required</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  required
                  value={strength1}
                  onChange={(e) => setStrength1(e.target.value)}
                  placeholder="1. e.g. Resilience in difficult tasks"
                  className="fatimi-input text-xs"
                />
                <input
                  type="text"
                  required
                  value={strength2}
                  onChange={(e) => setStrength2(e.target.value)}
                  placeholder="2. e.g. Empathy & helping peers"
                  className="fatimi-input text-xs"
                />
                <input
                  type="text"
                  required
                  value={strength3}
                  onChange={(e) => setStrength3(e.target.value)}
                  placeholder="3. e.g. Analytical thinking & focus"
                  className="fatimi-input text-xs"
                />
              </div>
            </div>

            {/* 2. Three things I genuinely enjoy doing */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                <span>Three things I genuinely enjoy doing: <span className="text-rose-500">*</span></span>
                <span className="text-[10px] font-normal text-slate-400">All 3 required</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  required
                  value={enjoy1}
                  onChange={(e) => setEnjoy1(e.target.value)}
                  placeholder="1. e.g. Reading history books"
                  className="fatimi-input text-xs"
                />
                <input
                  type="text"
                  required
                  value={enjoy2}
                  onChange={(e) => setEnjoy2(e.target.value)}
                  placeholder="2. e.g. Writing Arabic calligraphy"
                  className="fatimi-input text-xs"
                />
                <input
                  type="text"
                  required
                  value={enjoy3}
                  onChange={(e) => setEnjoy3(e.target.value)}
                  placeholder="3. e.g. Creative problem solving"
                  className="fatimi-input text-xs"
                />
              </div>
            </div>

            {/* 3. Accomplishment */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Something I am proud of accomplishing: <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={proudAccomplishment}
                onChange={(e) => setProudAccomplishment(e.target.value)}
                placeholder="Share a project, achievement, personal milestone, or moment where you pushed through a challenge..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* 4. Improvement */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Something I would like to become better at: <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={improveBetterAt}
                onChange={(e) => setImproveBetterAt(e.target.value)}
                placeholder="A habit, academic subject, soft skill, or mindset you wish to strengthen..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* 5. Admire Person */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Someone I admire and why: <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={admirePersonWhy}
                onChange={(e) => setAdmirePersonWhy(e.target.value)}
                placeholder="Name the person (mentor, parent, historical figure, or teacher) and the specific values or character traits you admire in them..."
                className="fatimi-input text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Section 2: Obstacles & Challenges ── */}
        <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-amber-50/50 border-b border-amber-100">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                Part 2: Obstacles &amp; Growth Edge
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                selectedObstacles.length === 3
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                  : selectedObstacles.length > 0
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-slate-100 text-slate-600 border-slate-300"
              }`}>
                {selectedObstacles.length} of 3 selected
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-600">
              What are the three biggest obstacles I experience? <strong>Select up to three obstacles:</strong> <span className="text-rose-500">*</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {OBSTACLE_OPTIONS.map((opt) => {
                const checked = selectedObstacles.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleToggleObstacle(opt)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                      checked
                        ? "bg-amber-50 text-amber-950 border-amber-400 shadow-xs ring-1 ring-amber-400"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                        checked ? "bg-amber-600 border-amber-600 text-white" : "border-slate-300 bg-white"
                      }`}
                    >
                      {checked && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>

            {selectedObstacles.includes("Other") && (
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Please specify your "Other" obstacle: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={otherObstacle}
                  onChange={(e) => setOtherObstacle(e.target.value)}
                  placeholder="Describe your obstacle in your own words..."
                  className="fatimi-input text-xs"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 3: Further Reflection (14 Compulsory Questions) ── */}
        <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-emerald-50/50 border-b border-emerald-100">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-700" />
              Part 3: Further Reflection
            </CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Deep reflective questions regarding resilience, character, success, and Khidmat. <strong>All 14 questions are compulsory.</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-5">
            {/* Q1 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                1. When something becomes difficult, what do you usually do? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={difficultResponse}
                onChange={(e) => setDifficultResponse(e.target.value)}
                placeholder="Describe your instinctive reaction and steps you take when faced with difficulty..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* Q2 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                2. What makes you want to give up? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={wantToGiveUp}
                onChange={(e) => setWantToGiveUp(e.target.value)}
                placeholder="What triggers feelings of exhaustion, frustration, or discouragement..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* Q3 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                3. What helps you recover after disappointment? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={recoverAfterDisappointment}
                onChange={(e) => setRecoverAfterDisappointment(e.target.value)}
                placeholder="What restores your hope, clarity, and motivation after an outcome didn't go your way..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* Q4 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                4. Who do you approach when you need support? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={approachForSupport}
                onChange={(e) => setApproachForSupport(e.target.value)}
                placeholder="Mentors, parents, specific asaatizah, friends, or trusted family members..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* Q5 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                5. What is one obstacle you are willing to work on? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={obstacleWillingToWorkOn}
                onChange={(e) => setObstacleWillingToWorkOn(e.target.value)}
                placeholder="Select one obstacle you commit to overcoming and how you plan to tackle it..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* Q6 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                6. What kind of behavior from others hurts or upsets you the most? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={behaviorHurtsMost}
                onChange={(e) => setBehaviorHurtsMost(e.target.value)}
                placeholder="Reflect on behaviors that impact your emotional well-being..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* Q7 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                7. What do you wish others understood about you? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={wishOthersUnderstood}
                onChange={(e) => setWishOthersUnderstood(e.target.value)}
                placeholder="What part of your personality, thoughts, or effort goes unseen by others..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* Q8 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                8. What does being a successful person mean to you? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={successfulPersonMeaning}
                onChange={(e) => setSuccessfulPersonMeaning(e.target.value)}
                placeholder="Define real success in your personal and spiritual life..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* Q9 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                9. Is success only about qualifications, money, and recognition? Why? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={successBeyondQualifications}
                onChange={(e) => setSuccessBeyondQualifications(e.target.value)}
                placeholder="Share your perspective on inner peace, akhlaq, contentment, and true accomplishment..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* Q10 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                10. What qualities make someone worthy of respect? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={qualitiesWorthyOfRespect}
                onChange={(e) => setQualitiesWorthyOfRespect(e.target.value)}
                placeholder="Humility, honesty, loyalty, dedication, knowledge..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* Q11 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                11. Why should a person continue learning even after completing formal education? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={continueLearningReason}
                onChange={(e) => setContinueLearningReason(e.target.value)}
                placeholder="Explain the importance of lifelong learning and spiritual refinement..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* Q12 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                12. What does Khidmat mean to you? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={khidmatMeaning}
                onChange={(e) => setKhidmatMeaning(e.target.value)}
                placeholder="Reflect on selfless devotion, serving the community, and fulfilling duties to Moula (TUS)..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* Q13 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                13. How can you use your knowledge, skills, and abilities to benefit others? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={useSkillsToBenefitOthers}
                onChange={(e) => setUseSkillsToBenefitOthers(e.target.value)}
                placeholder="Practical ways you plan to apply what you have learned at Darse Burhani to help others..."
                className="fatimi-input text-xs"
              />
            </div>

            {/* Q14 */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                14. What would you like people to remember you for? <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={rememberedFor}
                onChange={(e) => setRememberedFor(e.target.value)}
                placeholder="Your legacy, character, values, and lasting impact on those around you..."
                className="fatimi-input text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Submit Action Footer ── */}
        <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            <span className="font-bold text-slate-800">Compulsory Assessment: </span>
            <span>All responses will be securely stored and reviewed by Administration.</span>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Link
              href="/talabat/profile"
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all text-center flex-1 sm:flex-initial"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              disabled={saving}
              className="fatimi-emerald-gradient text-white hover:opacity-90 shadow-md min-w-[200px] flex-1 sm:flex-initial text-xs font-bold"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {alreadySubmitted ? "Update & Save Assessment" : "Submit Assessment to Admin"}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
