import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "client/src/pages/menu/MenuItemEditor.tsx");
let source = fs.readFileSync(file, "utf8");

const replacements = [
  [
    'return <div className="fixed inset-0 z-50 bg-black/45 p-0 sm:p-3" onClick={onClose}>',
    'return <div className="fixed inset-0 z-50 bg-slate-100" onClick={onClose}>'
  ],
  [
    '<div className="mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden bg-slate-50 shadow-2xl sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>',
    '<div className="flex h-full w-full flex-col overflow-hidden bg-slate-50" onClick={(event) => event.stopPropagation()}>'
  ],
  [
    '<header className="flex items-center justify-between gap-4 border-b bg-white px-4 py-3 sm:px-6">',
    '<header className="flex min-h-[72px] items-center justify-between gap-4 border-b bg-white px-4 py-3 sm:px-6 lg:px-8">'
  ],
  [
    '<div className="flex-1 overflow-y-auto p-4 sm:p-5">',
    '<div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">'
  ],
  [
    '<div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_360px]">',
    '<div className="mx-auto grid w-full max-w-[1800px] gap-5 xl:grid-cols-[320px_minmax(0,1fr)_380px] 2xl:grid-cols-[360px_minmax(0,1fr)_420px]">'
  ],
  [
    '<footer className="border-t bg-white px-4 py-3 sm:px-6"><div className="mx-auto flex max-w-[1500px] flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">',
    '<footer className="border-t bg-white px-4 py-3 sm:px-6 lg:px-8"><div className="mx-auto flex w-full max-w-[1800px] flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">'
  ]
];

let changed = false;
for (const [search, replacement] of replacements) {
  if (source.includes(replacement)) continue;
  if (!source.includes(search)) throw new Error(`Product Builder V2 anchor not found: ${search.slice(0, 80)}`);
  source = source.replace(search, replacement);
  changed = true;
}

if (!changed) {
  console.log("Product Builder full-screen V2 already applied.");
  process.exit(0);
}

fs.writeFileSync(file, source);
console.log("Product Builder full-screen V2 applied successfully.");
