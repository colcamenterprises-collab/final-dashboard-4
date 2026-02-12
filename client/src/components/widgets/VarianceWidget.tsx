import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useState, useEffect } from "react";

interface VarianceData {
  rolls?: { expected: number; actual: number; diff: number };
  meat?: { expectedKg: string; actualKg: string; diffKg: string };
  drinks?: Record<string, { expected: number; actual: number; diff: number }>;
}

export function VarianceWidget() {
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);

  const { data: variance } = useQuery({
    queryKey: ["daily-variance"],
    queryFn: async () => {
      const res = await axios.get(`/api/reports/latest`);
      return (res.data?.variance as VarianceData) || null;
    },
  });

  useEffect(() => {
    if (!canvasRef || !variance) return;

    // Dynamically import Chart.js
    import("chart.js").then(({ Chart }) => {
      const ctx = canvasRef.getContext("2d");
      if (!ctx) return;

      // Calculate status: green if within tolerance, red if not
      const rollsTolerance = 5;
      const meatTolerance = 500; // grams
      const drinksTolerance = 3;

      const rollsOk = Math.abs(variance.rolls?.diff || 0) <= rollsTolerance;
      const meatDiffGrams = parseInt(variance.meat?.diffKg || "0") * 1000;
      const meatOk = Math.abs(meatDiffGrams) <= meatTolerance;
      
      const drinksOk = Object.values(variance.drinks || {}).every(
        (d: any) => Math.abs(d.diff) <= drinksTolerance
      );

      const passCount = [rollsOk, meatOk, drinksOk].filter(Boolean).length;
      const failCount = 3 - passCount;

      new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["OK", "Alert"],
          datasets: [
            {
              data: [passCount, failCount],
              backgroundColor: ["#10b981", "#ef4444"],
              borderColor: ["#059669", "#dc2626"],
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: "bottom",
            },
          },
        },
      });
    });
  }, [canvasRef, variance]);

  if (!variance) {
    return (
      <div className="bg-white rounded p-4 shadow-sm border border-slate-100">
        <p className="text-xs text-slate-500">No variance data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded p-4 shadow-sm border border-slate-100">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Inventory Variance</h3>
      <canvas ref={setCanvasRef} style={{ maxHeight: "150px" }} />
      <div className="mt-3 space-y-1 text-xs text-slate-600">
        <p>Rolls: {variance.rolls?.diff || 0} {Math.abs(variance.rolls?.diff || 0) > 5 ? "⚠️" : "✓"}</p>
        <p>Meat: {variance.meat?.diffKg || "0.00"} kg {Math.abs(parseInt(variance.meat?.diffKg || "0")) > 0.5 ? "⚠️" : "✓"}</p>
      </div>
    </div>
  );
}
