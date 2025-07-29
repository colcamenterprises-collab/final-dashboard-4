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
              className="rounded-lg shadow p-4 bg-white border border-gray-200 text-gray-900"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">{formattedDate}</span>
                <span className="text-sm px-2 py-1 rounded bg-gray-100 text-gray-700">
                  Status
                </span>
              </div>
              <div className="text-sm">
                <div>
                  <span className="font-semibold">Balance:</span>{" "}
                  {isNaN(item.banking_diff) || item.banking_diff == null ? 'N/A' : 
                    `${item.banking_diff >= 0 ? '+' : ''}฿${item.banking_diff.toFixed(2)}`}
                </div>

              </div>
              <div className="mt-3 pt-2 border-t border-gray-200">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation(`/analysis/shift-report/${encodeURIComponent(item.date)}`)}
                >
                  View Details
                </Button>
              </div>
            </div>
          );
        })}

        <div className="text-sm text-gray-700 border-t pt-2">
          <strong>Note:</strong> Shift report balance review and anomaly tracking for daily operations.
        </div>
      </CardContent>
    </Card>
  );
};

export default ShiftReportSummary;