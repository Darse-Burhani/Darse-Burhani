"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  FileSpreadsheet,
  Edit3,
  Star,
  GraduationCap,
  X,
  Send,
  Eye,
  Award,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Camera,
  Upload,
  User,
  ZoomIn,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Save,
  HeartHandshake,
  ArrowUpRight,
  Check,
  UserCheck,
  Lock,
  Unlock,
  Shield,
  ShieldCheck,
  Activity,
  Layers,
} from "lucide-react";
import { TalabatProfileDocument, TalabatProfileData } from "@/components/talabat/TalabatProfileDocument";
import { TalabatBulkDownloadModal, BulkStudentTarget } from "@/components/talabat/TalabatBulkDownloadModal";

const normalizeImgSrc = (url?: string | null): string => {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return "/" + trimmed;
};

interface StudentListItem {
  studentId: string;
  idNo: string;
  its: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  grade: string;
  section: string;
  status: string;
  hasProfile: boolean;
  studentPhotoUrl?: string | null;
  fatherPhotoUrl?: string | null;
  motherPhotoUrl?: string | null;
  hasStudentPhoto?: boolean;
  hasFatherPhoto?: boolean;
  hasMotherPhoto?: boolean;
  ratings?: {
    behaviour?: number | null;
    communication?: number | null;
    dedication?: number | null;
    discipline?: number | null;
    hasRemarks?: boolean;
  } | null;
  departmentResponses?: Record<string, boolean>;
  filledCount?: number;
  totalDepartments?: number;
  remarksPreview?: Record<string, string | null> | null;
  updatedAt?: string | null;
}

export const ADMIN_EVALUATION_TABS = [
  { id: "masool", short: "M", label: "Class Masul", arLabel: "المسؤول عن الدرجة", icon: Award, desc: "General conduct, participation & student demeanor" },
  { id: "tahfeez", short: "Th", label: "Tahfeez Department", arLabel: "عن التحفيظ", icon: BookOpen, desc: "Hifz al-Quran progress, sincerity and recitation" },
  { id: "taleem", short: "Tl", label: "Ta'leem / Academic", arLabel: "عن التعليم", icon: GraduationCap, desc: "Academic level, class engagement and comprehension" },
  { id: "tadeeb", short: "Td", label: "Ta'deeb & Akhlaaq", arLabel: "عن التأديب والرياضة", icon: ShieldCheck, desc: "Manners, morals and adherence to institutional norms" },
  { id: "tanzeem", short: "Tz", label: "Tanzeem & Attendance", arLabel: "عن التنظيم", icon: Clock, desc: "Punctuality, prayer attendance and daily routines" },
  { id: "sports", short: "Sp", label: "Sports & Athletics", arLabel: "عن خيمة الرياضة", icon: Activity, desc: "Physical education, sports events and athletic spirit" },
  { id: "maktabat", short: "Mk", label: "Maktabat / Library", arLabel: "المكتبة", icon: BookOpen, desc: "Reading habits, library utilization and issued books" },
  { id: "skills", short: "Sk", label: "Art & IT Skills", arLabel: "عن الفن والمهارة", icon: Sparkles, desc: "Special talents, computer/coding skills and hobbies" },
  { id: "otherExams", short: "Ex", label: "External Board Exams", arLabel: "عن الامتحانات الأخرى", icon: Layers, desc: "Board exams (10th/12th), NIOS or external certifications" },
  { id: "counselling", short: "Cn", label: "Counselling & Career", arLabel: "الإرشاد والتوجيه", icon: HeartHandshake, desc: "Confidential guidance, career trajectory and counselling" },
  { id: "ratings", short: "★", label: "5-Star Ratings", arLabel: "التقييم العام", icon: Star, desc: "Behaviour, Communication, Dedication, Discipline" },
];

export interface TabDelegationTeacher {
  teacherId: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  isAllTabs: boolean;
  assignedTabs: string[];
}

