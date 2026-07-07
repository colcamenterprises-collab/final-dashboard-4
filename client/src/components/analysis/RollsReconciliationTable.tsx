import { useQuery } from '@tanstack/react-query';

type RollsReconciliationResponse = {
  ok: boolean;
  date: string;
  status: 'complete' | 'partial';
  missing?: string[];
  previous_shift_date?: string | null;
  data?: {
    previous: number | null;
    purchased: number | null;
    used: number | null;
    expected: number | null;
    actual: number | null;
    variance: number | null;
    status: 'OK' | 'FLAG' | null;
  };
  error?: string;
};

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200 ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
}

function Td({ children, right, flag }: { children: React.ReactNode; right?: boolean; flag?: boolean }) {
  return <td className={`px-3 py-2 text-xs border-b border-slate-100 ${right ? 'text-right tabular-nums' : 'text-left'} ${flag ? 'text-red-700 font-semibold bg-red-50' : 'text-slate-700'}`}>{children}</td>;
}

function cell(value: number | string | null | undefined) {
  return value === null || typeof value === 'undefined' ? 'Missing data' : value;
}

export default function RollsReconciliationTable({ date }: { date: string }) {
  const { data: resp, isLoading, isError, error } = useQuery<RollsReconciliationResponse>({
    queryKey: ['/api/analysis/rolls-reconciliation', date],
    queryFn: () => fetch(`/api/analysis/rolls-reconciliation?date=${date}`).then((r) => r.json()),
    enabled: !!date,
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500">Loading Rolls Reconciliation…</div>;
  }

  if (isError || !resp?.ok) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">Failed to load Rolls Reconciliation: {(error as Error)?.message ?? resp?.error ?? 'Unknown error'}</div>;
  }

  const row = resp.data;
  const flagged = row?.variance !== null && row?.variance !== undefined && row.variance !== 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
        <div>
          <p className="text-sm font-semibold text-slate-800">Rolls Reconciliation</p>
          <p className="text-[10px] text-slate-400">1 burger sold = 1 roll used{resp.previous_shift_date ? ` · Previous stock: ${resp.previous_shift_date}` : ''}</p>
        </div>
        <span className="text-xs text-slate-400">{date}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
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
            <tr className="hover:bg-slate-50/60">
              <Td right>{cell(row?.previous)}</Td>
              <Td right>{cell(row?.purchased)}</Td>
              <Td right>{cell(row?.used)}</Td>
              <Td right>{cell(row?.expected)}</Td>
              <Td right>{cell(row?.actual)}</Td>
              <Td right flag={flagged}>{cell(row?.variance)}</Td>
              <Td flag={flagged}>{cell(row?.status)}</Td>
            </tr>
          </tbody>
        </table>
      </div>
      {resp.missing && resp.missing.length > 0 && (
        <div className="px-4 py-2 border-t border-amber-100 bg-amber-50 text-[10px] text-amber-800">
          Missing data: {resp.missing.join(', ')}
        </div>
      )}
    </div>
  );
}
