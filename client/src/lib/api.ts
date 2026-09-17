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
  audience: "ALL_STUDENTS" | "FACULTY" | "ALL";
  status: "ACTIVE" | "UPCOMING" | "CLOSED";
  timeDisplay: string;
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
  eventLiveCounts?: Record<string, number>;
  audience?: "STUDENT" | "FACULTY" | "ALL";
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

  return request<AttendanceLogsResponse>(`/api/admin/attendance-logs?${query.toString()}`);
}

export const getAttendanceRegistry = getAttendanceLogs;

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

export async function finalizeEventScans(date?: string): Promise<any> {
  return request<any>("/api/admin/attendance-logs/finalize-event", {
    method: "POST",
    body: JSON.stringify({ date }),
  });
}

// ── Google Sheet daily attendance log sync ──

export interface SheetSyncStatusData {
  configured: boolean;
  spreadsheetId: string | null;
  enabled: boolean;
  syncHourUtc: number;
  url: string | null;
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
  return request<SheetSyncStatusData>("/api/admin/attendance-logs/sync-sheet/status");
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

export const getExportAttendanceRegistryUrl = getExportAttendanceLogsUrl;

