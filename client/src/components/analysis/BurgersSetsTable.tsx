/**
 * BurgersSetsTable — Burgers & Sets Sales-to-Bun-Usage Table
 */

import { useQuery } from '@tanstack/react-query';

type BurgersRow = {
  sku: string | null;
  item_name: string;
  pos_category: string;
  sold_count: number;
  buns_used: number;
  notes: string | null;
};

type BurgersResponse = {
  ok: boolean;
  date: string;
  row_count: number;
  data: BurgersRow[];
  error?: string;
};

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, right, muted, bold }: { children: React.ReactNode; right?: boolean; muted?: boolean; bold?: boolean }) {
  return (
    <td className={`px-3 py-2 text-xs border-b border-slate-100 ${right ? 'text-right tabular-nums' : 'text-left'} ${muted ? 'text-slate-400' : bold ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
      {children}
    </td>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const lower = category.toLowerCase();
  let cls = 'bg-slate-100 text-slate-600';
  if (lower.includes('smash burger sets') || lower.includes('burger sets')) {
    cls = 'bg-blue-50 text-blue-700';
  } else if (lower.includes('smash burgers') || lower === 'burgers') {
    cls = 'bg-amber-50 text-amber-700';
  } else if (lower.includes('kids')) {
    cls = 'bg-emerald-50 text-emerald-700';
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${cls}`}>
      {category}
    </span>
  );
}

export default function BurgersSetsTable({ date }: { date: string }) {
  const { data: resp, isLoading, isError, error } = useQuery<BurgersResponse>({
    queryKey: ['/api/analysis/burgers-sets', date],
    queryFn: () => fetch(`/api/analysis/burgers-sets?date=${date}`).then((r) => r.json()),
    enabled: !!date,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />)}
      </div>
    );
  }

  if (isError || !resp?.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        Failed to load Burgers &amp; Sets data: {(error as Error)?.message ?? resp?.error ?? 'Unknown error'}
      </div>
    );
  }

  const rows = resp.data ?? [];
  const totalSold = rows.reduce((s, r) => s + r.sold_count, 0);
  const totalBuns = rows.reduce((s, r) => s + r.buns_used, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <span className="text-sm font-semibold text-slate-800">Burgers &amp; Sets — Sales &amp; Bun Usage</span>
        <span className="text-xs text-slate-400">{date}</span>
      </div>

      {rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400">No burger or set data found for {date}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>Item Name</Th>
                <Th>POS Category</Th>
                <Th right>Sold</Th>
                <Th right>Buns Used</Th>
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.sku ?? 'nosku'}-${row.item_name}-${idx}`} className="hover:bg-slate-50/60">
                  <Td muted>{row.sku ?? '—'}</Td>
                  <Td bold>{row.item_name}</Td>
                  <Td><CategoryBadge category={row.pos_category} /></Td>
                  <Td right>{row.sold_count}</Td>
                  <Td right>{row.buns_used}</Td>
                  <Td muted={!row.notes}>{row.notes ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-slate-700 text-right">Total</td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-900 text-right tabular-nums">{totalSold}</td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-900 text-right tabular-nums">{totalBuns}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
