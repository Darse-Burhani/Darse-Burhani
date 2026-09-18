"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, GripVertical, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";

export default function AdminPointMatrixPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ category: "", actionName: "", pointValue: "", actionType: "POSITIVE", color: "#6366f1", iconName: "star" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/point-rules").then((r) => r.json()).then((res) => {
      if (res.success) setRules(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const positiveRules = rules.filter((r) => r.actionType === "POSITIVE");
  const negativeRules = rules.filter((r) => r.actionType === "NEGATIVE");

  const openCreate = () => {
    setEditId(null);
    setForm({ category: "", actionName: "", pointValue: "", actionType: "POSITIVE", color: "#6366f1", iconName: "star" });
    setShowModal(true);
  };

  const openEdit = (rule: any) => {
    setEditId(rule.id);
    setForm({ category: rule.category, actionName: rule.actionName, pointValue: rule.pointValue.toString(), actionType: rule.actionType, color: rule.color, iconName: rule.iconName });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/point-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, pointValue: parseInt(form.pointValue), id: editId }),
      });
      if (res.ok) {
        setShowModal(false);
        const updated = await fetch("/api/admin/point-rules").then((r) => r.json());
        if (updated.success) setRules(updated.data);
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">Point Matrix Rules</h1>
          <p className="text-gray-500 mt-1">Configure scoring rules and point values</p>
        </div>
        <Button variant="admin" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Add Rule</Button>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Positive Actions</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
              ) : positiveRules.length > 0 ? (
                <div className="space-y-2">
                  {positiveRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openEdit(rule)}>
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-emerald-300" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{rule.actionName}</p>
                          <p className="text-xs text-gray-500">{rule.category}</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">+{rule.pointValue}</Badge>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center text-gray-400 py-6">No positive rules yet</p>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /> Negative Actions</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
              ) : negativeRules.length > 0 ? (
                <div className="space-y-2">
                  {negativeRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-100 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openEdit(rule)}>
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-red-300" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{rule.actionName}</p>
                          <p className="text-xs text-gray-500">{rule.category}</p>
                        </div>
                      </div>
                      <Badge className="bg-red-100 text-red-700 border-red-200">{rule.pointValue}</Badge>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center text-gray-400 py-6">No negative rules yet</p>}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Modal open={showModal} onOpenChange={setShowModal}>
        <ModalContent>
          <ModalHeader><ModalTitle>{editId ? "Edit Rule" : "Add Rule"}</ModalTitle></ModalHeader>
          <div className="space-y-4 py-4">
            <div><label htmlFor="actionName" className="text-sm font-medium text-gray-700">Action Name</label><input id="actionName" name="actionName" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" placeholder="e.g. Helped Peer" value={form.actionName} onChange={(e) => setForm({ ...form, actionName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label htmlFor="category" className="text-sm font-medium text-gray-700">Category</label><input id="category" name="category" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" placeholder="e.g. Leadership" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><label htmlFor="pointValue" className="text-sm font-medium text-gray-700">Points</label><input id="pointValue" name="pointValue" type="number" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" value={form.pointValue} onChange={(e) => setForm({ ...form, pointValue: e.target.value })} /></div>
            </div>
            <fieldset className="border-0 p-0 m-0">
              <legend className="text-sm font-medium text-gray-700">Type</legend>
              <div className="flex gap-2 mt-1">
                <Button variant={form.actionType === "POSITIVE" ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, actionType: "POSITIVE" })}>Positive</Button>
                <Button variant={form.actionType === "NEGATIVE" ? "destructive" : "outline"} size="sm" onClick={() => setForm({ ...form, actionType: "NEGATIVE" })}>Negative</Button>
              </div>
            </fieldset>
          </div>
          <ModalFooter>
            <ModalClose asChild><Button variant="outline" size="sm">Cancel</Button></ModalClose>
            <Button variant="admin" size="sm" onClick={handleSave} disabled={saving || !form.actionName || !form.category || !form.pointValue}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} {editId ? "Update" : "Create"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
