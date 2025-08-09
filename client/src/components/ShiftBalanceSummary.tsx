import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Calendar, DollarSign } from "lucide-react";

interface ShiftBalance {
  id: string;
  shiftDate: string;
  shiftStart: string;
  shiftEnd: string;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  calculatedTotal: number;
  variance: number;
  isBalanced: boolean;
  staffMembers: string[];
  totalTransactions: number;
  completedBy: string;
}

export default function ShiftBalanceSummary() {
  const { data: shiftBalances, isLoading } = useQuery<ShiftBalance[]>({
    queryKey: ["/api/loyverse/shift-balance-analysis"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatCurrency = (amount: number) => {
    return `฿${amount.toFixed(2)}`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bangkok'
    });
  };

  const unbalancedCount = shiftBalances?.filter(shift => !shift.isBalanced).length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Shift Balance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">Loading shift data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <DollarSign className="h-5 w-5" />
          Shift Balance Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!shiftBalances || shiftBalances.length === 0 ? (
          <div className="text-sm text-gray-500">No shift balance data available</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-blue-200 bg-blue-50">
              <div>
                <h3 className="text-sm font-medium text-blue-800">Balance Status</h3>
                <p className="text-xs text-blue-600 mt-1">
                  {unbalancedCount === 0 
                    ? "All recent shifts are balanced" 
                    : `${unbalancedCount} shift${unbalancedCount > 1 ? 's' : ''} need attention`
                  }
                </p>
              </div>
              <Badge 
                variant={unbalancedCount === 0 ? "default" : "destructive"}
                className={unbalancedCount === 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
              >
                {unbalancedCount === 0 ? "All Balanced" : `${unbalancedCount} Unbalanced`}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
