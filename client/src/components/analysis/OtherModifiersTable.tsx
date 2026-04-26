import { useQuery } from '@tanstack/react-query';

interface OtherModifierRow {
  modifier_name: string;
  total: number;
}

interface OtherModifiersResponse {
  ok: boolean;
  date: string;
  source: string;
  total_other_modifiers: number;
  data: OtherModifierRow[];
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
        No other modifier data for this date
      </td>
    </tr>
  );
}

export function OtherModifiersTable({ date }: { date: string }) {
  const { data, isLoading, isError } = useQuery<OtherModifiersResponse>({
    queryKey: ['/api/analysis/other-modifiers', date],
    queryFn: () =>
      fetch(`/api/analysis/other-modifiers?date=${date}`).then((r) => r.json()),
    enabled: !!date,
  });

  if (isLoading) {
    return <p className="text-xs text-gray-400 py-2">Loading other modifiers…</p>;
  }
  if (isError || !data?.ok) {
    return <p className="text-xs text-red-500 py-2">Failed to load other modifier data.</p>;
  }

  const rows = data.data ?? [];
  const total = data.total_other_modifiers ?? 0;

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <Th>Modifier / Add-on</Th>
              <Th right>Count</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow cols={2} />
            ) : (
              <>
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <Cell>{row.modifier_name}</Cell>
                    <Cell right bold>{row.total}</Cell>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-2 py-1 text-xs text-gray-600">Total other modifiers</td>
                  <td className="px-2 py-1 text-xs text-right font-bold">{total}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">Source: {data.source}</p>
    </div>
  );
}
