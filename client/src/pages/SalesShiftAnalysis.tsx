import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface ShiftData {
  total?: number;
  cash?: number;
  qr?: number;
  grab?: number;
  other?: number;
  exp_cash?: number;
  exp?: number;
}

interface ShiftSnapshotRow {
  date: string;
  approved: boolean;
  pos_data?: ShiftData;
  form_data?: ShiftData;
}

const categories: Array<{ key: keyof ShiftData; label: string }> = [
  { key: 'total', label: 'Total' },
  { key: 'cash', label: 'Cash' },
  { key: 'qr', label: 'QR' },
  { key: 'grab', label: 'Grab' },
  { key: 'other', label: 'Other' },
  { key: 'exp_cash', label: 'Exp Cash' },
  { key: 'exp', label: 'Exp' },
];

const toNumber = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const todayBkk = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function SalesShiftAnalysis() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayBkk);
  const [notes, setNotes] = useState('');
  const [cashBanked, setCashBanked] = useState('0');
  const [qrBanked, setQrBanked] = useState('0');

  const managerName = 'dashboard';

  const { data: formData, isLoading: formLoading } = useQuery<ShiftData>({
    queryKey: ['daily-sales', selectedDate],
    queryFn: () => getJson(`/api/daily-sales-v2/${selectedDate}`),
  });

  const { data: posData, isLoading: posLoading } = useQuery<ShiftData>({
    queryKey: ['pos-shift', selectedDate],
    queryFn: () => getJson(`/api/pos-shift/${selectedDate}`),
  });

  const { data: allShifts } = useQuery<ShiftSnapshotRow[]>({
    queryKey: ['shift-snapshots'],
    queryFn: () => getJson('/api/shift-snapshots'),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/approve-shift', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'manager',
          'x-user-id': managerName,
        },
        body: JSON.stringify({
          date: selectedDate,
          cash_banked: toNumber(cashBanked),
          qr_banked: toNumber(qrBanked),
          notes,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pnl'] });
      queryClient.invalidateQueries({ queryKey: ['shift-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['pos-shift', selectedDate] });
      alert('Shift approved successfully');
    },
  });

  const rows = useMemo(() => {
    return categories.map(({ key, label }) => {
      const form = toNumber(formData?.[key]);
      const pos = toNumber(posData?.[key]);
      const diff = Math.abs(form - pos);
      const flagged = diff > Math.max(5, pos * 0.05);
      return { label, form, pos, diff, flagged };
    });
  }, [formData, posData]);

  if (formLoading || posLoading) {
    return <div className="p-6">Loading shift comparison...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex gap-3 items-center">
        <h1 className="text-2xl font-semibold">Sales Shift Analysis</h1>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border rounded px-2 py-1" />
      </div>

      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Category</th>
            <th className="border p-2 text-right">Form Value</th>
            <th className="border p-2 text-right">POS Value</th>
            <th className="border p-2 text-right">Difference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.flagged ? 'bg-red-50' : ''}>
              <td className="border p-2">{r.label}</td>
              <td className="border p-2 text-right">{r.form.toFixed(2)}</td>
              <td className="border p-2 text-right">{r.pos.toFixed(2)}</td>
              <td className={`border p-2 text-right ${r.flagged ? 'text-red-600 font-semibold' : ''}`}>{r.diff.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid md:grid-cols-2 gap-4 border rounded p-4">
        <label className="flex flex-col gap-1">
          Manager Name
          <input value={managerName} readOnly className="border rounded px-2 py-1 bg-gray-100" />
        </label>
        <label className="flex flex-col gap-1">
          Cash Banked
          <input type="number" value={cashBanked} onChange={(e) => setCashBanked(e.target.value)} className="border rounded px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          QR Banked
          <input type="number" value={qrBanked} onChange={(e) => setQrBanked(e.target.value)} className="border rounded px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="border rounded px-2 py-1 min-h-20" />
        </label>
        <button
          className="bg-black text-white px-4 py-2 rounded w-fit"
          onClick={() => approveMutation.mutate()}
          disabled={approveMutation.isPending}
        >
          Approve &amp; Close Shift
        </button>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">All Shifts Data</h2>
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Date</th>
              <th className="border p-2 text-left">Approved</th>
              <th className="border p-2 text-right">POS Total</th>
              <th className="border p-2 text-right">Form Total</th>
            </tr>
          </thead>
          <tbody>
            {(allShifts || []).map((row) => (
              <tr key={row.date}>
                <td className="border p-2">{row.date}</td>
                <td className="border p-2">{row.approved ? 'Yes' : 'No'}</td>
                <td className="border p-2 text-right">{toNumber(row.pos_data?.total).toFixed(2)}</td>
                <td className="border p-2 text-right">{toNumber(row.form_data?.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
