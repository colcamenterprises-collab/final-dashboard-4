import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";

type ModifierOption = {
  id: string;
  name: string;
  thaiName?: string | null;
  price?: number;
  priceDelta?: number;
  sortOrder?: number;
  active?: boolean;
  isActive?: boolean;
};

type ModifierChannelSetting = {
  id: string;
  directPriceDelta: number;
  grabPriceDelta: number;
  directEnabled: boolean;
  grabEnabled: boolean;
};

type ModifierGroup = {
  id: string;
  name: string;
  name_th?: string | null;
  groupType?: string;
  selectionMode?: "single" | "multiple";
  minSelections?: number;
  maxSelections?: number | null;
  promptText?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  linkedMenuItemIds?: string[];
  linkedMenuItemNames?: string[];
  options?: ModifierOption[];
  modifiers?: ModifierOption[];
};

const emptyGroup = {
  name: "",
  name_th: "",
  groupType: "modifier",
  selectionMode: "multiple" as "single" | "multiple",
  minSelections: "0",
  maxSelections: "",
  promptText: "",
  sortOrder: "0",
  isActive: true,
};

const emptyOption = {
  id: "",
  name: "",
  thaiName: "",
  directPrice: "0",
  grabPrice: "0",
  directEnabled: true,
  grabEnabled: true,
  sortOrder: "0",
  isActive: true,
};

const money = (value: unknown) => Number(value || 0).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

async function loadGroups(): Promise<ModifierGroup[]> {
  const response = await fetch("/api/menu-v3/modifiers/groups", { credentials: "include" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "Could not load modifier groups");
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.groups)) return payload.groups;
  if (payload?.ok === false) throw new Error(payload?.blockers?.[0]?.message || "Could not load modifier groups");
  return [];
}

