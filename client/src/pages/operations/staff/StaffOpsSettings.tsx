import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Save, Clock, MapPin, Layout } from "lucide-react";
async function sapi(method: string, url: string, data?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}
import { useToast } from "@/hooks/use-toast";

type Settings = {
  id: number; defaultMaxStaffPerShift: number; breakMainMinutes: number;
  breakShortMinutes: number; breakShortCount: number; allowPrepShift: boolean;
  defaultShiftMode: string; notes: string | null;
};
type OperatingHours = { id: number; dayOfWeek: number; isOpen: boolean; openTime: string | null; closeTime: string | null };
type WorkArea = { id: number; name: string; isActive: boolean; sortOrder: number };
type ShiftTemplate = { id: number; templateName: string; startTime: string; endTime: string; isPrepShift: boolean; maxStaff: number; isActive: boolean };

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const inputCls = "w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500";

const settingsSchema = z.object({
  defaultMaxStaffPerShift: z.coerce.number().min(1).max(30),
  breakMainMinutes: z.coerce.number().min(0).max(120),
  breakShortMinutes: z.coerce.number().min(0).max(60),
  breakShortCount: z.coerce.number().min(0).max(10),
  allowPrepShift: z.boolean(),
  defaultShiftMode: z.string().min(1),
  notes: z.string().optional(),
});
const workAreaSchema = z.object({ name: z.string().min(1), sortOrder: z.coerce.number().default(0) });
const templateSchema = z.object({
  templateName: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  maxStaff: z.coerce.number().min(1).max(50),
  isPrepShift: z.boolean(),
});

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

type Tab = "break-rules" | "operating-hours" | "work-areas" | "templates";
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "break-rules", label: "Break & Shift Rules", icon: Clock },
  { id: "operating-hours", label: "Operating Hours", icon: Clock },
  { id: "work-areas", label: "Work Areas", icon: MapPin },
  { id: "templates", label: "Shift Templates", icon: Layout },
];

export default function StaffOpsSettings() {
  const [tab, setTab] = useState<Tab>("break-rules");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading: loadingSettings } = useQuery<Settings>({ queryKey: ["/api/operations/staff/settings"] });
  const { data: opHours = [] } = useQuery<OperatingHours[]>({ queryKey: ["/api/operations/staff/operating-hours"] });
  const { data: workAreas = [], isLoading: loadingAreas } = useQuery<WorkArea[]>({ queryKey: ["/api/operations/staff/work-areas"] });
  const { data: templates = [], isLoading: loadingTemplates } = useQuery<ShiftTemplate[]>({ queryKey: ["/api/operations/staff/shift-templates"] });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Operations Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">Configure break rules, shift templates, work areas and operating hours.</p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.id ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>
      {tab === "break-rules" && <BreakRulesPanel settings={settings} loading={loadingSettings} qc={qc} toast={toast} />}
      {tab === "operating-hours" && <OperatingHoursPanel opHours={opHours} qc={qc} toast={toast} />}
      {tab === "work-areas" && <WorkAreasPanel workAreas={workAreas} loading={loadingAreas} qc={qc} toast={toast} />}
      {tab === "templates" && <TemplatesPanel templates={templates} loading={loadingTemplates} qc={qc} toast={toast} />}
    </div>
  );
}

