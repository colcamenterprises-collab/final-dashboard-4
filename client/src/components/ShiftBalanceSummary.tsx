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
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
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
        <CardTitle className="flex items-center justify-between text-lg font-semibold text-gray-900">
          <span className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Last 5 Shift Reports
          </span>
          {unbalancedCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {unbalancedCount} Unbalanced
            </Badge>
          )}
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
                    className="text-xs"
                  >
                    {shift.isBalanced ? "Balanced" : `฿${shift.variance.toFixed(2)} variance`}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <div className="text-gray-600">Total Sales</div>
                    <div className="font-semibold">{formatCurrency(shift.totalSales)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Cash</div>
                    <div className="font-medium">{formatCurrency(shift.cashSales)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Card</div>
                    <div className="font-medium">{formatCurrency(shift.cardSales)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Staff</div>
                    <div className="font-medium">{shift.completedBy}</div>
                  </div>
                </div>

                {!shift.isBalanced && (
                  <div className="mt-2 p-2 bg-red-100 rounded text-xs">
                    <div className="flex items-center gap-1 text-red-700">
                      <DollarSign className="h-3 w-3" />
                      <span className="font-medium">Balance Issue:</span>
                      Expected: {formatCurrency(shift.calculatedTotal)} | 
                      Actual: {formatCurrency(shift.totalSales)} | 
                      Variance: {formatCurrency(shift.variance)} ({">"} ฿30 tolerance)
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}