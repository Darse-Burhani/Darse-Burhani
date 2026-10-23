"use client";

import { TeacherPageGuard } from "@/context/PortalAccessContext";
import AdminPointMatrixPage from "@/app/admin/point-matrix/page";

export default function TeacherPointMatrixPage() {
  return (
    <TeacherPageGuard pageKey="point-matrix" title="Point Matrix & Rules">
      <AdminPointMatrixPage />
    </TeacherPageGuard>
  );
}
