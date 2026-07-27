import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appPath = path.join(root, 'client/src/App.tsx');
const formsPath = path.join(root, 'server/routes/forms.ts');
const pagePath = path.join(root, 'client/src/pages/operations/ShiftOpen.tsx');

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); }
function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not apply ${label}: source block not found`);
  return source.replace(search, replacement);
}

const page = `import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ShiftOpen() {
  const navigate = useNavigate();
  const [completedBy, setCompletedBy] = useState("");
  const [startingCash, setStartingCash] = useState("2500");
  const [active, setActive] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadActive = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/forms/active-shift");
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Could not check active shift");
      setActive(result?.shift || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check active shift");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadActive(); }, []);

  const startShift = async () => {
    if (!completedBy.trim()) { setError("Enter the staff member opening the shift."); return; }
    const float = Number(startingCash);
    if (!Number.isFinite(float) || float < 0) { setError("Starting cash must be a valid non-negative amount."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/forms/open-shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedBy: completedBy.trim(), startingCash: float }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Could not open shift");
      const context = {
        shiftId: String(result.shift.id),
        salesId: String(result.shift.id),
        staffName: result.shift.completedBy,
        startingCash: Number(result.shift.startingCash || 0),
        shiftDate: result.shift.shiftDate,
        status: "OPEN",
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem("daily_shift_workflow_context", JSON.stringify(context));
      navigate("/operations/daily-sales");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open shift");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="mx-auto max-w-3xl p-6 text-sm">Checking active shift…</div>;

  return <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
    <div>
      <h1 className="text-2xl font-semibold text-slate-950">Open Shift</h1>
      <p className="mt-1 text-sm text-slate-500">Start the Bangkok trading shift before taking orders.</p>
    </div>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

    {active ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Shift already open</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-950">{active.shiftDate}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-slate-500">Opened by</span><p className="font-semibold">{active.completedBy || "—"}</p></div>
        <div><span className="text-slate-500">Starting cash</span><p className="font-semibold">฿{Number(active.startingCash || 0).toLocaleString("en-TH")}</p></div>
      </div>
      <button onClick={() => navigate("/operations/daily-sales")} className="mt-5 w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white">Continue current shift</button>
    </section> : <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <label className="block text-sm font-medium text-slate-800">Opened by
        <input value={completedBy} onChange={(e) => setCompletedBy(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base" placeholder="Staff name" />
      </label>
      <label className="block text-sm font-medium text-slate-800">Starting cash (THB)
        <input type="number" min="0" value={startingCash} onChange={(e) => setStartingCash(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base" />
      </label>
      <button disabled={saving} onClick={() => void startShift()} className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Opening shift…" : "Open shift"}</button>
    </section>}
  </div>;
}
`;
write(pagePath, page);

let app = read(appPath);
if (!app.includes('import ShiftOpen from "./pages/operations/ShiftOpen";')) {
  app = replaceRequired(app,
    'import DailySalesForm from "./pages/operations/daily-sales/Form";',
    'import DailySalesForm from "./pages/operations/daily-sales/Form";\nimport ShiftOpen from "./pages/operations/ShiftOpen";',
    'ShiftOpen import');
}
if (!app.includes('path="/operations/shift-open"')) {
  app = replaceRequired(app,
    '<Route path="/operations/daily-sales" element={<ProtectedRoute><DailySalesForm /></ProtectedRoute>} />',
    '<Route path="/operations/shift-open" element={<ProtectedRoute><ShiftOpen /></ProtectedRoute>} />\n                    <Route path="/operations/daily-sales" element={<ProtectedRoute><DailySalesForm /></ProtectedRoute>} />',
    'ShiftOpen route');
}
write(appPath, app);

let forms = read(formsPath);
const marker = '// GET /api/forms - List all submitted forms for the library';
if (!forms.includes('router.get("/active-shift"')) {
  const endpoints = `function bangkokShiftDate(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const date = \`${'${get("year")}-${get("month")}-${get("day")}'}\`;
  if (Number(get("hour")) >= 3) return date;
  const previous = new Date(\`${'${date}'}T00:00:00+07:00\`);
  previous.setDate(previous.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(previous);
}

router.get("/active-shift", async (_req, res) => {
  try {
    const shiftDate = bangkokShiftDate();
    const result: any = await drizzleDb.execute(sql\`
      SELECT id, "shiftDate", "completedBy", "startingCash", "createdAt", payload
      FROM daily_sales_v2
      WHERE COALESCE("shiftDate"::date, shift_date::date) = \${shiftDate}::date
        AND "deletedAt" IS NULL
        AND COALESCE(payload->>'shiftStatus', payload->>'status', '') = 'OPEN'
      ORDER BY "createdAt" DESC
      LIMIT 1
    \`);
    const row = ((result as any).rows || result)?.[0] || null;
    res.json({ ok: true, shift: row ? { id: row.id, shiftDate: row.shiftDate, completedBy: row.completedBy, startingCash: row.startingCash, createdAt: row.createdAt } : null });
  } catch (error) {
    console.error('[active-shift] failed', error);
    res.status(500).json({ ok: false, error: 'Failed to check active shift' });
  }
});

router.post("/open-shift", async (req, res) => {
  try {
    const completedBy = String(req.body?.completedBy || '').trim();
    const startingCash = Number(req.body?.startingCash);
    if (!completedBy) return res.status(400).json({ ok: false, error: 'Opened by is required' });
    if (!Number.isFinite(startingCash) || startingCash < 0) return res.status(400).json({ ok: false, error: 'Starting cash must be non-negative' });

    const shiftDate = bangkokShiftDate();
    const existing: any = await drizzleDb.execute(sql\`
      SELECT id, "shiftDate", "completedBy", "startingCash", "createdAt"
      FROM daily_sales_v2
      WHERE COALESCE("shiftDate"::date, shift_date::date) = \${shiftDate}::date
        AND "deletedAt" IS NULL
        AND COALESCE(payload->>'shiftStatus', payload->>'status', '') = 'OPEN'
      ORDER BY "createdAt" DESC
      LIMIT 1
    \`);
    const existingRow = ((existing as any).rows || existing)?.[0];
    if (existingRow) return res.status(409).json({ ok: false, error: 'A shift is already open', shift: existingRow });

    const id = crypto.randomUUID();
    const now = new Date();
    const payload = { shiftStatus: 'OPEN', status: 'OPEN', openedAt: now.toISOString(), openedBy: completedBy, startingCash };
    await drizzleDb.execute(sql\`
      INSERT INTO daily_sales_v2 (
        id, "shiftDate", shift_date, "completedBy", "createdAt", "submittedAtISO",
        "startingCash", "endingCash", "cashBanked", "cashSales", "qrSales", "grabSales", "aroiSales",
        "totalSales", "shoppingTotal", "wagesTotal", "othersTotal", "totalExpenses", "qrTransfer",
        "grab_receipt_count", "cash_receipt_count", "qr_receipt_count", payload
      ) VALUES (
        \${id}, \${shiftDate}, \${shiftDate}::date, \${completedBy}, \${now}, \${now},
        \${Math.round(startingCash)}, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, \${JSON.stringify(payload)}::jsonb
      )
    \`);
    res.status(201).json({ ok: true, shift: { id, shiftDate, completedBy, startingCash: Math.round(startingCash), status: 'OPEN' } });
  } catch (error) {
    console.error('[open-shift] failed', error);
    res.status(500).json({ ok: false, error: 'Failed to open shift' });
  }
});

`;
  forms = replaceRequired(forms, marker, endpoints + marker, 'shift API endpoints');
}
write(formsPath, forms);

console.log('Shift Open workflow installed.');
console.log('- Route: /operations/shift-open');
console.log('- API: GET /api/forms/active-shift');
console.log('- API: POST /api/forms/open-shift');
