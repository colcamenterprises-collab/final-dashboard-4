import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import DrinksVarianceTable from '@/components/analysis/DrinksVarianceTable';
import BurgersSetsTable from '@/components/analysis/BurgersSetsTable';
import BunsReconciliationTable from '@/components/analysis/BunsReconciliationTable';
import MeatReconciliationTable from '@/components/analysis/MeatReconciliationTable';
import SideOrdersTable from '@/components/analysis/SideOrdersTable';
import FriesReconciliationTable from '@/components/analysis/FriesReconciliationTable';

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
    drinks: Array<{
      sku: string;
      itemName?: string | null;
      soldDirect: number;
      soldFromModifiers: number;
      totalSold: number;
      start?: number | null;
      purchased?: number | null;
      end?: number | null;
      expected?: number | null;
      variance?: number | null;
    }>;
    burgersAndSets: Array<{ itemName: string; soldCount: number; type: 'Single' | 'Double' | 'Set' }>;
    sideOrders: Array<{ itemName: string; soldCount: number }>;
    modifiers: Array<{ modifierType: string; item: string; count: number }>;
  };
};

/**
 * Returns today's date in BKK timezone as YYYY-MM-DD.
 */
function todayBkk(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

/**
 * Returns the last CLOSED shift date in BKK timezone.
 *
 * Shift window: opens 17:00 BKK, closes 03:00 BKK next day.
 * - BKK 00:00–02:59  → yesterday's shift is still open  → last closed = 2 days ago (BKK)
 * - BKK 03:00–23:59  → yesterday's shift has closed     → last closed = yesterday (BKK)
 */
function lastClosedShiftDateBkk(): string {
  const bkkHourStr = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Bangkok',
    hour: 'numeric',
    hour12: false,
  });
  const bkkHour = parseInt(bkkHourStr, 10);
  const daysBack = bkkHour < 3 ? 2 : 1;
  const base = new Date(todayBkk() + 'T00:00:00Z');
  base.setUTCDate(base.getUTCDate() - daysBack);
  return base.toISOString().slice(0, 10);
}

function shiftStep(date: string, delta: -1 | 1): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatShiftLabel(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function Cell({ children, right = false, bold = false }: { children: ReactNode; right?: boolean; bold?: boolean }) {
  return (
    <td className={`border border-gray-200 px-3 py-2 text-xs ${right ? 'text-right tabular-nums' : ''} ${bold ? 'font-semibold' : ''}`}>
      {children}
    </td>
  );
}

function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return (
    <th className={`border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="border border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
        No data for this shift
      </td>
    </tr>
  );
}

export default function AnalysisV2() {
  const [shiftDate, setShiftDate] = useState<string>(lastClosedShiftDateBkk);
  const [isLastClosed, setIsLastClosed] = useState(true);

  useEffect(() => {
    fetch('/api/latest-valid-shift')
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j?.date) {
          setShiftDate(j.date);
          setIsLastClosed(true);
        }
      })
      .catch(() => {});
  }, []);

  const { data, isLoading } = useQuery<AnalysisV2Response>({
    queryKey: ['/api/analysis/v2', shiftDate],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/v2?date=${shiftDate}`);
      if (!res.ok) throw new Error('Failed to load Analysis V2');
      return res.json();
    },
  });

  const lastClosed = lastClosedShiftDateBkk();
  const isAtLastClosed = shiftDate === lastClosed;

  function handleDateInput(value: string) {
    setShiftDate(value);
    setIsLastClosed(false);
  }

  function handleStep(delta: -1 | 1) {
    setShiftDate((d) => shiftStep(d, delta));
    setIsLastClosed(false);
  }

  function jumpToLastClosed() {
    setShiftDate(lastClosed);
    setIsLastClosed(true);
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Sales &amp; Shift Analysis V2</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Drinks · Burgers · Side Orders · Modifiers — per shift
          </p>
        </div>

        {!isAtLastClosed && (
          <button
            onClick={jumpToLastClosed}
            className="text-xs text-emerald-700 border border-emerald-300 bg-emerald-50 px-3 py-1.5 rounded hover:bg-emerald-100 transition-colors"
          >
            ↩ Jump to last closed shift
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleStep(-1)}
          className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          title="Previous shift"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 max-w-xs">
          <label className="block text-xs text-gray-500 mb-1 font-medium">Shift Date</label>
          <Input
            type="date"
            value={shiftDate}
            max={todayBkk()}
            onChange={(e) => handleDateInput(e.target.value)}
            className="text-sm h-9"
          />
        </div>

        <button
          onClick={() => handleStep(1)}
          disabled={shiftDate >= lastClosed}
          className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next shift"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="text-xs text-gray-500 self-end pb-2 leading-tight">
          <span className="font-medium text-gray-700">{formatShiftLabel(shiftDate)}</span>
          <br />
          <span className="text-gray-400">17:00 BKK → 03:00 BKK+1</span>
        </div>
      </div>

      {isAtLastClosed && (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 inline-block">
          Showing last closed shift
        </div>
      )}

      {isLoading && (
        <div className="text-xs text-gray-400 py-6 text-center">Loading shift data…</div>
      )}

      {!!data?.blockers?.length && (
        <div className="border border-amber-300 bg-amber-50 rounded p-3 space-y-1">
          {data.blockers.map((b) => (
            <div key={`${b.code}-${b.where}`} className="text-xs">
              <span className="font-semibold text-amber-800">{b.code}</span>
              <span className="text-amber-700">: {b.message}</span>
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-100">
          1. Drinks
        </h2>
        <DrinksVarianceTable date={shiftDate} />
      </section>

      {data && (
        <div className="space-y-6">

          <section>
            <h2 className="text-sm font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-100">
              2. Burgers &amp; Sets
            </h2>
            <BurgersSetsTable date={shiftDate} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-100">
              3. Core Stock — Buns
            </h2>
            <BunsReconciliationTable date={shiftDate} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-100">
              4. Core Stock — Meat
            </h2>
            <MeatReconciliationTable date={shiftDate} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-100">
              5. Side Orders
            </h2>
            <SideOrdersTable date={shiftDate} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-100">
              6. Core Stock — French Fries
            </h2>
            <FriesReconciliationTable date={shiftDate} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-100">
              7. Modifiers
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <Th>Modifier Type</Th>
                    <Th>Item</Th>
                    <Th right>Count</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.tables.modifiers.length === 0 ? (
                    <EmptyRow cols={3} />
                  ) : (
                    data.tables.modifiers.map((row, idx) => (
                      <tr key={`${row.modifierType}-${row.item}-${idx}`} className="hover:bg-gray-50">
                        <Cell>{row.modifierType}</Cell>
                        <Cell>{row.item}</Cell>
                        <Cell right bold>{row.count}</Cell>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      )}
    </div>
  );
}
