import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, UserCheck, UserX, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type StaffMember = {
  id: number; fullName: string; displayName: string | null; isActive: boolean;
  primaryRole: string; canCashier: boolean; canBurgers: boolean; canSideOrders: boolean;
  canPrep: boolean; canCleaning: boolean; notes: string | null;
};
type StaffAvailability = {
  id: number; staffMemberId: number; dayOfWeek: number;
  isAvailable: boolean; defaultStartTime: string | null; defaultEndTime: string | null;
  canPrepStart: boolean; notes: string | null;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const inputCls = "w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500";

const memberSchema = z.object({
  fullName: z.string().min(1, "Required"),
  displayName: z.string().optional(),
  primaryRole: z.string().min(1),
  canCashier: z.boolean(),
  canBurgers: z.boolean(),
  canSideOrders: z.boolean(),
  canPrep: z.boolean(),
  canCleaning: z.boolean(),
  notes: z.string().optional(),
});

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg my-8">
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

function CapBadge({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${on ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
      {label}
    </span>
  );
}

export default function StaffManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<{ mode: "add" | "edit"; member?: StaffMember } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");

  const { data: members = [], isLoading } = useQuery<StaffMember[]>({ queryKey: ["/api/operations/staff/members"] });
  const { data: availability = [] } = useQuery<StaffAvailability[]>({ queryKey: ["/api/operations/staff/availability"] });

  const form = useForm({ resolver: zodResolver(memberSchema), defaultValues: {
    fullName: "", displayName: "", primaryRole: "staff",
    canCashier: false, canBurgers: false, canSideOrders: false, canPrep: false, canCleaning: true, notes: "",
  }});

  const saveMut = useMutation({
    mutationFn: (d: z.infer<typeof memberSchema> & { id?: number }) =>
      d.id ? apiRequest("PATCH", `/api/operations/staff/members/${d.id}`, d)
            : apiRequest("POST", `/api/operations/staff/members`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations/staff/members"] }); setModal(null); form.reset(); toast({ title: "Staff member saved" }); },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const toggleStatusMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/operations/staff/members/${id}/status`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations/staff/members"] }); toast({ title: "Status updated" }); },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const availSaveMut = useMutation({
    mutationFn: ({ memberId, dayOfWeek, data }: { memberId: number; dayOfWeek: number; data: object }) =>
      apiRequest("POST", `/api/operations/staff/availability`, { staffMemberId: memberId, dayOfWeek, ...data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/operations/staff/availability"] }); toast({ title: "Availability saved" }); },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  function openAdd() {
    form.reset({ fullName: "", displayName: "", primaryRole: "staff", canCashier: false, canBurgers: false, canSideOrders: false, canPrep: false, canCleaning: true, notes: "" });
    setModal({ mode: "add" });
  }
  function openEdit(m: StaffMember) {
    form.reset({ fullName: m.fullName, displayName: m.displayName ?? "", primaryRole: m.primaryRole, canCashier: m.canCashier, canBurgers: m.canBurgers, canSideOrders: m.canSideOrders, canPrep: m.canPrep, canCleaning: m.canCleaning, notes: m.notes ?? "" });
    setModal({ mode: "edit", member: m });
  }

  const filtered = members.filter(m =>
    filterActive === "all" ? true : filterActive === "active" ? m.isActive : !m.isActive
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Staff Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">Team directory, roles and capabilities.</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700">
          <Plus className="w-3.5 h-3.5" /> Add Staff
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-1">
        {(["all", "active", "inactive"] as const).map(f => (
          <button key={f} onClick={() => setFilterActive(f)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${filterActive === f ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {f === "all" ? `(${members.length})` : f === "active" ? `(${members.filter(m => m.isActive).length})` : `(${members.filter(m => !m.isActive).length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-xs text-slate-400 p-4">Loading staff...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <p className="text-sm text-slate-500">No staff members found.</p>
          <button onClick={openAdd} className="mt-3 text-xs text-emerald-600 hover:underline">Add your first staff member</button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {filtered.map(m => {
            const memberAvail = availability.filter(a => a.staffMemberId === m.id);
            const expanded = expandedId === m.id;
            return (
              <div key={m.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${m.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {m.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{m.fullName}</span>
                      {m.displayName && m.displayName !== m.fullName && (
                        <span className="text-xs text-slate-400">({m.displayName})</span>
                      )}
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{m.primaryRole}</span>
                      {!m.isActive && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs">Inactive</span>}
                    </div>
                    <div className="flex gap-1 flex-wrap mt-1">
                      <CapBadge label="Cashier" on={m.canCashier} />
                      <CapBadge label="Burgers" on={m.canBurgers} />
                      <CapBadge label="Sides" on={m.canSideOrders} />
                      <CapBadge label="Prep" on={m.canPrep} />
                      <CapBadge label="Cleaning" on={m.canCleaning} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleStatusMut.mutate({ id: m.id, isActive: !m.isActive })}
                      className={`p-1.5 rounded ${m.isActive ? "hover:bg-red-50 text-red-400" : "hover:bg-emerald-50 text-emerald-500"}`}
                      title={m.isActive ? "Deactivate" : "Activate"}>
                      {m.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setExpandedId(expanded ? null : m.id)}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
                      {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Availability rows */}
                {expanded && (
                  <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-600 pt-3 pb-2">Weekly Availability</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[500px]">
                        <thead>
                          <tr className="text-slate-500">
                            <th className="text-left pb-1.5 font-medium pr-3">Day</th>
                            <th className="text-left pb-1.5 font-medium pr-3">Available</th>
                            <th className="text-left pb-1.5 font-medium pr-3">Start</th>
                            <th className="text-left pb-1.5 font-medium pr-3">End</th>
                            <th className="text-left pb-1.5 font-medium pr-3">Prep start</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {FULL_DAY_NAMES.map((day, idx) => {
                            const row = memberAvail.find(a => a.dayOfWeek === idx);
                            return <AvailRow key={idx} day={day} idx={idx} memberId={m.id} row={row}
                              onSave={data => availSaveMut.mutate({ memberId: m.id, dayOfWeek: idx, data })}
                              saving={availSaveMut.isPending} />;
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === "add" ? "Add Staff Member" : `Edit — ${modal.member?.fullName}`} onClose={() => setModal(null)}>
          <form onSubmit={form.handleSubmit(d => saveMut.mutate({ ...d, id: modal.member?.id }))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name *"><input {...form.register("fullName")} className={inputCls} placeholder="Full name" /></Field>
              <Field label="Display Name"><input {...form.register("displayName")} className={inputCls} placeholder="Nickname" /></Field>
            </div>
            <Field label="Primary Role">
              <select {...form.register("primaryRole")} className={inputCls}>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
                <option value="kitchen">Kitchen</option>
                <option value="prep">Prep</option>
              </select>
            </Field>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Capabilities</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["canCashier", "Cashier"],
                  ["canBurgers", "Burgers"],
                  ["canSideOrders", "Side Orders"],
                  ["canPrep", "Prep"],
                  ["canCleaning", "Cleaning"],
                ] as [keyof z.infer<typeof memberSchema>, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" {...form.register(key as never)} className="w-4 h-4 accent-emerald-600" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Notes"><textarea {...form.register("notes")} rows={2} className={inputCls} placeholder="Optional notes" /></Field>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saveMut.isPending} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
                {saveMut.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AvailRow({ day, idx, memberId, row, onSave, saving }: {
  day: string; idx: number; memberId: number; row?: StaffAvailability;
  onSave: (d: object) => void; saving: boolean;
}) {
  const [avail, setAvail] = useState(row?.isAvailable ?? true);
  const [start, setStart] = useState(row?.defaultStartTime ?? "17:00");
  const [end, setEnd] = useState(row?.defaultEndTime ?? "03:00");
  const [prep, setPrep] = useState(row?.canPrepStart ?? false);
  return (
    <tr>
      <td className="py-2 pr-3 font-medium text-slate-700 w-24">{day}</td>
      <td className="py-2 pr-3"><input type="checkbox" checked={avail} onChange={e => setAvail(e.target.checked)} className="w-4 h-4 accent-emerald-600" /></td>
      <td className="py-2 pr-3"><input type="time" value={start} onChange={e => setStart(e.target.value)} disabled={!avail} className="border border-slate-300 rounded px-1.5 py-0.5 text-xs disabled:opacity-40 focus:outline-none" /></td>
      <td className="py-2 pr-3"><input type="time" value={end} onChange={e => setEnd(e.target.value)} disabled={!avail} className="border border-slate-300 rounded px-1.5 py-0.5 text-xs disabled:opacity-40 focus:outline-none" /></td>
      <td className="py-2 pr-3"><input type="checkbox" checked={prep} onChange={e => setPrep(e.target.checked)} disabled={!avail} className="w-4 h-4 accent-amber-500 disabled:opacity-40" /></td>
      <td className="py-2">
        <button onClick={() => onSave({ isAvailable: avail, defaultStartTime: start, defaultEndTime: end, canPrepStart: prep })}
          disabled={saving}
          className="px-2 py-0.5 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 disabled:opacity-50">Save</button>
      </td>
    </tr>
  );
}