async function loadChannelSettings(): Promise<ModifierChannelSetting[]> {
  const response = await fetch("/api/menu-v3/modifiers/channel-settings", { credentials: "include" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Could not load modifier channel pricing");
  return Array.isArray(payload?.settings) ? payload.settings : [];
}

export default function ModifierManager() {
  const { data: groups = [], isLoading, error } = useQuery({
    queryKey: ["/api/menu-v3/modifiers/groups"],
    queryFn: loadGroups,
  });
  const channelQuery = useQuery({
    queryKey: ["/api/menu-v3/modifiers/channel-settings"],
    queryFn: loadChannelSettings,
  });
  const channelById = useMemo(() => new Map((channelQuery.data || []).map(setting => [setting.id, setting])), [channelQuery.data]);

  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupDraft, setGroupDraft] = useState(emptyGroup);
  const [optionDraft, setOptionDraft] = useState(emptyOption);
  const [message, setMessage] = useState("");

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );

  const options = selectedGroup?.options || selectedGroup?.modifiers || [];
  const duplicateClusters = useMemo(() => {
    const byName = new Map<string, ModifierGroup[]>();
    for (const group of groups) {
      if (group.isActive === false) continue;
      const key = String(group.name || "").trim().toLowerCase();
      if (!key) continue;
      byName.set(key, [...(byName.get(key) || []), group]);
    }
    return [...byName.values()].filter((cluster) => cluster.length > 1);
  }, [groups]);
  const [mergeUniqueOptions, setMergeUniqueOptions] = useState(true);

  const duplicateGroupNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of groups) {
      const key = String(group.name || "").trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
  }, [groups]);

  const duplicateOptionNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const option of options) {
      const key = String(option.name || "").trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
  }, [options]);

  const selectedGroupIsDuplicate = duplicateGroupNames.has(groupDraft.name.trim().toLowerCase());
  const optionIsDuplicate = duplicateOptionNames.has(optionDraft.name.trim().toLowerCase()) &&
    !options.some((option) => option.id === optionDraft.id && option.name.trim().toLowerCase() === optionDraft.name.trim().toLowerCase());

  useEffect(() => {
    if (!selectedGroupId && groups.length) setSelectedGroupId(groups[0].id);
    if (selectedGroupId && !groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(groups[0]?.id || "");
    }
  }, [groups, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroup) {
      setGroupDraft(emptyGroup);
      return;
    }
    setGroupDraft({
      name: selectedGroup.name || "",
      name_th: selectedGroup.name_th || "",
      groupType: selectedGroup.groupType || "modifier",
      selectionMode: selectedGroup.selectionMode === "single" ? "single" : "multiple",
      minSelections: String(selectedGroup.minSelections ?? 0),
      maxSelections: selectedGroup.maxSelections == null ? "" : String(selectedGroup.maxSelections),
      promptText: selectedGroup.promptText || "",
      sortOrder: String(selectedGroup.sortOrder ?? 0),
      isActive: selectedGroup.isActive !== false,
    });
    setOptionDraft(emptyOption);
    setMessage("");
  }, [selectedGroup]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/modifiers/groups"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/modifiers/channel-settings"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] });
  };

  const createGroup = useMutation({
    mutationFn: () => apiRequest("/api/menu-v3/modifiers/groups/create", { method: "POST", body: JSON.stringify({ name: groupDraft.name, name_th: groupDraft.name_th || null, groupType: groupDraft.groupType, selectionMode: groupDraft.selectionMode, minSelections: Number(groupDraft.minSelections || 0), maxSelections: groupDraft.maxSelections === "" ? null : Number(groupDraft.maxSelections), promptText: groupDraft.promptText || null, sortOrder: Number(groupDraft.sortOrder || 0), isActive: groupDraft.isActive }) }),
    onSuccess: async (created: any) => { await refresh(); if (created?.id) setSelectedGroupId(String(created.id)); setMessage("Modifier group created."); },
  });

  const updateGroup = useMutation({
    mutationFn: () => apiRequest("/api/menu-v3/modifiers/groups/update", { method: "POST", body: JSON.stringify({ id: selectedGroupId, name: groupDraft.name, name_th: groupDraft.name_th || null, groupType: groupDraft.groupType, selectionMode: groupDraft.selectionMode, minSelections: Number(groupDraft.minSelections || 0), maxSelections: groupDraft.maxSelections === "" ? null : Number(groupDraft.maxSelections), promptText: groupDraft.promptText || null, sortOrder: Number(groupDraft.sortOrder || 0), isActive: groupDraft.isActive }) }),
    onSuccess: async () => { await refresh(); setMessage("Modifier group saved."); },
  });

  const deleteGroup = useMutation({ mutationFn: (id: string) => apiRequest("/api/menu-v3/modifiers/groups/delete", { method: "POST", body: JSON.stringify({ id }) }), onSuccess: async () => { setSelectedGroupId(""); await refresh(); setMessage("Modifier group deleted."); } });
  const mergeGroups = useMutation({ mutationFn: ({ targetGroupId, sourceGroupIds }: { targetGroupId: string; sourceGroupIds: string[] }) => apiRequest("/api/menu-v3/modifiers/groups/merge", { method: "POST", body: JSON.stringify({ targetGroupId, sourceGroupIds, mergeUniqueOptions }) }), onSuccess: async (result: any) => { if (result?.targetGroupId) setSelectedGroupId(String(result.targetGroupId)); await refresh(); setMessage('Duplicate groups archived. ' + Number(result?.assignmentsMoved || 0) + ' product link(s) and ' + Number(result?.optionsMoved || 0) + ' unique option(s) moved.'); } });

  const saveOption = useMutation({
    mutationFn: async () => {
      const core: any = await apiRequest(optionDraft.id ? "/api/menu-v3/modifiers/update" : "/api/menu-v3/modifiers/create", {
        method: "POST",
        body: JSON.stringify(optionDraft.id ? { id: optionDraft.id, name: optionDraft.name, thaiName: optionDraft.thaiName || null, priceDelta: Number(optionDraft.directPrice || 0), sortOrder: Number(optionDraft.sortOrder || 0), isActive: optionDraft.isActive } : { groupId: selectedGroupId, name: optionDraft.name, thaiName: optionDraft.thaiName || null, priceDelta: Number(optionDraft.directPrice || 0), sortOrder: Number(optionDraft.sortOrder || 0), isActive: optionDraft.isActive }),
      });
      const optionId = String(optionDraft.id || core?.id || core?.modifier?.id || "");
      if (!optionId) throw new Error("Modifier saved but channel pricing could not be linked");
      await apiRequest("/api/menu-v3/modifiers/channel-settings/update", { method: "POST", body: JSON.stringify({ id: optionId, directPriceDelta: Number(optionDraft.directPrice || 0), grabPriceDelta: Number(optionDraft.grabPrice || 0), directEnabled: optionDraft.directEnabled, grabEnabled: optionDraft.grabEnabled }) });
      return core;
    },
    onSuccess: async () => { await refresh(); setOptionDraft(emptyOption); setMessage("Modifier option saved."); },
  });

  const deleteOption = useMutation({ mutationFn: (id: string) => apiRequest("/api/menu-v3/modifiers/delete", { method: "POST", body: JSON.stringify({ id }) }), onSuccess: async () => { await refresh(); setOptionDraft(emptyOption); setMessage("Modifier option deleted."); } });

  const reorderGroup = useMutation({
    mutationFn: async (direction: -1 | 1) => {
      if (!selectedGroup) return;
      const ordered = [...groups].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.name.localeCompare(b.name));
      const index = ordered.findIndex((group) => group.id === selectedGroup.id);
      const target = ordered[index + direction]; if (!target) return;
      const currentOrder = Number(selectedGroup.sortOrder || index); const targetOrder = Number(target.sortOrder || index + direction);
      await apiRequest("/api/menu-v3/modifiers/groups/update", { method: "POST", body: JSON.stringify({ id: selectedGroup.id, sortOrder: targetOrder }) });
      await apiRequest("/api/menu-v3/modifiers/groups/update", { method: "POST", body: JSON.stringify({ id: target.id, sortOrder: currentOrder }) });
    }, onSuccess: async () => { await refresh(); setMessage("Modifier group order updated."); },
  });

  const reorderOption = useMutation({
    mutationFn: async ({ option, direction }: { option: ModifierOption; direction: -1 | 1 }) => {
      const ordered = [...options].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.name.localeCompare(b.name));
      const index = ordered.findIndex((entry) => entry.id === option.id); const target = ordered[index + direction]; if (!target) return;
      const currentOrder = Number(option.sortOrder || index); const targetOrder = Number(target.sortOrder || index + direction);
      await apiRequest("/api/menu-v3/modifiers/update", { method: "POST", body: JSON.stringify({ id: option.id, sortOrder: targetOrder }) });
      await apiRequest("/api/menu-v3/modifiers/update", { method: "POST", body: JSON.stringify({ id: target.id, sortOrder: currentOrder }) });
    }, onSuccess: async () => { await refresh(); setMessage("Modifier option order updated."); },
  });

  const startNewGroup = () => { setSelectedGroupId(""); setGroupDraft(emptyGroup); setOptionDraft(emptyOption); setMessage(""); };
  const editOption = (option: ModifierOption) => {
    const channel = channelById.get(option.id);
    const direct = channel?.directPriceDelta ?? option.priceDelta ?? option.price ?? 0;
    setOptionDraft({ id: option.id, name: option.name || "", thaiName: option.thaiName || "", directPrice: String(direct), grabPrice: String(channel?.grabPriceDelta ?? direct), directEnabled: channel?.directEnabled ?? true, grabEnabled: channel?.grabEnabled ?? true, sortOrder: String(option.sortOrder ?? 0), isActive: option.isActive ?? option.active ?? true });
  };

  const busy = createGroup.isPending || updateGroup.isPending || deleteGroup.isPending || saveOption.isPending || deleteOption.isPending || reorderGroup.isPending || reorderOption.isPending;
  const mutationError = createGroup.error || updateGroup.error || deleteGroup.error || mergeGroups.error || saveOption.error || deleteOption.error || channelQuery.error;

  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-slate-950">Modifier Library</h1><p className="mt-1 text-sm text-slate-500">One modifier can have different Direct and Grab pricing and visibility.</p></div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{(error as Error).message}</div>}
    {mutationError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{(mutationError as Error).message}</div>}
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}

    {duplicateClusters.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-amber-950">Duplicate modifier groups detected</h2><p className="mt-1 text-xs text-amber-800">Choose which group to keep. Product assignments are moved and the other groups are archived, not deleted.</p></div><label className="flex items-center gap-2 text-xs text-amber-900"><input type="checkbox" checked={mergeUniqueOptions} onChange={(event) => setMergeUniqueOptions(event.target.checked)} /> Move unique options into the kept group</label></div><div className="mt-4 space-y-3">{duplicateClusters.map((cluster) => <div key={cluster.map((group) => group.id).join("-")} className="rounded-xl border border-amber-200 bg-white p-3"><div className="text-sm font-semibold text-slate-950">{cluster[0].name} <span className="ml-2 text-xs font-normal text-slate-500">{cluster.length} copies</span></div><div className="mt-3 flex flex-wrap gap-2">{cluster.map((group) => { const usage = group.linkedMenuItemIds?.length || group.linkedMenuItemNames?.length || 0; const sourceIds = cluster.filter((candidate) => candidate.id !== group.id).map((candidate) => candidate.id); return <button key={group.id} type="button" disabled={busy} onClick={() => { const affected = sourceIds.length; if (window.confirm(`Keep this copy of "${group.name}" and archive ${affected} duplicate group${affected === 1 ? "" : "s"}? All product links will move to the kept group.`)) mergeGroups.mutate({ targetGroupId: group.id, sourceGroupIds: sourceIds }); }} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-950 disabled:opacity-40"><strong>Keep this group</strong><span className="ml-2">{usage} product{usage === 1 ? "" : "s"} · {(group.options || group.modifiers || []).length} options</span></button>; })}</div></div>)}</div></section>}

    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Modifier groups</h2><p className="text-xs text-slate-500">{groups.length} group{groups.length === 1 ? "" : "s"}</p></div><button type="button" onClick={startNewGroup} className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white">New group</button></div><div className="mt-4 space-y-2">{isLoading && <p className="py-8 text-center text-sm text-slate-400">Loading modifier groups…</p>}{!isLoading && groups.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No modifier groups yet.</p>}{groups.map((group) => { const count = (group.options || group.modifiers || []).length; return <button key={group.id} type="button" onClick={() => setSelectedGroupId(group.id)} className={"w-full rounded-xl border p-3 text-left transition " + (selectedGroupId === group.id ? "border-black bg-slate-50" : "border-slate-200 hover:border-slate-400")}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><strong className="truncate text-sm text-slate-950">{group.name}</strong>{duplicateGroupNames.has(group.name.trim().toLowerCase()) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Duplicate</span>}</div><span className={"rounded-full px-2 py-0.5 text-[10px] " + (group.isActive === false ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700")}>{group.isActive === false ? "Inactive" : "Active"}</span></div><p className="mt-1 text-xs text-slate-500">{count} option{count === 1 ? "" : "s"} · {group.selectionMode === "single" ? "Single choice" : "Multiple choice"}</p><p className="mt-1 text-[11px] text-slate-400">Used by {group.linkedMenuItemNames?.length || 0} product{group.linkedMenuItemNames?.length === 1 ? "" : "s"}</p></button>; })}</div></aside>

      <main className="space-y-5">
        <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{selectedGroup ? "Edit modifier group" : "Create modifier group"}</h2><p className="text-xs text-slate-500">Groups are created independently from products.</p></div>{selectedGroup && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => reorderGroup.mutate(-1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Move up</button><button type="button" disabled={busy} onClick={() => reorderGroup.mutate(1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Move down</button><button type="button" disabled={busy} onClick={() => { const usage = selectedGroup.linkedMenuItemNames?.length || 0; const warning = usage > 0 ? 'This group is used by ' + usage + ' product' + (usage === 1 ? '' : 's') + '. Deleting it will remove those assignments and all options. Continue?' : 'Delete modifier group "' + selectedGroup.name + '" and all its options?'; if (window.confirm(warning)) deleteGroup.mutate(selectedGroup.id); }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40">Delete group</button></div>}</div>{selectedGroupIsDuplicate && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Another modifier group already uses this name. Merge or rename duplicates before assigning them to products.</div>}<div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-medium">Group name<Input value={groupDraft.name} onChange={(event) => setGroupDraft({ ...groupDraft, name: event.target.value })} className="mt-1" placeholder="Make it Better" /></label><label className="text-xs font-medium">Thai name<Input value={groupDraft.name_th} onChange={(event) => setGroupDraft({ ...groupDraft, name_th: event.target.value })} className="mt-1" placeholder="Optional" /></label><label className="text-xs font-medium">Selection type<select value={groupDraft.selectionMode} onChange={(event) => setGroupDraft({ ...groupDraft, selectionMode: event.target.value as "single" | "multiple" })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm"><option value="multiple">Multiple choice</option><option value="single">Single choice</option></select></label><label className="text-xs font-medium">Group type<select value={groupDraft.groupType} onChange={(event) => setGroupDraft({ ...groupDraft, groupType: event.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm"><option value="modifier">Modifier</option><option value="upsell">Upsell</option><option value="choice">Required choice</option></select></label><label className="text-xs font-medium">Minimum selections<Input type="number" min="0" value={groupDraft.minSelections} onChange={(event) => setGroupDraft({ ...groupDraft, minSelections: event.target.value })} className="mt-1" /></label><label className="text-xs font-medium">Maximum selections<Input type="number" min="0" value={groupDraft.maxSelections} onChange={(event) => setGroupDraft({ ...groupDraft, maxSelections: event.target.value })} className="mt-1" placeholder="No maximum" /></label><label className="text-xs font-medium">Display order<Input type="number" value={groupDraft.sortOrder} onChange={(event) => setGroupDraft({ ...groupDraft, sortOrder: event.target.value })} className="mt-1" /></label><label className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>Active</span><input type="checkbox" checked={groupDraft.isActive} onChange={(event) => setGroupDraft({ ...groupDraft, isActive: event.target.checked })} /></label><label className="text-xs font-medium md:col-span-2">Prompt text<Input value={groupDraft.promptText} onChange={(event) => setGroupDraft({ ...groupDraft, promptText: event.target.value })} className="mt-1" placeholder="Would you like to make it better?" /></label></div><button type="button" disabled={busy || !groupDraft.name.trim()} onClick={() => selectedGroup ? updateGroup.mutate() : createGroup.mutate()} className="mt-5 w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Saving…" : selectedGroup ? "Save modifier group" : "Create modifier group"}</button></section>

        {selectedGroup && <section className="rounded-2xl border bg-white p-5 shadow-sm"><div><h2 className="text-lg font-semibold">Options — {selectedGroup.name}</h2><p className="text-xs text-slate-500">Set each option once, then control its price and visibility by sales channel.</p></div><div className="mt-4 overflow-x-auto rounded-xl border"><table className="w-full min-w-[920px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 text-left">Option</th><th className="p-3 text-right">Direct</th><th className="p-3 text-center">Direct visible</th><th className="p-3 text-right">Grab</th><th className="p-3 text-center">Grab visible</th><th className="p-3 text-right">Order</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{options.map((option) => { const channel = channelById.get(option.id); const direct = channel?.directPriceDelta ?? option.priceDelta ?? option.price ?? 0; const grab = channel?.grabPriceDelta ?? direct; return <tr key={option.id} className="border-t"><td className="p-3 font-medium">{option.name}<div className="text-xs font-normal text-slate-400">{option.thaiName || ""}</div></td><td className="p-3 text-right">฿{money(direct)}</td><td className="p-3 text-center">{channel?.directEnabled ?? true ? "✓" : "—"}</td><td className="p-3 text-right">฿{money(grab)}</td><td className="p-3 text-center">{channel?.grabEnabled ?? true ? "✓" : "—"}</td><td className="p-3 text-right">{option.sortOrder ?? 0}</td><td className="p-3 text-right"><div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => reorderOption.mutate({ option, direction: -1 })} className="rounded-lg border px-2 py-1.5 text-xs disabled:opacity-40">↑</button><button type="button" disabled={busy} onClick={() => reorderOption.mutate({ option, direction: 1 })} className="rounded-lg border px-2 py-1.5 text-xs disabled:opacity-40">↓</button><button type="button" onClick={() => editOption(option)} className="rounded-lg border px-3 py-1.5 text-xs">Edit</button><button type="button" onClick={() => { if (window.confirm('Delete option "' + option.name + '"? This cannot be undone.')) deleteOption.mutate(option.id); }} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700">Delete</button></div></td></tr>; })}{options.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-sm text-slate-400">No options in this group.</td></tr>}</tbody></table></div>

          <div className="mt-5 rounded-xl bg-slate-50 p-4"><h3 className="text-sm font-semibold">{optionDraft.id ? "Edit option" : "Add option"}</h3><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6"><label className="text-xs font-medium xl:col-span-2">Option name<Input value={optionDraft.name} onChange={(event) => setOptionDraft({ ...optionDraft, name: event.target.value })} className="mt-1" placeholder="Extra Bacon" /></label><label className="text-xs font-medium">Direct price<Input type="number" min="0" value={optionDraft.directPrice} onChange={(event) => setOptionDraft({ ...optionDraft, directPrice: event.target.value })} className="mt-1" /></label><label className="text-xs font-medium">Grab price<Input type="number" min="0" value={optionDraft.grabPrice} onChange={(event) => setOptionDraft({ ...optionDraft, grabPrice: event.target.value })} className="mt-1" /></label><label className="text-xs font-medium">Display order<Input type="number" value={optionDraft.sortOrder} onChange={(event) => setOptionDraft({ ...optionDraft, sortOrder: event.target.value })} className="mt-1" /></label><label className="text-xs font-medium">Thai name<Input value={optionDraft.thaiName} onChange={(event) => setOptionDraft({ ...optionDraft, thaiName: event.target.value })} className="mt-1" placeholder="Optional" /></label></div><div className="mt-3 flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={optionDraft.directEnabled} onChange={(event) => setOptionDraft({ ...optionDraft, directEnabled: event.target.checked })} /> Direct</label><label className="flex items-center gap-2"><input type="checkbox" checked={optionDraft.grabEnabled} onChange={(event) => setOptionDraft({ ...optionDraft, grabEnabled: event.target.checked })} /> Grab</label><label className="flex items-center gap-2"><input type="checkbox" checked={optionDraft.isActive} onChange={(event) => setOptionDraft({ ...optionDraft, isActive: event.target.checked })} /> Active</label></div>{optionIsDuplicate && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">An option with this name already exists in the selected group.</p>}<div className="mt-3 flex justify-end gap-2">{optionDraft.id && <button type="button" onClick={() => setOptionDraft(emptyOption)} className="rounded-lg border px-4 py-2 text-xs">Cancel edit</button>}<button type="button" disabled={busy || !optionDraft.name.trim() || (!optionDraft.directEnabled && !optionDraft.grabEnabled)} onClick={() => saveOption.mutate()} className="rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{saveOption.isPending ? "Saving…" : optionDraft.id ? "Save option" : "Add option"}</button></div></div>
        </section>}
      </main>
    </div>
  </div>;
}
