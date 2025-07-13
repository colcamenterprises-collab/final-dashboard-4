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
          <Calendar className="h-5 w-5" />
          Last 5 Shift Reports
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!shiftBalances || shiftBalances.length === 0 ? (
          <div className="text-sm text-gray-500">No shift data available</div>
        ) : (
          <div className="space-y-3">
            {shiftBalances.map((shift) => (
              <div 
                key={shift.id} 
                className={`p-3 rounded-lg border ${
                  shift.isBalanced 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {shift.isBalanced ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium text-sm">
                      Closed: {new Date(shift.shiftEnd).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Bangkok'
                      })}
                    </span>
                  </div>
                  <Badge 
                    variant={shift.isBalanced ? "default" : "destructive"}
                    className={shift.isBalanced ? "text-xs bg-green-100 text-green-800 border-green-300" : "text-xs bg-red-100 text-red-800 border-red-300"}
                  >
                    {shift.isBalanced ? "Balanced" : `฿${shift.variance.toFixed(2)} variance`}
                  </Badge>
                </div>
                
                <div className="text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Sales</span>
                    <span className="font-semibold">{formatCurrency(shift.totalSales)}</span>
                  </div>
                </div>


              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}