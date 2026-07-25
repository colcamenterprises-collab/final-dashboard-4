import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { asArray, normalizeMenuItems } from "@/lib/menuData";

type MenuItem = { id: string; name: string };
type ModifierOption = { id?: string; name: string; thaiName?: string | null; price?: number | string; priceDelta?: number | string; isActive?: boolean; active?: boolean };
type ModifierGroup = { id?: string; name: string; menuItemId?: string; linkedMenuItemIds?: string[]; options?: ModifierOption[]; modifiers?: ModifierOption[]; isActive?: boolean };

const money = (value: unknown) => `฿${Number(value || 0).toFixed(0)}`;
const emptyGroup = { id: "", name: "", menuItemId: "" };
const emptyOption = { id: "", groupId: "", name: "", thaiName: "", price: "", active: true };

export default function ModifierManager() {
  const [groupForm, setGroupForm] = useState(emptyGroup);
  const [optionForm, setOptionForm] = useState(emptyOption);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { data: rawItems } = useQuery<unknown>({ queryKey: ["/api/menu-v3/items"] });
  const { data: rawGroups, isLoading } = useQuery<ModifierGroup[] | { groups?: ModifierGroup[] }>({ queryKey: ["/api/menu-v3/modifiers/groups"] });
  const items = asArray<MenuItem>(normalizeMenuItems<MenuItem>(rawItems).items);
  const groups = Array.isArray(rawGroups) ? rawGroups : asArray<ModifierGroup>(rawGroups?.groups);
  const selectedGroup = useMemo(() => groups.find((group) => group.id === optionForm.groupId), [groups, optionForm.groupId]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/modifiers/groups"] });

  const saveGroup = useMutation({
    mutationFn: () => apiRequest(groupForm.id ? "/api/menu-v3/modifiers/groups/update" : "/api/menu-v3/modifiers/groups/create", {
      method: "POST",
      body: JSON.stringify({ id: groupForm.id || undefined, name: groupForm.name, menuItemId: groupForm.menuItemId, isActive: true }),
    }),
    onSuccess: () => { setGroupForm(emptyGroup); refresh(); },
  });
  const deleteGroup = useMutation({ mutationFn: (id: string) => apiRequest("/api/menu-v3/modifiers/groups/delete", { method: "POST", body: JSON.stringify({ id }) }), onSuccess: refresh });
  const saveOption = useMutation({
    mutationFn: () => apiRequest(optionForm.id ? "/api/menu-v3/modifiers/update" : "/api/menu-v3/modifiers/create", {
      method: "POST",
      body: JSON.stringify({ id: optionForm.id || undefined, groupId: optionForm.groupId, name: optionForm.name, thaiName: optionForm.thaiName || null, priceDelta: Number(optionForm.price || 0), isActive: optionForm.active }),
    }),
    onSuccess: () => { setOptionForm((current) => ({ ...emptyOption, groupId: current.groupId })); refresh(); },
  });
  const deleteOption = useMutation({ mutationFn: (id: string) => apiRequest("/api/menu-v3/modifiers/delete", { method: "POST", body: JSON.stringify({ id }) }), onSuccess: refresh });

  return <div className="space-y-5">
    <div>
      <h2 className="text-xl font-bold">Modifiers & Upsells</h2>
      <p className="mt-1 text-sm text-slate-500">These groups and options feed the live POS upsell modal. Prices selected by staff are recorded against the order line.</p>
    </div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between"><h3 className="font-semibold">{groupForm.id ? "Edit modifier group" : "Create modifier group"}</h3>{groupForm.id && <button className="text-xs underline" onClick={() => setGroupForm(emptyGroup)}>Cancel edit</button>}</div>
        <label className="block text-sm font-medium">Group name<Input value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} placeholder="Make it Better" className="mt-1" /></label>
        <label className="block text-sm font-medium">Linked menu item<select value={groupForm.menuItemId} onChange={(event) => setGroupForm({ ...groupForm, menuItemId: event.target.value })} className="mt-1 w-full rounded-md border px-3 py-2"><option value="">Select menu item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button disabled={!groupForm.name || !groupForm.menuItemId || saveGroup.isPending} onClick={() => saveGroup.mutate()} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Plus className="h-4 w-4" />{groupForm.id ? "Save group changes" : "Create group"}</button>
      </section>
      <section className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between"><h3 className="font-semibold">{optionForm.id ? "Edit modifier option" : "Add modifier option"}</h3>{optionForm.id && <button className="text-xs underline" onClick={() => setOptionForm((current) => ({ ...emptyOption, groupId: current.groupId }))}>Cancel edit</button>}</div>
        <label className="block text-sm font-medium">Modifier group<select value={optionForm.groupId} onChange={(event) => setOptionForm({ ...optionForm, groupId: event.target.value })} className="mt-1 w-full rounded-md border px-3 py-2"><option value="">Select modifier group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">Option name<Input value={optionForm.name} onChange={(event) => setOptionForm({ ...optionForm, name: event.target.value })} placeholder="Crispy Bacon" className="mt-1" /></label><label className="block text-sm font-medium">Thai name<Input value={optionForm.thaiName} onChange={(event) => setOptionForm({ ...optionForm, thaiName: event.target.value })} placeholder="Optional" className="mt-1" /></label></div>
        <label className="block text-sm font-medium">Upsell price (THB)<Input type="number" min="0" value={optionForm.price} onChange={(event) => setOptionForm({ ...optionForm, price: event.target.value })} placeholder="40" className="mt-1" /></label>
        <button disabled={!optionForm.groupId || !optionForm.name || saveOption.isPending} onClick={() => saveOption.mutate()} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Plus className="h-4 w-4" />{optionForm.id ? "Save option changes" : "Add option"}</button>
      </section>
    </div>
    {selectedGroup && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><strong>{selectedGroup.name}:</strong> {(selectedGroup.options || selectedGroup.modifiers || []).map((option) => `${option.name} ${money(option.priceDelta ?? option.price)}`).join(" · ") || "No options yet"}</div>}
    <section className="space-y-3">
      <h3 className="font-semibold">Existing modifier groups</h3>
      {isLoading ? <p className="text-sm text-slate-500">Loading modifiers…</p> : groups.length === 0 ? <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">No modifier groups have been created.</p> : groups.map((group) => {
        const id = String(group.id || group.name);
        const options = group.options || group.modifiers || [];
        const linkedNames = items.filter((item) => item.id === group.menuItemId || group.linkedMenuItemIds?.includes(item.id)).map((item) => item.name);
        const open = expanded[id] !== false;
        return <article key={id} className="overflow-hidden rounded-2xl border bg-white">
          <div className="flex flex-wrap items-center gap-3 p-4">
            <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setExpanded((current) => ({ ...current, [id]: !open }))}>{open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}<div><h4 className="font-bold">{group.name}</h4><p className="text-xs text-slate-500">Linked to: {linkedNames.join(", ") || "No item"} · {options.length} option{options.length === 1 ? "" : "s"}</p></div></button>
            <button title="Edit group" className="rounded-lg border p-2" onClick={() => setGroupForm({ id: String(group.id || ""), name: group.name, menuItemId: group.menuItemId || "" })}><Pencil className="h-4 w-4" /></button>
            <button title="Delete group" className="rounded-lg border border-red-200 p-2 text-red-700" onClick={() => group.id && window.confirm(`Delete ${group.name} and its options?`) && deleteGroup.mutate(String(group.id))}><Trash2 className="h-4 w-4" /></button>
          </div>
          {open && <div className="border-t bg-slate-50/70 p-4"><div className="grid gap-2">{options.length === 0 ? <p className="text-sm text-slate-500">No options. Select this group above and add the first option.</p> : options.map((option) => <div key={option.id || option.name} className="flex items-center gap-3 rounded-xl border bg-white px-3 py-3"><div className="min-w-0 flex-1"><p className="font-semibold">{option.name}</p>{option.thaiName && <p className="text-xs text-slate-500">{option.thaiName}</p>}</div><strong className="text-base">{money(option.priceDelta ?? option.price)}</strong><button className="rounded-lg border p-2" onClick={() => setOptionForm({ id: String(option.id || ""), groupId: String(group.id || ""), name: option.name, thaiName: option.thaiName || "", price: String(option.priceDelta ?? option.price ?? 0), active: option.isActive !== false && option.active !== false })}><Pencil className="h-4 w-4" /></button><button className="rounded-lg border border-red-200 p-2 text-red-700" onClick={() => option.id && window.confirm(`Delete ${option.name}?`) && deleteOption.mutate(String(option.id))}><Trash2 className="h-4 w-4" /></button></div>)}</div></div>}
        </article>;
      })}
    </section>
  </div>;
}
