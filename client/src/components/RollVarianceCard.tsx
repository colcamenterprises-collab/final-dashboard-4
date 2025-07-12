import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

export default function RollVarianceCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/dashboard/roll-variance'],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card className="restaurant-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Burger Roll Variance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="restaurant-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Burger Roll Variance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="text-gray-500 text-sm">No variance data available</div>
            <div className="text-gray-400 text-xs mt-1">Complete a shift to view roll tracking</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPositiveVariance = data.rollsVariance > 0;
  const isHighVariance = Math.abs(data.rollsVariance) > 5;
  const varianceColor = isHighVariance ? "text-red-600" : isPositiveVariance ? "text-emerald-600" : "text-orange-600";
  const VarianceIcon = isPositiveVariance ? TrendingUp : TrendingDown;

  return (
    <Card className="restaurant-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center justify-between">
          Burger Roll Variance
          {data.varianceFlag && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Alert
            </Badge>
          )}
        </CardTitle>
        <div className="text-sm text-gray-500">
          Shift: {new Date(data.shiftDate).toLocaleDateString()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Burgers Sold</div>
            <div className="font-semibold text-lg">{data.burgersSold}</div>
          </div>
          <div>
            <div className="text-gray-600">Patties Used</div>
            <div className="font-semibold text-lg">{data.pattiesUsed}</div>
          </div>
        </div>
        
        <div className="border-t pt-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Starting Rolls</div>
              <div className="font-medium">{data.rollsStart}</div>
            </div>
            <div>
              <div className="text-gray-600">Purchased</div>
              <div className="font-medium">{data.rollsPurchased}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Expected End</div>
            <div className="font-medium">{data.rollsExpected}</div>
          </div>
          <div>
            <div className="text-gray-600">Actual End</div>
            <div className="font-medium">{data.rollsActual}</div>
          </div>
        </div>

        <div className={`flex items-center justify-between p-3 rounded-lg ${
          isHighVariance ? 'bg-red-50 border border-red-200' : 
          isPositiveVariance ? 'bg-emerald-50 border border-emerald-200' : 
          'bg-orange-50 border border-orange-200'
        }`}>
          <div className="flex items-center space-x-2">
            <VarianceIcon className={`w-4 h-4 ${varianceColor}`} />
            <span className="font-medium text-gray-900">Variance</span>
          </div>
          <div className={`font-bold text-lg ${varianceColor}`}>
            {data.rollsVariance > 0 ? '+' : ''}{data.rollsVariance}
          </div>
        </div>

        {data.varianceFlag && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-red-800 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">High variance detected!</span>
            </div>
            <div className="text-red-700 text-xs mt-1">
              Review stock management and ordering procedures
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}