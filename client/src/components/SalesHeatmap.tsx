import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface HeatmapData {
  day: string;
  hour: number;
  sales: number;
  orders: number;
}

export default function SalesHeatmap() {
  const { data: heatmapData, isLoading } = useQuery({
    queryKey: ["/api/dashboard/sales-heatmap"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/sales-heatmap");
      if (!response.ok) throw new Error("Failed to fetch heatmap data");
      return response.json();
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getIntensityColor = (sales: number, maxSales: number) => {
    if (sales === 0) return "bg-gray-100 dark:bg-gray-800";
    
    const intensity = sales / maxSales;
    if (intensity >= 0.8) return "bg-red-500";
    if (intensity >= 0.6) return "bg-orange-500";
    if (intensity >= 0.4) return "bg-yellow-500";
    if (intensity >= 0.2) return "bg-green-400";
    return "bg-green-200";
  };

  const getDayName = (day: string) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const date = new Date(day);
    return days[date.getDay()];
  };

  const getHourLabel = (hour: number) => {
    if (hour === 0) return "12AM";
    if (hour < 12) return `${hour}AM`;
    if (hour === 12) return "12PM";
    return `${hour - 12}PM`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Sales Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-gray-500 text-sm">Loading heatmap...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!heatmapData || heatmapData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Sales Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-gray-500 text-sm">No sales data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate max sales for color intensity
  const maxSales = Math.max(...heatmapData.map((d: HeatmapData) => d.sales));

  // Group data by day and hour
  const dataMap = new Map<string, HeatmapData>();
  heatmapData.forEach((item: HeatmapData) => {
    const key = `${item.day}-${item.hour}`;
    dataMap.set(key, item);
  });

  // Get unique days and sort them
  const days = [...new Set(heatmapData.map((d: HeatmapData) => d.day))].sort();
  const hours = Array.from({length: 24}, (_, i) => i); // 0-23

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Sales Heatmap - Last 7 Days
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Hourly sales patterns (Bangkok timezone)
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>Low Activity</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-100 dark:bg-gray-800 rounded"></div>
              <div className="w-3 h-3 bg-green-200 rounded"></div>
              <div className="w-3 h-3 bg-green-400 rounded"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <div className="w-3 h-3 bg-red-500 rounded"></div>
            </div>
            <span>High Activity</span>
          </div>

          {/* Heatmap Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Hour labels */}
              <div className="flex items-center mb-2">
                <div className="w-12 text-xs text-gray-600 dark:text-gray-400">Day</div>
                {hours.map(hour => (
                  <div key={hour} className="w-8 text-xs text-center text-gray-600 dark:text-gray-400">
                    {hour % 6 === 0 ? getHourLabel(hour) : ''}
                  </div>
                ))}
              </div>

              {/* Days and data */}
              {days.map(day => (
                <div key={day} className="flex items-center mb-1">
                  <div className="w-12 text-xs text-gray-600 dark:text-gray-400 pr-2">
                    {getDayName(day)}
                  </div>
                  {hours.map(hour => {
                    const key = `${day}-${hour}`;
                    const data = dataMap.get(key);
                    const sales = data?.sales || 0;
                    const orders = data?.orders || 0;
                    
                    return (
                      <div
                        key={hour}
                        className={`w-8 h-6 mx-px rounded cursor-pointer transition-all hover:scale-110 ${getIntensityColor(sales, maxSales)}`}
                        title={`${getDayName(day)} ${getHourLabel(hour)}: ${formatCurrency(sales)} (${orders} orders)`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {formatCurrency(heatmapData.reduce((sum: number, d: HeatmapData) => sum + d.sales, 0))}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total Sales</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {heatmapData.reduce((sum: number, d: HeatmapData) => sum + d.orders, 0)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total Orders</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600">
                {formatCurrency(maxSales)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Peak Hour</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-orange-600">
                {formatCurrency(heatmapData.reduce((sum: number, d: HeatmapData) => sum + d.sales, 0) / heatmapData.filter((d: HeatmapData) => d.sales > 0).length || 0)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Avg/Hour</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}