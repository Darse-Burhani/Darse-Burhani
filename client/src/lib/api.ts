/**
 * API Client for Attendance Registry & Medical/Leave Management System
 */

export interface LeaveRequestItem {
  id: string;
  studentId?: string;
  studentName?: string;
  avatarUrl?: string | null;
  its?: string;
  grade?: string;
  section?: string;
  className?: string;
  type: "MEDICAL" | "PERSONAL" | "FAMILY_EMERGENCY" | "OTHER";
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewerNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface StudentLeaveSummary {
  totalRequests: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvedDays: number;
  medicalDays: number;
}

export interface TeacherLeaveStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export interface AdminLeaveStats {
  pending: number;
  approved: number;
  rejected: number;
  medical: number;
  total: number;
}

export interface ScheduledEventWindow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateEndTime?: string | null;
  enabled: boolean;
  audience: "ALL_STUDENTS" | "STUDENT" | "FACULTY" | "BOTH" | "ALL";
  status: "ACTIVE" | "UPCOMING" | "CLOSED";
  timeDisplay: string;
  // Faculty timer of the same unified event (present when the event carries
  // both Talabat + faculty timings). Used for window-aware faculty pulling.
  facultyStartTime?: string | null;
  facultyEndTime?: string | null;
  facultyLateEndTime?: string | null;
  facultyEnabled?: boolean;
}

export interface AttendanceLogRecordItem {
  id: string;
  memberId: string;
  studentId?: string;
  role: "STUDENT" | "FACULTY";
  name: string;
  avatarUrl?: string | null;
  its?: string;
  grade: string;
  section: string;
  designationOrClass: string;
  className?: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "EARLY_DEPARTURE" | "MEDICAL" | "ON_LEAVE" | "NOT_MARKED";
  source: "SCAN" | "MANUAL" | "AUTO_ABSENT" | "MEDICAL_LEAVE" | "LEAVE_APPROVED" | "BIOMETRIC";
  verificationMethod?: string | null;
  biometricMethod?: "FACIAL" | "FINGERPRINT" | "CARD" | "BIOMETRIC" | string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  remarks?: string | null;
  leave?: {
    id: string;
    type: string;
    reason: string;
    startDate: string;
    endDate: string;
    attachmentUrl?: string | null;
  } | null;
  streakDays?: number;
  scheduledEvent?: {
    id: string;
    name: string;
    timeWindow: string;
    audience?: "STUDENT" | "FACULTY" | "BOTH" | string;
  } | null;
}

export type RegistryRecordItem = AttendanceLogRecordItem;

export interface AttendanceLogsSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  medical: number;
  onLeave: number;
  notMarked: number;
  sources: {
    scanned?: number;
    biometric?: number;
    manual: number;
    autoAbsent: number;
    medicalLeave: number;
    leaveApproved: number;
  };
}

export type RegistrySummary = AttendanceLogsSummary;

export interface AttendanceLogsResponse {
  date: string;
  summary: AttendanceLogsSummary;
  talabatSummary?: AttendanceLogsSummary;
  facultySummary?: AttendanceLogsSummary;
  overallSummary?: AttendanceLogsSummary;
  hikvisionSummary?: AttendanceLogsSummary;
  manualSummary?: AttendanceLogsSummary;
  eventLiveCounts?: Record<string, number>;
  audience?: "STUDENT" | "FACULTY" | "ALL";
  logType?: "HIKVISION" | "MANUAL" | "ALL";
  isTeacherView?: boolean;
  isTilawatDua?: boolean;
  filters: {
    grades: string[];
    sections: string[];
  };
  records: AttendanceLogRecordItem[];
}

export type RegistryResponse = AttendanceLogsResponse;

