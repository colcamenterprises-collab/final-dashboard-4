import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Patch anchor not found: ${label}`);
  return source.replace(search, replacement);
}

// 1) Canonical service transaction: relink products, optionally move unique options,
// and archive source groups without deleting historical records.
const servicePath = "server/services/menu/modifierService.ts";
let service = read(servicePath);
if (!service.includes("export async function mergeModifierGroups")) {
  service += `

export async function mergeModifierGroups(targetGroupId: string, sourceGroupIds: string[], mergeUniqueOptions = true) {
  const targetId = String(targetGroupId || "").trim();
  const sourceIds = Array.from(new Set((sourceGroupIds || []).map(String).filter((id) => id && id !== targetId)));
  if (!targetId) throw new Error("Canonical modifier group is required");
  if (!sourceIds.length) throw new Error("Select at least one duplicate modifier group");

  const client = await db().connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id,name_en,is_active FROM ordering_modifier_groups WHERE id = ANY($1::uuid[])`,
      [[targetId, ...sourceIds]],
    );
    const existingIds = new Set(existing.rows.map((row) => String(row.id)));
    if (!existingIds.has(targetId)) throw new Error("Canonical modifier group was not found");
    const missing = sourceIds.filter((id) => !existingIds.has(id));
    if (missing.length) throw new Error(`Duplicate modifier group not found: ${missing.join(", ")}`);

    const targetOptions = await client.query(
      `SELECT id,LOWER(TRIM(name_en)) AS normalized_name FROM ordering_item_modifiers WHERE modifier_group_id=$1`,
      [targetId],
    );
    const optionNames = new Set(targetOptions.rows.map((row) => String(row.normalized_name || "")));

    let assignmentsMoved = 0;
    let optionsMoved = 0;
    let duplicateOptionsArchived = 0;

    for (const sourceId of sourceIds) {
      const assignmentResult = await client.query(
        `INSERT INTO ordering_modifier_group_items(modifier_group_id,menu_item_id,sort_order)
         SELECT $1,menu_item_id,sort_order
         FROM ordering_modifier_group_items
         WHERE modifier_group_id=$2
         ON CONFLICT DO NOTHING`,
        [targetId, sourceId],
      );
      assignmentsMoved += assignmentResult.rowCount || 0;

      if (mergeUniqueOptions) {
        const sourceOptions = await client.query(
          `SELECT id,name_en,LOWER(TRIM(name_en)) AS normalized_name
           FROM ordering_item_modifiers
           WHERE modifier_group_id=$1
           ORDER BY sort_order,name_en`,
          [sourceId],
        );
        for (const option of sourceOptions.rows) {
          const normalized = String(option.normalized_name || "");
          if (normalized && !optionNames.has(normalized)) {
            await client.query(
              `UPDATE ordering_item_modifiers SET modifier_group_id=$2,updated_at=NOW() WHERE id=$1`,
              [option.id, targetId],
            );
            optionNames.add(normalized);
            optionsMoved += 1;
          } else {
            await client.query(
              `UPDATE ordering_item_modifiers SET is_active=false,updated_at=NOW() WHERE id=$1`,
              [option.id],
            );
            duplicateOptionsArchived += 1;
          }
        }
      }

      await client.query(`DELETE FROM ordering_modifier_group_items WHERE modifier_group_id=$1`, [sourceId]);
      await client.query(
        `UPDATE ordering_modifier_groups SET is_active=false,updated_at=NOW() WHERE id=$1`,
        [sourceId],
      );
    }

    await client.query(`UPDATE ordering_modifier_groups SET is_active=true,updated_at=NOW() WHERE id=$1`, [targetId]);
    await client.query("COMMIT");

    return {
      ok: true,
      targetGroupId: targetId,
      archivedGroupIds: sourceIds,
      assignmentsMoved,
      optionsMoved,
      duplicateOptionsArchived,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
`;
  write(servicePath, service);
}

// 2) API route.
const routesPath = "server/routes/menu/menuV3Routes.ts";
let routes = read(routesPath);
if (!routes.includes("mergeModifierGroups")) {
  routes = replaceRequired(
    routes,
    "  createModifier, updateModifier, deleteModifier, applyGroupToItem, setGroupAssignments\n",
    "  createModifier, updateModifier, deleteModifier, applyGroupToItem, setGroupAssignments, mergeModifierGroups\n",
    "modifier service import",
  );
  routes = replaceRequired(
    routes,
    'router.post("/modifiers/groups/delete", async (req, res) => res.json(await deleteModifierGroup(req.body.id)));',
    'router.post("/modifiers/groups/delete", async (req, res) => res.json(await deleteModifierGroup(req.body.id)));\nrouter.post("/modifiers/groups/merge", async (req, res) => {\n  const sourceGroupIds = Array.isArray(req.body?.sourceGroupIds) ? req.body.sourceGroupIds.map(String) : [];\n  return res.json(await mergeModifierGroups(String(req.body?.targetGroupId || ""), sourceGroupIds, req.body?.mergeUniqueOptions !== false));\n});',
    "modifier merge route",
  );
  write(routesPath, routes);
}

