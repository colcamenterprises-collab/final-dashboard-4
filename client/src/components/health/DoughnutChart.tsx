import { PieChart, Pie, Cell } from "recharts";

interface HealthCheck {
  name: string;
  ok: boolean;
  error?: string;
}

interface DoughnutChartProps {
  checks?: HealthCheck[];
  checksPassed?: number;
  totalChecks?: number;
  size?: "lg" | "sm";
  mini?: boolean;
  check?: HealthCheck;
}

export function DoughnutChart({ 
  checks, 
  checksPassed = 0, 
  totalChecks = 0,
  size = "lg",
  mini = false,
  check
}: DoughnutChartProps) {
  
  // Mini version for individual check
  if (mini && check) {
    const data = [
      { name: "OK", value: check.ok ? 1 : 0, color: "#10b981" },
      { name: "Failed", value: check.ok ? 0 : 1, color: "#ef4444" }
    ];
    
    return (
      <svg width="80" height="80" viewBox="0 0 80 80">
        <PieChart width={80} height={80}>
          <Pie
            data={data}
            dataKey="value"
            cx={40}
            cy={40}
            innerRadius={16}
            outerRadius={28}
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </svg>
    );
  }

  // Regular version
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

  const width = size === "lg" ? 160 : 128;
  const height = size === "lg" ? 160 : 128;
  const cx = width / 2;
  const cy = height / 2;
  const innerRadius = size === "lg" ? 45 : 32;
  const outerRadius = size === "lg" ? 70 : 55;

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="relative" style={{ width: `${width}px`, height: `${height}px` }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
          <PieChart width={width} height={height}>
            <Pie
              data={data}
              dataKey="value"
              cx={cx}
              cy={cy}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${size === "lg" ? "text-2xl" : "text-xl"} font-bold ${getStatusColor()}`}>{passRate}%</span>
          <span className={`${size === "lg" ? "text-xs" : "text-[10px]"} text-slate-500`}>Health</span>
        </div>
      </div>
    </div>
  );
}
