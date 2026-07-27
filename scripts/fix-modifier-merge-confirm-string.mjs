import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "client/src/pages/menu/ModifierManager.tsx");
let source = fs.readFileSync(file, "utf8");

const broken = 'if (window.confirm("Keep this copy of "" + group.name + "" and archive " + affected + " duplicate group" + (affected === 1 ? "" : "s") + "? All product links will move to the kept group.")) mergeGroups.mutate({ targetGroupId: group.id, sourceGroupIds: sourceIds });';
const fixed = 'if (window.confirm(`Keep this copy of "${group.name}" and archive ${affected} duplicate group${affected === 1 ? "" : "s"}? All product links will move to the kept group.`)) mergeGroups.mutate({ targetGroupId: group.id, sourceGroupIds: sourceIds });';

if (!source.includes(broken)) {
  if (source.includes(fixed)) {
    console.log("Modifier merge confirmation string is already fixed.");
    process.exit(0);
  }
  throw new Error("Broken modifier merge confirmation string not found");
}

source = source.replace(broken, fixed);
fs.writeFileSync(file, source);
console.log("Modifier merge confirmation string fixed successfully.");
