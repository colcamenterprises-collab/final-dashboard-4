import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Settings, Plus, MapPin, Clock } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface WorkArea {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

interface ShiftTemplate {
  id: number;
  templateName: string;
  startTime: string;
  endTime: string;
  maxStaff: number;
  isActive: boolean;
  isPrepShift: boolean;
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Icon className="h-4 w-4 text-slate-400" />
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{title}</p>
    </div>
  );
}

export default function StaffSettings() {
  const [areaName, setAreaName] = useState("");
  const [tplForm, setTplForm] = useState({ templateName: "", startTime: "17:00", endTime: "03:00", maxStaff: 5 });

  const { data: areasData } = useQuery<{ workAreas?: WorkArea[] }>({ queryKey: ["/api/staff/work-areas"] });
  const { data: tplData } = useQuery<{ templates?: ShiftTemplate[] }>({ queryKey: ["/api/staff/templates"] });

  const createAreaMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/staff/work-areas", { name: areaName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/work-areas"] });
      setAreaName("");
    },
  });

  const workAreas = areasData?.workAreas ?? [];
  const templates = tplData?.templates ?? [];

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Settings className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Staff Settings</h1>
          <p className="text-xs text-slate-500">Work areas, shift templates, and configuration</p>
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader title="Work Areas" icon={MapPin} />
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {workAreas.length === 0 && (
            <div className="px-3 py-4 text-xs text-slate-400 text-center">No work areas defined.</div>
          )}
          {workAreas.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-900">
              <span className="text-xs text-slate-800 dark:text-white">{a.name}</span>
              <span className="text-[10px] text-slate-400">#{a.sortOrder}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
            placeholder="Area name (e.g., Grill, Counter, Prep)"
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
          />
          <button
            onClick={() => createAreaMutation.mutate()}
            disabled={!areaName || createAreaMutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 bg-black text-white text-xs rounded-lg hover:bg-slate-800 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader title="Shift Templates" icon={Clock} />
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {templates.length === 0 && (
            <div className="px-3 py-4 text-xs text-slate-400 text-center">No shift templates defined.</div>
          )}
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-white">{t.templateName}</p>
                <p className="text-[10px] text-slate-400">{t.startTime}–{t.endTime} · max {t.maxStaff} staff{t.isPrepShift ? " · Prep" : ""}</p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${t.isActive ? "bg-green-100 text-green-700 border-green-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
                {t.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
