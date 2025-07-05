import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Calendar } from "lucide-react";

interface ShiftBalance {
  id: string;
  shiftDate: string;
  totalSales: number;
  isBalanced: boolean;
}

export default function CompactShiftReports() {
  const { data: shiftBalances, isLoading } = useQuery<ShiftBalance[]>({
    queryKey: ["/api/loyverse/shift-balance-analysis"],
    refetchInterval: 30000,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Bangkok'
    });
  };

  const formatCurrency = (amount: number) => {
    return `฿${amount.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-900">
            Recent Shifts
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-sm text-gray-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!shiftBalances || shiftBalances.length === 0) {
    return (
      <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-900">
            Recent Shifts
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-sm text-gray-500">No shift data available</div>
        </CardContent>
      </Card>
    );
  }

  // Show only last 3 shifts
  const recentShifts = shiftBalances.slice(0, 3);

  return (
    <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-gray-900">
          Recent Shifts
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {recentShifts.map((shift) => (
            <div key={shift.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center gap-3">
                {shift.isBalanced ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatDate(shift.shiftDate)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {shift.isBalanced ? 'Balanced' : 'Not Balanced'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">
                  {formatCurrency(shift.totalSales)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}