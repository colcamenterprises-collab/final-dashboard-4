import { PieChart, Pie, Cell } from "recharts";

interface DoughnutChartProps {
  results?: Record<string, boolean>;
}

export function DoughnutChart({ results }: DoughnutChartProps) {
  if (!results) {
    return (
      <div className="w-64 h-64 flex items-center justify-center text-slate-500 text-sm">
        Loading health data...
      </div>
    );
  }

  const data = [
    { name: "Sales", value: results.salesCreated ? 1 : 0 },
    { name: "Stock", value: results.stockCreated ? 1 : 0 },
    { name: "Purchased Rolls", value: results.purchasedRolls ? 1 : 0 },
    { name: "Purchased Meat", value: results.purchasedMeat ? 1 : 0 },
    { name: "Purchased Drinks", value: results.purchasedDrinks ? 1 : 0 },
    { name: "Shopping List", value: results.shoppingList ? 1 : 0 },
    { name: "Report JSON", value: results.reportJson ? 1 : 0 },
    { name: "Report PDF", value: results.reportPdf ? 1 : 0 }
  ];

  const COLORS = ["#10b981", "#ef4444"]; // green for passed, red for failed

  return (
    <div className="flex justify-center">
      <PieChart width={260} height={260}>
        <Pie
          data={data}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={2}
          startAngle={90}
          endAngle={-270}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.value === 1 ? COLORS[0] : COLORS[1]}
            />
          ))}
        </Pie>
      </PieChart>
    </div>
  );
}
