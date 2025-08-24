import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Get MTD Expenses
  const { data: expensesData } = useQuery({
    queryKey: ["/api/expensesV2/summary", { month: currentMonth }],
    queryFn: () => apiRequest("/api/expensesV2/summary?" + new URLSearchParams({ month: currentMonth })),
  });

  // Get MTD Purchase Tally
  const { data: purchasesData } = useQuery({
    queryKey: ["/api/purchase-tally/summary", { month: currentMonth }],
    queryFn: () => apiRequest("/api/purchase-tally/summary?" + new URLSearchParams({ month: currentMonth })),
  });

  // Get MTD Purchase Tally Drinks Summary
  const { data: drinksSummaryData } = useQuery({
    queryKey: ["/api/purchase-tally/drinks/summary", { month: currentMonth }],
    queryFn: () => apiRequest("/api/purchase-tally/drinks/summary?" + new URLSearchParams({ month: currentMonth })),
  });

  const mtdExpenses = expensesData?.summary?.totalAmount || 0;
  const mtdPurchases = purchasesData?.summary?.totalAmount || 0;
  const purchasesSummary = purchasesData?.summary || {};
  const topDrinks = drinksSummaryData?.items?.slice(0, 3) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Good morning Cam 👋</h1>

      {/* KPI bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", value: "1,249" },
          { label: "Total Revenue", value: "฿89,542" },
          { label: "Growth", value: "+12.5%" },
          { label: "Active Items", value: "32" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border bg-emerald-600 text-white p-5 shadow-sm">
            <div className="text-sm opacity-90">{k.label}</div>
            <div className="text-2xl font-extrabold mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      {/* MTD Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MTD Expenses */}
        <div className="rounded-2xl border bg-blue-600 text-white p-5 shadow-sm">
          <div className="text-sm opacity-90">MTD Expenses</div>
          <div className="text-2xl font-extrabold mt-1 currency">
            ฿{Number(mtdExpenses).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs opacity-75 mt-1">
            {expensesData?.summary?.entryCount || 0} entries this month
          </div>
        </div>

        {/* MTD Purchases */}
        <div className="rounded-2xl border bg-orange-600 text-white p-5 shadow-sm">
          <div className="text-sm opacity-90">MTD Purchases</div>
          <div className="text-2xl font-extrabold mt-1 currency">
            ฿{Number(mtdPurchases).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs opacity-75 mt-1">
            {purchasesSummary.totalRolls || 0} rolls • {Number(purchasesSummary.totalMeat || 0).toLocaleString()}g meat • {purchasesSummary.totalDrinks || 0} drinks
          </div>
          {topDrinks.length > 0 && (
            <div className="text-xs opacity-60 mt-1">
              Top drinks: {topDrinks.map((drink: any) => `${drink.itemName.split(' ')[0]} ${drink.qty}`).join(' • ')}
            </div>
          )}
        </div>
      </div>

      {/* two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold mb-3">Summary Revenue</div>
          <div className="h-60 grid place-items-center text-neutral-400 text-sm border rounded-xl">
            Chart placeholder
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold mb-3">Manager's Checklist</div>
          <div className="text-sm text-neutral-600">Today's Tasks <span className="font-semibold">8/12 Complete</span></div>
          <div className="mt-3 h-2 rounded-full bg-neutral-200">
            <div className="h-2 rounded-full bg-emerald-600" style={{width:"70%"}} />
          </div>
          <button className="mt-4 w-full rounded-xl border px-3 py-2">Complete Tasks →</button>
        </div>
      </div>
    </div>
  );
}