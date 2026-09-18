"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Layers,
  CheckCircle2,
  BookMarked,
  AlertTriangle,
  History,
  TrendingUp,
  Star,
  Users,
  Clock,
  Loader2,
  RefreshCw,
  Library,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const LibraryCategoryPie = lazy(() => import("@/components/admin/LibraryCategoryPie"));

interface OverviewData {
  books: {
    totalTitles: number;
    totalCopies: number;
    availableCopies: number;
    issuedCopies: number;
    byStatus: { status: string; count: number }[];
  };
  loans: { active: number; overdue: number; returned: number };
  categories: { name: string; count: number }[];
  recentLoans: {
    id: string;
    studentName: string;
    bookTitle: string;
    bookBarcode: string | null;
    borrowedAt: string;
    dueAt: string;
    returnedAt: string | null;
    status: string;
  }[];
  recentAdditions: {
    id: string;
    title: string;
    author: string | null;
    category: string;
    barcode: string | null;
    coverImage: string | null;
    status: string;
    availableCopies: number;
    totalCopies: number;
  }[];
  topBorrowers: { name: string; count: number }[];
  popularBooks: { title: string; count: number }[];
}

const statusConfig: Record<string, { label: string; bar: string; dot: string }> = {
  AVAILABLE: { label: "On Shelf", bar: "bg-emerald-500", dot: "bg-emerald-400" },
  BORROWED: { label: "Issued", bar: "bg-amber-500", dot: "bg-amber-400" },
  RESTOCK_QUEUE: { label: "In Sorting", bar: "bg-blue-500", dot: "bg-blue-400" },
  DAMAGED: { label: "Damaged", bar: "bg-red-500", dot: "bg-red-400" },
  LOST: { label: "Lost", bar: "bg-gray-500", dot: "bg-gray-400" },
};

const statusOrder = ["AVAILABLE", "BORROWED", "RESTOCK_QUEUE", "DAMAGED", "LOST"];

