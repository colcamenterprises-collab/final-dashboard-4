import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Users, Plus, ChevronDown, ChevronRight, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface StaffMember {
  id: number;
  fullName: string;
  displayName?: string;
  primaryRole: string;
  isActive: boolean;
  canCashier: boolean;
  canBurgers: boolean;
  canSideOrders: boolean;
  canPrep: boolean;
  canCleaning: boolean;
  notes?: string;
}

interface MembersResponse {
  members?: StaffMember[];
}

const ROLE_COLOURS: Record<string, string> = {
  manager: "bg-purple-100 text-purple-700 border-purple-200",
  cashier: "bg-blue-100 text-blue-700 border-blue-200",
  kitchen: "bg-amber-100 text-amber-700 border-amber-200",
  staff: "bg-slate-100 text-slate-600 border-slate-200",
};

function Cap({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-400 border-slate-200 line-through"}`}>
      {label}
    </span>
  );
}

export default function StaffMembers() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", primaryRole: "staff", canCashier: false, canBurgers: false, canSideOrders: false, canPrep: false });

  const { data, isLoading, isError } = useQuery<MembersResponse>({
    queryKey: ["/api/staff/members"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/staff/members", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/dashboard"] });
      setShowForm(false);
      setForm({ fullName: "", primaryRole: "staff", canCashier: false, canBurgers: false, canSideOrders: false, canPrep: false });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PUT", `/api/staff/members/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/staff/members"] }),
  });

  const members = data?.members ?? [];
  const active = members.filter((m) => m.isActive);
  const inactive = members.filter((m) => !m.isActive);

  const renderGroup = (group: StaffMember[], title: string) => (
    <div key={title} className="space-y-1">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">{title} ({group.length})</p>
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {group.map((m) => {
          const isOpen = expandedId === m.id;
          return (
            <div key={m.id} className="bg-white dark:bg-slate-900">
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                onClick={() => setExpandedId(isOpen ? null : m.id)}
              >
                {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-white">{m.fullName}</p>
                  {m.displayName && m.displayName !== m.fullName && (
                    <p className="text-[10px] text-slate-400">{m.displayName}</p>
                  )}
                </div>
                <Badge className={`text-[10px] px-1.5 py-0 border ${ROLE_COLOURS[m.primaryRole] ?? ROLE_COLOURS.staff}`}>
                  {m.primaryRole}
                </Badge>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Cap label="Cashier" enabled={m.canCashier} />
                    <Cap label="Burgers" enabled={m.canBurgers} />
                    <Cap label="Side Orders" enabled={m.canSideOrders} />
                    <Cap label="Prep" enabled={m.canPrep} />
                    <Cap label="Cleaning" enabled={m.canCleaning} />
                  </div>
                  {m.notes && <p className="text-[10px] text-slate-500">{m.notes}</p>}
                  <button
                    onClick={() => toggleActiveMutation.mutate({ id: m.id, isActive: !m.isActive })}
                    disabled={toggleActiveMutation.isPending}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                      m.isActive
                        ? "border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        : "border-green-200 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                    }`}
                  >
                    {m.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-slate-400" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Staff Members</h1>
            <p className="text-xs text-slate-500">{active.length} active</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-black text-white text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Member
        </button>
      </div>

      {showForm && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-900 space-y-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">New Staff Member</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Full Name *</label>
              <input
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="First Last"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Role</label>
              <select
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                value={form.primaryRole}
                onChange={(e) => setForm({ ...form, primaryRole: e.target.value })}
              >
                {["staff", "cashier", "kitchen", "manager"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1.5">Capabilities</label>
            <div className="flex gap-2 flex-wrap">
              {(["canCashier", "canBurgers", "canSideOrders", "canPrep"] as const).map((cap) => (
                <button
                  key={cap}
                  onClick={() => setForm({ ...form, [cap]: !form[cap] })}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${
                    form[cap]
                      ? "bg-black text-white border-black"
                      : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400"
                  }`}
                >
                  {form[cap] && <Check className="h-2.5 w-2.5" />}
                  {cap.replace("can", "")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-xs px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400">Cancel</button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.fullName || createMutation.isPending}
              className="text-xs px-3 py-1.5 bg-black text-white rounded-lg hover:bg-slate-800 disabled:opacity-40"
            >
              {createMutation.isPending ? "Saving..." : "Add Member"}
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="text-center py-16 text-slate-400 text-xs">Loading staff...</div>}
      {isError && <div className="text-center py-16 text-red-500 text-xs">Failed to load staff members. Tables may not be provisioned yet.</div>}
      {!isLoading && !isError && members.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-xs">No staff members yet. Click 'Add Member' to get started.</div>
      )}

      <div className="space-y-4">
        {active.length > 0 && renderGroup(active, "Active")}
        {inactive.length > 0 && renderGroup(inactive, "Inactive")}
      </div>
    </div>
  );
}
