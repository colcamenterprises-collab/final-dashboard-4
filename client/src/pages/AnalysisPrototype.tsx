const MOCK_METRICS = {
  revenue: 18450,
  cogsPercent: 31.4,
  primeCostPercent: 58.2,
  criticalIssues: 3,
};

const MOCK_STOCK_ISSUES = [
  {
    item: "Burger Buns",
    start: 240,
    purchased: 48,
    sold: 112,
    expectedEnd: 176,
    actualEnd: 158,
    variance: -18,
  },
  {
    item: "Beef Patty 80g",
    start: 180,
    purchased: 60,
    sold: 130,
    expectedEnd: 110,
    actualEnd: 98,
    variance: -12,
  },
  {
    item: "Coke Zero 330ml",
    start: 96,
    purchased: 24,
    sold: 38,
    expectedEnd: 82,
    actualEnd: 95,
    variance: 13,
  },
  {
    item: "Cheddar Slices",
    start: 200,
    purchased: 0,
    sold: 88,
    expectedEnd: 112,
    actualEnd: 107,
    variance: -5,
  },
];

const MOCK_SUMMARY = {
  sales: {
    pos: 16200,
    grab: 1850,
    other: 400,
    total: 18450,
  },
  stockVariance: {
    buns: -18,
    meat: -12,
    beverages: 13,
  },
  ingredientUsage: {
    beefConsumed: "10.4 kg",
    bunsConsumed: 112,
    cheeseSales: 88,
  },
  profitSnapshot: {
    grossProfit: 12674,
    grossMargin: 68.6,
    laborCost: 4980,
    netProfit: 7694,
  },
};

function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "red" | "yellow";
}) {
  const border =
    highlight === "red"
      ? "border-red-500/40"
      : highlight === "yellow"
        ? "border-yellow-500/40"
        : "border-white/10";
  const valueColor =
    highlight === "red"
      ? "text-red-400"
      : highlight === "yellow"
        ? "text-yellow-400"
        : "text-white";

  return (
    <div className={`rounded-2xl border ${border} bg-white/5 px-5 py-4 flex flex-col gap-1`}>
      <span className="text-xs text-white/50 uppercase tracking-widest font-medium">{label}</span>
      <span className={`text-3xl font-extrabold leading-tight ${valueColor}`}>{value}</span>
      {sub && <span className="text-xs text-white/40">{sub}</span>}
    </div>
  );
}

function VarianceBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-white/40">—</span>;
  const color = value < 0 ? "text-red-400" : "text-green-400";
  const sign = value > 0 ? "+" : "";
  return <span className={`font-semibold ${color}`}>{sign}{value}</span>;
}

