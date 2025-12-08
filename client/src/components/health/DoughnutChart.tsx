import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface HealthCheck {
  name: string;
  ok: boolean;
  error?: string;
}

interface DoughnutChartProps {
  checks?: HealthCheck[];
  checksPassed?: number;
  totalChecks?: number;
}

export function DoughnutChart({ checks, checksPassed = 0, totalChecks = 0 }: DoughnutChartProps) {
  if (!checks || checks.length === 0) {
    return (
      <div className="w-48 h-48 flex items-center justify-center text-slate-500 text-sm">
        Loading health data...
      </div>
    );
  }

  const passRate = totalChecks > 0 ? Math.round((checksPassed / totalChecks) * 100) : 0;

  const data = [
    { name: "Passed", value: checksPassed, color: "#10b981" },
    { name: "Failed", value: totalChecks - checksPassed, color: "#ef4444" }
  ];

  const getStatusColor = () => {
    if (passRate >= 80) return "text-emerald-600";
    if (passRate >= 50) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="relative w-40 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${getStatusColor()}`}>{passRate}%</span>
          <span className="text-xs text-slate-500">Health</span>
        </div>
      </div>
    </div>
  );
}
