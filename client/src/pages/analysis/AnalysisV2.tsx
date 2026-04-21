import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';

type Blocker = {
  code: string;
  message: string;
  where: string;
  canonical_source: string;
  auto_build_attempted: boolean;
};

type AnalysisV2Response = {
  ok: boolean;
  date: string;
  blockers: Blocker[];
  tables: {
    drinks: Array<{ sku: string; soldDirect: number; soldFromModifiers: number; totalSold: number }>;
    burgersAndSets: Array<{ itemName: string; soldCount: number; type: 'Single' | 'Double' | 'Set' }>;
    sideOrders: Array<{ itemName: string; soldCount: number }>;
    modifiers: Array<{ modifierType: string; item: string; count: number }>;
  };
};

function defaultDateUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function Cell({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return <td className={`border px-3 py-2 text-sm ${right ? 'text-right' : ''}`}>{children}</td>;
}

export default function AnalysisV2() {
  const [date, setDate] = useState(defaultDateUTC());

  const { data, isLoading, error } = useQuery<AnalysisV2Response>({
    queryKey: ['/api/analysis/v2', date],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/v2?date=${date}`);
      if (!res.ok) throw new Error('Failed to load Analysis V2');
      return res.json();
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Analysis V2</h1>

      <div className="max-w-xs">
        <label className="mb-1 block text-xs font-medium">Business Date</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {isLoading && <div className="text-sm">Loading…</div>}
      {error && <div className="text-sm text-red-600">{(error as Error).message}</div>}

      {!!data?.blockers?.length && (
        <div className="border border-amber-300 bg-amber-50 p-3 text-sm">
          {data.blockers.map((b) => (
            <div key={`${b.code}-${b.where}`}>
              <strong>{b.code}</strong>: {b.message}
            </div>
          ))}
        </div>
      )}

      {data && (
        <>
          <section>
            <h2 className="mb-2 text-lg font-semibold">1. Drinks</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-3 py-2 text-left text-sm">SKU</th>
                  <th className="border px-3 py-2 text-right text-sm">Sold (Direct)</th>
                  <th className="border px-3 py-2 text-right text-sm">Sold (From Modifiers)</th>
                  <th className="border px-3 py-2 text-right text-sm">Total Sold</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.drinks.map((row) => (
                  <tr key={row.sku}>
                    <Cell>{row.sku}</Cell>
                    <Cell right>{row.soldDirect}</Cell>
                    <Cell right>{row.soldFromModifiers}</Cell>
                    <Cell right>{row.totalSold}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">2. Burgers &amp; Burger Sets</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-3 py-2 text-left text-sm">Item Name</th>
                  <th className="border px-3 py-2 text-right text-sm">Sold Count</th>
                  <th className="border px-3 py-2 text-left text-sm">Type (Single / Double / Set)</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.burgersAndSets.map((row) => (
                  <tr key={`${row.itemName}-${row.type}`}>
                    <Cell>{row.itemName}</Cell>
                    <Cell right>{row.soldCount}</Cell>
                    <Cell>{row.type}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">3. Side Orders</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-3 py-2 text-left text-sm">Item Name</th>
                  <th className="border px-3 py-2 text-right text-sm">Sold Count</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.sideOrders.map((row) => (
                  <tr key={row.itemName}>
                    <Cell>{row.itemName}</Cell>
                    <Cell right>{row.soldCount}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">4. Modifiers</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-3 py-2 text-left text-sm">Modifier Type</th>
                  <th className="border px-3 py-2 text-left text-sm">Item</th>
                  <th className="border px-3 py-2 text-right text-sm">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.modifiers.map((row, idx) => (
                  <tr key={`${row.modifierType}-${row.item}-${idx}`}>
                    <Cell>{row.modifierType}</Cell>
                    <Cell>{row.item}</Cell>
                    <Cell right>{row.count}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
