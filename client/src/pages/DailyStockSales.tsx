import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Apple, Pizza, Croissant } from "lucide-react";
import { api } from "@/lib/api";

export default function DailyStockSales() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [shiftData, setShiftData] = useState({
    staffMember: "",
    startTime: "09:00",
    endTime: "17:00",
    openingStock: "",
    closingStock: "",
    salesTotal: ""
  });

  const { data: inventory } = useQuery({
    queryKey: ["/api/inventory"],
    queryFn: api.getInventory
  });

  const handleInputChange = (field: string, value: string) => {
    setShiftData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitShiftReport = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Shift report submitted:", shiftData);
    // Here you would typically call an API to save the shift report
  };

  const getStockIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'produce':
        return <Apple className="text-gray-600" />;
      case 'dairy':
        return <Pizza className="text-gray-600" />;
      case 'bakery':
        return <Croissant className="text-gray-600" />;
      default:
        return <Apple className="text-gray-600" />;
    }
  };

  const getStockStatus = (current: string, min: string) => {
    const currentStock = parseFloat(current);
    const minStock = parseFloat(min);
    
    if (currentStock <= minStock) {
      return { label: "Low Stock", color: "bg-red-100 text-red-800" };
    } else if (currentStock <= minStock * 1.5) {
      return { label: "Medium", color: "bg-yellow-100 text-yellow-800" };
    } else {
      return { label: "In Stock", color: "bg-green-100 text-green-800" };
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Daily Stock & Sales</h1>
        <div className="flex items-center space-x-4">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <Button className="restaurant-primary">
            Generate Report
          </Button>
        </div>
      </div>

      {/* Staff Shift Report Form */}
      <Card className="restaurant-card mb-8">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Staff Shift Report</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitShiftReport} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Staff Member</Label>
              <Select value={shiftData.staffMember} onValueChange={(value) => handleInputChange('staffMember', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="john-smith">John Smith</SelectItem>
                  <SelectItem value="sarah-johnson">Sarah Johnson</SelectItem>
                  <SelectItem value="mike-davis">Mike Davis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Shift Start</Label>
              <Input
                type="time"
                value={shiftData.startTime}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
                className="focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Shift End</Label>
              <Input
                type="time"
                value={shiftData.endTime}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
                className="focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Opening Stock Count</Label>
              <Input
                type="number"
                placeholder="Enter count"
                value={shiftData.openingStock}
                onChange={(e) => handleInputChange('openingStock', e.target.value)}
                className="focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Closing Stock Count</Label>
              <Input
                type="number"
                placeholder="Enter count"
                value={shiftData.closingStock}
                onChange={(e) => handleInputChange('closingStock', e.target.value)}
                className="focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Sales Total</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={shiftData.salesTotal}
                onChange={(e) => handleInputChange('salesTotal', e.target.value)}
                className="focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Inventory Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Current Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inventory?.map((item) => {
                const status = getStockStatus(item.quantity, item.minStock);
                return (
                  <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        {getStockIcon(item.category)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{item.quantity} {item.unit}</p>
                      <Badge variant="secondary" className={`text-xs ${status.color}`}>
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Daily Sales Summary */}
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Daily Sales Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <p className="text-sm text-gray-600">Morning Sales</p>
                  <p className="text-xl font-bold text-gray-900">$856.40</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Evening Sales</p>
                  <p className="text-xl font-bold text-gray-900">$1,621.96</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Orders</span>
                  <span className="font-semibold text-gray-900">127</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Average Order Value</span>
                  <span className="font-semibold text-gray-900">$19.51</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Peak Hour</span>
                  <span className="font-semibold text-gray-900">7:00 PM - 8:00 PM</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
