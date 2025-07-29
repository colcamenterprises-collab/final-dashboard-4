import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

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
        
        {summary.map((item) => {
          const isBalanced = item.status === "balanced";
          const formattedDate = format(new Date(item.date), "dd/MM/yyyy");
          
          return (
            <div
              key={item.date}
              className={cn(
                "rounded-lg shadow p-4 text-white",
                isBalanced ? "bg-green-600" : "bg-red-600"
              )}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">{formattedDate}</span>
                <span
                  className={cn(
                    "text-sm px-2 py-1 rounded",
                    isBalanced ? "bg-green-800" : "bg-red-800"
                  )}
                >
                  {isBalanced ? "Balanced" : "Attention"}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">Balance:</span>{" "}
                {item.banking_diff >= 0 ? "+" : "-"}฿
                {Math.abs(item.banking_diff).toFixed(2)}
              </div>
            </div>
          );
        })}

        <div className="text-sm text-gray-700 border-t pt-2">
          <strong>Note:</strong> Green = balance within ±฿50. Red = exceeds ±฿50 and requires review.
        </div>
      </CardContent>
    </Card>
  );
};

export default ShiftReportSummary;