function BreakRulesPanel({ settings, loading, qc, toast }: {
  settings?: Settings; loading: boolean;
  qc: ReturnType<typeof useQueryClient>; toast: ReturnType<typeof useToast>["toast"];
}) {
  const form = useForm({ resolver: zodResolver(settingsSchema), values: settings ? {
    defaultMaxStaffPerShift: settings.defaultMaxStaffPerShift,
    breakMainMinutes: settings.breakMainMinutes,
    breakShortMinutes: settings.breakShortMinutes,
    breakShortCount: settings.breakShortCount,
    allowPrepShift: settings.allowPrepShift,
    defaultShiftMode: settings.defaultShiftMode,
    notes: settings.notes ?? "",
  } : undefined });

  const saveMut = useMutation({
    mutationFn: (data: z.infer<typeof settingsSchema>) => sapi("PATCH", "/api/operations/staff/settings", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations/staff/settings"] }); toast({ title: "Settings saved" }); },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  if (loading) return <div className="text-xs text-slate-400 p-4">Loading...</div>;

  return (
    <form onSubmit={form.handleSubmit(d => saveMut.mutate(d))} className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="Max staff per shift"><input type="number" {...form.register("defaultMaxStaffPerShift")} className={inputCls} /></Field>
        <Field label="Main break (minutes)"><input type="number" {...form.register("breakMainMinutes")} className={inputCls} /></Field>
        <Field label="Short break (minutes)"><input type="number" {...form.register("breakShortMinutes")} className={inputCls} /></Field>
        <Field label="Short breaks per shift"><input type="number" {...form.register("breakShortCount")} className={inputCls} /></Field>
        <Field label="Default shift mode">
          <select {...form.register("defaultShiftMode")} className={inputCls}>
            <option value="standard">Standard</option>
            <option value="prep">Prep</option>
            <option value="split">Split</option>
          </select>
        </Field>
        <div className="flex items-center gap-2 mt-5">
          <input type="checkbox" {...form.register("allowPrepShift")} className="w-4 h-4 accent-emerald-600" />
          <span className="text-xs text-slate-600">Allow prep shift option</span>
        </div>
      </div>
      <Field label="Internal notes">
        <textarea {...form.register("notes")} rows={2} className={inputCls} placeholder="Internal notes..." />
      </Field>
      <div className="flex justify-end">
        <button type="submit" disabled={saveMut.isPending}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 disabled:opacity-50">
          <Save className="w-3.5 h-3.5" /> {saveMut.isPending ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </form>
  );
}

function OperatingHoursPanel({ opHours, qc, toast }: {
  opHours: OperatingHours[];
  qc: ReturnType<typeof useQueryClient>; toast: ReturnType<typeof useToast>["toast"];
}) {
  const saveMut = useMutation({
    mutationFn: ({ id, data }: { id?: number; data: object }) =>
      id ? sapi("PATCH", `/api/operations/staff/operating-hours/${id}`, data)
         : sapi("POST", `/api/operations/staff/operating-hours`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations/staff/operating-hours"] }); toast({ title: "Hours saved" }); },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });
  const days = DAY_NAMES.map((name, idx) => ({ name, idx, row: opHours.find(h => h.dayOfWeek === idx) }));
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
      <table className="w-full text-xs min-w-[480px]">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600">Day</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600">Open</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600">Open Time</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600">Close Time</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {days.map(({ name, idx, row }) => (
            <HoursRow key={idx} name={name} idx={idx} row={row}
              onSave={data => saveMut.mutate({ id: row?.id, data })} saving={saveMut.isPending} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HoursRow({ name, idx, row, onSave, saving }: {
  name: string; idx: number; row?: OperatingHours;
  onSave: (d: object) => void; saving: boolean;
}) {
  const [isOpen, setIsOpen] = useState(row?.isOpen ?? true);
  const [open, setOpen] = useState(row?.openTime ?? "17:00");
  const [close, setClose] = useState(row?.closeTime ?? "03:00");
  return (
    <tr>
      <td className="px-4 py-2.5 font-medium text-slate-700 w-32">{name}</td>
      <td className="px-4 py-2.5">
        <input type="checkbox" checked={isOpen} onChange={e => setIsOpen(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
      </td>
      <td className="px-4 py-2.5">
        <input type="time" value={open} onChange={e => setOpen(e.target.value)} disabled={!isOpen}
          className="border border-slate-300 rounded px-2 py-1 text-xs disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
      </td>
      <td className="px-4 py-2.5">
        <input type="time" value={close} onChange={e => setClose(e.target.value)} disabled={!isOpen}
          className="border border-slate-300 rounded px-2 py-1 text-xs disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
      </td>
      <td className="px-4 py-2.5">
        <button onClick={() => onSave({ dayOfWeek: idx, isOpen, openTime: open, closeTime: close })}
          disabled={saving}
          className="px-2.5 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 disabled:opacity-50">Save</button>
      </td>
    </tr>
  );
}

function WorkAreasPanel({ workAreas, loading, qc, toast }: {
  workAreas: WorkArea[]; loading: boolean;
  qc: ReturnType<typeof useQueryClient>; toast: ReturnType<typeof useToast>["toast"];
}) {
  const [modal, setModal] = useState<{ mode: "add" | "edit"; item?: WorkArea } | null>(null);
  const form = useForm({ resolver: zodResolver(workAreaSchema) });

  const saveMut = useMutation({
    mutationFn: (d: z.infer<typeof workAreaSchema> & { id?: number }) =>
      d.id ? sapi("PATCH", `/api/operations/staff/work-areas/${d.id}`, d)
            : sapi("POST", `/api/operations/staff/work-areas`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations/staff/work-areas"] }); setModal(null); form.reset(); toast({ title: "Saved" }); },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => sapi("DELETE", `/api/operations/staff/work-areas/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations/staff/work-areas"] }); toast({ title: "Deleted" }); },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  if (loading) return <div className="text-xs text-slate-400 p-4">Loading...</div>;
  return (
    <>
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-700">Work Areas ({workAreas.length})</p>
          <button onClick={() => { form.reset({ name: "", sortOrder: workAreas.length }); setModal({ mode: "add" }); }}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        {workAreas.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">No work areas configured.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Order</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workAreas.map(a => (
                <tr key={a.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{a.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{a.sortOrder}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${a.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {a.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { form.reset({ name: a.name, sortOrder: a.sortOrder }); setModal({ mode: "edit", item: a }); }}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { if (confirm("Delete this work area?")) delMut.mutate(a.id); }}
                        className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal && (
        <Modal title={modal.mode === "add" ? "Add Work Area" : "Edit Work Area"} onClose={() => setModal(null)}>
          <form onSubmit={form.handleSubmit(d => saveMut.mutate({ ...d, id: modal.item?.id }))} className="space-y-4">
            <Field label="Area Name *"><input {...form.register("name")} className={inputCls} placeholder="e.g. Grill Station" /></Field>
            <Field label="Sort Order"><input type="number" {...form.register("sortOrder")} className={inputCls} /></Field>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saveMut.isPending} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
                {saveMut.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function TemplatesPanel({ templates, loading, qc, toast }: {
  templates: ShiftTemplate[]; loading: boolean;
  qc: ReturnType<typeof useQueryClient>; toast: ReturnType<typeof useToast>["toast"];
}) {
  const [modal, setModal] = useState<{ mode: "add" | "edit"; item?: ShiftTemplate } | null>(null);
  const form = useForm({ resolver: zodResolver(templateSchema) });

  const saveMut = useMutation({
    mutationFn: (d: z.infer<typeof templateSchema> & { id?: number }) =>
      d.id ? sapi("PATCH", `/api/operations/staff/shift-templates/${d.id}`, d)
            : sapi("POST", `/api/operations/staff/shift-templates`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations/staff/shift-templates"] }); setModal(null); form.reset(); toast({ title: "Template saved" }); },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => sapi("DELETE", `/api/operations/staff/shift-templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations/staff/shift-templates"] }); toast({ title: "Deleted" }); },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  if (loading) return <div className="text-xs text-slate-400 p-4">Loading...</div>;
  return (
    <>
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-700">Shift Templates ({templates.length})</p>
          <button onClick={() => { form.reset({ templateName: "", startTime: "17:00", endTime: "03:00", maxStaff: 5, isPrepShift: false }); setModal({ mode: "add" }); }}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700">
            <Plus className="w-3 h-3" /> Add Template
          </button>
        </div>
        {templates.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">No shift templates. Add one to speed up roster creation.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Times</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Max Staff</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{t.templateName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{t.startTime} – {t.endTime}</td>
                  <td className="px-4 py-2.5 text-slate-600">{t.maxStaff}</td>
                  <td className="px-4 py-2.5">{t.isPrepShift && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">Prep</span>}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${t.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { form.reset({ templateName: t.templateName, startTime: t.startTime, endTime: t.endTime, maxStaff: t.maxStaff, isPrepShift: t.isPrepShift }); setModal({ mode: "edit", item: t }); }}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { if (confirm("Delete this template?")) delMut.mutate(t.id); }}
                        className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal && (
        <Modal title={modal.mode === "add" ? "Add Shift Template" : "Edit Shift Template"} onClose={() => setModal(null)}>
          <form onSubmit={form.handleSubmit(d => saveMut.mutate({ ...d, id: modal.item?.id }))} className="space-y-4">
            <Field label="Template Name *"><input {...form.register("templateName")} className={inputCls} placeholder="e.g. Evening Main" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Time *"><input type="time" {...form.register("startTime")} className={inputCls} /></Field>
              <Field label="End Time *"><input type="time" {...form.register("endTime")} className={inputCls} /></Field>
            </div>
            <Field label="Max Staff"><input type="number" {...form.register("maxStaff")} className={inputCls} /></Field>
            <div className="flex items-center gap-2">
              <input type="checkbox" {...form.register("isPrepShift")} className="w-4 h-4 accent-emerald-600" />
              <span className="text-xs text-slate-600">This is a prep shift</span>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saveMut.isPending} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
                {saveMut.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
