import { useQuery } from '@tanstack/react-query';

interface PromoSale {
  receipt_id: string;
  line_no: number;
  qty: number;
}

interface DrinkSelection {
  name: string;
  qty: number;
}

interface BurgerSelection {
  name: string;
  qty: number;
}

interface PromoMixMatchResponse {
  ok: boolean;
  date: string;
  source: string;
  promo: {
    sku: string;
    name: string;
    qty_sold: number;
    line_items: PromoSale[];
  };
  drinks: {
    expected: number;
    selected: number;
    missing: number;
    selections: DrinkSelection[];
    flag: string | null;
  };
  burgers: {
    expected: number;
    selected: number;
    missing: number;
    selections: BurgerSelection[];
    flag: string | null;
  };
  fries: {
    additional_servings: number;
    note: string;
  };
  buns: {
    additional_units: number;
    note: string;
  };
  coleslaw: {
    expected: number;
    note: string;
  };
  drink_reconciliation: {
    lv_modifier_drink_total: number;
    promo_drink_entitlement: number;
    expected_total: number;
    promo_drink_selected: number;
    promo_drink_missing: number;
    note: string;
  };
  flags: string[];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1">
      {children}
    </p>
  );
}

function Row({
  label,
  value,
  warn,
  ok,
}: {
  label: string;
  value: React.ReactNode;
  warn?: boolean;
  ok?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-600">{label}</span>
      <span
        className={`text-xs font-semibold ${
          warn ? 'text-red-600' : ok ? 'text-green-600' : 'text-gray-800'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Flag({ code }: { code: string }) {
  return (
    <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded px-2 py-1 text-xs text-red-700 font-medium">
      <span>⚑</span>
      <span>{code}</span>
    </div>
  );
}

export function PromoMixMatchTable({ date }: { date: string }) {
  const { data, isLoading, isError } = useQuery<PromoMixMatchResponse>({
    queryKey: ['/api/analysis/promo-mix-and-match', date],
    queryFn: () =>
      fetch(`/api/analysis/promo-mix-and-match?date=${date}`).then((r) => r.json()),
    enabled: !!date,
  });

  if (isLoading) {
    return <p className="text-xs text-gray-400 py-2">Loading promo analysis…</p>;
  }
  if (isError || !data?.ok) {
    return <p className="text-xs text-red-500 py-2">Failed to load promo data.</p>;
  }

  const { promo, drinks, burgers, fries, buns, coleslaw, drink_reconciliation, flags } = data;

  if (promo.qty_sold === 0) {
    return (
      <p className="text-xs text-gray-400 py-2">
        No Mix and Match Meal Deal sales on this date.
      </p>
    );
  }

  return (
    <div className="space-y-3">

      {/* Flags */}
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {flags.map((f) => <Flag key={f} code={f} />)}
        </div>
      )}

      {/* Promo Sales Summary */}
      <div className="bg-gray-50 rounded border border-gray-100 px-3 py-2">
        <SectionLabel>Promo Sales</SectionLabel>
        <Row label="SKU" value={promo.sku} />
        <Row label="Name" value={promo.name} />
        <Row label="Quantity Sold" value={promo.qty_sold} />
        {promo.line_items.map((li) => (
          <Row
            key={`${li.receipt_id}-${li.line_no}`}
            label={`Receipt ${li.receipt_id} · Line ${li.line_no}`}
            value={`qty ${li.qty}`}
          />
        ))}
      </div>

      {/* Drink Modifiers */}
      <div className="bg-gray-50 rounded border border-gray-100 px-3 py-2">
        <SectionLabel>Drink Modifiers (Mix and Match - Drink Options)</SectionLabel>
        <Row label="Expected (2 per sale)" value={drinks.expected} />
        <Row
          label="Selected in Loyverse"
          value={drinks.selected}
          ok={drinks.missing === 0}
          warn={drinks.missing > 0}
        />
        <Row
          label="Missing selections"
          value={drinks.missing}
          warn={drinks.missing > 0}
        />
        {drinks.selections.length > 0 ? (
          drinks.selections.map((s, i) => (
            <Row key={i} label={`  → ${s.name}`} value={`qty ${s.qty}`} />
          ))
        ) : (
          <Row label="  → No drink selections recorded" value="—" warn />
        )}
      </div>

      {/* Burger Modifiers */}
      <div className="bg-gray-50 rounded border border-gray-100 px-3 py-2">
        <SectionLabel>Burger Modifiers (Mix and Match - Burger Option)</SectionLabel>
        <Row label="Expected (2 per sale)" value={burgers.expected} />
        <Row
          label="Selected in Loyverse"
          value={burgers.selected}
          ok={burgers.missing === 0}
          warn={burgers.missing > 0}
        />
        <Row
          label="Missing selections"
          value={burgers.missing}
          ok={burgers.missing === 0}
          warn={burgers.missing > 0}
        />
        {burgers.selections.map((s, i) => (
          <Row key={i} label={`  → ${s.name}`} value={`qty ${s.qty}`} />
        ))}
      </div>

      {/* Stock Contributions */}
      <div className="bg-gray-50 rounded border border-gray-100 px-3 py-2">
        <SectionLabel>Stock Contributions (for reconciliation)</SectionLabel>
        <Row
          label="Fries servings added"
          value={`+${fries.additional_servings}`}
        />
        <Row
          label="Bun units added"
          value={`+${buns.additional_units}`}
        />
        <Row
          label="Coleslaw (note only)"
          value={`${coleslaw.expected} serving(s)`}
        />
        <p className="text-xs text-gray-400 mt-1">{fries.note}</p>
      </div>

      {/* Drink Reconciliation */}
      <div className="bg-blue-50 rounded border border-blue-100 px-3 py-2">
        <SectionLabel>Drink Count Reconciliation</SectionLabel>
        <Row
          label="All drink modifiers selected (lv_modifier)"
          value={drink_reconciliation.lv_modifier_drink_total}
        />
        <Row
          label="Promo drink entitlement"
          value={`+${drink_reconciliation.promo_drink_entitlement}`}
        />
        <Row
          label="Expected total (stock reconciliation target)"
          value={drink_reconciliation.expected_total}
          ok
        />
        <Row
          label="Promo drinks selected"
          value={drink_reconciliation.promo_drink_selected}
        />
        <Row
          label="Promo drinks missing"
          value={drink_reconciliation.promo_drink_missing}
          warn={drink_reconciliation.promo_drink_missing > 0}
        />
        <p className="text-xs text-blue-500 mt-1">{drink_reconciliation.note}</p>
      </div>

      <p className="text-xs text-gray-400">Source: {data.source}</p>
    </div>
  );
}
