import { useQuery } from '@tanstack/react-query';

interface PromoSale { receipt_id: string; line_no: number; qty: number }
interface DrinkSelection { name: string; qty: number }
interface BurgerSelection { name: string; qty: number }

interface PromoMixMatchResponse {
  ok: boolean; date: string; source: string;
  promo: { sku: string; name: string; qty_sold: number; line_items: PromoSale[] };
  drinks: { expected: number; selected: number; missing: number; selections: DrinkSelection[]; flag: string | null };
  burgers: { expected: number; selected: number; missing: number; selections: BurgerSelection[]; flag: string | null };
  fries: { additional_servings: number; note: string };
  buns: { additional_units: number; note: string };
  coleslaw: { expected: number; note: string };
  drink_reconciliation: {
    lv_modifier_drink_total: number; promo_drink_entitlement: number;
    expected_total: number; promo_drink_selected: number; promo_drink_missing: number; note: string;
  };
  flags: string[];
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{children}</p>
    </div>
  );
}

function Row({ label, value, warn, ok }: { label: string; value: React.ReactNode; warn?: boolean; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-600">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${warn ? 'text-red-600' : ok ? 'text-emerald-600' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  );
}

export function PromoMixMatchTable({ date }: { date: string }) {
  const { data, isLoading, isError } = useQuery<PromoMixMatchResponse>({
    queryKey: ['/api/analysis/promo-mix-and-match', date],
    queryFn: () => fetch(`/api/analysis/promo-mix-and-match?date=${date}`).then((r) => r.json()),
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
        Failed to load promo data.
      </div>
    );
  }

  const { promo, drinks, burgers, fries, buns, coleslaw, drink_reconciliation, flags } = data;

  if (promo.qty_sold === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <span className="text-sm font-semibold text-slate-800">Promotions — Mix and Match Meal Deal</span>
          <span className="text-xs text-slate-400">{date}</span>
        </div>
        <div className="px-4 py-4 text-xs text-slate-400 text-center">No Mix and Match Meal Deal sales on this date.</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <span className="text-sm font-semibold text-slate-800">Promotions — Mix and Match Meal Deal</span>
        <span className="text-xs text-slate-400">{date}</span>
      </div>

      {flags.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap gap-2">
          {flags.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-red-200 bg-red-50 text-xs text-red-700 font-medium">
              ⚑ {f}
            </span>
          ))}
        </div>
      )}

      {/* Promo Sales */}
      <SectionHeader>Promo Sales</SectionHeader>
      <Row label="SKU" value={promo.sku} />
      <Row label="Name" value={promo.name} />
      <Row label="Quantity Sold" value={promo.qty_sold} />
      {promo.line_items.map((li) => (
        <Row key={`${li.receipt_id}-${li.line_no}`} label={`Receipt ${li.receipt_id} · Line ${li.line_no}`} value={`qty ${li.qty}`} />
      ))}

      {/* Drink Modifiers */}
      <SectionHeader>Drink Modifiers (Mix and Match — Drink Options)</SectionHeader>
      <Row label="Expected (2 per sale)" value={drinks.expected} />
      <Row label="Selected in Loyverse" value={drinks.selected} ok={drinks.missing === 0} warn={drinks.missing > 0} />
      <Row label="Missing selections" value={drinks.missing} warn={drinks.missing > 0} />
      {drinks.selections.length > 0 ? (
        drinks.selections.map((s, i) => <Row key={i} label={`  → ${s.name}`} value={`qty ${s.qty}`} />)
      ) : (
        <Row label="  → No drink selections recorded" value="—" warn />
      )}

      {/* Burger Modifiers */}
      <SectionHeader>Burger Modifiers (Mix and Match — Burger Option)</SectionHeader>
      <Row label="Expected (2 per sale)" value={burgers.expected} />
      <Row label="Selected in Loyverse" value={burgers.selected} ok={burgers.missing === 0} warn={burgers.missing > 0} />
      <Row label="Missing selections" value={burgers.missing} ok={burgers.missing === 0} warn={burgers.missing > 0} />
      {burgers.selections.map((s, i) => <Row key={i} label={`  → ${s.name}`} value={`qty ${s.qty}`} />)}

      {/* Stock Contributions */}
      <SectionHeader>Stock Contributions (for reconciliation)</SectionHeader>
      <Row label="Fries servings added" value={`+${fries.additional_servings}`} />
      <Row label="Bun units added" value={`+${buns.additional_units}`} />
      <Row label="Coleslaw (note only)" value={`${coleslaw.expected} serving(s)`} />
      <div className="px-4 py-1.5 border-b border-slate-50">
        <p className="text-[10px] text-slate-400">{fries.note}</p>
      </div>

      {/* Drink Reconciliation */}
      <SectionHeader>Drink Count Reconciliation</SectionHeader>
      <Row label="All drink modifiers selected (lv_modifier)" value={drink_reconciliation.lv_modifier_drink_total} />
      <Row label="Promo drink entitlement" value={`+${drink_reconciliation.promo_drink_entitlement}`} />
      <Row label="Expected total (stock reconciliation target)" value={drink_reconciliation.expected_total} ok />
      <Row label="Promo drinks selected" value={drink_reconciliation.promo_drink_selected} />
      <Row label="Promo drinks missing" value={drink_reconciliation.promo_drink_missing} warn={drink_reconciliation.promo_drink_missing > 0} />

      <div className="px-4 py-2 border-t border-slate-100">
        <p className="text-[10px] text-slate-400">Source: {data.source}</p>
      </div>
    </div>
  );
}
