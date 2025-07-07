import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface SalesVsExpensesData {
  date: string;
  sales: number;
  expenses: number;
  dayLabel: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-md">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-teal-600">
          Sales: ฿{payload[0]?.value?.toLocaleString() || 0}
        </p>
        <p className="text-sm text-orange-600">
          Expenses: ฿{payload[1]?.value?.toLocaleString() || 0}
        </p>
      </div>
    );
  }
  return null;
};

export default function SalesVsExpensesChart() {
  const { data: chartData, isLoading, error } = useQuery<SalesVsExpensesData[]>({
    queryKey: ["/api/dashboard/sales-vs-expenses"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/sales-vs-expenses");
      if (!response.ok) {
        throw new Error("Failed to fetch sales vs expenses data");
      }
      return response.json();
    },
    retry: false, // Don't retry on failure
  });

  if (isLoading) {
    return (
      <Card className="restaurant-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Daily Sales vs Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-500">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="restaurant-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold text-gray-900">
          Daily Sales vs Expenses
        </CardTitle>
        <Button variant="outline" size="sm">
          View Report
        </Button>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="dayLabel" 
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#666"
                tickFormatter={(value) => `฿${value.toLocaleString()}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="sales" 
                fill="#0f766e" 
                name="Sales"
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="expenses" 
                fill="#ea580c" 
                name="Expenses"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}