import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "client/src/pages/menu/ModifierManager.tsx");
let source = fs.readFileSync(file, "utf8");

function replaceRequired(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not apply ${label}: anchor not found`);
  source = source.replace(search, replacement);
}

if (source.includes("duplicateGroupNames") && source.includes("reorderGroup")) {
  console.log("Modifier Library controls already applied.");
  process.exit(0);
}

replaceRequired(
`  const options = selectedGroup?.options || selectedGroup?.modifiers || [];
`,
`  const options = selectedGroup?.options || selectedGroup?.modifiers || [];

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
`,
"duplicate detection"
);

replaceRequired(
`  const deleteOption = useMutation({
    mutationFn: (id: string) => apiRequest("/api/menu-v3/modifiers/delete", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
    onSuccess: async () => {
      await refresh();
      setOptionDraft(emptyOption);
      setMessage("Modifier option deleted.");
    },
  });
`,
`  const deleteOption = useMutation({
    mutationFn: (id: string) => apiRequest("/api/menu-v3/modifiers/delete", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
    onSuccess: async () => {
      await refresh();
      setOptionDraft(emptyOption);
      setMessage("Modifier option deleted.");
    },
  });

  const reorderGroup = useMutation({
    mutationFn: async (direction: -1 | 1) => {
      if (!selectedGroup) return;
      const ordered = [...groups].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.name.localeCompare(b.name));
      const index = ordered.findIndex((group) => group.id === selectedGroup.id);
      const target = ordered[index + direction];
      if (!target) return;
      const currentOrder = Number(selectedGroup.sortOrder || index);
      const targetOrder = Number(target.sortOrder || index + direction);
      await apiRequest("/api/menu-v3/modifiers/groups/update", { method: "POST", body: JSON.stringify({ id: selectedGroup.id, sortOrder: targetOrder }) });
      await apiRequest("/api/menu-v3/modifiers/groups/update", { method: "POST", body: JSON.stringify({ id: target.id, sortOrder: currentOrder }) });
    },
    onSuccess: async () => { await refresh(); setMessage("Modifier group order updated."); },
  });

  const reorderOption = useMutation({
    mutationFn: async ({ option, direction }: { option: ModifierOption; direction: -1 | 1 }) => {
      const ordered = [...options].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.name.localeCompare(b.name));
      const index = ordered.findIndex((entry) => entry.id === option.id);
      const target = ordered[index + direction];
      if (!target) return;
      const currentOrder = Number(option.sortOrder || index);
      const targetOrder = Number(target.sortOrder || index + direction);
      await apiRequest("/api/menu-v3/modifiers/update", { method: "POST", body: JSON.stringify({ id: option.id, sortOrder: targetOrder }) });
      await apiRequest("/api/menu-v3/modifiers/update", { method: "POST", body: JSON.stringify({ id: target.id, sortOrder: currentOrder }) });
    },
    onSuccess: async () => { await refresh(); setMessage("Modifier option order updated."); },
  });
`,
"reorder mutations"
);

replaceRequired(
`  const busy = createGroup.isPending || updateGroup.isPending || deleteGroup.isPending || saveOption.isPending || deleteOption.isPending;
`,
`  const busy = createGroup.isPending || updateGroup.isPending || deleteGroup.isPending || saveOption.isPending || deleteOption.isPending || reorderGroup.isPending || reorderOption.isPending;
`,
"busy state"
);

replaceRequired(
`              <div className="flex items-start justify-between gap-3"><strong className="text-sm text-slate-950">{group.name}</strong><span className={"rounded-full px-2 py-0.5 text-[10px] " + (group.isActive === false ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700")}>{group.isActive === false ? "Inactive" : "Active"}</span></div>
              <p className="mt-1 text-xs text-slate-500">{count} option{count === 1 ? "" : "s"} · {group.selectionMode === "single" ? "Single choice" : "Multiple choice"}</p>
              {(group.linkedMenuItemNames?.length || 0) > 0 && <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">Used by {group.linkedMenuItemNames?.length} product{group.linkedMenuItemNames?.length === 1 ? "" : "s"}</p>}
`,
`              <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><strong className="truncate text-sm text-slate-950">{group.name}</strong>{duplicateGroupNames.has(group.name.trim().toLowerCase()) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Duplicate</span>}</div><span className={"rounded-full px-2 py-0.5 text-[10px] " + (group.isActive === false ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700")}>{group.isActive === false ? "Inactive" : "Active"}</span></div>
              <p className="mt-1 text-xs text-slate-500">{count} option{count === 1 ? "" : "s"} · {group.selectionMode === "single" ? "Single choice" : "Multiple choice"}</p>
              <p className="mt-1 text-[11px] text-slate-400">Used by {group.linkedMenuItemNames?.length || 0} product{group.linkedMenuItemNames?.length === 1 ? "" : "s"}</p>
`,
"group badges and usage"
);

replaceRequired(
`            {selectedGroup && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Delete modifier group "' + selectedGroup.name + '" and all its options?')) deleteGroup.mutate(selectedGroup.id); }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40">Delete group</button>}
`,
`            {selectedGroup && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => reorderGroup.mutate(-1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Move up</button><button type="button" disabled={busy} onClick={() => reorderGroup.mutate(1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Move down</button><button type="button" disabled={busy} onClick={() => { const usage = selectedGroup.linkedMenuItemNames?.length || 0; const warning = usage > 0 ? 'This group is used by ' + usage + ' product' + (usage === 1 ? '' : 's') + '. Deleting it will remove those assignments and all options. Continue?' : 'Delete modifier group "' + selectedGroup.name + '" and all its options?'; if (window.confirm(warning)) deleteGroup.mutate(selectedGroup.id); }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40">Delete group</button></div>}
`,
"safe group controls"
);

replaceRequired(
`          <div className="mt-4 grid gap-4 md:grid-cols-2">
`,
`          {selectedGroupIsDuplicate && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Another modifier group already uses this name. Merge or rename duplicates before assigning them to products.</div>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
`,
"group duplicate warning"
);

replaceRequired(
`<td className="p-3 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => editOption(option)} className="rounded-lg border px-3 py-1.5 text-xs">Edit</button><button type="button" onClick={() => { if (window.confirm('Delete option "' + option.name + '"?')) deleteOption.mutate(option.id); }} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700">Delete</button></div></td>`,
`<td className="p-3 text-right"><div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => reorderOption.mutate({ option, direction: -1 })} className="rounded-lg border px-2 py-1.5 text-xs disabled:opacity-40">↑</button><button type="button" disabled={busy} onClick={() => reorderOption.mutate({ option, direction: 1 })} className="rounded-lg border px-2 py-1.5 text-xs disabled:opacity-40">↓</button><button type="button" onClick={() => editOption(option)} className="rounded-lg border px-3 py-1.5 text-xs">Edit</button><button type="button" onClick={() => { if (window.confirm('Delete option "' + option.name + '"? This cannot be undone.')) deleteOption.mutate(option.id); }} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700">Delete</button></div></td>`,
"option ordering controls"
);

replaceRequired(
`            <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={optionDraft.isActive} onChange={(event) => setOptionDraft({ ...optionDraft, isActive: event.target.checked })} /> Active</label>`,
`            {optionIsDuplicate && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">An option with this name already exists in the selected group.</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={optionDraft.isActive} onChange={(event) => setOptionDraft({ ...optionDraft, isActive: event.target.checked })} /> Active</label>`,
"option duplicate warning"
);

fs.writeFileSync(file, source);
console.log("Modifier Library operational controls applied successfully.");
