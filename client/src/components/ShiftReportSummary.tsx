import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface ShiftSummary {
  date: string;
  banking_diff: number;
  status: "attention" | "balanced";
}

const ShiftReportSummary = () => {
  const { data: summary = [], isLoading, error } = useQuery<ShiftSummary[]>({
    queryKey: ['/api/shift-reports/balance-review'],
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h3 className="text-lg font-bold">Shift Report Review</h3>
        
        {isLoading && (
          <div className="text-center py-4 text-muted-foreground">
            Loading shift summary...
          </div>
        )}
        
        {error && (
          <div className="text-center py-4 text-red-500">
            Failed to load shift summary
          </div>
        )}
        
        {summary.length === 0 && !isLoading && !error && (
          <div className="text-center py-4 text-muted-foreground">
            No shift reports available
          </div>
        )}
        
        {summary.map((item) => (
          <div
            key={item.date}
            className={cn(
              "rounded-md p-3 text-white",
              item.status === "balanced" ? "bg-green-600" : "bg-red-600"
            )}
          >
            <div className="flex items-center gap-2">
              <CalendarDays size={18} />
              <span>{item.date}</span>
              <span
                className={cn(
                  "ml-auto text-sm font-semibold px-2 py-0.5 rounded",
                  item.status === "balanced"
                    ? "bg-green-700 text-white"
                    : "bg-red-700 text-white"
                )}
              >
                {item.status === "balanced" ? "Balanced" : "Attention"}
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <DollarSign size={18} />
              <span>Balance</span>
              <span className="ml-auto font-mono">
                {item.banking_diff >= 0
                  ? `+฿${item.banking_diff.toFixed(2)}`
                  : `-฿${Math.abs(item.banking_diff).toFixed(2)}`}
              </span>
            </div>
          </div>
        ))}

        <p className="text-xs text-muted-foreground border-t pt-2">
          <strong>Note:</strong> Green boxes indicate register difference within
          ±50 (acceptable range). Red boxes indicate difference exceeding
          ±50 (requires attention).
        </p>
      </CardContent>
    </Card>
  );
};

export default ShiftReportSummary;