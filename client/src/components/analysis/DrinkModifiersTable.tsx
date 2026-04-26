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
    <th className={`px-2 py-1 text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50 ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Cell({ children, right, bold }: { children: React.ReactNode; right?: boolean; bold?: boolean }) {
  return (
    <td className={`px-2 py-1 text-xs border-b border-gray-50 ${right ? 'text-right' : ''} ${bold ? 'font-semibold' : ''}`}>
      {children}
    </td>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-2 py-3 text-xs text-gray-400 text-center">
        No drink modifier data for this date
      </td>
    </tr>
  );
}

export function DrinkModifiersTable({ date }: { date: string }) {
  const { data, isLoading, isError } = useQuery<DrinkModifiersResponse>({
    queryKey: ['/api/analysis/drink-modifiers', date],
    queryFn: () =>
      fetch(`/api/analysis/drink-modifiers?date=${date}`).then((r) => r.json()),
    enabled: !!date,
  });

  if (isLoading) {
    return <p className="text-xs text-gray-400 py-2">Loading drink modifiers…</p>;
  }
  if (isError || !data?.ok) {
    return <p className="text-xs text-red-500 py-2">Failed to load drink modifier data.</p>;
  }

  const rows = data.data ?? [];
  const total = data.total_drink_modifiers ?? 0;

  return (
    <div className="space-y-1">
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
              <EmptyRow cols={4} />
            ) : (
              <>
                {rows.map((row, idx) => (
                  <tr key={`${row.sku}-${idx}`} className="hover:bg-gray-50">
                    <Cell>{row.modifier_name}</Cell>
                    <Cell>{row.sku}</Cell>
                    <Cell>{row.display_name}</Cell>
                    <Cell right bold>{row.total}</Cell>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={3} className="px-2 py-1 text-xs text-gray-600">Total drink modifiers sold</td>
                  <td className="px-2 py-1 text-xs text-right font-bold">{total}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      {data.unmapped_drink_modifiers.length > 0 && (
        <p className="text-xs text-amber-600 mt-1">
          ⚠ Unmapped drink-like modifiers: {data.unmapped_drink_modifiers.join(', ')}
        </p>
      )}
      <p className="text-xs text-gray-400">Source: {data.source}</p>
    </div>
  );
}