export interface StudentAuditHistory {
  student: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    its: string;
    grade: string;
    section: string;
    streakDays: number;
  };
  registries: Array<{
    id: string;
    date: string;
    status: string;
    source: string;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    remarks?: string | null;
    leave?: {
      id: string;
      type: string;
      reason: string;
      status: string;
    } | null;
  }>;
  recentLeaves: Array<{
    id: string;
    type: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: string;
    createdAt: string;
  }>;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Request failed with status ${res.status}`);
  }

  return json.data as T;
}

// ── Talabat API ──

export async function getTalabatLeaves(): Promise<{
  summary: StudentLeaveSummary;
  leaves: LeaveRequestItem[];
}> {
  return request<{ summary: StudentLeaveSummary; leaves: LeaveRequestItem[] }>("/api/talabat/leave");
}

export async function submitTalabatLeave(payload: {
  type: "MEDICAL" | "PERSONAL" | "FAMILY_EMERGENCY" | "OTHER";
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string;
}): Promise<LeaveRequestItem> {
  return request<LeaveRequestItem>("/api/talabat/leave", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelTalabatLeave(leaveId: string): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(`/api/talabat/leave/${leaveId}`, {
    method: "DELETE",
  });
}

// ── Parent leave API (no MEDICAL — PERSONAL / FAMILY_EMERGENCY / OTHER only) ──

export type ParentLeaveType = "PERSONAL" | "FAMILY_EMERGENCY" | "OTHER";

export interface ParentLeaveItem extends LeaveRequestItem {
  studentProfileId: string;
  studentName: string;
}

export async function getParentLeaves(studentProfileId?: string): Promise<{
  leaves: ParentLeaveItem[];
  summaryByChild: Record<string, unknown>;
}> {
  const q = studentProfileId ? `?studentId=${encodeURIComponent(studentProfileId)}` : "";
  return request<{ leaves: ParentLeaveItem[]; summaryByChild: Record<string, unknown> }>(
    `/api/parent/leave${q}`
  );
}

export async function submitParentLeave(payload: {
  studentProfileId: string;
  type: ParentLeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string;
}): Promise<LeaveRequestItem> {
  return request<LeaveRequestItem>("/api/parent/leave", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelParentLeave(leaveId: string): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(`/api/parent/leave/${leaveId}`, {
    method: "DELETE",
  });
}

// ── Assignments API ──

export type SkillCategory = "criticalThinking" | "collaboration" | "leadership" | "resilience";

export interface AssignmentItem {
  id: string;
  title: string;
  description?: string | null;
  subject?: string | null;
  skillCategory?: string | null;
  maxMarks: number;
  dueDate?: string | null;
  grade?: string | null;
  section?: string | null;
  targetStudentId?: string | null;
  targetStudent?: {
    id: string;
    name: string;
    its: string;
    grade: string;
    section: string;
  } | null;
  isPersonalized?: boolean;
  createdAt: string;
  gradedCount?: number;
  myGrade?: { marks: number; feedback?: string | null; updatedAt: string } | null;
}

export interface AssignmentGradeItem {
  id: string;
  studentId: string;
  studentName: string;
  its: string;
  grade: string;
  section: string;
  marks: number;
  feedback?: string | null;
  updatedAt: string;
}

export async function getAssignments(): Promise<AssignmentItem[]> {
  return request<AssignmentItem[]>("/api/assignments");
}

export async function createAssignment(payload: {
  title: string;
  description?: string;
  subject?: string;
  skillCategory?: string;
  maxMarks?: number;
  dueDate?: string;
  grade?: string;
  section?: string;
  targetStudentId?: string | null;
}): Promise<{ id: string }> {
  return request<{ id: string }>("/api/assignments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAssignment(id: string, payload: Record<string, unknown>): Promise<void> {
  await request<unknown>(`/api/assignments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAssignment(id: string): Promise<void> {
  await request<unknown>(`/api/assignments/${id}`, { method: "DELETE" });
}

export interface AssignmentStudentOption {
  id: string;
  name: string;
  its: string;
  grade: string;
  section: string;
}

export async function getAssignmentStudents(q?: string): Promise<AssignmentStudentOption[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return request<AssignmentStudentOption[]>(`/api/assignments/students${qs}`);
}

export async function getAssignmentGrades(assignmentId: string): Promise<AssignmentGradeItem[]> {
  return request<AssignmentGradeItem[]>(`/api/assignments/${assignmentId}/grades`);
}

