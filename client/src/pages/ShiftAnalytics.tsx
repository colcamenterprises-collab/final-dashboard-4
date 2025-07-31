import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CalendarDays, TrendingUp, Package, DollarSign } from "lucide-react";

interface ShiftAnalytics {
  shiftDate: string;
  totals: {
    burgers: number;
    drinks: number;
    sides: number;
    extras: number;
    other: number;
    totalSales: number;
    totalReceipts: number;
  };
  items: Array<{
    category: string;
    name: string;
    quantity: number;
    sales: number;
  }>;
  modifiers: Array<{
    name: string;
    quantity: number;
    sales: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function ShiftAnalytics() {
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to yesterday's date (since shifts are processed the next day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });

  const { data: analytics, isLoading, error } = useQuery<ShiftAnalytics>({
    queryKey: ['/api/analysis/shift', selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/analysis/shift/${selectedDate}`);
      if (!response.ok) {
        throw new Error('Failed to fetch shift analytics');
      }
      return response.json();
    },
    enabled: !!selectedDate,
  });

  const processPreviousShift = async () => {
    try {
      const response = await fetch('/api/analysis/process-shift', {
        method: 'POST',
      });
      const result = await response.json();
      alert(result.message);
    } catch (error) {
      alert('Failed to process shift analytics');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading shift analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Shift Analytics
            </CardTitle>
            <CardDescription>Detailed breakdown of shift performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="date">Select Shift Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-48"
                />
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  No analytics found for {selectedDate}. Analytics are processed daily at 3am Bangkok time.
                </p>
                <Button onClick={processPreviousShift} className="mt-2" variant="outline">
                  Process Previous Shift Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Shift Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">No data available for the selected date.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categoryData = [
    { name: 'Burgers', value: analytics.totals.burgers, color: COLORS[0] },
    { name: 'Drinks', value: analytics.totals.drinks, color: COLORS[1] },
    { name: 'Sides', value: analytics.totals.sides, color: COLORS[2] },
    { name: 'Extras', value: analytics.totals.extras, color: COLORS[3] },
    { name: 'Other', value: analytics.totals.other, color: COLORS[4] },
  ].filter(item => item.value > 0);

  const topItems = analytics.items
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const topItemsChart = topItems.map(item => ({
    name: item.name.substring(0, 20) + (item.name.length > 20 ? '...' : ''),
    quantity: item.quantity,
    sales: item.sales
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Shift Analytics
          </CardTitle>
          <CardDescription>Detailed breakdown of shift performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="date">Select Shift Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-48"
              />
            </div>
            
            <div className="text-sm text-gray-600">
              Showing data for shift: {analytics.shiftDate} (6pm-3am)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">฿{analytics.totals.totalSales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.totals.totalReceipts} receipts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Burgers Sold</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totals.burgers}</div>
            <p className="text-xs text-muted-foreground">Main items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drinks Sold</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totals.drinks}</div>
            <p className="text-xs text-muted-foreground">Beverages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sides Sold</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totals.sides}</div>
            <p className="text-xs text-muted-foreground">Side orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Items by Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topItemsChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables */}
      <Tabs defaultValue="items" className="w-full">
        <TabsList>
          <TabsTrigger value="items">Items Breakdown</TabsTrigger>
          <TabsTrigger value="modifiers">Modifiers</TabsTrigger>
        </TabsList>
        
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Items Breakdown</CardTitle>
              <CardDescription>All items sold during the shift</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Badge variant="outline">{item.category}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">฿{item.sales.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="modifiers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Modifiers</CardTitle>
              <CardDescription>All modifiers ordered during the shift</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modifier Name</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.modifiers.map((modifier, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{modifier.name}</TableCell>
                      <TableCell className="text-right">{modifier.quantity}</TableCell>
                      <TableCell className="text-right">฿{modifier.sales.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}