function StatCard({ icon: Icon, label, value, sub, color, accent }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  accent: string;
}) {
  return (
    <Card className="fatimi-card">
      <div className="fatimi-card-header" />
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div className={`p-2 rounded-xl ${accent}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <ArrowUpRight className="w-4 h-4 text-gray-400" />
        </div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Cover({ book }: { book: OverviewData["recentAdditions"][0] }) {
  const [errored, setErrored] = useState(false);
  if (book.coverImage && !errored) {
    return (
      <img
        src={book.coverImage}
        alt={book.title}
        className="w-full h-32 object-cover"
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <div className="w-full h-32 flex items-center justify-center bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
      <BookOpen className="w-8 h-8 text-indigo-300" />
    </div>
  );
}

export default function LibraryOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/library/overview");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totalStatusCount = data
    ? data.books.byStatus.reduce((acc, s) => acc + s.count, 0)
    : 0;
  const issuedPct = data && data.books.totalCopies > 0
    ? Math.round((data.books.issuedCopies / data.books.totalCopies) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Library className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
              Darse Burhani Library Overview
            </h1>
            <p className="text-gray-500 mt-1">
              A complete snapshot of your library — inventory, circulation, and activity at a glance.
            </p>
          </div>
        </div>
        <Button variant="admin" onClick={load} loading={loading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </motion.div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-400">
            Failed to load library overview
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8"
          >
            <StatCard icon={BookOpen} label="Book Titles" value={data.books.totalTitles} color="text-indigo-600" accent="bg-indigo-100" />
            <StatCard icon={Layers} label="Total Copies" value={data.books.totalCopies} color="text-blue-600" accent="bg-blue-100" />
            <StatCard icon={CheckCircle2} label="Available" value={data.books.availableCopies} color="text-emerald-600" accent="bg-emerald-100" />
            <StatCard icon={BookMarked} label="Issued" value={data.books.issuedCopies} sub={`${issuedPct}% of copies out`} color="text-amber-600" accent="bg-amber-100" />
            <StatCard icon={AlertTriangle} label="Overdue" value={data.loans.overdue} sub={`${data.loans.active} active loans`} color="text-red-600" accent="bg-red-100" />
            <StatCard icon={History} label="Returned" value={data.loans.returned} sub="all time" color="text-teal-600" accent="bg-teal-100" />
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            {/* Category distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="fatimi-card h-full">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-5 text-indigo-500" />
                    Categories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<div className="h-[260px] bg-gray-100 animate-pulse rounded-lg" />}>
                    <LibraryCategoryPie data={data.categories} />
                  </Suspense>
                </CardContent>
              </Card>
            </motion.div>

            {/* Books by status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="fatimi-card h-full">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-5 text-indigo-500" />
                    Books by Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {statusOrder.map((status) => {
                      const cfg = statusConfig[status];
                      const count = data.books.byStatus.find((s) => s.status === status)?.count || 0;
                      const pct = totalStatusCount > 0 ? (count / totalStatusCount) * 100 : 0;
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-gray-600 w-20">{cfg.label}</span>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: 0.2 }}
                              className={`h-full rounded-full ${cfg.bar}`}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-900 w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Total catalog</span>
                    <Badge variant="outline" className="text-xs">{totalStatusCount} titles</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col gap-4"
            >
              <Card className="fatimi-card flex-1">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-5 text-indigo-500" />
                    Top Borrowers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topBorrowers.length > 0 ? (
                    <div className="space-y-3">
                      {data.topBorrowers.map((b, i) => (
                        <div key={b.name} className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-indigo-600"}`}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">{b.count} loans</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 py-6 text-center">No active borrowers</p>
                  )}
                </CardContent>
              </Card>

              <Card className="fatimi-card flex-1">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Star className="w-4 h-5 text-indigo-500" />
                    Most Borrowed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.popularBooks.length > 0 ? (
                    <div className="space-y-3">
                      {data.popularBooks.map((b, i) => (
                        <div key={b.title} className="flex items-center gap-3">
                          <Star className={`w-4 h-4 shrink-0 ${i === 0 ? "text-amber-500 fill-amber-500" : "text-gray-400"}`} />
                          <p className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">{b.title}</p>
                          <Badge variant="secondary" className="text-[10px]">×{b.count}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 py-6 text-center">No loans yet</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Recent loans */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="fatimi-card h-full">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-5 text-indigo-500" />
                    Recent Circulation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.recentLoans.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {data.recentLoans.map((loan) => (
                        <div key={loan.id} className="py-3 flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            loan.status === "ACTIVE" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {loan.status === "ACTIVE" ? <BookMarked className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{loan.bookTitle}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {loan.studentName} · issued {new Date(loan.borrowedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {loan.status === "ACTIVE" ? (
                              <Badge
                                variant="secondary"
                                className={`text-[10px] ${new Date(loan.dueAt) < new Date() ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                              >
                                due {new Date(loan.dueAt).toLocaleDateString()}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700">returned</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 py-8 text-center">No circulation activity yet</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent additions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="fatimi-card h-full">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <BookOpen className="w-4 h-5 text-indigo-500" />
                      Recent Additions
                    </CardTitle>
                    <Link href="/admin/library" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                      Manage catalog →
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {data.recentAdditions.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {data.recentAdditions.map((book) => (
                        <div key={book.id} className="group rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow">
                          <div className="bg-gray-100">
                            <Cover book={book} />
                          </div>
                          <div className="p-3">
                            <p className="text-xs font-semibold text-gray-900 truncate">{book.title}</p>
                            <p className="text-[10px] text-gray-500 truncate mt-0.5">{book.author || book.category}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] font-mono font-semibold text-gray-500">{book.barcode}</span>
                              <span className={`text-[10px] font-medium ${book.availableCopies > 0 ? "text-emerald-700" : "text-amber-700"}`}>
                                {book.availableCopies > 0 ? "Available" : "Out"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 py-8 text-center">Catalog is empty — add your first book</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
