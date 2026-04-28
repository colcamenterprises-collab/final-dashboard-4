import { useQuery } from '@tanstack/react-query';

interface DrinkModifierRow {
  modifier_name: string;
  sku: string;
  display_name: string;
  total: number;
}

interface DrinkModifiersResponse {
  ok: boolean;
  date: string;
  source: string;
  total_drink_modifiers: number;
  data: DrinkModifierRow[];
  unmapped_drink_modifiers: string[];
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, right, bold, muted }: { children: React.ReactNode; right?: boolean; bold?: boolean; muted?: boolean }) {
  return (
    <td className={`px-3 py-2 text-xs border-b border-slate-100 ${right ? 'text-right tabular-nums' : 'text-left'} ${bold ? 'font-semibold text-slate-900' : muted ? 'text-slate-400' : 'text-slate-700'}`}>
      {children}
    </td>
  );
}

export function DrinkModifiersTable({ date }: { date: string }) {
  const { data, isLoading, isError } = useQuery<DrinkModifiersResponse>({
    queryKey: ['/api/analysis/drink-modifiers', date],
    queryFn: () => fetch(`/api/analysis/drink-modifiers?date=${date}`).then((r) => r.json()),
    enabled: !!date,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />)}
      </div>
    );
  }

  if (isError || !data?.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        Failed to load drink modifier data.
      </div>
    );
  }

  const rows = data.data ?? [];
  const total = data.total_drink_modifiers ?? 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <span className="text-sm font-semibold text-slate-800">Drink Modifiers</span>
        <span className="text-xs text-slate-400">{date}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <Th>Modifier Name (Loyverse)</Th>
              <Th>SKU</Th>
              <Th>Mapped Item</Th>
              <Th right>Count</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-xs text-slate-400">
                  No drink modifier data for this date
                </td>
              </tr>
            ) : (
              <>
                {rows.map((row, idx) => (
                  <tr key={`${row.sku}-${idx}`} className="hover:bg-slate-50/60">
                    <Td>{row.modifier_name}</Td>
                    <Td muted>{row.sku}</Td>
                    <Td>{row.display_name}</Td>
                    <Td right bold>{row.total}</Td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-slate-700">Total drink modifiers</td>
                <td className="px-3 py-2 text-xs font-semibold text-right tabular-nums text-slate-900">{total}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] text-slate-400">Source: {data.source}</p>
        {data.unmapped_drink_modifiers.length > 0 && (
          <p className="text-[10px] text-amber-600">
            ⚠ Unmapped: {data.unmapped_drink_modifiers.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