function SummaryBlock({
  title,
  lines,
}: {
  title: string;
  lines: { label: string; value: string; highlight?: boolean }[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
      <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3">{title}</h3>
      <ul className="space-y-2">
        {lines.map((line) => (
          <li key={line.label} className="flex justify-between items-center text-sm">
            <span className="text-white/60">{line.label}</span>
            <span className={`font-semibold ${line.highlight ? "text-yellow-400" : "text-white"}`}>
              {line.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AnalysisPrototype() {
  const { revenue, cogsPercent, primeCostPercent, criticalIssues } = MOCK_METRICS;
  const { sales, stockVariance, ingredientUsage, profitSnapshot } = MOCK_SUMMARY;

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-[Poppins] p-6 space-y-8">

      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-8 rounded-full bg-yellow-400" />
          <h1 className="text-2xl font-extrabold tracking-tight">Analysis Prototype</h1>
          <span className="ml-2 rounded-full bg-yellow-400/20 border border-yellow-400/40 px-3 py-0.5 text-xs font-semibold text-yellow-300 uppercase tracking-wider">
            UI Validation
          </span>
        </div>
        <p className="mt-1 text-sm text-white/40 ml-11">
          Prototype only — mock data · no backend connection
        </p>
      </div>

      {/* SECTION 1 — KEY METRICS */}
      <section>
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
          Section 1 · Key Metrics
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Revenue"
            value={`฿${revenue.toLocaleString()}`}
            sub="Tonight's shift"
          />
          <MetricCard
            label="COGS %"
            value={`${cogsPercent}%`}
            sub="Target ≤ 32%"
            highlight={cogsPercent > 32 ? "red" : undefined}
          />
          <MetricCard
            label="Prime Cost %"
            value={`${primeCostPercent}%`}
            sub="Target ≤ 60%"
            highlight={primeCostPercent > 60 ? "red" : undefined}
          />
          <MetricCard
            label="Critical Issues"
            value={String(criticalIssues)}
            sub="Stock variances flagged"
            highlight={criticalIssues > 0 ? "red" : undefined}
          />
        </div>
      </section>

      {/* SECTION 2 — CRITICAL STOCK ISSUES */}
      <section>
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
          Section 2 · Critical Stock Issues
        </h2>
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-semibold">Problem Items Only</span>
            <span className="text-xs text-white/40">{MOCK_STOCK_ISSUES.length} items with variance</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Item</th>
                  <th className="text-right px-4 py-3">Start</th>
                  <th className="text-right px-4 py-3">Purchased</th>
                  <th className="text-right px-4 py-3">Sold</th>
                  <th className="text-right px-4 py-3">Expected End</th>
                  <th className="text-right px-4 py-3">Actual End</th>
                  <th className="text-right px-5 py-3">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {MOCK_STOCK_ISSUES.map((row) => (
                  <tr key={row.item} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3 font-medium">{row.item}</td>
                    <td className="px-4 py-3 text-right text-white/70">{row.start}</td>
                    <td className="px-4 py-3 text-right text-white/70">
                      {row.purchased > 0 ? `+${row.purchased}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-white/70">{row.sold}</td>
                    <td className="px-4 py-3 text-right text-white/70">{row.expectedEnd}</td>
                    <td className="px-4 py-3 text-right text-white/70">{row.actualEnd}</td>
                    <td className="px-5 py-3 text-right">
                      <VarianceBadge value={row.variance} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 3 — DAILY REPORT SUMMARY */}
      <section>
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
          Section 3 · Daily Report Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryBlock
            title="Sales Summary"
            lines={[
              { label: "POS Sales", value: `฿${sales.pos.toLocaleString()}` },
              { label: "Grab", value: `฿${sales.grab.toLocaleString()}` },
              { label: "Other", value: `฿${sales.other.toLocaleString()}` },
              { label: "Total", value: `฿${sales.total.toLocaleString()}`, highlight: true },
            ]}
          />
          <SummaryBlock
            title="Stock Variance"
            lines={[
              { label: "Burger Buns", value: `${stockVariance.buns}`, highlight: stockVariance.buns !== 0 },
              { label: "Beef Patty", value: `${stockVariance.meat}`, highlight: stockVariance.meat !== 0 },
              { label: "Coke Zero", value: `+${stockVariance.beverages}`, highlight: stockVariance.beverages !== 0 },
            ]}
          />
          <SummaryBlock
            title="Ingredient Usage"
            lines={[
              { label: "Beef consumed", value: ingredientUsage.beefConsumed },
              { label: "Buns consumed", value: String(ingredientUsage.bunsConsumed) },
              { label: "Cheese slices", value: String(ingredientUsage.cheeseSales) },
            ]}
          />
          <SummaryBlock
            title="Profit Snapshot"
            lines={[
              { label: "Gross Profit", value: `฿${profitSnapshot.grossProfit.toLocaleString()}` },
              { label: "Gross Margin", value: `${profitSnapshot.grossMargin}%` },
              { label: "Labour Cost", value: `฿${profitSnapshot.laborCost.toLocaleString()}` },
              { label: "Net Profit", value: `฿${profitSnapshot.netProfit.toLocaleString()}`, highlight: true },
            ]}
          />
        </div>
      </section>

    </div>
  );
}
