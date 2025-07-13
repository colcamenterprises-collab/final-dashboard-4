import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface ShiftReportData {
  date: string;
  balance: number;
  status: "Balanced" | "Attention";
  isWithinRange: boolean;
}

export default function ShiftReportReview() {
  const { data: shiftReports = [], isLoading } = useQuery({
    queryKey: ['/api/shift-reports/balance-review'],
    queryFn: async () => {
      const response = await fetch('/api/shift-reports/balance-review');
      if (!response.ok) throw new Error('Failed to fetch shift reports');
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <Card className="restaurant-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Shift Report Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="text-gray-500 text-sm">Loading shift reports...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="restaurant-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">Shift Report Review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {shiftReports.map((report: ShiftReportData, index: number) => (
          <div key={index} className="bg-slate-800 text-white rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium">{report.date}</span>
              </div>
              <Badge 
                variant={report.status === "Balanced" ? "default" : "destructive"}
                className={report.status === "Balanced" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}
              >
                {report.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium">Balance</span>
              </div>
              <span className={`text-sm font-bold ${report.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {report.balance >= 0 ? '+' : ''}฿{report.balance.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
        
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            <strong>Note:</strong> Green boxes indicate register difference within ±฿50 (acceptable range). 
            Red boxes indicate difference exceeding ±฿50 (requires attention).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}