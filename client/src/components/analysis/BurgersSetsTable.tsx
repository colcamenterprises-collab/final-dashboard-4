/**
 * BurgersSetsTable — Burgers & Sets Sales-to-Bun-Usage Table
 *
 * PATCH 1: SKU | Item Name | POS Category | Sold Count | Buns Used | Notes
 * Buns Used = Sold Count (1 bun per burger/set, no recipe logic yet)
 *
 * Does NOT touch drinks logic, drinks UI, or drinks reconciliation.
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
    <th
      className={`px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  );
}

function Td({ children, right, muted }: { children: React.ReactNode; right?: boolean; muted?: boolean }) {
  return (
    <td
      className={`px-3 py-2 text-xs border-b border-gray-100 ${right ? 'text-right tabular-nums' : 'text-left'} ${muted ? 'text-gray-400' : 'text-gray-800'}`}
    >
      {children}
    </td>
  );
}

// Category display badge colours
function CategoryBadge({ category }: { category: string }) {
  const lower = category.toLowerCase();
  let cls = 'bg-gray-100 text-gray-600';
  if (lower.includes('smash burger sets') || lower.includes('burger sets')) {
    cls = 'bg-blue-50 text-blue-700';
  } else if (lower.includes('smash burgers') || lower === 'burgers') {
    cls = 'bg-amber-50 text-amber-700';
  } else if (lower.includes('kids')) {
    cls = 'bg-green-50 text-green-700';
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {category}
    </span>
  );
}

function NotesBadge({ notes }: { notes: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700">
      {notes}
    </span>
  );
}

export default function BurgersSetsTable({ date }: { date: string }) {
  const { data: resp, isLoading, isError, error } = useQuery<BurgersResponse>({
    queryKey: ['/api/analysis/burgers-sets', date],
    queryFn: () =>
      fetch(`/api/analysis/burgers-sets?date=${date}`).then((r) => r.json()),
    enabled: !!date,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-500 animate-pulse">
        Loading Burgers &amp; Sets…
      </div>
    );
  }

  if (isError || !resp?.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        Failed to load Burgers &amp; Sets data:{' '}
        {(error as Error)?.message ?? resp?.error ?? 'Unknown error'}
      </div>
    );
  }

  const rows = resp.data ?? [];
  const totalSold = rows.reduce((s, r) => s + r.sold_count, 0);
  const totalBuns = rows.reduce((s, r) => s + r.buns_used, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-800">
          Burgers &amp; Sets — Sales &amp; Bun Usage
        </span>
        <span className="text-xs text-gray-400">{date}</span>
      </div>

      {rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-gray-400">
          No burger or set data found for {date}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>Item Name</Th>
                <Th>POS Category</Th>
                <Th right>Sold Count</Th>
                <Th right>Buns Used</Th>
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.sku ?? 'nosku'}-${row.item_name}-${idx}`} className="hover:bg-gray-50">
                  <Td muted>{row.sku ?? '—'}</Td>
                  <Td>{row.item_name}</Td>
                  <Td>
                    <CategoryBadge category={row.pos_category} />
                  </Td>
                  <Td right>{row.sold_count}</Td>
                  <Td right>{row.buns_used}</Td>
                  <Td>
                    {row.notes ? <NotesBadge notes={row.notes} /> : null}
                  </Td>
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-300">
                <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-700 text-right">
                  Total
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-gray-900 text-right tabular-nums">
                  {totalSold}
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-gray-900 text-right tabular-nums">
                  {totalBuns}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
