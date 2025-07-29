import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLocation } from "wouter";

interface ShiftSummary {
  date: string;
  banking_diff: number;
  status: "attention" | "balanced";
  anomalies: number;
}

const ShiftReportSummary = () => {
  const [, setLocation] = useLocation();
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
        
        {summary.map((item, index) => {
          const isBalanced = item.status === "balanced";
          
          // Safe date parsing with fallback
          let formattedDate = item.date;
          try {
            // Check if the date is already formatted (dd/MM/yyyy)
            if (item.date && item.date.includes('/')) {
              formattedDate = item.date;
            } else {
              // Try to parse as ISO date or other format
              const dateObj = new Date(item.date);
              if (!isNaN(dateObj.getTime())) {
                formattedDate = format(dateObj, "dd/MM/yyyy");
              } else {
                formattedDate = item.date || 'Invalid Date';
              }
            }
          } catch (error) {
            console.error('Date formatting error:', error, 'for date:', item.date);
            formattedDate = item.date || 'Invalid Date';
          }
          
          return (
            <div
              key={`${item.date}-${index}`}
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
                <div>
                  <span className="font-semibold">Balance:</span>{" "}
                  {item.banking_diff >= 0 ? "+" : "-"}฿
                  {Math.abs(item.banking_diff).toFixed(2)}
                </div>
                {item.anomalies > 0 && (
                  <div className="mt-1 text-yellow-200 font-medium">
                    {item.anomalies} Anomaly{item.anomalies > 1 ? "ies" : "y"} Detected
                  </div>
                )}
              </div>
              <div className="mt-3 pt-2 border-t border-white/20">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white"
                  onClick={() => setLocation(`/reports-analysis?tab=analysis&date=${encodeURIComponent(item.date)}`)}
                >
                  View Details
                </Button>
              </div>
            </div>
          );
        })}

        <div className="text-sm text-gray-700 border-t pt-2">
          <strong>Note:</strong> Green = balance within ±฿50. Red = exceeds ±฿50 and requires review. Yellow text = anomalies found based on sales vs POS report mismatch.
        </div>
      </CardContent>
    </Card>
  );
};

export default ShiftReportSummary;