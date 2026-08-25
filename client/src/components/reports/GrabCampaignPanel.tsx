import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

export type GrabCampaign = {
  id: string;
  name: string;
  itemNameMatch: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  notes?: string | null;
};

type CampaignResponse = { ok: boolean; campaigns: GrabCampaign[]; error?: string };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const body = await response.json();
  if (!response.ok || body?.ok === false) throw new Error(body?.error || `HTTP ${response.status}`);
  return body;
}

function localDateTime(hoursFromNow = 0) {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function useGrabCampaigns() {
  return useQuery<CampaignResponse>({
    queryKey: ["grab-campaigns"],
    queryFn: () => json("/api/reports/receipt-analytics/grab-campaigns"),
    staleTime: 30_000,
  });
}

export default function GrabCampaignPanel() {
  const [open, setOpen] = useState(false);
  const campaigns = useGrabCampaigns();
  const [draft, setDraft] = useState({
    name: "",
    itemNameMatch: "",
    discountType: "percent" as "percent" | "fixed",
    discountValue: "",
    startsAt: localDateTime(),
    endsAt: localDateTime(24 * 5),
    notes: "",
  });
  const create = useMutation({
    mutationFn: () => json("/api/reports/receipt-analytics/grab-campaigns", { method: "POST", body: JSON.stringify({ ...draft, discountValue: Number(draft.discountValue), startsAt: new Date(draft.startsAt).toISOString(), endsAt: new Date(draft.endsAt).toISOString() }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["grab-campaigns"] });
      setDraft({ name: "", itemNameMatch: "", discountType: "percent", discountValue: "", startsAt: localDateTime(), endsAt: localDateTime(24 * 5), notes: "" });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => json(`/api/reports/receipt-analytics/grab-campaigns/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["grab-campaigns"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => json(`/api/reports/receipt-analytics/grab-campaigns/${id}`, { method: "DELETE" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["grab-campaigns"] }),
  });

  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <button type="button" onClick={() => setOpen(value => !value)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
      <div><p className="text-sm font-black text-slate-900">Grab Marketing Adjustments</p><p className="text-xs text-slate-500">Temporary reporting rules only · do not alter POS menu prices</p></div>
      {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
    </button>
    {open ? <div className="border-t border-slate-100 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Campaign name" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
        <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Item name contains…" value={draft.itemNameMatch} onChange={event => setDraft({ ...draft, itemNameMatch: event.target.value })} />
        <div className="flex gap-2"><select className="w-full rounded-xl border px-3 py-2 text-sm" value={draft.discountType} onChange={event => setDraft({ ...draft, discountType: event.target.value === "fixed" ? "fixed" : "percent" })}><option value="percent">%</option><option value="fixed">฿</option></select><input className="w-full rounded-xl border px-3 py-2 text-sm" inputMode="decimal" placeholder="40" value={draft.discountValue} onChange={event => setDraft({ ...draft, discountValue: event.target.value })} /></div>
        <input className="rounded-xl border px-3 py-2 text-sm" type="datetime-local" value={draft.startsAt} onChange={event => setDraft({ ...draft, startsAt: event.target.value })} />
        <input className="rounded-xl border px-3 py-2 text-sm" type="datetime-local" value={draft.endsAt} onChange={event => setDraft({ ...draft, endsAt: event.target.value })} />
        <button type="button" disabled={create.isPending || !draft.name.trim() || !draft.itemNameMatch.trim() || !draft.discountValue} onClick={() => create.mutate()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-40"><Plus className="h-4 w-4" />Add</button>
      </div>
      <input className="mt-3 w-full rounded-xl border px-3 py-2 text-sm" placeholder="Notes (optional)" value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} />
      {create.error ? <p className="mt-2 text-xs font-bold text-red-700">{(create.error as Error).message}</p> : null}
      <div className="mt-4 space-y-2">
        {(campaigns.data?.campaigns || []).map(campaign => <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
          <div><span className="font-black text-slate-900">{campaign.name}</span><span className="ml-2 text-slate-500">{campaign.itemNameMatch} · {campaign.discountType === "percent" ? `${campaign.discountValue}%` : `฿${campaign.discountValue}`} · {new Date(campaign.startsAt).toLocaleDateString()} → {new Date(campaign.endsAt).toLocaleDateString()}</span></div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => toggle.mutate({ id: campaign.id, active: !campaign.active })} className={`rounded-lg px-2 py-1 font-black ${campaign.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>{campaign.active ? "Active" : "Paused"}</button><button type="button" onClick={() => window.confirm(`Delete ${campaign.name}?`) && remove.mutate(campaign.id)} className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></div>
        </div>)}
        {!campaigns.isLoading && !(campaigns.data?.campaigns || []).length ? <p className="text-xs text-slate-500">No Grab marketing adjustments configured.</p> : null}
      </div>
    </div> : null}
  </section>;
}