export async function saveAssignmentGrade(
  assignmentId: string,
  payload: { studentId: string; marks: number; feedback?: string }
): Promise<{ id: string }> {
  return request<{ id: string }>(`/api/assignments/${assignmentId}/grades`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface SkillAttemptItem {
  id: string;
  studentId: string;
  studentName: string;
  skill: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  createdAt: string;
}

export async function getSkillAttempts(params?: {
  studentId?: string;
  skill?: string;
}): Promise<SkillAttemptItem[]> {
  const q = new URLSearchParams();
  if (params?.studentId) q.set("studentId", params.studentId);
  if (params?.skill) q.set("skill", params.skill);
  const qs = q.toString();
  return request<SkillAttemptItem[]>(`/api/assignments/skill-attempts/recent${qs ? `?${qs}` : ""}`);
}

export async function submitSkillAttempt(payload: {
  skill: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
}): Promise<{ score: number; criticalThinking: number; collaboration: number; leadership: number; resilience: number }> {
  return request<{ score: number; criticalThinking: number; collaboration: number; leadership: number; resilience: number }>(
    "/api/talabat/skill-tree/attempt",
    { method: "POST", body: JSON.stringify(payload) }
  );
}

// ── Hobbies & Skills API ──

export interface HobbyItem {
  id: string;
  studentId?: string;
  studentName?: string;
  grade?: string;
  section?: string;
  name: string;
  category?: string | null;
  level?: string | null;
  createdAt: string;
}

export async function getMyHobbies(): Promise<HobbyItem[]> {
  return request<HobbyItem[]>("/api/hobbies");
}

export async function getStudentHobbies(studentId: string): Promise<HobbyItem[]> {
  return request<HobbyItem[]>(`/api/hobbies?studentId=${encodeURIComponent(studentId)}`);
}

export async function getAllHobbies(): Promise<HobbyItem[]> {
  return request<HobbyItem[]>("/api/hobbies?all=1");
}

export async function addHobby(payload: {
  name: string;
  category?: string;
  level?: string;
  studentId?: string;
}): Promise<{ id: string }> {
  return request<{ id: string }>("/api/hobbies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteHobby(id: string): Promise<void> {
  await request<unknown>(`/api/hobbies/${id}`, { method: "DELETE" });
}

// ── Talabat Skills Records (admin / assigned-teacher view) ──

export interface TalabatSkillRecord {
  studentId: string;
  name: string;
  its: string;
  grade: string;
  section: string;
  avatarUrl?: string | null;
  skills: Record<SkillCategory, number>;
  latestScores: Record<SkillCategory, number | null>;
  assignmentStats: {
    graded: number;
    averagePct: number | null;
    marks: Array<{
      assignmentId: string;
      title: string;
      subject?: string | null;
      marks: number;
      maxMarks: number;
      feedback?: string | null;
    }>;
  };
  attempts: Array<{
    id: string;
    skill: string;
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    createdAt: string;
  }>;
  hobbies: Array<{ id: string; name: string; category?: string | null; level?: string | null }>;
  totalAssignments: number;
}

export async function getSkillsRecords(params?: { q?: string; grade?: string }): Promise<TalabatSkillRecord[]> {
  const q = new URLSearchParams();
  if (params?.q) q.set("q", params.q);
  if (params?.grade) q.set("grade", params.grade);
  const qs = q.toString();
  return request<TalabatSkillRecord[]>(`/api/skills/records${qs ? `?${qs}` : ""}`);
}

// ── Teacher API ──

export async function getTeacherLeaves(params?: {
  status?: string;
  type?: string;
  classId?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  stats: TeacherLeaveStats;
  classes: Array<{ id: string; name: string; grade: string; section: string }>;
  requests: LeaveRequestItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.type) query.set("type", params.type);
  if (params?.classId) query.set("classId", params.classId);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  return request<{
    stats: TeacherLeaveStats;
    classes: Array<{ id: string; name: string; grade: string; section: string }>;
    requests: LeaveRequestItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(`/api/teacher/leave?${query.toString()}`);
}

export async function approveTeacherLeave(
  leaveId: string,
  reviewerNotes?: string
): Promise<{ id: string; status: string; reviewedAt: string }> {
  return request<{ id: string; status: string; reviewedAt: string }>(`/api/teacher/leave/${leaveId}/approve`, {
    method: "POST",
    body: JSON.stringify({ reviewerNotes }),
  });
}

export async function rejectTeacherLeave(
  leaveId: string,
  reviewerNotes?: string
): Promise<{ id: string; status: string; reviewedAt: string }> {
  return request<{ id: string; status: string; reviewedAt: string }>(`/api/teacher/leave/${leaveId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reviewerNotes }),
  });
}

export async function batchApproveTeacherLeaves(
  leaveIds: string[],
  reviewerNotes?: string
): Promise<{ success: boolean; message: string; data: { total: number; approvedCount: number } }> {
  return request<{ success: boolean; message: string; data: { total: number; approvedCount: number } }>(
    `/api/teacher/leave/batch-approve`,
    {
      method: "POST",
      body: JSON.stringify({ leaveIds, reviewerNotes }),
    }
  );
}

export async function markTeacherHolidayLeave(data: {
  studentIds: string[];
  startDate: string;
  endDate: string;
  reason: string;
  type?: string;
  notes?: string;
}): Promise<{ success: boolean; message: string; data: any }> {
  return request<{ success: boolean; message: string; data: any }>(`/api/teacher/leave/mark-holiday`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Admin API ──

export async function getAdminLeaves(params?: {
  status?: string;
  type?: string;
  grade?: string;
  section?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  stats: AdminLeaveStats;
  gradesSections: Array<{ grade: string; section: string }>;
  requests: LeaveRequestItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.type) query.set("type", params.type);
  if (params?.grade) query.set("grade", params.grade);
  if (params?.section) query.set("section", params.section);
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  return request<{
    stats: AdminLeaveStats;
    gradesSections: Array<{ grade: string; section: string }>;
    requests: LeaveRequestItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(`/api/admin/leave?${query.toString()}`);
}

export async function approveAdminLeave(
  leaveId: string,
  reviewerNotes?: string
): Promise<{ id: string; status: string; reviewedAt: string }> {
  return request<{ id: string; status: string; reviewedAt: string }>(`/api/admin/leave/${leaveId}/approve`, {
    method: "POST",
    body: JSON.stringify({ reviewerNotes }),
  });
}

export async function rejectAdminLeave(
  leaveId: string,
  reviewerNotes?: string
): Promise<{ id: string; status: string; reviewedAt: string }> {
  return request<{ id: string; status: string; reviewedAt: string }>(`/api/admin/leave/${leaveId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reviewerNotes }),
  });
}

export async function deleteAdminLeave(leaveId: string): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(`/api/admin/leave/${leaveId}`, {
    method: "DELETE",
  });
}

export async function batchApproveAdminLeaves(
  leaveIds: string[],
  reviewerNotes?: string
): Promise<{ success: boolean; message: string; data: { total: number; approvedCount: number } }> {
  return request<{ success: boolean; message: string; data: { total: number; approvedCount: number } }>(
    `/api/admin/leave/batch-approve`,
    {
      method: "POST",
      body: JSON.stringify({ leaveIds, reviewerNotes }),
    }
  );
}

export async function markAdminHolidayLeave(data: {
  studentIds: string[];
  startDate: string;
  endDate: string;
  reason: string;
  type?: string;
  notes?: string;
}): Promise<{ success: boolean; message: string; data: any }> {
  return request<{ success: boolean; message: string; data: any }>(`/api/admin/leave/mark-holiday`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Attendance Logs API ──

export async function getAttendanceLogEvents(): Promise<ScheduledEventWindow[]> {
  return request<ScheduledEventWindow[]>("/api/admin/attendance-logs/events");
}

export async function getAttendanceLogs(params?: {
  date?: string;
  grade?: string;
  section?: string;
  status?: string;
  source?: string;
  search?: string;
  eventWindowId?: string;
  audience?: "STUDENT" | "FACULTY" | "ALL";
  logType?: "HIKVISION" | "MANUAL" | "ALL";
}): Promise<AttendanceLogsResponse> {
  const query = new URLSearchParams();
  if (params?.date) query.set("date", params.date);
  if (params?.grade) query.set("grade", params.grade);
  if (params?.section) query.set("section", params.section);
  if (params?.status) query.set("status", params.status);
  if (params?.source) query.set("source", params.source);
  if (params?.search) query.set("search", params.search);
  if (params?.eventWindowId) query.set("eventWindowId", params.eventWindowId);
  if (params?.audience) query.set("audience", params.audience);
  if (params?.logType) query.set("logType", params.logType);

  return request<AttendanceLogsResponse>(`/api/admin/attendance-logs?${query.toString()}`);
}

export async function overrideAttendanceLog(payload: {
  studentId?: string;
  teacherId?: string;
  date: string;
  status: string;
  source?: string;
  remarks?: string;
}): Promise<any> {
  return request<any>("/api/admin/attendance-logs/override", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export const overrideAttendanceRegistry = overrideAttendanceLog;

export async function pollHikvisionDevicesNow(): Promise<{
  success: boolean;
  message: string;
  data: {
    totalFetched: number;
    totalProcessed: number;
    devices: Array<{
      id: string;
      name: string;
      host: string;
      success: boolean;
      scansFetched: number;
      scansProcessed: number;
      error?: string;
    }>;
  };
}> {
  return request<any>("/api/admin/attendance-logs/poll-now", {
    method: "POST",
  });
}

// ── Google Sheet daily attendance log sync ──

export interface SheetSyncStatusData {
  configured: boolean;
  spreadsheetId: string | null;
  maskedSpreadsheetId?: string | null;
  serviceAccountEmail?: string | null;
  fullServiceAccountEmail?: string | null;
  enabled: boolean;
  syncHourUtc: number;
  url: string | null;
  lastSyncedAt?: string | null;
  lastSyncedDate?: string | null;
}

export interface SheetSyncResult {
  spreadsheetId: string;
  tabTitle: string;
  rowsSynced: number;
  url: string;
  stats: {
    studentPresent: number;
    studentLate: number;
    studentAbsent: number;
    studentTotal: number;
    studentRate: number;
    teacherPresent: number;
    teacherLate: number;
    teacherAbsent: number;
    teacherTotal: number;
    teacherRate: number;
  };
}

export async function getSheetSyncStatus(): Promise<SheetSyncStatusData> {
  const res = await request<{ success: boolean; data: SheetSyncStatusData }>("/api/admin/attendance-logs/sync-sheet/status");
  return res.data;
}

export async function testSheetConnection(config: {
  spreadsheetId?: string;
  serviceAccountJson?: string;
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
}): Promise<{
  title: string;
  sheetNames: string[];
  url: string;
  serviceAccountEmail: string;
}> {
  const res = await request<{
    success: boolean;
    message: string;
    data: {
      title: string;
      sheetNames: string[];
      url: string;
      serviceAccountEmail: string;
    };
  }>("/api/admin/attendance-logs/sync-sheet/test", {
    method: "POST",
    body: JSON.stringify(config),
  });
  return res.data;
}

export async function saveSheetConfig(config: {
  spreadsheetId?: string;
  serviceAccountJson?: string;
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
  enabled?: boolean;
  syncHourUtc?: number;
}): Promise<{ message: string; data: SheetSyncStatusData }> {
  return request<{ message: string; data: SheetSyncStatusData }>("/api/admin/attendance-logs/sync-sheet/config", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export async function syncAttendanceSheet(date?: string): Promise<{ message: string; data: SheetSyncResult }> {
  return request<{ message: string; data: SheetSyncResult }>("/api/admin/attendance-logs/sync-sheet", {
    method: "POST",
    body: JSON.stringify({ date }),
  });
}

export async function getStudentAuditTimeline(studentId: string): Promise<StudentAuditHistory> {
  return request<StudentAuditHistory>(`/api/admin/attendance-registry/student/${studentId}`);
}

export function getExportAttendanceLogsUrl(params?: {
  startDate?: string;
  endDate?: string;
  grade?: string;
  section?: string;
  audience?: "STUDENT" | "FACULTY" | "ALL";
}): string {
  const query = new URLSearchParams();
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  if (params?.grade) query.set("grade", params.grade);
  if (params?.section) query.set("section", params.section);
  if (params?.audience) query.set("audience", params.audience);
  return `/api/admin/attendance-logs/export?${query.toString()}`;
}