export default function AdminTalabatProfilesPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Tab navigation inside evaluation modal
  const [activeDepartmentTab, setActiveDepartmentTab] = useState<string>("tahfeez");
  const [evaluationViewSubMode, setEvaluationViewSubMode] = useState<"OVERVIEW" | "TABS">("OVERVIEW");

  // Granular Tab Delegation State
  const [tabDelegationList, setTabDelegationList] = useState<TabDelegationTeacher[]>([]);
  const [delegationViewMode, setDelegationViewMode] = useState<"BY_TAB" | "BY_TEACHER">("BY_TAB");
  const [activeDelegationTab, setActiveDelegationTab] = useState<string>("tahfeez");
  const [savingDelegation, setSavingDelegation] = useState(false);

  // Bulk Selection & Download State
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isBulkDownloadOpen, setIsBulkDownloadOpen] = useState(false);

  // Review / View Modal State
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [activeProfile, setActiveProfile] = useState<TalabatProfileData | null>(null);
  const [reviewerName, setReviewerName] = useState<string | null>(null);

  // Lightbox & Admin photo upload state
  const [lightboxImg, setLightboxImg] = useState<{ url: string; title: string } | null>(null);
  const [uploadingAdminPhoto, setUploadingAdminPhoto] = useState<string | null>(null);

  // Remarks Form State inside modal
  const [behaviourRating, setBehaviourRating] = useState<number>(5);
  const [communicationRating, setCommunicationRating] = useState<number>(5);
  const [dedicationRating, setDedicationRating] = useState<number>(5);
  const [disciplineRating, setDisciplineRating] = useState<number>(5);

  // 10 Granular Category Remarks
  const [remarksMasool, setRemarksMasool] = useState<string>("");
  const [remarksTahfeez, setRemarksTahfeez] = useState<string>("");
  const [remarksTaleem, setRemarksTaleem] = useState<string>("");
  const [remarksTadeeb, setRemarksTadeeb] = useState<string>("");
  const [remarksTanzeem, setRemarksTanzeem] = useState<string>("");
  const [remarksSports, setRemarksSports] = useState<string>("");
  const [remarksMaktabat, setRemarksMaktabat] = useState<string>("");
  const [remarksSkills, setRemarksSkills] = useState<string>("");
  const [remarksOtherExams, setRemarksOtherExams] = useState<string>("");
  const [remarksCounselling, setRemarksCounselling] = useState<string>("");
  const [counsellingNotes, setCounsellingNotes] = useState<string>("");

  const [savingRemarks, setSavingRemarks] = useState(false);
  const [savingCounsellor, setSavingCounsellor] = useState(false);
  const [modalViewTab, setModalViewTab] = useState<"fill" | "counsellor" | "edit-profile" | "document">("fill");
  const [adminReviewStatus, setAdminReviewStatus] = useState<string>("REVIEWED");
  const [showStudentDetailsAbove, setShowStudentDetailsAbove] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Full admin editing state
  const [savingAdminProfile, setSavingAdminProfile] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState<Partial<TalabatProfileData>>({});

  // Teaching faculty assignments state (restricted strictly to teachers assigned subjects for teaching)
  interface TeachingFacultyMember {
    id: string;
    teacherProfileId: string;
    name: string;
    email: string;
    employeeId: string;
    its: string;
    department: string;
    avatarUrl?: string | null;
    subjects: string[];
    classes: string[];
    masoolClasses: string[];
    canEditRemarks: boolean;
    canEditCounsellor: boolean;
    isMasterAdmin: boolean;
  }

  const [showAssignFacultyModal, setShowAssignFacultyModal] = useState(false);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [teachingFacultyList, setTeachingFacultyList] = useState<TeachingFacultyMember[]>([]);
  const [facultySearchQuery, setFacultySearchQuery] = useState("");
  const [facultyFilter, setFacultyFilter] = useState<"ALL" | "ENABLED" | "LOCKED">("ALL");
  const [togglingFacultyId, setTogglingFacultyId] = useState<string | null>(null);
  const [facultyMsg, setFacultyMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchTeachingFaculty = async () => {
    try {
      setLoadingFaculty(true);
      const res = await fetch("/api/talabat-profile/teaching-faculty");
      const data = await res.json();
      if (data.success && Array.isArray(data.faculty)) {
        setTeachingFacultyList(data.faculty);
      }
    } catch (err) {
      console.error("Failed to load teaching faculty", err);
    } finally {
      setLoadingFaculty(false);
    }
  };

  const fetchTabAssignments = async () => {
    try {
      setLoadingFaculty(true);
      const res = await fetch("/api/talabat-profile/tab-assignments");
      const data = await res.json();
      if (data.success && Array.isArray(data.teachers)) {
        setTabDelegationList(data.teachers);
      }
    } catch (err) {
      console.error("Failed to load tab assignments", err);
    } finally {
      setLoadingFaculty(false);
    }
  };

  const openAssignFacultyModal = () => {
    setShowAssignFacultyModal(true);
    setFacultyMsg(null);
    fetchTeachingFaculty();
    fetchTabAssignments();
  };

  const handleToggleTeacherForTab = async (tabKey: string, teacherId: string) => {
    const currentTeacherIds = tabDelegationList
      .filter((t) => t.isAllTabs || t.assignedTabs.includes(tabKey))
      .map((t) => t.teacherId);
    const isCurrentlyAssigned = currentTeacherIds.includes(teacherId);
    const nextTeacherIds = isCurrentlyAssigned
      ? currentTeacherIds.filter((id) => id !== teacherId)
      : [...currentTeacherIds, teacherId];

    // Optimistic local update
    setTabDelegationList((prev) =>
      prev.map((t) => {
        if (t.teacherId === teacherId) {
          const nextTabs = isCurrentlyAssigned
            ? t.assignedTabs.filter((tab) => tab !== tabKey)
            : [...t.assignedTabs, tabKey];
          return { ...t, assignedTabs: nextTabs, isAllTabs: false };
        }
        return t;
      })
    );

    try {
      setSavingDelegation(true);
      setFacultyMsg(null);
      const res = await fetch("/api/talabat-profile/tab-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabKey, teacherIds: nextTeacherIds }),
      });
      const data = await res.json();
      if (data.success) {
        setFacultyMsg({ type: "success", text: `Incharge faculty updated for ${tabKey}!` });
      } else {
        setFacultyMsg({ type: "error", text: data.error || "Failed to update tab assignments" });
        fetchTabAssignments();
      }
    } catch (err: any) {
      setFacultyMsg({ type: "error", text: err.message || "Network error" });
      fetchTabAssignments();
    } finally {
      setSavingDelegation(false);
    }
  };

  const handleSaveTeacherTabs = async (teacherId: string, tabs: string[], isAll: boolean) => {
    setTabDelegationList((prev) =>
      prev.map((t) => (t.teacherId === teacherId ? { ...t, assignedTabs: tabs, isAllTabs: isAll } : t))
    );

    try {
      setSavingDelegation(true);
      setFacultyMsg(null);
      const res = await fetch("/api/talabat-profile/tab-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, tabs, isAll }),
      });
      const data = await res.json();
      if (data.success) {
        setFacultyMsg({ type: "success", text: "Department tab assignments updated for teacher!" });
      } else {
        setFacultyMsg({ type: "error", text: data.error || "Failed to save teacher tab assignments" });
        fetchTabAssignments();
      }
    } catch (err: any) {
      setFacultyMsg({ type: "error", text: err.message || "Network error" });
      fetchTabAssignments();
    } finally {
      setSavingDelegation(false);
    }
  };

  const handleToggleFacultyPermission = async (
    teacher: TeachingFacultyMember,
    permType: "remarks" | "counsellor"
  ) => {
    const newRemarks = permType === "remarks" ? !teacher.canEditRemarks : teacher.canEditRemarks;
    const newCounsellor = permType === "counsellor" ? !teacher.canEditCounsellor : teacher.canEditCounsellor;

    // Optimistic update
    setTeachingFacultyList((prev) =>
      prev.map((t) =>
        t.id === teacher.id
          ? {
              ...t,
              canEditRemarks: newRemarks,
              canEditCounsellor: newCounsellor,
            }
          : t
      )
    );

    try {
      setTogglingFacultyId(teacher.id);
      setFacultyMsg(null);
      const res = await fetch("/api/talabat-profile/assign-faculty-remarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherUserId: teacher.id,
          teacherProfileId: teacher.teacherProfileId,
          canEditRemarks: permType === "remarks" ? newRemarks : undefined,
          canEditCounsellor: permType === "counsellor" ? newCounsellor : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFacultyMsg({
          type: "success",
          text: `Permissions updated for ${teacher.name}: ${
            permType === "remarks"
              ? newRemarks ? "Remarks editing granted" : "Remarks editing locked"
              : newCounsellor ? "Counsellor access granted" : "Counsellor access restricted"
          }`,
        });
      } else {
        // Rollback
        setTeachingFacultyList((prev) =>
          prev.map((t) => (t.id === teacher.id ? teacher : t))
        );
        setFacultyMsg({ type: "error", text: data.error || "Failed to update permission" });
      }
    } catch (err: any) {
      // Rollback
      setTeachingFacultyList((prev) =>
        prev.map((t) => (t.id === teacher.id ? teacher : t))
      );
      setFacultyMsg({ type: "error", text: err.message || "Network error" });
    } finally {
      setTogglingFacultyId(null);
    }
  };

  // Real-time synchronization state
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchList();

    // Silent background auto-polling every 25 seconds for realtime collaboration
    const pollInterval = setInterval(() => {
      fetchList(true);
    }, 25000);

    // Relative elapsed time counter
    const clockInterval = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(clockInterval);
    };
  }, []);

  const fetchList = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const res = await fetch("/api/talabat-profile/list");
      const data = await res.json();
      if (data.success && Array.isArray(data.students)) {
        setStudents(data.students);
        setLastSynced(new Date());
        setSecondsAgo(0);
      } else {
        setStudents([]);
      }
    } catch (e) {
      setStudents([]);
      console.error("Failed to load list", e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const openStudentModal = async (
    studentId: string,
    defaultTab: "fill" | "counsellor" | "edit-profile" | "document" = "fill",
    focusDepartmentTab?: string
  ) => {
    setSelectedStudentId(studentId);
    setModalLoading(true);
    setFeedbackMsg(null);
    setModalViewTab(defaultTab);
    if (focusDepartmentTab) {
      setActiveDepartmentTab(focusDepartmentTab);
      setEvaluationViewSubMode("TABS");
    }

    try {
      const res = await fetch(`/api/talabat-profile/view/${studentId}`);
      const data = await res.json();
      if (data.success && data.profile) {
        const info = data.studentInfo || {};
        const p = {
          ...data.profile,
          name: data.profile.name || info.name,
          itsNo: data.profile.itsNo || info.its,
          studentPhotoUrl: data.profile.studentPhotoUrl || info.avatarUrl,
          motherName: data.profile.motherName || info.motherName,
          fatherName: data.profile.fatherName || info.fatherName,
          fatherOccupation: data.profile.fatherOccupation || info.fatherOccupation,
          standard: data.profile.standard || info.standard || info.grade,
          grade: data.profile.grade || info.grade,
          section: data.profile.section || info.section,
          studentStatus: data.profile.studentStatus || info.studentStatus,
          admissionYear: data.profile.admissionYear || info.admissionYear,
          currentYear: data.profile.currentYear || info.currentYear,
          age: data.profile.age || info.age,
          watan: data.profile.vatan || data.profile.watan || info.watan,
          residentCity: data.profile.jamaat || data.profile.residentCity || info.residentCity,
          address: data.profile.address || info.address,
          mobileNumber: data.profile.mobileNumber || info.mobileNumber,
          email: data.profile.email || info.email,
          externalSchooling: data.profile.externalSchooling || info.externalSchooling,
          reallyGoodAt: data.profile.reallyGoodAt || info.reallyGoodAt,
          loveToStudy: data.profile.loveToStudy || info.loveToStudy,
          loveForFun: data.profile.loveForFun || info.loveForFun,
          knowingMyself: data.knowingMyself || data.profile?.knowingMyself || null,
        };
        setActiveProfile(p);
        setEditProfileForm({
          ...p,
          strengths: Array.isArray(p.strengths) ? [...p.strengths] : ["", "", ""],
          weaknesses: Array.isArray(p.weaknesses) ? [...p.weaknesses] : ["", "", ""],
        });
        setAdminReviewStatus(p.status || "REVIEWED");
        setReviewerName(data.reviewerName || null);
        setBehaviourRating(p.behaviourRating || 5);
        setCommunicationRating(p.communicationRating || 5);
        setDedicationRating(p.dedicationRating || 5);
        setDisciplineRating(p.disciplineRating || 5);

        setRemarksMasool(p.remarksMasool || p.masoolRemarks || "");
        setRemarksTahfeez(p.remarksTahfeez || "");
        setRemarksTaleem(p.remarksTaleem || "");
        setRemarksTadeeb(p.remarksTadeeb || "");
        setRemarksTanzeem(p.remarksTanzeem || "");
        setRemarksSports(p.remarksSports || "");
        setRemarksMaktabat(p.remarksMaktabat || "");
        setRemarksSkills(p.remarksSkills || "");
        setRemarksOtherExams(p.remarksOtherExams || "");
        setRemarksCounselling(p.remarksCounselling || "");
        setCounsellingNotes(p.counsellingNotes || "");
      }
    } catch (err) {
      console.error("Failed to fetch student profile", err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveRemarks = async (advanceNext: boolean = false) => {
    if (!selectedStudentId) return;
    try {
      setSavingRemarks(true);
      setFeedbackMsg(null);
      const res = await fetch(`/api/talabat-profile/remarks/${selectedStudentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          behaviourRating,
          communicationRating,
          dedicationRating,
          disciplineRating,
          status: adminReviewStatus,
          remarksMasool,
          remarksTahfeez,
          remarksTaleem,
          remarksTadeeb,
          remarksTanzeem,
          remarksSports,
          remarksMaktabat,
          remarksSkills,
          remarksOtherExams,
          remarksCounselling,
          counsellingNotes,
          masoolRemarks: remarksMasool,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ type: "success", text: "Remarks, status, and ratings saved successfully!" });
        if (activeProfile) {
          setActiveProfile({
            ...activeProfile,
            behaviourRating,
            communicationRating,
            dedicationRating,
            disciplineRating,
            remarksMasool,
            remarksTahfeez,
            remarksTaleem,
            remarksTadeeb,
            remarksTanzeem,
            remarksSports,
            remarksMaktabat,
            remarksSkills,
            remarksOtherExams,
            remarksCounselling,
            counsellingNotes,
            masoolRemarks: remarksMasool,
            status: adminReviewStatus,
          });
        }
        // Optimistic update in students list immediately for real-time KPI reflection
        setStudents((prev) =>
          prev.map((s) =>
            s.studentId === selectedStudentId
              ? {
                  ...s,
                  status: adminReviewStatus,
                  ratings: {
                    behaviour: behaviourRating,
                    communication: communicationRating,
                    dedication: dedicationRating,
                    discipline: disciplineRating,
                    hasRemarks: true,
                  },
                }
              : s
          )
        );
        let nextStudentToOpen: StudentListItem | null = null;
        if (advanceNext) {
          const curIdx = filteredStudents.findIndex((s) => s.studentId === selectedStudentId);
          if (curIdx >= 0 && curIdx < filteredStudents.length - 1) {
            nextStudentToOpen = filteredStudents[curIdx + 1];
          }
        }

        fetchList(true);

        if (nextStudentToOpen) {
          openStudentModal(nextStudentToOpen.studentId, modalViewTab);
        } else if (advanceNext) {
          setFeedbackMsg({ type: "success", text: "All students in this filter have been evaluated!" });
        }
      } else {
        setFeedbackMsg({ type: "error", text: data.error || "Failed to save remarks" });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Network error" });
    } finally {
      setSavingRemarks(false);
    }
  };

  const handleSaveCounsellorRemarks = async () => {
    if (!selectedStudentId) return;
    try {
      setSavingCounsellor(true);
      setFeedbackMsg(null);
      const res = await fetch(`/api/talabat-profile/remarks/${selectedStudentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remarksCounselling,
          counsellingNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ type: "success", text: "Counsellor remarks and guidance saved & synced successfully!" });
        if (activeProfile) {
          setActiveProfile({
            ...activeProfile,
            remarksCounselling,
            counsellingNotes,
            status: "REVIEWED",
          });
        }
        fetchList(true);
      } else {
        setFeedbackMsg({ type: "error", text: data.error || "Failed to save counsellor remarks" });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Network error while saving counsellor remarks" });
    } finally {
      setSavingCounsellor(false);
    }
  };

  const handleSaveAdminProfile = async () => {
    if (!selectedStudentId) return;
    try {
      setSavingAdminProfile(true);
      setFeedbackMsg(null);
      const res = await fetch(`/api/talabat-profile/admin/profile/${selectedStudentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editProfileForm),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setFeedbackMsg({ type: "success", text: "Student profile report updated and saved successfully!" });
        setActiveProfile((prev) => ({ ...data.data, knowingMyself: prev?.knowingMyself || null }));
        setEditProfileForm({
          ...data.data,
          strengths: Array.isArray(data.data.strengths) ? [...data.data.strengths] : ["", "", ""],
          weaknesses: Array.isArray(data.data.weaknesses) ? [...data.data.weaknesses] : ["", "", ""],
        });
        setStudents((prev) =>
          prev.map((s) =>
            s.studentId === selectedStudentId
              ? {
                  ...s,
                  name: data.data.name || s.name,
                  its: data.data.itsNo || s.its,
                  status: data.data.status || s.status,
                  studentPhotoUrl: data.data.studentPhotoUrl || s.studentPhotoUrl,
                  fatherPhotoUrl: data.data.fatherPhotoUrl || s.fatherPhotoUrl,
                  motherPhotoUrl: data.data.motherPhotoUrl || s.motherPhotoUrl,
                  hasStudentPhoto: !!(data.data.studentPhotoUrl || s.studentPhotoUrl),
                  hasFatherPhoto: !!data.data.fatherPhotoUrl,
                  hasMotherPhoto: !!data.data.motherPhotoUrl,
                }
              : s
          )
        );
        fetchList(true);
      } else {
        setFeedbackMsg({ type: "error", text: data.error || "Failed to save profile changes" });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Network error" });
    } finally {
      setSavingAdminProfile(false);
    }
  };

  const addEditStrength = () => {
    setEditProfileForm((prev) => ({
      ...prev,
      strengths: [...(prev.strengths || []), ""],
    }));
  };

  const removeEditStrength = (index: number) => {
    setEditProfileForm((prev) => ({
      ...prev,
      strengths: (prev.strengths || []).filter((_, i) => i !== index),
    }));
  };

  const updateEditStrength = (index: number, val: string) => {
    setEditProfileForm((prev) => {
      const list = [...(prev.strengths || [])];
      list[index] = val;
      return { ...prev, strengths: list };
    });
  };

  const addEditWeakness = () => {
    setEditProfileForm((prev) => ({
      ...prev,
      weaknesses: [...(prev.weaknesses || []), ""],
    }));
  };

  const removeEditWeakness = (index: number) => {
    setEditProfileForm((prev) => ({
      ...prev,
      weaknesses: (prev.weaknesses || []).filter((_, i) => i !== index),
    }));
  };

  const updateEditWeakness = (index: number, val: string) => {
    setEditProfileForm((prev) => {
      const list = [...(prev.weaknesses || [])];
      list[index] = val;
      return { ...prev, weaknesses: list };
    });
  };

  const handleAdminPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    photoField: "studentPhotoUrl" | "fatherPhotoUrl" | "motherPhotoUrl"
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudentId) return;
    e.target.value = "";

    try {
      setUploadingAdminPhoto(photoField);
      setFeedbackMsg(null);

      const fd = new FormData();
      fd.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });
      const uploadData = await uploadRes.json();

      if (uploadData.success && uploadData.url) {
        const updateRes = await fetch(`/api/talabat-profile/admin/profile/${selectedStudentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [photoField]: uploadData.url }),
        });
        const updateData = await updateRes.json();

        if (updateData.success) {
          setActiveProfile((prev) => (prev ? { ...prev, [photoField]: uploadData.url } : null));
          const label = photoField === "fatherPhotoUrl" ? "Father" : photoField === "motherPhotoUrl" ? "Mother" : "Student";
          setFeedbackMsg({ type: "success", text: `${label} photo updated and saved successfully!` });

          // Optimistic update in students list
          setStudents((prev) =>
            prev.map((s) => {
              if (s.studentId !== selectedStudentId) return s;
              return {
                ...s,
                [photoField]: uploadData.url,
                hasStudentPhoto: photoField === "studentPhotoUrl" ? true : s.hasStudentPhoto,
                hasFatherPhoto: photoField === "fatherPhotoUrl" ? true : s.hasFatherPhoto,
                hasMotherPhoto: photoField === "motherPhotoUrl" ? true : s.hasMotherPhoto,
              };
            })
          );
          fetchList(true);
        } else {
          setFeedbackMsg({ type: "error", text: updateData.error || "Failed to update profile photo" });
        }
      } else {
        setFeedbackMsg({ type: "error", text: uploadData.error || "Upload failed" });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Network error during upload" });
    } finally {
      setUploadingAdminPhoto(null);
    }
  };

  const handleDirectUpload = async (
    studentId: string,
    photoField: "studentPhotoUrl" | "fatherPhotoUrl" | "motherPhotoUrl",
    file: File
  ) => {
    try {
      setFeedbackMsg(null);
      const fd = new FormData();
      fd.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });
      const uploadData = await uploadRes.json();

      if (uploadData.success && uploadData.url) {
        const updateRes = await fetch(`/api/talabat-profile/admin/profile/${studentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [photoField]: uploadData.url }),
        });
        const updateData = await updateRes.json();

        if (updateData.success) {
          // Optimistic local update
          setStudents((prev) =>
            prev.map((s) => {
              if (s.studentId !== studentId) return s;
              return {
                ...s,
                [photoField]: uploadData.url,
                hasStudentPhoto: photoField === "studentPhotoUrl" ? true : s.hasStudentPhoto,
                hasFatherPhoto: photoField === "fatherPhotoUrl" ? true : s.hasFatherPhoto,
                hasMotherPhoto: photoField === "motherPhotoUrl" ? true : s.hasMotherPhoto,
              };
            })
          );
          fetchList(true);
        } else {
          setFeedbackMsg({ type: "error", text: updateData.error || "Failed to update profile photo" });
        }
      } else {
        setFeedbackMsg({ type: "error", text: uploadData.error || "Upload failed" });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Network error during upload" });
    }
  };

  const studentList = Array.isArray(students) ? students : [];

  const filteredStudents = studentList.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.its && s.its.includes(searchQuery)) ||
      (s.idNo && s.idNo.toLowerCase().includes(searchQuery.toLowerCase()));

    if (statusFilter === "ALL") return matchesSearch;
    if (statusFilter === "SUBMITTED") return matchesSearch && s.status === "SUBMITTED";
    if (statusFilter === "REVIEWED") return matchesSearch && s.status === "REVIEWED";
    if (statusFilter === "PENDING") return matchesSearch && (s.status === "DRAFT" || s.status === "NOT_STARTED");
    if (statusFilter === "ALL_RESPONSES") return matchesSearch && (s.filledCount === 11);
    if (statusFilter === "PARTIAL_RESPONSES") return matchesSearch && (s.filledCount !== undefined && s.filledCount > 0 && s.filledCount < 11);
    if (statusFilter === "NO_RESPONSES") return matchesSearch && (!s.filledCount || s.filledCount === 0);
    if (statusFilter === "MISSING_PARENT_PHOTOS") return matchesSearch && (!s.hasFatherPhoto || !s.hasMotherPhoto);
    if (statusFilter === "PHOTOS_COMPLETE") return matchesSearch && !!(s.hasFatherPhoto && s.hasMotherPhoto && s.hasStudentPhoto);
    return matchesSearch;
  });

  const currentStudentIndex = useMemo(() => {
    if (!selectedStudentId) return -1;
    return filteredStudents.findIndex((s) => s.studentId === selectedStudentId);
  }, [selectedStudentId, filteredStudents]);

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      const prevStudent = filteredStudents[currentStudentIndex - 1];
      openStudentModal(prevStudent.studentId, modalViewTab);
    }
  };

  const handleNextStudent = () => {
    if (currentStudentIndex >= 0 && currentStudentIndex < filteredStudents.length - 1) {
      const nextStudent = filteredStudents[currentStudentIndex + 1];
      openStudentModal(nextStudent.studentId, modalViewTab);
    }
  };

  const totalStudents = studentList.length;
  const submittedCount = studentList.filter((s) => s.status === "SUBMITTED").length;
  const reviewedCount = studentList.filter((s) => s.status === "REVIEWED").length;
  const pendingCount = studentList.filter((s) => s.status === "DRAFT" || s.status === "NOT_STARTED").length;
  const allResponsesCount = studentList.filter((s) => s.filledCount === 11).length;
  const partialResponsesCount = studentList.filter((s) => s.filledCount !== undefined && s.filledCount > 0 && s.filledCount < 11).length;
  const missingPhotosCount = studentList.filter((s) => !s.hasFatherPhoto || !s.hasMotherPhoto).length;
  const photosCompleteCount = studentList.filter((s) => s.hasFatherPhoto && s.hasMotherPhoto && s.hasStudentPhoto).length;

  const reviewedPct = totalStudents > 0 ? Math.round((reviewedCount / totalStudents) * 100) : 0;
  const photosPct = totalStudents > 0 ? Math.round((photosCompleteCount / totalStudents) * 100) : 0;

  // Realtime trait averages calculation across cohort
  const evaluatedStudents = studentList.filter(
    (s) => s.ratings && (s.ratings.discipline || s.ratings.dedication || s.ratings.behaviour || s.ratings.communication)
  );
  const avgDiscipline = evaluatedStudents.length
    ? (evaluatedStudents.reduce((acc, s) => acc + (s.ratings?.discipline || 0), 0) / evaluatedStudents.length).toFixed(1)
    : "—";
  const avgDedication = evaluatedStudents.length
    ? (evaluatedStudents.reduce((acc, s) => acc + (s.ratings?.dedication || 0), 0) / evaluatedStudents.length).toFixed(1)
    : "—";
  const avgBehaviour = evaluatedStudents.length
    ? (evaluatedStudents.reduce((acc, s) => acc + (s.ratings?.behaviour || 0), 0) / evaluatedStudents.length).toFixed(1)
    : "—";
  const avgCommunication = evaluatedStudents.length
    ? (evaluatedStudents.reduce((acc, s) => acc + (s.ratings?.communication || 0), 0) / evaluatedStudents.length).toFixed(1)
    : "—";

  const handleToggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const allFilteredSelected =
      filteredStudents.length > 0 &&
      filteredStudents.every((s) => selectedStudentIds.has(s.studentId));

    if (allFilteredSelected) {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        filteredStudents.forEach((s) => next.delete(s.studentId));
        return next;
      });
    } else {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        filteredStudents.forEach((s) => next.add(s.studentId));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedStudentIds(new Set());
  };

  const downloadProfilesExcel = async (studentIds?: string[]) => {
    try {
      const params = new URLSearchParams();
      if (studentIds && studentIds.length > 0) {
        params.set("studentIds", studentIds.join(","));
      }
      const res = await fetch(`/api/admin/students/export-excel?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = studentIds?.length === 1
        ? `Talabat_Profile_${studentIds[0]}.xlsx`
        : "Talabat_Profiles.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download Excel file.");
    }
  };

  const selectedStudentTargets: BulkStudentTarget[] = studentList
    .filter((s) => selectedStudentIds.has(s.studentId))
    .map((s) => ({
      studentId: s.studentId,
      name: s.name,
      its: s.its,
      idNo: s.idNo,
    }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* ── Page Header ── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-[#1c1c1c] via-[#1c1c1c] to-[#0d0d0d] border border-emerald-700/40 text-white p-6 rounded-2xl shadow-lg border border-amber-500/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 backdrop-blur shadow-inner">
            <GraduationCap className="w-8 h-8 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider bg-amber-400 text-slate-900 px-2.5 py-0.5 rounded-full shadow-xs">
                1447 H
              </span>
              <span className="text-sm text-white/90 font-alkanz" dir="rtl">توجيه الطالب</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              Talabat Profiles (<span className="font-alkanz" dir="rtl">توجيه الطالب</span>)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              1447 H student profiles, parent photos, remarks, and Excel export.
            </p>
          </div>
        </div>

        {/* Sync & Faculty Assignment Controls */}
        <div className="flex items-center gap-2.5 self-start sm:self-center flex-wrap">
          <button
            onClick={openAssignFacultyModal}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-95 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
            title="Assign remarks editing permissions to teaching faculty only"
          >
            <UserCheck className="w-4 h-4 text-slate-950" />
            <span>Assign Remarks Access</span>
          </button>

          <button
            onClick={() => fetchList(false)}
            disabled={loading || isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 rounded-xl text-xs font-medium text-white transition-all cursor-pointer backdrop-blur"
            title="Refresh cohort records immediately"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || loading ? "animate-spin text-amber-300" : ""}`} />
            <span>{secondsAgo < 5 ? "Synced just now" : `Synced ${secondsAgo}s ago`}</span>
          </button>
        </div>
      </div>

      {/* ── Stat Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
        {/* Total Cohort */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Cohort</span>
            <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900">{totalStudents}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">Registered Talabat</div>
        </div>

        {/* Submitted Awaiting */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs hover:shadow-md transition-shadow bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Submitted</span>
            <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700">{submittedCount}</div>
          <div className="text-[11px] text-emerald-600 mt-1 font-medium">Awaiting Remarks</div>
        </div>

        {/* Reviewed Complete */}
        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-xs hover:shadow-md transition-shadow bg-gradient-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Reviewed</span>
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-700">{reviewedCount}</span>
            <span className="text-xs font-bold text-blue-600 font-mono">({reviewedPct}%)</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-blue-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${reviewedPct}%` }} />
          </div>
        </div>

        {/* Pending / Draft */}
        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs hover:shadow-md transition-shadow bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Draft / Pending</span>
            <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-700">{pendingCount}</div>
          <div className="text-[11px] text-amber-600 mt-1 font-medium">Incomplete Profiles</div>
        </div>

        {/* Photos Verified */}
        <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-xs hover:shadow-md transition-shadow bg-gradient-to-br from-white to-purple-50/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Photos Ready</span>
            <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
              <Camera className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-700">{photosCompleteCount}</span>
            <span className="text-xs font-bold text-purple-600 font-mono">({photosPct}%)</span>
          </div>
          <div className="text-[11px] text-purple-600 mt-1 font-medium">Both Parents + Student</div>
        </div>

        {/* Missing Parent Photos */}
        <div className={`p-4 rounded-2xl border shadow-xs hover:shadow-md transition-shadow ${
          missingPhotosCount > 0 ? "bg-rose-50/60 border-rose-200 text-rose-800" : "bg-emerald-50/60 border-emerald-200 text-emerald-800"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Missing Photos</span>
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
              missingPhotosCount > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
            }`}>
              {missingPhotosCount > 0 ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            </span>
          </div>
          <div className="text-2xl font-black">{missingPhotosCount}</div>
          <div className="text-[11px] font-medium mt-1">
            {missingPhotosCount > 0 ? "Parent Photos Due" : "All Photos Uploaded"}
          </div>
        </div>
      </div>

      {/* ── Live Evaluated Trait Ratings Strip ── */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 mb-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 border border-amber-500/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase font-extrabold tracking-wider text-amber-400">Cohort Trait Averages</div>
            <div className="text-xs text-slate-300">
              Evaluated across {evaluatedStudents.length} of {totalStudents} talabat (1–5 scale)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center min-w-[100px]">
            <div className="text-[10px] uppercase font-bold text-slate-400">Discipline</div>
            <div className="text-lg font-black text-amber-300">{avgDiscipline} <span className="text-xs font-normal text-slate-400">/ 5</span></div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center min-w-[100px]">
            <div className="text-[10px] uppercase font-bold text-slate-400">Dedication</div>
            <div className="text-lg font-black text-amber-300">{avgDedication} <span className="text-xs font-normal text-slate-400">/ 5</span></div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center min-w-[100px]">
            <div className="text-[10px] uppercase font-bold text-slate-400">Behaviour</div>
            <div className="text-lg font-black text-amber-300">{avgBehaviour} <span className="text-xs font-normal text-slate-400">/ 5</span></div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center min-w-[100px]">
            <div className="text-[10px] uppercase font-bold text-slate-400">Communication</div>
            <div className="text-lg font-black text-amber-300">{avgCommunication} <span className="text-xs font-normal text-slate-400">/ 5</span></div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-col lg:flex-row gap-4 justify-between items-center">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by Name, ITS, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { key: "ALL", label: `All (${totalStudents})` },
            { key: "ALL_RESPONSES", label: `Full Responses 11/11 (${allResponsesCount})` },
            { key: "PARTIAL_RESPONSES", label: `In Progress (${partialResponsesCount})` },
            { key: "SUBMITTED", label: `Submitted (${submittedCount})` },
            { key: "REVIEWED", label: `Reviewed (${reviewedCount})` },
            { key: "PENDING", label: `Pending (${pendingCount})` },
            { key: "MISSING_PARENT_PHOTOS", label: `Missing Parent Photos (${missingPhotosCount})` },
            { key: "PHOTOS_COMPLETE", label: `Photos Ready (${photosCompleteCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                statusFilter === tab.key
                  ? "bg-[#1c1c1c] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk Action Banner (when students are selected) ── */}
      {selectedStudentIds.size > 0 && (
        <div className="mb-4 p-4 bg-gradient-to-r from-slate-950 via-[#1c1c1c] to-slate-900 border border-amber-500/40 text-white rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-sm shadow-md">
              {selectedStudentIds.size}
            </div>
            <div>
              <div className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
                <span>{selectedStudentIds.size} {selectedStudentIds.size === 1 ? "Student" : "Students"} Selected</span>
              </div>
              <div className="text-xs text-slate-300">
                Download selected Talabat profiles in a formatted Excel workbook.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => downloadProfilesExcel(Array.from(selectedStudentIds))}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel ({selectedStudentIds.size})</span>
            </button>
            <button
              onClick={handleSelectAllFiltered}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              {filteredStudents.length > 0 && filteredStudents.every((s) => selectedStudentIds.has(s.studentId))
                ? "Deselect All Filtered"
                : `Select All Filtered (${filteredStudents.length})`}
            </button>
            <button
              onClick={handleClearSelection}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-medium cursor-pointer transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* ── Student List Table ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <div className="w-8 h-8 border-3 border-[#1c1c1c] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading profiles...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No student profiles match your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredStudents.length > 0 &&
                        filteredStudents.every((s) => selectedStudentIds.has(s.studentId))
                      }
                      ref={(input) => {
                        if (input) {
                          const someSelected = filteredStudents.some((s) => selectedStudentIds.has(s.studentId));
                          const allSelected =
                            filteredStudents.length > 0 &&
                            filteredStudents.every((s) => selectedStudentIds.has(s.studentId));
                          input.indeterminate = someSelected && !allSelected;
                        }
                      }}
                      onChange={handleSelectAllFiltered}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer accent-amber-500"
                      title="Select all currently visible students"
                    />
                  </th>
                  <th className="py-3.5 px-4">Talib Name &amp; ID</th>
                  <th className="py-3.5 px-4">ITS No.</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Photos Status</th>
                  <th className="py-3.5 px-4">Masul Ratings</th>
                  <th className="py-3.5 px-4">Department Responses</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s) => {
                  const isSelected = selectedStudentIds.has(s.studentId);
                  return (
                    <tr
                      key={s.studentId}
                      className={`transition-colors ${
                        isSelected
                          ? "bg-amber-50/70 hover:bg-amber-100/60"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      <td className="py-3.5 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectStudent(s.studentId)}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer accent-amber-500"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {s.avatarUrl || s.studentPhotoUrl ? (
                          <img
                            src={normalizeImgSrc(s.studentPhotoUrl || s.avatarUrl)}
                            alt={s.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                            {s.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900">{s.name}</div>
                          <div className="text-xs text-slate-500">ID: {s.idNo} • Class {s.grade}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      {s.its || "—"}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        s.status === "SUBMITTED"
                          ? "bg-emerald-100 text-emerald-800"
                          : s.status === "REVIEWED"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          s.status === "SUBMITTED" ? "bg-emerald-600" : s.status === "REVIEWED" ? "bg-blue-600" : "bg-amber-600"
                        }`} />
                        {s.status === "REVIEWED" ? "Reviewed" : s.status === "SUBMITTED" ? "Submitted" : s.status === "DRAFT" ? "Draft Saved" : "Not Started"}
                      </span>
                    </td>

                    {/* Photos Status Column */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {/* Student Photo */}
                        <div
                          className="relative cursor-pointer group"
                          title={s.studentPhotoUrl ? "Talib Photo Uploaded (Click to view)" : "Talib Photo Missing"}
                          onClick={() => s.studentPhotoUrl && setLightboxImg({ url: normalizeImgSrc(s.studentPhotoUrl), title: `${s.name} (Student)` })}
                        >
                          {s.studentPhotoUrl ? (
                            <img
                              src={normalizeImgSrc(s.studentPhotoUrl)}
                              alt="Talib"
                              className="w-7 h-7 rounded-full object-cover border-2 border-emerald-500 shadow-2xs group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                              <User className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                              s.studentPhotoUrl ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          />
                        </div>

                        {/* Father Photo */}
                        {s.fatherPhotoUrl ? (
                          <div
                            className="relative cursor-pointer group"
                            title="Father Photo Uploaded (Click to view full size)"
                            onClick={() => setLightboxImg({ url: normalizeImgSrc(s.fatherPhotoUrl), title: `${s.name}'s Father` })}
                          >
                            <img
                              src={normalizeImgSrc(s.fatherPhotoUrl)}
                              alt="Father"
                              className="w-7 h-7 rounded-full object-cover border-2 border-blue-500 shadow-2xs group-hover:scale-105 transition-transform"
                            />
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white bg-emerald-500" />
                          </div>
                        ) : (
                          <label
                            className="relative cursor-pointer group flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 border border-dashed border-blue-300 hover:bg-blue-100 transition-colors shadow-2xs"
                            title="Father Photo Missing • Click to upload directly"
                          >
                            <span className="text-[10px]">👨</span>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white bg-amber-500" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleDirectUpload(s.studentId, "fatherPhotoUrl", file);
                              }}
                            />
                          </label>
                        )}

                        {/* Mother Photo */}
                        {s.motherPhotoUrl ? (
                          <div
                            className="relative cursor-pointer group"
                            title="Mother Photo Uploaded (Click to view full size)"
                            onClick={() => setLightboxImg({ url: normalizeImgSrc(s.motherPhotoUrl), title: `${s.name}'s Mother` })}
                          >
                            <img
                              src={normalizeImgSrc(s.motherPhotoUrl)}
                              alt="Mother"
                              className="w-7 h-7 rounded-full object-cover border-2 border-purple-500 shadow-2xs group-hover:scale-105 transition-transform"
                            />
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white bg-emerald-500" />
                          </div>
                        ) : (
                          <label
                            className="relative cursor-pointer group flex items-center justify-center w-7 h-7 rounded-full bg-rose-50 border border-dashed border-rose-300 hover:bg-rose-100 transition-colors shadow-2xs"
                            title="Mother Photo Missing • Click to upload directly"
                          >
                            <span className="text-[10px]">👩</span>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white bg-amber-500" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleDirectUpload(s.studentId, "motherPhotoUrl", file);
                              }}
                            />
                          </label>
                        )}

                        <span className="text-[11px] text-slate-400 font-medium ml-1">
                          {s.hasFatherPhoto && s.hasMotherPhoto ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Both Parents
                            </span>
                          ) : s.hasFatherPhoto || s.hasMotherPhoto ? (
                            <span className="text-amber-600 font-medium">1/2 Parents</span>
                          ) : (
                            <span className="text-rose-600 font-medium">Missing</span>
                          )}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {s.ratings?.behaviour ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-900 flex items-center gap-0.5">
                            ★ {(
                              ((s.ratings.behaviour || 0) +
                                (s.ratings.communication || 0) +
                                (s.ratings.dedication || 0) +
                                (s.ratings.discipline || 0)) / 4
                            ).toFixed(1)}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            (Avg of 4 traits)
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No ratings yet</span>
                      )}
                    </td>

                    {/* Department Responses Column */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1.5 min-w-[210px]">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                              (s.filledCount ?? 0) === 11
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : (s.filledCount ?? 0) > 0
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                          >
                            {s.filledCount ?? 0} of 11 Responded
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono font-bold">
                            {Math.round(((s.filledCount ?? 0) / 11) * 100)}%
                          </span>
                        </div>

                        {/* 11 Department Mini Pills */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {ADMIN_EVALUATION_TABS.map((tab) => {
                            const isFilled = Boolean(s.departmentResponses?.[tab.id]);
                            const snippet = s.remarksPreview?.[tab.id];
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => openStudentModal(s.studentId, "fill", tab.id)}
                                className={`w-5 h-5 rounded text-[9px] font-black flex items-center justify-center transition-all cursor-pointer ${
                                  isFilled
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                                    : "bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200"
                                }`}
                                title={`${tab.label} (${tab.arLabel}): ${
                                  isFilled
                                    ? snippet
                                      ? `"${snippet.slice(0, 50)}..."`
                                      : "Response recorded"
                                    : "Pending response"
                                } • Click to view/edit`}
                              >
                                {tab.short}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => downloadProfilesExcel([s.studentId])}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                          title="Download student profile in Excel"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          Download Excel
                        </button>
                        <button
                          onClick={() => openStudentModal(s.studentId, "fill")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1c1c1c] hover:bg-[#1c1c1c] text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Remarks &amp; Ratings
                        </button>
                        <button
                          onClick={() => openStudentModal(s.studentId, "document")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Document
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          STUDENT PROFILE & REMARKS MODAL
      ════════════════════════════════════════════════════════════ */}
      {selectedStudentId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 sm:px-6 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center font-bold">
                  {activeProfile?.name?.slice(0, 2).toUpperCase() || "TP"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base sm:text-lg">{activeProfile?.name || "Talabat Profile"}</h3>
                    {currentStudentIndex >= 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
                        {currentStudentIndex + 1} of {filteredStudents.length}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>ITS: {activeProfile?.itsNo || "—"}</span>
                    <span>•</span>
                    <span>ID: {activeProfile?.idNo || "—"}</span>
                    <span>•</span>
                    <span className="text-amber-300 font-semibold">{activeProfile?.status || "DRAFT"}</span>
                    {reviewerName && (
                      <>
                        <span>•</span>
                        <span className="text-blue-300">Reviewed by: {reviewerName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Actions & Student Navigation */}
              <div className="flex items-center gap-3">
                {/* Prev / Next Student arrows in header */}
                <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  <button
                    type="button"
                    onClick={handlePrevStudent}
                    disabled={currentStudentIndex <= 0}
                    className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 cursor-pointer"
                    title="Previous Student"
                  >
                    <ChevronUp className="w-4 h-4 -rotate-90" />
                  </button>
                  <span className="text-[11px] font-mono font-bold px-2 text-slate-300">
                    {currentStudentIndex >= 0 ? `${currentStudentIndex + 1} / ${filteredStudents.length}` : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextStudent}
                    disabled={currentStudentIndex >= filteredStudents.length - 1}
                    className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 cursor-pointer"
                    title="Next Student"
                  >
                    <ChevronDown className="w-4 h-4 -rotate-90" />
                  </button>
                </div>

                <div className="flex items-center bg-slate-800 p-1 rounded-lg">
                  <button
                    onClick={() => setModalViewTab("fill")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      modalViewTab === "fill" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    📝 Remarks &amp; Ratings
                  </button>
                  <button
                    onClick={() => setModalViewTab("counsellor")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      modalViewTab === "counsellor" ? "bg-purple-600 text-white font-bold" : "text-purple-300 hover:text-white"
                    }`}
                  >
                    <HeartHandshake className="w-3.5 h-3.5" />
                    <span>💬 Counsellor Remarks</span>
                  </button>
                  <button
                    onClick={() => setModalViewTab("edit-profile")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      modalViewTab === "edit-profile" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    ✏️ Edit Profile Details
                  </button>
                  <button
                    onClick={() => setModalViewTab("document")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      modalViewTab === "document" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    <span>👁️ Document &amp; Print</span>
                    <span className="text-[10px] bg-slate-900 text-amber-300 border border-slate-700 font-bold px-1.5 py-0.2 rounded-full">
                      A4 PDF
                    </span>
                  </button>
                </div>

                <button
                  onClick={() => setSelectedStudentId(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
              {modalLoading ? (
                <div className="py-20 text-center text-slate-500">
                  <div className="w-8 h-8 border-3 border-[#1c1c1c] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  Loading profile...
                </div>
              ) : activeProfile ? (
                modalViewTab === "document" ? (
                  <TalabatProfileDocument data={activeProfile} showPrintButton={true} />
                ) : modalViewTab === "counsellor" ? (
                  /* ════════════════════════════════════════════════════
                      COUNSELLOR REMARKS & CAREER GUIDANCE (DARAJEH RABEA)
                  ════════════════════════════════════════════════════ */
                  <div className="space-y-6 max-w-4xl mx-auto">
                    {/* Header Card */}
                    <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-purple-800/40 relative overflow-hidden">
                      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-purple-300 shadow-inner">
                            <HeartHandshake className="w-7 h-7" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-400 text-purple-950">
                                Darajah Rabea (Grade 4)
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-purple-200 border border-white/10">
                                Counsellor Guidance
                              </span>
                            </div>
                            <h2 className="text-xl font-black mt-1 text-white tracking-tight">
                              Counsellor Remarks &amp; Career Trajectory
                            </h2>
                            <p className="text-xs text-purple-200/90 mt-0.5">
                              Student: <strong className="text-white">{activeProfile?.name}</strong> • ITS: <strong className="text-white font-mono">{activeProfile?.itsNo}</strong>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSaveCounsellorRemarks}
                            disabled={savingCounsellor}
                            className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                          >
                            {savingCounsellor ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                <span>Saving &amp; Syncing...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Save Counsellor Remarks &amp; Sync</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Feedback message banner if present */}
                    {feedbackMsg && (
                      <div
                        className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
                          feedbackMsg.type === "success"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-rose-50 border-rose-200 text-rose-800"
                        }`}
                      >
                        {feedbackMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                        <span>{feedbackMsg.text}</span>
                      </div>
                    )}

                    {/* Main Form Fields Container */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
                      {/* Section 1: Recommended Further Studies (Counselling) */}
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div>
                            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <span>1. Recommended Further Studies &amp; Academic Trajectory</span>
                              <span className="text-xs font-normal text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 font-alkanz">
                                توجيه الطالب (Counselling)
                              </span>
                            </label>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Institutional, higher academic, or vocational recommendation after Darajah Rabea.
                            </p>
                          </div>
                        </div>

                        {/* Dynamic Recommendation Preset Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Suggestions:</span>
                          {[
                            "Al-Jamea Advanced Hifz & Qirat",
                            "Higher Secondary Science / Pre-Medical",
                            "Higher Secondary Commerce & Finance",
                            "Advanced IT & Computer Engineering",
                            "Intensive Lisan al-Dawat & Arabic Literature",
                            "Vocational & Entrepreneurial Guidance",
                          ].map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => {
                                setRemarksCounselling((prev) => {
                                  const trimmed = prev.trim();
                                  return trimmed ? `${trimmed}\n• ${suggestion}` : `• ${suggestion}`;
                                });
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-purple-100 hover:text-purple-900 text-slate-700 rounded-lg text-[11px] font-medium border border-slate-200 hover:border-purple-300 transition-colors cursor-pointer"
                            >
                              + {suggestion}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={4}
                          dir="auto"
                          value={remarksCounselling}
                          onChange={(e) => setRemarksCounselling(e.target.value)}
                          placeholder="Enter career counselling recommendations, academic roadmap, suggested institutions, or specialized streams for this student..."
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm leading-relaxed font-sans focus:ring-2 focus:ring-purple-600 focus:border-purple-600 focus:outline-none transition-all shadow-2xs"
                        />
                      </div>

                      {/* Section 2: Sibling Details & Confidential Counsellor Notes */}
                      <div className="space-y-3 pt-4 border-t border-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div>
                            <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <span>2. Confidential Counsellor Notes &amp; Sibling Background</span>
                              <span className="text-xs font-normal text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 font-alkanz">
                                ملاحظات المرشد (Mentoring Notes)
                              </span>
                            </label>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Family background, elder/younger sibling education, behavioral insights, and mentoring session notes.
                            </p>
                          </div>
                        </div>

                        {/* Dynamic Sibling & Mentoring Preset Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Suggestions:</span>
                          {[
                            "Sibling currently enrolled at Al-Jamea",
                            "Elder siblings in University / Degree studies",
                            "High discipline & exemplary attitude in counselling",
                            "Requires structured encouragement in language portion",
                            "Parental mentoring consultation conducted",
                            "Recommended for special leadership responsibilities",
                          ].map((note) => (
                            <button
                              key={note}
                              type="button"
                              onClick={() => {
                                setCounsellingNotes((prev) => {
                                  const trimmed = prev.trim();
                                  return trimmed ? `${trimmed}\n• ${note}` : `• ${note}`;
                                });
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-900 text-slate-700 rounded-lg text-[11px] font-medium border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer"
                            >
                              + {note}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={5}
                          dir="auto"
                          value={counsellingNotes}
                          onChange={(e) => setCounsellingNotes(e.target.value)}
                          placeholder={"Enter family/sibling educational background and counsellor guidance notes...\ne.g.\n• Elder Brother: Al-Jamea Graduate\n• Younger Sister: Class 2\n• Father's Profession: Business\n• Counsellor Notes: High potential in public speaking and memorization..."}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm leading-relaxed font-sans focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 focus:outline-none transition-all shadow-2xs"
                        />
                      </div>

                      {/* Bottom Actions */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className="text-xs text-slate-500 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                          <span>Syncs instantly to Yearly Profile 1447 and official printable document.</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentId(null)}
                            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            Close
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveCounsellorRemarks}
                            disabled={savingCounsellor}
                            className="px-6 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                          >
                            {savingCounsellor ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Saving &amp; Syncing...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Save &amp; Sync Remarks</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : modalViewTab === "edit-profile" ? (
                  <div className="space-y-6 max-w-4xl mx-auto">
                    {/* Admin Profile Details Editor Header */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                          <Edit3 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                            Administrative Record &amp; Profile Editor (1447 H)
                          </h4>
                          <p className="text-xs text-slate-500">
                            Directly edit and correct student identity, family details, academic scores, and self-assessment.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-700">Status:</label>
                        <select
                          value={editProfileForm.status || "SUBMITTED"}
                          onChange={(e) => setEditProfileForm((prev) => ({ ...prev, status: e.target.value }))}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="SUBMITTED">Submitted</option>
                          <option value="REVIEWED">Reviewed</option>
                          <option value="APPROVED">Approved</option>
                          <option value="NEEDS_REVISION">Needs Revision</option>
                        </select>
                      </div>
                    </div>

                    {feedbackMsg && (
                      <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                        feedbackMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}>
                        <CheckCircle2 className="w-4 h-4" />
                        {feedbackMsg.text}
                      </div>
                    )}

                    {/* Section 1: Photos Management */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-[#1c1c1c]" />
                          1. Passport Photographs (3-Photo Verification)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Student, Father &amp; Mother photos required
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Student Photo */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center text-center">
                          <span className="text-xs font-bold text-slate-800 mb-2">Talib / Student</span>
                          <div
                            className="w-24 h-32 rounded-lg overflow-hidden border border-slate-300 relative bg-white flex items-center justify-center cursor-pointer mb-2"
                            onClick={() =>
                              editProfileForm.studentPhotoUrl &&
                              setLightboxImg({
                                url: normalizeImgSrc(editProfileForm.studentPhotoUrl),
                                title: `${editProfileForm.name || "Student"} - Photo`,
                              })
                            }
                          >
                            {editProfileForm.studentPhotoUrl ? (
                              <img
                                src={normalizeImgSrc(editProfileForm.studentPhotoUrl)}
                                alt="Student"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-slate-400 text-[10px]">No Photo</div>
                            )}
                          </div>
                          <label className="w-full py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-300 transition-colors flex items-center justify-center gap-1">
                            <Upload className="w-3.5 h-3.5 text-[#1c1c1c]" />
                            {uploadingAdminPhoto === "studentPhotoUrl" ? "Uploading..." : "Upload Photo"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingAdminPhoto === "studentPhotoUrl"}
                              onChange={(e) => handleAdminPhotoUpload(e, "studentPhotoUrl")}
                            />
                          </label>
                        </div>

                        {/* Father Photo */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center text-center">
                          <span className="text-xs font-bold text-blue-900 mb-2">Father / الوالد</span>
                          <div
                            className="w-24 h-32 rounded-lg overflow-hidden border border-slate-300 relative bg-white flex items-center justify-center cursor-pointer mb-2"
                            onClick={() =>
                              editProfileForm.fatherPhotoUrl &&
                              setLightboxImg({
                                url: normalizeImgSrc(editProfileForm.fatherPhotoUrl),
                                title: `${editProfileForm.fatherName || "Father"} - Photo`,
                              })
                            }
                          >
                            {editProfileForm.fatherPhotoUrl ? (
                              <img
                                src={normalizeImgSrc(editProfileForm.fatherPhotoUrl)}
                                alt="Father"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-slate-400 text-[10px]">No Photo</div>
                            )}
                          </div>
                          <label className="w-full py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-300 transition-colors flex items-center justify-center gap-1">
                            <Upload className="w-3.5 h-3.5 text-[#1c1c1c]" />
                            {uploadingAdminPhoto === "fatherPhotoUrl" ? "Uploading..." : "Upload Photo"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingAdminPhoto === "fatherPhotoUrl"}
                              onChange={(e) => handleAdminPhotoUpload(e, "fatherPhotoUrl")}
                            />
                          </label>
                        </div>

                        {/* Mother Photo */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center text-center">
                          <span className="text-xs font-bold text-purple-900 mb-2">Mother / الوالدة</span>
                          <div
                            className="w-24 h-32 rounded-lg overflow-hidden border border-slate-300 relative bg-white flex items-center justify-center cursor-pointer mb-2"
                            onClick={() =>
                              editProfileForm.motherPhotoUrl &&
                              setLightboxImg({
                                url: normalizeImgSrc(editProfileForm.motherPhotoUrl),
                                title: `${editProfileForm.motherName || "Mother"} - Photo`,
                              })
                            }
                          >
                            {editProfileForm.motherPhotoUrl ? (
                              <img
                                src={normalizeImgSrc(editProfileForm.motherPhotoUrl)}
                                alt="Mother"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-slate-400 text-[10px]">No Photo</div>
                            )}
                          </div>
                          <label className="w-full py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-300 transition-colors flex items-center justify-center gap-1">
                            <Upload className="w-3.5 h-3.5 text-[#1c1c1c]" />
                            {uploadingAdminPhoto === "motherPhotoUrl" ? "Uploading..." : "Upload Photo"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingAdminPhoto === "motherPhotoUrl"}
                              onChange={(e) => handleAdminPhotoUpload(e, "motherPhotoUrl")}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Personal Identity Details */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-[#1c1c1c]" />
                        2. Personal &amp; Jamia Identity
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Full Student Name</label>
                          <input
                            type="text"
                            value={editProfileForm.name || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, name: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">ITS No</label>
                          <input
                            type="text"
                            value={editProfileForm.itsNo || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, itsNo: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Registration / ID No</label>
                          <input
                            type="text"
                            value={editProfileForm.idNo || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, idNo: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Jamaat</label>
                          <input
                            type="text"
                            value={editProfileForm.jamaat || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, jamaat: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Vatan</label>
                          <input
                            type="text"
                            value={editProfileForm.vatan || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, vatan: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Date of Birth</label>
                          <input
                            type="text"
                            placeholder="DD/MM/YYYY"
                            value={editProfileForm.dob || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, dob: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Age (Years)</label>
                          <input
                            type="number"
                            value={editProfileForm.age ?? ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, age: parseInt(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Family Information */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#1c1c1c]" />
                        3. Parents &amp; Family Information
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Father's Name</label>
                          <input
                            type="text"
                            value={editProfileForm.fatherName || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, fatherName: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Father's Occupation</label>
                          <input
                            type="text"
                            value={editProfileForm.fatherOccupation || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, fatherOccupation: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Mother's Name</label>
                          <input
                            type="text"
                            value={editProfileForm.motherName || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, motherName: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Mother's Occupation</label>
                          <input
                            type="text"
                            value={editProfileForm.motherOccupation || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, motherOccupation: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Academic Background & Hifz */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-[#1c1c1c]" />
                        4. Academic Performance &amp; Al-Tahfeez
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Result 1444 H</label>
                          <input
                            type="text"
                            placeholder="e.g. 78.5% / Mumtaz"
                            value={editProfileForm.result1444 || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, result1444: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Result 1445 H</label>
                          <input
                            type="text"
                            placeholder="e.g. 82.0% / Mumtaz"
                            value={editProfileForm.result1445 || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, result1445: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Result 1446 H</label>
                          <input
                            type="text"
                            placeholder="e.g. 85.2% / Jayyid Jiddan"
                            value={editProfileForm.result1446 || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, result1446: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Hifz Sanah / Year</label>
                          <input
                            type="text"
                            placeholder="e.g. 1442 H"
                            value={editProfileForm.hifzYear || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, hifzYear: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Hifz Tabaqa</label>
                          <input
                            type="text"
                            placeholder="e.g. Tabaqa 1 / Ula"
                            value={editProfileForm.hifzTabaqa || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, hifzTabaqa: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Result 1447 H</label>
                          <input
                            type="text"
                            placeholder="e.g. 84.0% / Mumtaz"
                            value={editProfileForm.result1447 || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, result1447: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Course 1</label>
                          <input
                            type="text"
                            placeholder="e.g. Basic IT"
                            value={editProfileForm.course1 || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, course1: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Course 2</label>
                          <input
                            type="text"
                            placeholder="e.g. Calligraphy"
                            value={editProfileForm.course2 || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, course2: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Course 3</label>
                          <input
                            type="text"
                            placeholder="e.g. Spoken Arabic"
                            value={editProfileForm.course3 || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, course3: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Course 4</label>
                          <input
                            type="text"
                            placeholder="e.g. First Aid"
                            value={editProfileForm.course4 || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, course4: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">External Board Exams</label>
                          <input
                            type="text"
                            placeholder="e.g. 10th NIOS 72%"
                            value={editProfileForm.otherExams || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, otherExams: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Extra-Curricular Activities</label>
                          <input
                            type="text"
                            placeholder="e.g. Football, Swimming"
                            value={editProfileForm.activities || ""}
                            onChange={(e) => setEditProfileForm((p) => ({ ...p, activities: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 5: Strengths & Weaknesses */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Strengths */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-emerald-600" />
                            Strengths (قوة الطالب)
                          </span>
                          <button
                            type="button"
                            onClick={addEditStrength}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(editProfileForm.strengths || []).map((str, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={str}
                                onChange={(e) => updateEditStrength(idx, e.target.value)}
                                placeholder={`Strength #${idx + 1}`}
                                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                              />
                              {(editProfileForm.strengths || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeEditStrength(idx)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Weaknesses */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-rose-600" />
                            Weaknesses (ضعف الطالب)
                          </span>
                          <button
                            type="button"
                            onClick={addEditWeakness}
                            className="text-[11px] font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(editProfileForm.weaknesses || []).map((w, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={w}
                                onChange={(e) => updateEditWeakness(idx, e.target.value)}
                                placeholder={`Weakness #${idx + 1}`}
                                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-600 focus:outline-none"
                              />
                              {(editProfileForm.weaknesses || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeEditWeakness(idx)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Section 6: About Myself */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                      <label className="text-xs font-bold text-slate-800 block">
                        6. Personal Statement / About Myself (عن نفسي)
                      </label>
                      <textarea
                        rows={4}
                        value={editProfileForm.aboutMyself || ""}
                        onChange={(e) => setEditProfileForm((p) => ({ ...p, aboutMyself: e.target.value }))}
                        placeholder="Write student's personal statement..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs leading-relaxed focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                      />
                    </div>

                    {/* Save Footer Bar */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setSelectedStudentId(null)}
                        className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAdminProfile}
                        disabled={savingAdminProfile}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1c1c1c] hover:bg-[#1c1c1c] text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingAdminProfile ? "Saving Profile..." : "Save Profile Changes"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 max-w-4xl mx-auto">
                    {/* ════════════════════════════════════════════════════
                        SECTION 1: TALABAT YEARLY PROFILE (VISIBLE ABOVE)
                    ════════════════════════════════════════════════════ */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                      <div
                        onClick={() => setShowStudentDetailsAbove(!showStudentDetailsAbove)}
                        className="bg-gradient-to-r from-slate-100 to-amber-50/50 p-4 flex items-center justify-between cursor-pointer border-b border-slate-200 hover:bg-slate-100/80 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <GraduationCap className="w-5 h-5 text-[#1c1c1c]" />
                          <div>
                            <span className="font-bold text-sm text-slate-900">
                              Talabat Filled Profile – 1447 H (Student Submission Details)
                            </span>
                            <span className="block text-xs text-slate-500">
                              Review personal, academic, and self-assessment information before assigning remarks.
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <span>{showStudentDetailsAbove ? "Collapse" : "Expand View"}</span>
                          {showStudentDetailsAbove ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>

                      {showStudentDetailsAbove && (
                        <div className="p-5 space-y-4 text-xs bg-white">
                          {/* ── 3-Photo Identity Showcase (Student, Father, Mother) ── */}
                          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-2 border-b border-slate-200">
                              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                <Camera className="w-4 h-4 text-[#1c1c1c]" />
                                Student &amp; Family Photos (صور الطالب والوالدين)
                              </span>
                              <span className="text-[11px] text-slate-500">
                                Click photo to zoom • Admin can upload or replace photos directly
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {/* 1. Student Card */}
                              <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center text-center shadow-2xs">
                                <div className="flex items-center justify-between w-full mb-2">
                                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                                    <User className="w-3 h-3 text-[#1c1c1c]" /> Talib / Student
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      activeProfile.studentPhotoUrl
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {activeProfile.studentPhotoUrl ? "Uploaded" : "Missing"}
                                  </span>
                                </div>

                                <div
                                  className="w-24 h-32 rounded-lg overflow-hidden border border-slate-300 relative bg-slate-100 flex items-center justify-center cursor-pointer group shadow-2xs mb-2"
                                  onClick={() =>
                                    activeProfile.studentPhotoUrl &&
                                    setLightboxImg({
                                      url: normalizeImgSrc(activeProfile.studentPhotoUrl),
                                      title: `${activeProfile.name || "Student"} - Photo`,
                                    })
                                  }
                                >
                                  {activeProfile.studentPhotoUrl ? (
                                    <>
                                      <img
                                        src={normalizeImgSrc(activeProfile.studentPhotoUrl)}
                                        alt="Student"
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <ZoomIn className="w-5 h-5" />
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-center p-2 text-slate-400">
                                      <User className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                                      <span className="text-[10px] block">No Photo</span>
                                    </div>
                                  )}
                                </div>

                                <div className="text-[11px] font-bold text-slate-900 truncate w-full">
                                  {activeProfile.name || "—"}
                                </div>
                                <div className="text-[10px] text-slate-500 mb-2">
                                  ITS: {activeProfile.itsNo || "—"}
                                </div>

                                <label className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold cursor-pointer border border-slate-200 transition-colors flex items-center justify-center gap-1">
                                  <Upload className="w-3 h-3 text-[#1c1c1c]" />
                                  {uploadingAdminPhoto === "studentPhotoUrl"
                                    ? "Uploading..."
                                    : activeProfile.studentPhotoUrl
                                    ? "Change Photo"
                                    : "Upload Photo"}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploadingAdminPhoto === "studentPhotoUrl"}
                                    onChange={(e) => handleAdminPhotoUpload(e, "studentPhotoUrl")}
                                  />
                                </label>
                              </div>

                              {/* 2. Father Card */}
                              <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center text-center shadow-2xs">
                                <div className="flex items-center justify-between w-full mb-2">
                                  <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                                    👨 Father / الوالد
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      activeProfile.fatherPhotoUrl
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {activeProfile.fatherPhotoUrl ? "Uploaded" : "Missing"}
                                  </span>
                                </div>

                                <div
                                  className="w-24 h-32 rounded-lg overflow-hidden border border-slate-300 relative bg-slate-100 flex items-center justify-center cursor-pointer group shadow-2xs mb-2"
                                  onClick={() =>
                                    activeProfile.fatherPhotoUrl &&
                                    setLightboxImg({
                                      url: normalizeImgSrc(activeProfile.fatherPhotoUrl),
                                      title: `${activeProfile.fatherName || "Father"} - Photo`,
                                    })
                                  }
                                >
                                  {activeProfile.fatherPhotoUrl ? (
                                    <>
                                      <img
                                        src={normalizeImgSrc(activeProfile.fatherPhotoUrl)}
                                        alt="Father"
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <ZoomIn className="w-5 h-5" />
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-center p-2 text-slate-400">
                                      <span className="text-3xl block mb-1">👨</span>
                                      <span className="text-[10px] block">No Photo</span>
                                    </div>
                                  )}
                                </div>

                                <div className="text-[11px] font-bold text-slate-900 truncate w-full">
                                  {activeProfile.fatherName || "—"}
                                </div>
                                <div className="text-[10px] text-slate-500 mb-2 truncate w-full">
                                  {activeProfile.fatherOccupation || "Business"}
                                </div>

                                <label className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold cursor-pointer border border-slate-200 transition-colors flex items-center justify-center gap-1">
                                  <Upload className="w-3 h-3 text-[#1c1c1c]" />
                                  {uploadingAdminPhoto === "fatherPhotoUrl"
                                    ? "Uploading..."
                                    : activeProfile.fatherPhotoUrl
                                    ? "Change Photo"
                                    : "Upload Photo"}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploadingAdminPhoto === "fatherPhotoUrl"}
                                    onChange={(e) => handleAdminPhotoUpload(e, "fatherPhotoUrl")}
                                  />
                                </label>
                              </div>

                              {/* 3. Mother Card */}
                              <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center text-center shadow-2xs">
                                <div className="flex items-center justify-between w-full mb-2">
                                  <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                                    👩 Mother / الوالدة
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      activeProfile.motherPhotoUrl
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {activeProfile.motherPhotoUrl ? "Uploaded" : "Missing"}
                                  </span>
                                </div>

                                <div
                                  className="w-24 h-32 rounded-lg overflow-hidden border border-slate-300 relative bg-slate-100 flex items-center justify-center cursor-pointer group shadow-2xs mb-2"
                                  onClick={() =>
                                    activeProfile.motherPhotoUrl &&
                                    setLightboxImg({
                                      url: normalizeImgSrc(activeProfile.motherPhotoUrl),
                                      title: `${activeProfile.motherName || "Mother"} - Photo`,
                                    })
                                  }
                                >
                                  {activeProfile.motherPhotoUrl ? (
                                    <>
                                      <img
                                        src={normalizeImgSrc(activeProfile.motherPhotoUrl)}
                                        alt="Mother"
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <ZoomIn className="w-5 h-5" />
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-center p-2 text-slate-400">
                                      <span className="text-3xl block mb-1">👩</span>
                                      <span className="text-[10px] block">No Photo</span>
                                    </div>
                                  )}
                                </div>

                                <div className="text-[11px] font-bold text-slate-900 truncate w-full">
                                  {activeProfile.motherName || "—"}
                                </div>
                                <div className="text-[10px] text-slate-500 mb-2 truncate w-full">
                                  {activeProfile.motherOccupation || "Homemaker"}
                                </div>

                                <label className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold cursor-pointer border border-slate-200 transition-colors flex items-center justify-center gap-1">
                                  <Upload className="w-3 h-3 text-[#1c1c1c]" />
                                  {uploadingAdminPhoto === "motherPhotoUrl"
                                    ? "Uploading..."
                                    : activeProfile.motherPhotoUrl
                                    ? "Change Photo"
                                    : "Upload Photo"}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploadingAdminPhoto === "motherPhotoUrl"}
                                    onChange={(e) => handleAdminPhotoUpload(e, "motherPhotoUrl")}
                                  />
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Basic Profile Details Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                            <div>
                              <span className="text-slate-500 block text-[11px]">Full Name:</span>
                              <span className="font-bold text-slate-900">{activeProfile.name || "—"}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">ITS / ID:</span>
                              <span className="font-mono font-bold">{activeProfile.itsNo || "—"} • ID {activeProfile.idNo || "—"}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Jamaat / Vatan:</span>
                              <span className="font-semibold">{activeProfile.jamaat || "—"} / {activeProfile.vatan || "—"}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Father:</span>
                              <span className="font-semibold">{activeProfile.fatherName || "—"} ({activeProfile.fatherOccupation || "Business"})</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Mother:</span>
                              <span className="font-semibold">{activeProfile.motherName || "—"} ({activeProfile.motherOccupation || "Homemaker"})</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Age / DOB:</span>
                              <span className="font-semibold">{activeProfile.age ? `${activeProfile.age} Yrs` : "—"} ({activeProfile.dob || "—"})</span>
                            </div>
                          </div>

                          {/* Academics & Self-Assessment Snippet */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                              <span className="font-bold text-slate-700 block mb-1">Academic Scores:</span>
                              <div className="text-[11px] space-y-0.5">
                                <div>1444 H: <b>{activeProfile.result1444 || "—"}</b></div>
                                <div>1445 H: <b>{activeProfile.result1445 || "—"}</b></div>
                                <div>1446 H: <b>{activeProfile.result1446 || "—"}</b></div>
                                <div>Hifz Year: <b>{activeProfile.hifzYear || "—"}</b> (Tabaqa: {activeProfile.hifzTabaqa || "—"})</div>
                              </div>
                            </div>

                            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                              <span className="font-bold text-emerald-900 block mb-1">Strengths:</span>
                              <ul className="list-disc pl-3 text-[11px] text-emerald-950 space-y-0.5">
                                {(activeProfile.strengths || []).filter(Boolean).map((s, idx) => (
                                  <li key={idx}>{s}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200">
                              <span className="font-bold text-rose-900 block mb-1">Weaknesses:</span>
                              <ul className="list-disc pl-3 text-[11px] text-rose-950 space-y-0.5">
                                {(activeProfile.weaknesses || []).filter(Boolean).map((w, idx) => (
                                  <li key={idx}>{w}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* About Myself */}
                          {activeProfile.aboutMyself && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                              <span className="font-bold text-slate-700 block mb-0.5">About Myself:</span>
                              <p className="text-slate-800">{activeProfile.aboutMyself}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ════════════════════════════════════════════════════
                        SECTION 2: REMARKS & DEPARTMENT EVALUATION TABS
                    ════════════════════════════════════════════════════ */}
                    <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                      <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-bold text-[#1c1c1c] uppercase tracking-wider">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            Official Department Remarks (1447 H)
                          </div>
                          <h4 className="text-lg font-bold text-slate-900 mt-1">
                            {evaluationViewSubMode === "OVERVIEW"
                              ? "Consolidated Department Responses Summary"
                              : ADMIN_EVALUATION_TABS.find((t) => t.id === activeDepartmentTab)?.label || "Department Evaluation"}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {evaluationViewSubMode === "OVERVIEW"
                              ? "Review all responses submitted by department incharges and faculty for this student."
                              : ADMIN_EVALUATION_TABS.find((t) => t.id === activeDepartmentTab)?.desc || "Fill student performance and conduct remarks for this department."}
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap">
                          {/* Mode Switcher */}
                          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setEvaluationViewSubMode("OVERVIEW")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                evaluationViewSubMode === "OVERVIEW"
                                  ? "bg-white text-slate-900 shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
                              <span>All Responses (جميع الردود)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEvaluationViewSubMode("TABS")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                evaluationViewSubMode === "TABS"
                                  ? "bg-white text-slate-900 shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                              <span>Edit Tabs (تعديل الأقسام)</span>
                            </button>
                          </div>

                          <span className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                            Status: <strong className="text-slate-800">{adminReviewStatus}</strong>
                          </span>
                        </div>
                      </div>

                      {feedbackMsg && (
                        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                          feedbackMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{feedbackMsg.text}</span>
                        </div>
                      )}

                      {/* ── MODE A: ALL RESPONSES CONSOLIDATED OVERVIEW ── */}
                      {evaluationViewSubMode === "OVERVIEW" && (
                        <div className="space-y-4">
                          {/* Quick Summary Pill Bar */}
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between flex-wrap gap-2.5 text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-700">Department Status:</span>
                              <span className="px-2.5 py-0.5 rounded-full font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {[
                                  Boolean(remarksMasool),
                                  Boolean(remarksTahfeez),
                                  Boolean(remarksTaleem),
                                  Boolean(remarksTadeeb),
                                  Boolean(remarksTanzeem),
                                  Boolean(remarksSports),
                                  Boolean(remarksMaktabat),
                                  Boolean(remarksSkills),
                                  Boolean(remarksOtherExams),
                                  Boolean(remarksCounselling || counsellingNotes),
                                  Boolean(disciplineRating && dedicationRating),
                                ].filter(Boolean).length} of 11 Departments Recorded
                              </span>
                              <span className="text-slate-400">|</span>
                              <span className="text-slate-500">
                                Click any department card or edit button to update remarks directly.
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setEvaluationViewSubMode("TABS")}
                              className="px-3.5 py-1.5 bg-[#1c1c1c] hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                              <span>Switch to Tabs Editor (تعديل الأقسام)</span>
                            </button>
                          </div>

                          {/* 11 Department Response Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {ADMIN_EVALUATION_TABS.map((tab) => {
                              const TabIcon = tab.icon;
                              let isFilled = false;
                              let contentText = "";

                              if (tab.id === "masool") {
                                isFilled = Boolean(remarksMasool);
                                contentText = remarksMasool;
                              } else if (tab.id === "tahfeez") {
                                isFilled = Boolean(remarksTahfeez);
                                contentText = remarksTahfeez;
                              } else if (tab.id === "taleem") {
                                isFilled = Boolean(remarksTaleem);
                                contentText = remarksTaleem;
                              } else if (tab.id === "tadeeb") {
                                isFilled = Boolean(remarksTadeeb);
                                contentText = remarksTadeeb;
                              } else if (tab.id === "tanzeem") {
                                isFilled = Boolean(remarksTanzeem);
                                contentText = remarksTanzeem;
                              } else if (tab.id === "sports") {
                                isFilled = Boolean(remarksSports);
                                contentText = remarksSports;
                              } else if (tab.id === "maktabat") {
                                isFilled = Boolean(remarksMaktabat);
                                contentText = remarksMaktabat;
                              } else if (tab.id === "skills") {
                                isFilled = Boolean(remarksSkills);
                                contentText = remarksSkills;
                              } else if (tab.id === "otherExams") {
                                isFilled = Boolean(remarksOtherExams);
                                contentText = remarksOtherExams;
                              } else if (tab.id === "counselling") {
                                isFilled = Boolean(remarksCounselling || counsellingNotes);
                                contentText = remarksCounselling || counsellingNotes;
                              } else if (tab.id === "ratings") {
                                isFilled = Boolean(disciplineRating && dedicationRating);
                              }

                              return (
                                <div
                                  key={tab.id}
                                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                                    isFilled
                                      ? "bg-white border-emerald-200 shadow-2xs hover:shadow-xs"
                                      : "bg-slate-50/60 border-slate-200 opacity-80"
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div
                                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                            isFilled
                                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                                              : "bg-slate-200 text-slate-500"
                                          }`}
                                        >
                                          <TabIcon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <h5 className="font-bold text-xs text-slate-900 truncate">
                                            {tab.label}
                                          </h5>
                                          <span
                                            className="font-alkanz text-[11px] text-slate-500 truncate block"
                                            dir="rtl"
                                          >
                                            {tab.arLabel}
                                          </span>
                                        </div>
                                      </div>

                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                          isFilled
                                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                            : "bg-slate-200 text-slate-600"
                                        }`}
                                      >
                                        {isFilled ? "✓ Responded" : "Pending"}
                                      </span>
                                    </div>

                                    {/* Response Body */}
                                    {tab.id === "ratings" ? (
                                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-xs">
                                        <div className="bg-slate-50 p-2 rounded-xl">
                                          <span className="text-[10px] text-slate-500 block">
                                            Behaviour
                                          </span>
                                          <span className="font-black text-slate-900">
                                            ★ {behaviourRating || "—"} / 5
                                          </span>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded-xl">
                                          <span className="text-[10px] text-slate-500 block">
                                            Communication
                                          </span>
                                          <span className="font-black text-slate-900">
                                            ★ {communicationRating || "—"} / 5
                                          </span>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded-xl">
                                          <span className="text-[10px] text-slate-500 block">
                                            Dedication
                                          </span>
                                          <span className="font-black text-slate-900">
                                            ★ {dedicationRating || "—"} / 5
                                          </span>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded-xl">
                                          <span className="text-[10px] text-slate-500 block">
                                            Discipline
                                          </span>
                                          <span className="font-black text-slate-900">
                                            ★ {disciplineRating || "—"} / 5
                                          </span>
                                        </div>
                                      </div>
                                    ) : isFilled ? (
                                      <p
                                        className="text-xs text-slate-800 leading-relaxed font-alkanz bg-slate-50/70 p-3 rounded-xl border border-slate-100 mt-2 whitespace-pre-wrap"
                                        dir="auto"
                                      >
                                        {contentText}
                                      </p>
                                    ) : (
                                      <div className="text-xs text-slate-400 italic py-3 text-center bg-slate-100/50 rounded-xl mt-2">
                                        No remarks entered yet.
                                      </div>
                                    )}
                                  </div>

                                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveDepartmentTab(tab.id);
                                        setEvaluationViewSubMode("TABS");
                                      }}
                                      className="text-xs font-bold text-slate-700 hover:text-black flex items-center gap-1 cursor-pointer hover:underline"
                                    >
                                      <Edit3 className="w-3 h-3 text-amber-600" />
                                      <span>Edit {tab.label}</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── MODE B: EDIT BY DEPARTMENT TAB ── */}
                      {evaluationViewSubMode === "TABS" && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between pb-1">
                            <span className="text-xs font-bold text-slate-700">Select Department to Edit:</span>
                            <button
                              type="button"
                              onClick={() => setEvaluationViewSubMode("OVERVIEW")}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>← View All Responses Summary</span>
                            </button>
                          </div>

                      {/* 11 Department Tabs Pill Selector */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100">
                        {ADMIN_EVALUATION_TABS.map((tab) => {
                          const Icon = tab.icon;
                          const isActive = activeDepartmentTab === tab.id;
                          let isFilled = false;
                          if (tab.id === "masool") isFilled = Boolean(remarksMasool);
                          else if (tab.id === "tahfeez") isFilled = Boolean(remarksTahfeez);
                          else if (tab.id === "taleem") isFilled = Boolean(remarksTaleem);
                          else if (tab.id === "tadeeb") isFilled = Boolean(remarksTadeeb);
                          else if (tab.id === "tanzeem") isFilled = Boolean(remarksTanzeem);
                          else if (tab.id === "sports") isFilled = Boolean(remarksSports);
                          else if (tab.id === "maktabat") isFilled = Boolean(remarksMaktabat);
                          else if (tab.id === "skills") isFilled = Boolean(remarksSkills);
                          else if (tab.id === "otherExams") isFilled = Boolean(remarksOtherExams);
                          else if (tab.id === "counselling") isFilled = Boolean(remarksCounselling || counsellingNotes);
                          else if (tab.id === "ratings") isFilled = Boolean(disciplineRating && dedicationRating);

                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setActiveDepartmentTab(tab.id)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                isActive
                                  ? "bg-slate-950 text-white shadow-md ring-2 ring-slate-950/20"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${isFilled ? "bg-emerald-400" : "bg-slate-300"}`} />
                              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-amber-400" : "text-slate-500"}`} />
                              <span>{tab.label}</span>
                              <span className={`text-[11px] font-alkanz ${isActive ? "text-amber-300" : "text-slate-500"}`} dir="rtl">
                                {tab.arLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* ── ACTIVE TAB CONTENT ── */}
                      <div className="space-y-4">
                        {/* TAB: RATINGS */}
                        {activeDepartmentTab === "ratings" && (
                          <div className="space-y-4">
                            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl">
                              <h5 className="font-bold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                                <Star className="w-4 h-4 text-amber-600" />
                                Institutional 5-Star Evaluations:
                              </h5>
                              <p className="text-[11px] text-amber-700 mt-0.5">
                                Overall score evaluation across four core traits (1 to 5).
                              </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              {/* Behaviour */}
                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-slate-900">Behaviour</span>
                                  <span className="text-xs font-extrabold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                                    {behaviourRating} / 5
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                  Cooperates with faculty and peers, maintains positive attitude.
                                </p>
                                <div className="flex items-center gap-1 pt-1">
                                  {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() => setBehaviourRating(val)}
                                      className={`flex-1 py-1 rounded text-xs font-bold cursor-pointer ${
                                        behaviourRating === val ? "bg-emerald-700 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                                      }`}
                                    >
                                      {val}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Communication */}
                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-slate-900">Communication</span>
                                  <span className="text-xs font-extrabold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                                    {communicationRating} / 5
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                  Conveys ideas effectively, polite conversations.
                                </p>
                                <div className="flex items-center gap-1 pt-1">
                                  {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() => setCommunicationRating(val)}
                                      className={`flex-1 py-1 rounded text-xs font-bold cursor-pointer ${
                                        communicationRating === val ? "bg-emerald-700 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                                      }`}
                                    >
                                      {val}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Dedication */}
                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-slate-900">Dedication</span>
                                  <span className="text-xs font-extrabold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                                    {dedicationRating} / 5
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                  Commitment to tasks, classes, and assigned responsibilities.
                                </p>
                                <div className="flex items-center gap-1 pt-1">
                                  {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() => setDedicationRating(val)}
                                      className={`flex-1 py-1 rounded text-xs font-bold cursor-pointer ${
                                        dedicationRating === val ? "bg-emerald-700 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                                      }`}
                                    >
                                      {val}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Discipline */}
                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-slate-900">Discipline</span>
                                  <span className="text-xs font-extrabold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                                    {disciplineRating} / 5
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                  Practices rules, etiquette, and punctuality.
                                </p>
                                <div className="flex items-center gap-1 pt-1">
                                  {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() => setDisciplineRating(val)}
                                      className={`flex-1 py-1 rounded text-xs font-bold cursor-pointer ${
                                        disciplineRating === val ? "bg-emerald-700 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                                      }`}
                                    >
                                      {val}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TAB: MASOOL */}
                        {activeDepartmentTab === "masool" && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">Class Masul Remarks</span>
                              <span className="font-alkanz text-sm font-bold text-[#1c1c1c]" dir="rtl">المسؤول عن الدرجة</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {["طالب ما بهتر معاشرة ني خوبي چھے", "برامج علمية ما ساهمة فعالة كيدي چھے", "مواظبة وأخلاق حسنة في كل الشؤون"].map((phrase) => (
                                <button
                                  key={phrase}
                                  type="button"
                                  onClick={() => setRemarksMasool((prev) => (prev ? `${prev} ${phrase}` : phrase))}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-alkanz text-slate-700 cursor-pointer"
                                  dir="rtl"
                                >
                                  + {phrase}
                                </button>
                              ))}
                            </div>
                            <textarea
                              rows={4}
                              dir="auto"
                              value={remarksMasool}
                              onChange={(e) => setRemarksMasool(e.target.value)}
                              placeholder="طالب ما بهتر معاشرة ني خوبي چھے، برامج علمية ما ساهمة فعالة كيدي چھے..."
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                            />
                          </div>
                        )}

                        {/* TAB: TAHFEEZ */}
                        {activeDepartmentTab === "tahfeez" && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">Tahfeez Department Remarks</span>
                              <span className="font-alkanz text-sm font-bold text-[#1c1c1c]" dir="rtl">عن التحفيظ</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {["حلقة ما برابر دهيان سي پرھے چھے", "حفظ القرآن الكريم ما مخلصانه ڪوشش چھے", "تلاوة حسنة وتجويد ممتاز", "مواظبة على حصص التحفيظ"].map((phrase) => (
                                <button
                                  key={phrase}
                                  type="button"
                                  onClick={() => setRemarksTahfeez((prev) => (prev ? `${prev} ${phrase}` : phrase))}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-alkanz text-slate-700 cursor-pointer"
                                  dir="rtl"
                                >
                                  + {phrase}
                                </button>
                              ))}
                            </div>
                            <textarea
                              rows={4}
                              dir="auto"
                              value={remarksTahfeez}
                              onChange={(e) => setRemarksTahfeez(e.target.value)}
                              placeholder="He has good character and makes sincere efforts for Tahfeez-ul-Qur'an..."
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                            />
                          </div>
                        )}

                        {/* TAB: TALEEM */}
                        {activeDepartmentTab === "taleem" && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">Academic Progress &amp; Ta&apos;leem</span>
                              <span className="font-alkanz text-sm font-bold text-[#1c1c1c]" dir="rtl">عن التعليم</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {["طالب علم نو تعليمي مستوى ممتاز چھے", "حلقة ما فعال اور مجتهد چھے", "درجات ممتازة في المواد العلمية", "استيعاب سريع واجتهاد دائم"].map((phrase) => (
                                <button
                                  key={phrase}
                                  type="button"
                                  onClick={() => setRemarksTaleem((prev) => (prev ? `${prev} ${phrase}` : phrase))}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-alkanz text-slate-700 cursor-pointer"
                                  dir="rtl"
                                >
                                  + {phrase}
                                </button>
                              ))}
                            </div>
                            <textarea
                              rows={4}
                              dir="auto"
                              value={remarksTaleem}
                              onChange={(e) => setRemarksTaleem(e.target.value)}
                              placeholder="طالب علم نو تعليمي مستوى ممتاز چھے، حلقة ما برابر دهيان سي پرھے چھے..."
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                            />
                          </div>
                        )}

                        {/* TAB: TADEEB */}
                        {activeDepartmentTab === "tadeeb" && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">Ta&apos;deeb &amp; Akhlaaq</span>
                              <span className="font-alkanz text-sm font-bold text-[#1c1c1c]" dir="rtl">عن التأديب والرياضة والمنازل البرهانية</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {["حسن الأخلاق والأدب مع الأساتذة والزملاء", "focused person in every aspects and always follow norms", "ملتزم بآداب وسنن المنازل البرهانية"].map((phrase) => (
                                <button
                                  key={phrase}
                                  type="button"
                                  onClick={() => setRemarksTadeeb((prev) => (prev ? `${prev} ${phrase}` : phrase))}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-alkanz text-slate-700 cursor-pointer"
                                  dir="rtl"
                                >
                                  + {phrase}
                                </button>
                              ))}
                            </div>
                            <textarea
                              rows={4}
                              dir="auto"
                              value={remarksTadeeb}
                              onChange={(e) => setRemarksTadeeb(e.target.value)}
                              placeholder="focused person in every aspects and always follow norms."
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                            />
                          </div>
                        )}

                        {/* TAB: TANZEEM */}
                        {activeDepartmentTab === "tanzeem" && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">Tanzeem &amp; Punctuality</span>
                              <span className="font-alkanz text-sm font-bold text-[#1c1c1c]" dir="rtl">عن التنظيم</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {["تلاوة الدعاء ، حلقة انے تمام برامج ما مواظبة سي حاضر تھائي چھے", "حضور منتظم وانضباط ممتاز في الوقت"].map((phrase) => (
                                <button
                                  key={phrase}
                                  type="button"
                                  onClick={() => setRemarksTanzeem((prev) => (prev ? `${prev} ${phrase}` : phrase))}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-alkanz text-slate-700 cursor-pointer"
                                  dir="rtl"
                                >
                                  + {phrase}
                                </button>
                              ))}
                            </div>
                            <textarea
                              rows={4}
                              dir="auto"
                              value={remarksTanzeem}
                              onChange={(e) => setRemarksTanzeem(e.target.value)}
                              placeholder="تلاوة الدعاء ، حلقة انے تمام برامج ما مواظبة سي حاضر تھائي چھے..."
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                            />
                          </div>
                        )}

                        {/* TAB: SPORTS */}
                        {activeDepartmentTab === "sports" && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">Sports &amp; Athletics Activities</span>
                              <span className="font-alkanz text-sm font-bold text-[#1c1c1c]" dir="rtl">عن خيمة الرياضة</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {["The student participates actively in sports and physical training.", "مشارك نشط في كافة الأنشطة الرياضية", "The student has not participated in sports activities during this academic year."].map((phrase) => (
                                <button
                                  key={phrase}
                                  type="button"
                                  onClick={() => setRemarksSports((prev) => (prev ? `${prev} ${phrase}` : phrase))}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer"
                                >
                                  + {phrase}
                                </button>
                              ))}
                            </div>
                            <textarea
                              rows={4}
                              dir="auto"
                              value={remarksSports}
                              onChange={(e) => setRemarksSports(e.target.value)}
                              placeholder="Active participation in athletics, football, and physical fitness..."
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                            />
                          </div>
                        )}

                        {/* TAB: MAKTABAT */}
                        {activeDepartmentTab === "maktabat" && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">Maktabat &amp; Library Utilization</span>
                              <span className="font-alkanz text-sm font-bold text-[#1c1c1c]" dir="rtl">المكتبة</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {["The student demonstrated consistent library usage and regular reading habits.", "Issued multiple academic and reference books during the year.", "مستفيد منتظم من المكتبة وقراءة الكتب العلمية"].map((phrase) => (
                                <button
                                  key={phrase}
                                  type="button"
                                  onClick={() => setRemarksMaktabat((prev) => (prev ? `${prev} ${phrase}` : phrase))}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer"
                                >
                                  + {phrase}
                                </button>
                              ))}
                            </div>
                            <textarea
                              rows={4}
                              dir="auto"
                              value={remarksMaktabat}
                              onChange={(e) => setRemarksMaktabat(e.target.value)}
                              placeholder="The student had issued books from the Maktabat and demonstrated consistent library usage..."
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                            />
                          </div>
                        )}

                        {/* TAB: SKILLS */}
                        {activeDepartmentTab === "skills" && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">Art, IT &amp; Special Skills</span>
                              <span className="font-alkanz text-sm font-bold text-[#1c1c1c]" dir="rtl">عن الفن والمهارة</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {["IT Skills, Computer Hardware", "Graphic Design & Coding Skills", "خط عربي وفنون جميلة", "Public Speaking and Debating"].map((phrase) => (
                                <button
                                  key={phrase}
                                  type="button"
                                  onClick={() => setRemarksSkills((prev) => (prev ? `${prev}, ${phrase}` : phrase))}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer"
                                >
                                  + {phrase}
                                </button>
                              ))}
                            </div>
                            <textarea
                              rows={3}
                              dir="auto"
                              value={remarksSkills}
                              onChange={(e) => setRemarksSkills(e.target.value)}
                              placeholder="IT Skills, Coding, Calligraphy, Public Speaking..."
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                            />
                          </div>
                        )}

                        {/* TAB: OTHER EXAMS */}
                        {activeDepartmentTab === "otherExams" && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">External Board Exams</span>
                              <span className="font-alkanz text-sm font-bold text-[#1c1c1c]" dir="rtl">عن الامتحانات الأخرى</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {["10th done from Board, 12th pursuing", "Appeared for external exams with good score", "10th done, 12th not done"].map((phrase) => (
                                <button
                                  key={phrase}
                                  type="button"
                                  onClick={() => setRemarksOtherExams(phrase)}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer"
                                >
                                  {phrase}
                                </button>
                              ))}
                            </div>
                            <input
                              type="text"
                              dir="auto"
                              value={remarksOtherExams}
                              onChange={(e) => setRemarksOtherExams(e.target.value)}
                              placeholder="10th done from MP Board, 12th pursuing..."
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-alkanz focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                            />
                          </div>
                        )}

                        {/* TAB: COUNSELLING */}
                        {activeDepartmentTab === "counselling" && (
                          <div className="space-y-4">
                            <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                                  <HeartHandshake className="w-4 h-4 text-purple-700" />
                                  Counsellor Institutional Remarks
                                </span>
                                <span className="font-alkanz text-sm font-bold text-purple-900" dir="rtl">الإرشاد والتوجيه</span>
                              </div>
                              <textarea
                                rows={3}
                                dir="auto"
                                value={remarksCounselling}
                                onChange={(e) => setRemarksCounselling(e.target.value)}
                                placeholder="Career guidance trajectory, strengths, academic readiness..."
                                className="w-full px-3.5 py-2.5 bg-white border border-purple-300 rounded-xl text-sm leading-relaxed font-alkanz focus:ring-2 focus:ring-purple-600 focus:outline-none"
                              />
                            </div>

                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                              <span className="text-xs font-bold text-slate-800">
                                Confidential Counselling &amp; Sibling Notes
                              </span>
                              <textarea
                                rows={3}
                                dir="auto"
                                value={counsellingNotes}
                                onChange={(e) => setCounsellingNotes(e.target.value)}
                                placeholder="Family background, sibling educational trajectory, confidential notes..."
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm leading-relaxed focus:ring-2 focus:ring-slate-800 focus:outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                      {/* ── STICKY BOTTOM ACTION BAR (Save & Next Student) ── */}
                      <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 -mx-5 sm:-mx-7 -mb-5 sm:-mb-7 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg z-20">
                        {/* Left: Student Carousel Nav */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handlePrevStudent}
                            disabled={currentStudentIndex <= 0}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                              currentStudentIndex <= 0
                                ? "border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50"
                                : "border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                            }`}
                          >
                            <span>← Prev Student</span>
                          </button>
                          <span className="text-xs font-semibold text-slate-600 px-1 font-mono">
                            {currentStudentIndex >= 0 ? `${currentStudentIndex + 1} of ${filteredStudents.length}` : "—"}
                          </span>
                          <button
                            type="button"
                            onClick={handleNextStudent}
                            disabled={currentStudentIndex >= filteredStudents.length - 1}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                              currentStudentIndex >= filteredStudents.length - 1
                                ? "border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50"
                                : "border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                            }`}
                          >
                            <span>Next Student →</span>
                          </button>
                        </div>

                        {/* Status Select and Save Actions */}
                        <div className="flex items-center gap-2.5 flex-wrap justify-end">
                          <div className="flex items-center gap-1.5 mr-2">
                            <label className="text-xs font-bold text-slate-700">Status:</label>
                            <select
                              value={adminReviewStatus}
                              onChange={(e) => setAdminReviewStatus(e.target.value)}
                              className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                            >
                              <option value="DRAFT">Draft</option>
                              <option value="SUBMITTED">Submitted</option>
                              <option value="REVIEWED">Reviewed</option>
                              <option value="APPROVED">Approved</option>
                              <option value="NEEDS_REVISION">Needs Revision</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedStudentId(null)}
                            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            Close
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveRemarks(false)}
                            disabled={savingRemarks}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                          >
                            {savingRemarks ? "Saving..." : "Save Tab"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveRemarks(true)}
                            disabled={savingRemarks}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-60"
                            title="Save current remarks and immediately jump to the next student"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>💾 Save &amp; Next Student →</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          YEARLY PROFILE TAB DELEGATION & INCHARGES MODAL
          Dual Mode: By Department Tab or By Faculty Member
      ════════════════════════════════════════════════════════════ */}
      {showAssignFacultyModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-start justify-between border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400 text-slate-950">
                      Tab Delegation
                    </span>
                    <span className="text-xs text-slate-300">11 Department Incharges</span>
                    <span className="text-xs font-alkanz text-amber-300" dir="rtl">تفويض الأقسام والمشرفين</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">
                    Yearly Profile Department Incharges &amp; Delegation
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
                    Assign specific faculty members to individual department tabs. Incharges see all students in their list, but are strictly restricted to view and edit only their assigned department tabs.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAssignFacultyModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode Switcher & Refresh */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDelegationViewMode("BY_TAB")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    delegationViewMode === "BY_TAB"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                  <span>By Department Tab (حسب القسم)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDelegationViewMode("BY_TEACHER")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    delegationViewMode === "BY_TEACHER"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>By Faculty Member (حسب الأستاذ)</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    fetchTabAssignments();
                    fetchTeachingFaculty();
                  }}
                  disabled={loadingFaculty || savingDelegation}
                  className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5"
                  title="Refresh assignments"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFaculty || savingDelegation ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Notification / Feedback Banner */}
            {facultyMsg && (
              <div
                className={`px-5 py-2.5 text-xs font-semibold flex items-center justify-between border-b shrink-0 ${
                  facultyMsg.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  {facultyMsg.type === "success" ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{facultyMsg.text}</span>
                </div>
                <button
                  onClick={() => setFacultyMsg(null)}
                  className="text-xs underline hover:opacity-80 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* ── MODE 1: BY DEPARTMENT TAB ── */}
            {delegationViewMode === "BY_TAB" && (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-hidden">
                {/* 11 Department Tabs Scrollable Strip */}
                <div className="flex items-center gap-2 overflow-x-auto p-3.5 border-b border-slate-200 bg-white shrink-0">
                  {ADMIN_EVALUATION_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isSelected = activeDelegationTab === tab.id;
                    const inchargesCount = tabDelegationList.filter(
                      (t) => t.isAllTabs || t.assignedTabs.includes(tab.id)
                    ).length;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveDelegationTab(tab.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                          isSelected
                            ? "bg-[#1c1c1c] text-white border-[#1c1c1c] shadow-xs"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-amber-400" : "text-slate-500"}`} />
                        <span>{tab.label}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : inchargesCount > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {inchargesCount}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Tab Context Banner & Search */}
                {(() => {
                  const currentTabInfo =
                    ADMIN_EVALUATION_TABS.find((t) => t.id === activeDelegationTab) || ADMIN_EVALUATION_TABS[0];
                  const CurrentIcon = currentTabInfo.icon;

                  return (
                    <>
                      <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                            <CurrentIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-900">{currentTabInfo.label}</h4>
                              <span className="font-alkanz text-xs font-bold text-slate-600" dir="rtl">
                                {currentTabInfo.arLabel}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{currentTabInfo.desc}</p>
                          </div>
                        </div>

                        <div className="relative w-full sm:w-64 shrink-0">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={facultySearchQuery}
                            onChange={(e) => setFacultySearchQuery(e.target.value)}
                            placeholder="Search faculty..."
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Teachers List for this Tab */}
                      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
                        {loadingFaculty ? (
                          <div className="py-20 text-center text-slate-500">
                            <div className="w-8 h-8 border-3 border-[#1c1c1c] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            Loading faculty assignments...
                          </div>
                        ) : (
                          (() => {
                            const q = facultySearchQuery.toLowerCase();
                            const filteredTeachers = tabDelegationList.filter((t) => {
                              if (!q) return true;
                              return t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q);
                            });

                            if (filteredTeachers.length === 0) {
                              return (
                                <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                                  <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                  <p className="text-xs font-semibold">No matching faculty found.</p>
                                </div>
                              );
                            }

                            return filteredTeachers.map((teacher) => {
                              const isAssigned =
                                teacher.isAllTabs || teacher.assignedTabs.includes(currentTabInfo.id);
                              const tf = teachingFacultyList.find(
                                (f) => f.teacherProfileId === teacher.teacherId || f.id === teacher.userId
                              );

                              return (
                                <div
                                  key={teacher.teacherId}
                                  className={`p-3.5 bg-white rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                    isAssigned
                                      ? "border-emerald-300 bg-emerald-50/20 shadow-2xs"
                                      : "border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-slate-700 font-bold text-xs">
                                      {teacher.avatarUrl ? (
                                        <img
                                          src={normalizeImgSrc(teacher.avatarUrl)}
                                          alt={teacher.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        teacher.name
                                          .split(" ")
                                          .map((n) => n[0])
                                          .slice(0, 2)
                                          .join("")
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-xs text-slate-900 truncate">
                                          {teacher.name}
                                        </span>
                                        {teacher.isAllTabs && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800">
                                            Universal Access
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-slate-500 truncate">{teacher.email}</div>
                                      {tf && tf.subjects.length > 0 && (
                                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                                          {tf.subjects.slice(0, 3).map((s) => (
                                            <span
                                              key={s}
                                              className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                                            >
                                              {s}
                                            </span>
                                          ))}
                                          {tf.subjects.length > 3 && (
                                            <span className="text-[10px] text-slate-400 font-medium">
                                              +{tf.subjects.length - 3} more
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleTeacherForTab(currentTabInfo.id, teacher.teacherId)
                                    }
                                    disabled={savingDelegation || teacher.isAllTabs}
                                    className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                      isAssigned
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                                    }`}
                                  >
                                    {isAssigned ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-white" />
                                        <span>Incharge Assigned</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3.5 h-3.5 text-slate-500" />
                                        <span>Assign Incharge</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              );
                            });
                          })()
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* ── MODE 2: BY FACULTY MEMBER ── */}
            {delegationViewMode === "BY_TEACHER" && (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-hidden">
                {/* Search & Filter Header */}
                <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={facultySearchQuery}
                      onChange={(e) => setFacultySearchQuery(e.target.value)}
                      placeholder="Search faculty by name or email..."
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#1c1c1c] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5 text-xs font-semibold">
                      <button
                        onClick={() => setFacultyFilter("ALL")}
                        className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                          facultyFilter === "ALL"
                            ? "bg-[#1c1c1c] text-white font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        All ({tabDelegationList.length})
                      </button>
                      <button
                        onClick={() => setFacultyFilter("ENABLED")}
                        className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                          facultyFilter === "ENABLED"
                            ? "bg-emerald-600 text-white font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Has Tabs (
                        {
                          tabDelegationList.filter(
                            (t) => t.isAllTabs || t.assignedTabs.length > 0
                          ).length
                        }
                        )
                      </button>
                      <button
                        onClick={() => setFacultyFilter("LOCKED")}
                        className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                          facultyFilter === "LOCKED"
                            ? "bg-amber-600 text-white font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        No Tabs (
                        {
                          tabDelegationList.filter(
                            (t) => !t.isAllTabs && t.assignedTabs.length === 0
                          ).length
                        }
                        )
                      </button>
                    </div>
                  </div>
                </div>

                {/* Teachers List with 11 Pill Chips */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                  {loadingFaculty ? (
                    <div className="py-20 text-center text-slate-500">
                      <div className="w-8 h-8 border-3 border-[#1c1c1c] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading faculty assignments...
                    </div>
                  ) : (
                    (() => {
                      const q = facultySearchQuery.toLowerCase();
                      const filtered = tabDelegationList.filter((t) => {
                        if (
                          q &&
                          !t.name.toLowerCase().includes(q) &&
                          !t.email.toLowerCase().includes(q)
                        )
                          return false;
                        if (facultyFilter === "ENABLED")
                          return t.isAllTabs || t.assignedTabs.length > 0;
                        if (facultyFilter === "LOCKED")
                          return !t.isAllTabs && t.assignedTabs.length === 0;
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                            <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="text-xs font-semibold">No matching faculty found.</p>
                          </div>
                        );
                      }

                      return filtered.map((teacher) => {
                        const tf = teachingFacultyList.find(
                          (f) =>
                            f.teacherProfileId === teacher.teacherId ||
                            f.id === teacher.userId
                        );

                        return (
                          <div
                            key={teacher.teacherId}
                            className={`p-4 bg-white rounded-2xl border transition-all shadow-2xs space-y-3 ${
                              teacher.isAllTabs || teacher.assignedTabs.length > 0
                                ? "border-emerald-200 bg-gradient-to-r from-white to-emerald-50/10"
                                : "border-slate-200"
                            }`}
                          >
                            {/* Header: Teacher Name, Email, All Tabs Toggle */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-slate-700 font-bold text-xs">
                                  {teacher.avatarUrl ? (
                                    <img
                                      src={normalizeImgSrc(teacher.avatarUrl)}
                                      alt={teacher.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    teacher.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .slice(0, 2)
                                      .join("")
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-slate-900">
                                      {teacher.name}
                                    </span>
                                    {tf && tf.department && (
                                      <span className="text-[11px] text-slate-500 font-medium">
                                        ({tf.department})
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500">{teacher.email}</div>
                                </div>
                              </div>

                              {/* Right: Assigned Count & All Tabs Button */}
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                    teacher.isAllTabs
                                      ? "bg-purple-100 text-purple-800"
                                      : teacher.assignedTabs.length > 0
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {teacher.isAllTabs
                                    ? "All 11 Tabs (Universal)"
                                    : `${teacher.assignedTabs.length} of 11 Tabs Assigned`}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (teacher.isAllTabs) {
                                      handleSaveTeacherTabs(teacher.teacherId, [], false);
                                    } else {
                                      handleSaveTeacherTabs(
                                        teacher.teacherId,
                                        ADMIN_EVALUATION_TABS.map((t) => t.id),
                                        true
                                      );
                                    }
                                  }}
                                  disabled={savingDelegation}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                                    teacher.isAllTabs
                                      ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                                  }`}
                                >
                                  {teacher.isAllTabs ? "Revoke Universal" : "Grant All Tabs"}
                                </button>
                              </div>
                            </div>

                            {/* 11 Granular Tab Pills for this Teacher */}
                            <div className="pt-2 border-t border-slate-100">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Click to Grant / Revoke Department Tabs:
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {ADMIN_EVALUATION_TABS.map((tab) => {
                                  const TabIcon = tab.icon;
                                  const hasTab =
                                    teacher.isAllTabs || teacher.assignedTabs.includes(tab.id);

                                  return (
                                    <button
                                      key={tab.id}
                                      type="button"
                                      onClick={() => {
                                        if (teacher.isAllTabs) {
                                          const nextTabs = ADMIN_EVALUATION_TABS.filter(
                                            (t) => t.id !== tab.id
                                          ).map((t) => t.id);
                                          handleSaveTeacherTabs(teacher.teacherId, nextTabs, false);
                                        } else if (hasTab) {
                                          const nextTabs = teacher.assignedTabs.filter(
                                            (tid) => tid !== tab.id
                                          );
                                          handleSaveTeacherTabs(teacher.teacherId, nextTabs, false);
                                        } else {
                                          const nextTabs = [...teacher.assignedTabs, tab.id];
                                          handleSaveTeacherTabs(teacher.teacherId, nextTabs, false);
                                        }
                                      }}
                                      disabled={savingDelegation}
                                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                        hasTab
                                          ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs"
                                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                      }`}
                                      title={hasTab ? `Revoke ${tab.label}` : `Grant ${tab.label}`}
                                    >
                                      <TabIcon
                                        className={`w-3 h-3 ${
                                          hasTab ? "text-emerald-700" : "text-slate-400"
                                        }`}
                                      />
                                      <span>{tab.label}</span>
                                      {hasTab && <Check className="w-3 h-3 text-emerald-600" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>
                  <strong>
                    {
                      tabDelegationList.filter((t) => t.isAllTabs || t.assignedTabs.length > 0)
                        .length
                    }
                  </strong>{" "}
                  of <strong>{tabDelegationList.length}</strong> faculty members assigned to Yearly Profile
                  evaluation tabs.
                </span>
              </div>

              <button
                onClick={() => setShowAssignFacultyModal(false)}
                className="px-5 py-2 bg-[#1c1c1c] hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          IMAGE ZOOM / LIGHTBOX PREVIEW MODAL
      ════════════════════════════════════════════════════════════ */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImg(null)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-2 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-800 truncate pr-2">{lightboxImg.title}</h4>
              <button
                onClick={() => setLightboxImg(null)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 flex items-center justify-center bg-slate-50 rounded-xl max-h-[70vh] overflow-hidden">
              <img
                src={normalizeImgSrc(lightboxImg.url)}
                alt={lightboxImg.title}
                className="max-h-[66vh] max-w-full object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
      {/* ════════════════════════════════════════════════════════════
          BULK DOWNLOAD PROFILES PDF MODAL
      ════════════════════════════════════════════════════════════ */}
      <TalabatBulkDownloadModal
        isOpen={isBulkDownloadOpen}
        onClose={() => setIsBulkDownloadOpen(false)}
        selectedStudents={selectedStudentTargets}
        onClearSelection={handleClearSelection}
      />
    </div>
  );
}