// 3) Modifier Library duplicate workflow.
const uiPath = "client/src/pages/menu/ModifierManager.tsx";
let ui = read(uiPath);

if (!ui.includes("duplicateClusters")) {
  ui = replaceRequired(
    ui,
    "  const options = selectedGroup?.options || selectedGroup?.modifiers || [];\n",
    `  const options = selectedGroup?.options || selectedGroup?.modifiers || [];
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
`,
    "duplicate cluster calculation",
  );
}

if (!ui.includes("const mergeGroups = useMutation")) {
  ui = replaceRequired(
    ui,
    "  const saveOption = useMutation({\n",
    `  const mergeGroups = useMutation({
    mutationFn: ({ targetGroupId, sourceGroupIds }: { targetGroupId: string; sourceGroupIds: string[] }) => apiRequest("/api/menu-v3/modifiers/groups/merge", {
      method: "POST",
      body: JSON.stringify({ targetGroupId, sourceGroupIds, mergeUniqueOptions }),
    }),
    onSuccess: async (result: any) => {
      if (result?.targetGroupId) setSelectedGroupId(String(result.targetGroupId));
      await refresh();
      setMessage(`Duplicate groups archived. ${Number(result?.assignmentsMoved || 0)} product link(s) and ${Number(result?.optionsMoved || 0)} unique option(s) moved.`);
    },
  });

  const saveOption = useMutation({
`,
    "merge mutation",
  );
}

ui = ui.replace(
  "  const busy = createGroup.isPending || updateGroup.isPending || deleteGroup.isPending || saveOption.isPending || deleteOption.isPending;",
  "  const busy = createGroup.isPending || updateGroup.isPending || deleteGroup.isPending || mergeGroups.isPending || saveOption.isPending || deleteOption.isPending;",
);
ui = ui.replace(
  "  const mutationError = createGroup.error || updateGroup.error || deleteGroup.error || saveOption.error || deleteOption.error;",
  "  const mutationError = createGroup.error || updateGroup.error || deleteGroup.error || mergeGroups.error || saveOption.error || deleteOption.error;",
);

if (!ui.includes("Duplicate modifier groups detected")) {
  ui = replaceRequired(
    ui,
    '    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}\n\n    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">',
    `    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}

    {duplicateClusters.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-semibold text-amber-950">Duplicate modifier groups detected</h2><p className="mt-1 text-xs text-amber-800">Choose which group to keep. Product assignments are moved and the other groups are archived, not deleted.</p></div>
        <label className="flex items-center gap-2 text-xs text-amber-900"><input type="checkbox" checked={mergeUniqueOptions} onChange={(event) => setMergeUniqueOptions(event.target.checked)} /> Move unique options into the kept group</label>
      </div>
      <div className="mt-4 space-y-3">{duplicateClusters.map((cluster) => <div key={cluster.map((group) => group.id).join("-")} className="rounded-xl border border-amber-200 bg-white p-3">
        <div className="text-sm font-semibold text-slate-950">{cluster[0].name} <span className="ml-2 text-xs font-normal text-slate-500">{cluster.length} copies</span></div>
        <div className="mt-3 flex flex-wrap gap-2">{cluster.map((group) => {
          const usage = group.linkedMenuItemIds?.length || group.linkedMenuItemNames?.length || 0;
          const sourceIds = cluster.filter((candidate) => candidate.id !== group.id).map((candidate) => candidate.id);
          return <button key={group.id} type="button" disabled={busy} onClick={() => {
            const affected = sourceIds.length;
            if (window.confirm(`Keep this copy of "${group.name}" and archive ${affected} duplicate group${affected === 1 ? "" : "s"}? All product links will move to the kept group.`)) mergeGroups.mutate({ targetGroupId: group.id, sourceGroupIds: sourceIds });
          }} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-950 disabled:opacity-40">
            <strong>Keep this group</strong><span className="ml-2">{usage} product{usage === 1 ? "" : "s"} · {(group.options || group.modifiers || []).length} options</span>
          </button>;
        })}</div>
      </div>)}</div>
    </section>}

    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">`,
    "duplicate merge panel",
  );
}

write(uiPath, ui);
console.log("Modifier duplicate merge and archive workflow applied successfully.");
