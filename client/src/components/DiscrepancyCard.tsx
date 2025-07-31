import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from "lucide-react";

interface Discrepancy {
  item: string;
  expected: number;
  actual: number;
  difference: number;
  threshold: number;
  isOutOfBounds: boolean;
  alert: string | null;
}

export const DiscrepancyCard: React.FC = () => {
  const { data: response, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard/stock-discrepancies"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stock-discrepancies");
      if (!res.ok) throw new Error("Failed to fetch stock discrepancies");
      return res.json();
    },
  });

  const discrepancies = response?.discrepancies || [];

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2 text-red-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Failed to load stock discrepancies</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stock Discrepancy Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-gray-500">Loading stock analysis...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const outOfBoundsCount = discrepancies.filter((d: Discrepancy) => d.isOutOfBounds).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Stock Discrepancy Report</span>
          <Badge variant={outOfBoundsCount > 0 ? "destructive" : "secondary"}>
            {outOfBoundsCount > 0 ? `${outOfBoundsCount} Issues` : "All OK"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {discrepancies.map((d: Discrepancy, idx: number) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${
                d.isOutOfBounds 
                  ? "border-red-200 bg-red-50" 
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-1 rounded-full ${
                    d.isOutOfBounds ? "bg-red-100" : "bg-green-100"
                  }`}>
                    {d.isOutOfBounds ? (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{d.item}</div>
                    <div className="text-xs text-gray-500">
                      Expected: {d.expected} | Actual: {d.actual}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`flex items-center space-x-1 text-sm font-medium ${
                    d.difference > 0 ? "text-green-600" : d.difference < 0 ? "text-red-600" : "text-gray-600"
                  }`}>
                    {d.difference > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : d.difference < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : null}
                    <span>{d.difference > 0 ? `+${d.difference}` : d.difference}</span>
                  </div>
                  {d.isOutOfBounds && d.alert && (
                    <div className="text-xs text-red-600 mt-1">{d.alert}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};