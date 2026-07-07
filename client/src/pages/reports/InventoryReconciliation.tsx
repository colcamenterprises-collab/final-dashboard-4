import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

type Status = 'OK' | 'FLAG' | 'Missing Data';

type Blocker = {
  code: string;
  message: string;
  where: string;
  canonical_source: string;
  auto_build_attempted: boolean;
};

type Row = {
  item: string;
  previous: number | null;
  purchased: number | null;
  used: number | null;
  expected: number | null;
  actual: number | null;
  variance: number | null;
  status: Status;
  blockers: Blocker[];
};

type Response = {
  ok: boolean;
  source: string[];
  scope: { date: string };
  status: 'complete' | 'partial';
  data: Row[];
  warnings: string[];
  blockers: Blocker[];
  last_updated: string;
  error?: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatCell(value: number | null) {
  return value === null ? 'Missing Data' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200 bg-slate-50 ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
}

function Td({ children, right, flagged, missing }: { children: React.ReactNode; right?: boolean; flagged?: boolean; missing?: boolean }) {
  return <td className={`px-3 py-2 text-sm border-b border-slate-100 ${right ? 'text-right tabular-nums' : 'text-left'} ${flagged ? 'bg-red-50 text-red-700 font-semibold' : missing ? 'bg-amber-50 text-amber-800' : 'text-slate-700'}`}>{children}</td>;
}

export default function InventoryReconciliation() {
  const [date, setDate] = useState(todayISO());
  const { data, isLoading, error } = useQuery<Response>({
    queryKey: ['/api/analysis/inventory-reconciliation', date],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/inventory-reconciliation?date=${date}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Inventory reconciliation request failed');
      return body;
    },
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(date),
  });

  const blockers = useMemo(() => data?.blockers ?? [], [data]);

  return (
    <main className="p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventory Reconciliation</h1>
          <p className="text-sm text-slate-500">Expected = Previous + Purchased - Used. Variance = Actual - Expected.</p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          Shift date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {isLoading && <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading reconciliation.</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{(error as Error).message}</div>}

      {data?.ok && (
        <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-800">Tracked inventory items</div>
            <div className="text-xs text-slate-500">Sources: {data.source.join(', ')}</div>
            <div className="text-xs text-slate-500">Last updated: {new Date(data.last_updated).toLocaleString()}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th right>Previous</Th>
                  <Th right>Purchased</Th>
                  <Th right>Used</Th>
                  <Th right>Expected</Th>
                  <Th right>Actual</Th>
                  <Th right>Variance</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row) => {
                  const flagged = row.status === 'FLAG';
                  const missing = row.status === 'Missing Data';
                  return (
                    <tr key={row.item}>
                      <Td missing={missing}>{row.item}</Td>
                      <Td right missing={row.previous === null}>{formatCell(row.previous)}</Td>
                      <Td right missing={row.purchased === null}>{formatCell(row.purchased)}</Td>
                      <Td right missing={row.used === null}>{formatCell(row.used)}</Td>
                      <Td right missing={row.expected === null}>{formatCell(row.expected)}</Td>
                      <Td right missing={row.actual === null}>{formatCell(row.actual)}</Td>
                      <Td right flagged={flagged} missing={row.variance === null}>{formatCell(row.variance)}</Td>
                      <Td flagged={flagged} missing={missing}>{row.status}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {blockers.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Missing data blockers</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Message</Th>
                  <Th>Where</Th>
                  <Th>Canonical source</Th>
                </tr>
              </thead>
              <tbody>
                {blockers.map((blocker, index) => (
                  <tr key={`${blocker.code}-${index}`}>
                    <Td>{blocker.code}</Td>
                    <Td>{blocker.message}</Td>
                    <Td>{blocker.where}</Td>
                    <Td>{blocker.canonical_source}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
