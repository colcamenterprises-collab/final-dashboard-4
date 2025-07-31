import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, Eye, FileText, DollarSign, Users, Package, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyStockSales } from "@shared/schema";

export default function DailyStockSalesSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedForm, setSelectedForm] = useState<DailyStockSales | null>(null);

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['/api/daily-stock-sales/search', searchQuery, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery);
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      
      const response = await fetch(`/api/daily-stock-sales/search?${params}`);
      if (!response.ok) throw new Error('Failed to search forms');
      return response.json();
    }
  });

  const handleSearch = () => {
    // This will trigger the query due to the dependencies
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const formatCurrency = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') {
      return '$0.00';
    }
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return `$${(isNaN(numValue) ? 0 : numValue).toFixed(2)}`;
  };

  const FormDetailView = ({ form }: { form: DailyStockSales }) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4 text-blue-500" />
          <div>
            <p className="text-sm text-gray-600">Completed By</p>
            <p className="font-medium">{form.completedBy}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <CalendarIcon className="h-4 w-4 text-green-500" />
          <div>
            <p className="text-sm text-gray-600">Shift Date</p>
            <p className="font-medium">{format(new Date(form.shiftDate), 'dd/MM/yyyy')}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={form.shiftType === 'Night Shift' ? 'secondary' : 'outline'}>
            {form.shiftType}
          </Badge>
        </div>
      </div>

      {/* Cash Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cash Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Starting Cash</p>
                <p className="font-medium">{formatCurrency(form.startingCash)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Ending Cash</p>
                <p className="font-medium">{formatCurrency(form.endingCash)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sales Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Grab Sales</p>
              <p className="font-medium text-green-600">{formatCurrency(form.grabSales)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Food Panda Sales</p>
              <p className="font-medium text-green-600">{formatCurrency(form.foodPandaSales)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Aroi Dee Sales</p>
              <p className="font-medium text-green-600">{formatCurrency(form.aroiDeeSales)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">QR Scan Sales</p>
              <p className="font-medium text-green-600">{formatCurrency(form.qrScanSales)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Cash Sales</p>
              <p className="font-medium text-green-600">{formatCurrency(form.cashSales)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-semibold">Total Sales</p>
              <p className="font-bold text-green-600">{formatCurrency(form.totalSales)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Expenses Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Salary / Wages</p>
              <p className="font-medium text-red-600">{formatCurrency(form.salaryWages)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Shopping</p>
              <p className="font-medium text-red-600">{formatCurrency(form.shopping)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Gas Expense</p>
              <p className="font-medium text-red-600">{formatCurrency(form.gasExpense)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-semibold">Total Expenses</p>
              <p className="font-bold text-red-600">{formatCurrency(form.totalExpenses)}</p>
            </div>
          </div>
          {form.expenseDescription && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Expense Description</p>
              <p className="text-sm">{form.expenseDescription}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wage Entries */}
      {form.wageEntries && (form.wageEntries as any[]).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Salary / Wages Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(form.wageEntries as any[]).map((entry, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-medium">{entry.name}</p>
                    {entry.notes && <p className="text-sm text-gray-600">{entry.notes}</p>}
                  </div>
                  <Badge variant="outline">{formatCurrency(entry.amount)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shopping Entries */}
      {form.shoppingEntries && (form.shoppingEntries as any[]).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shopping Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(form.shoppingEntries as any[]).map((entry, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-medium">{entry.item}</p>
                    {entry.shop && <p className="text-xs text-blue-600">Shop: {entry.shop}</p>}
                    {entry.customShop && <p className="text-xs text-blue-600">Custom Shop: {entry.customShop}</p>}
                    {entry.notes && <p className="text-sm text-gray-600">{entry.notes}</p>}
                  </div>
                  <Badge variant="outline">{formatCurrency(entry.amount)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stock Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Burger Buns Stock</p>
              <p className="font-medium">{form.burgerBunsStock}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Rolls Ordered</p>
              <p className="font-medium">{form.rollsOrderedCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Meat Weight</p>
              <p className="font-medium">{form.meatWeight} kg</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Drink Stock Count</p>
              <p className="font-medium">{form.drinkStockCount}</p>
            </div>
          </div>
          {form.rollsOrderedConfirmed && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700">✓ Rolls Ordered Confirmed</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fresh Food Items */}
      {form.freshFood && Object.keys(form.freshFood as any).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fresh Food Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(form.freshFood as any).map(([key, value]) => (
                <div key={key} className="p-3 border rounded-lg">
                  <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-sm text-gray-600">{value ? 'Required' : 'Not Required'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Frozen Food Items */}
      {form.frozenFood && Object.keys(form.frozenFood as any).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Frozen Food Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(form.frozenFood as any).map(([key, value]) => (
                <div key={key} className="p-3 border rounded-lg">
                  <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-sm text-gray-600">{value ? 'Required' : 'Not Required'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shelf Items */}
      {form.shelfItems && Object.keys(form.shelfItems as any).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shelf Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(form.shelfItems as any).map(([key, value]) => (
                <div key={key} className="p-3 border rounded-lg">
                  <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-sm text-gray-600">{value ? 'Required' : 'Not Required'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kitchen Items */}
      {form.kitchenItems && Object.keys(form.kitchenItems as any).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kitchen Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(form.kitchenItems as any).map(([key, value]) => (
                <div key={key} className="p-3 border rounded-lg">
                  <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-sm text-gray-600">{value ? 'Required' : 'Not Required'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Packaging Items */}
      {form.packagingItems && Object.keys(form.packagingItems as any).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Packaging Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(form.packagingItems as any).map(([key, value]) => (
                <div key={key} className="p-3 border rounded-lg">
                  <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-sm text-gray-600">{value ? 'Required' : 'Not Required'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drink Stock */}
      {form.drinkStock && Object.keys(form.drinkStock as any).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Drink Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(form.drinkStock as any).map(([key, value]) => (
                <div key={key} className="p-3 border rounded-lg">
                  <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-sm text-gray-600">{value ? 'In Stock' : 'Out of Stock'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}



      {/* Draft Status */}
      {form.isDraft && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">Draft</Badge>
              <p className="text-sm text-gray-600">This form is saved as a draft</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timestamps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Form Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Created At</p>
              <p className="font-medium">{format(new Date(form.createdAt), 'dd/MM/yyyy HH:mm')}</p>
            </div>
            <div>
              <p className="text-gray-600">Updated At</p>
              <p className="font-medium">{format(new Date(form.updatedAt), 'dd/MM/yyyy HH:mm')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Daily Stock & Sales Search</h1>
        <p className="text-gray-600">Search and view completed Daily Stock and Sales forms</p>
      </div>

      {/* Search Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search by staff name, date, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="flex space-x-2 mt-4">
            <Button onClick={handleSearch} className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span>Search</span>
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p>Searching forms...</p>
          </CardContent>
        </Card>
      ) : selectedForm ? (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Form Details</CardTitle>
              <Button variant="outline" onClick={() => setSelectedForm(null)}>
                Back to Results
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <FormDetailView form={selectedForm} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Search Results ({forms.length} forms found)</CardTitle>
          </CardHeader>
          <CardContent>
            {forms.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No forms found matching your search criteria</p>
              </div>
            ) : (
              <div className="space-y-6">
                {forms.map((form: DailyStockSales) => (
                  <div key={form.id} className="border rounded-lg p-6 hover:bg-gray-50">
                    {/* Form Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <h3 className="font-bold text-lg">{form.completedBy}</h3>
                          <Badge variant={form.shiftType === 'Night Shift' ? 'secondary' : 'outline'}>
                            {form.shiftType}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {format(new Date(form.shiftDate), 'MMM dd, yyyy')}
                          </span>
                          {form.isDraft && (
                            <Badge variant="outline" className="text-orange-600 border-orange-600">
                              Draft
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedForm(form)}
                        className="flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View Full Details</span>
                      </Button>
                    </div>

                    {/* Sales Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="text-xs text-gray-600">Total Sales</span>
                        <p className="font-bold text-green-600">{formatCurrency(form.totalSales)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">Cash Sales</span>
                        <p className="font-medium">{formatCurrency(form.cashSales)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">Grab Sales</span>
                        <p className="font-medium">{formatCurrency(form.grabSales)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">QR Scan</span>
                        <p className="font-medium">{formatCurrency(form.qrScanSales)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">FoodPanda</span>
                        <p className="font-medium">{formatCurrency(form.foodPandaSales)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">Aroi Dee</span>
                        <p className="font-medium">{formatCurrency(form.aroiDeeSales)}</p>
                      </div>
                    </div>

                    {/* Cash Management */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-3 bg-blue-50 rounded-lg">
                      <div>
                        <span className="text-xs text-gray-600">Starting Cash</span>
                        <p className="font-medium">{formatCurrency(form.startingCash)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">Ending Cash</span>
                        <p className="font-medium">{formatCurrency(form.endingCash)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">Total Expenses</span>
                        <p className="font-medium text-red-600">{formatCurrency(form.totalExpenses)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">Cash Balance</span>
                        <p className="font-medium">{formatCurrency(Number(form.endingCash) - Number(form.startingCash))}</p>
                      </div>
                    </div>

                    {/* Expense Breakdown */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-3 bg-red-50 rounded-lg">
                      <div>
                        <span className="text-xs text-gray-600">Wages</span>
                        <p className="font-medium">{formatCurrency(form.salaryWages)}</p>
                        <p className="text-xs text-gray-500">{(form.wageEntries as any[] || []).length} entries</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">Shopping</span>
                        <p className="font-medium">{formatCurrency(form.shopping)}</p>
                        <p className="text-xs text-gray-500">{(form.shoppingEntries as any[] || []).length} items</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">Gas Expense</span>
                        <p className="font-medium">{formatCurrency(form.gasExpense)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">Other Expenses</span>
                        <p className="font-medium">{formatCurrency(form.otherExpenses)}</p>
                      </div>
                    </div>

                    {/* Stock Information */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-3 bg-green-50 rounded-lg">
                      <div>
                        <span className="text-xs text-gray-600">Burger Buns</span>
                        <p className="font-medium">{form.burgerBunsStock}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">Rolls Ordered</span>
                        <p className="font-medium">{form.rollsOrderedCount}</p>
                        {form.rollsOrderedConfirmed && <span className="text-xs text-green-600">✓ Confirmed</span>}
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">Meat Weight</span>
                        <p className="font-medium">{form.meatWeight} kg</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-600">Drink Stock</span>
                        <p className="font-medium">{form.drinkStockCount}</p>
                      </div>
                    </div>

                    {/* Inventory Status */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {/* Fresh Food Status */}
                      {form.freshFood && Object.keys(form.freshFood as any).length > 0 && (
                        <div className="p-3 border rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Fresh Food Items</p>
                          <p className="font-medium">{Object.values(form.freshFood as any).filter(v => v).length} required</p>
                          <p className="text-xs text-gray-500">of {Object.keys(form.freshFood as any).length} total</p>
                        </div>
                      )}

                      {/* Frozen Food Status */}
                      {form.frozenFood && Object.keys(form.frozenFood as any).length > 0 && (
                        <div className="p-3 border rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Frozen Food Items</p>
                          <p className="font-medium">{Object.values(form.frozenFood as any).filter(v => v).length} required</p>
                          <p className="text-xs text-gray-500">of {Object.keys(form.frozenFood as any).length} total</p>
                        </div>
                      )}

                      {/* Kitchen Items Status */}
                      {form.kitchenItems && Object.keys(form.kitchenItems as any).length > 0 && (
                        <div className="p-3 border rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Kitchen Items</p>
                          <p className="font-medium">{Object.values(form.kitchenItems as any).filter(v => v).length} required</p>
                          <p className="text-xs text-gray-500">of {Object.keys(form.kitchenItems as any).length} total</p>
                        </div>
                      )}

                      {/* Packaging Items Status */}
                      {form.packagingItems && Object.keys(form.packagingItems as any).length > 0 && (
                        <div className="p-3 border rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Packaging Items</p>
                          <p className="font-medium">{Object.values(form.packagingItems as any).filter(v => v).length} required</p>
                          <p className="text-xs text-gray-500">of {Object.keys(form.packagingItems as any).length} total</p>
                        </div>
                      )}
                    </div>

                    {/* Additional Details */}
                    <div className="flex justify-between items-center text-sm text-gray-600 mt-4 pt-3 border-t">
                      <div className="flex space-x-4">
                        <span>Created: {format(new Date(form.createdAt), 'MMM dd, HH:mm')}</span>
                        <span>Updated: {format(new Date(form.updatedAt), 'MMM dd, HH:mm')}</span>
                        {form.receiptPhotos && (form.receiptPhotos as any[]).length > 0 && (
                          <span className="flex items-center space-x-1">
                            <Camera className="h-3 w-3" />
                            <span>{(form.receiptPhotos as any[]).length} photos</span>
                          </span>
                        )}
                      </div>
                      {form.expenseDescription && (
                        <span className="text-blue-600">Has expense notes</span>
                      )}
                    </div>

                    {/* Wage Entries Details */}
                    {form.wageEntries && (form.wageEntries as any[]).length > 0 && (
                      <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-2">Wage Entries Summary</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {(form.wageEntries as any[]).slice(0, 4).map((entry, index) => (
                            <div key={index} className="flex justify-between">
                              <span>{entry.name} ({entry.notes})</span>
                              <span className="font-medium">{formatCurrency(entry.amount)}</span>
                            </div>
                          ))}
                          {(form.wageEntries as any[]).length > 4 && (
                            <div className="text-gray-500 text-xs">
                              +{(form.wageEntries as any[]).length - 4} more entries...
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Shopping Entries Details */}
                    {form.shoppingEntries && (form.shoppingEntries as any[]).length > 0 && (
                      <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-2">Shopping Entries Summary</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {(form.shoppingEntries as any[]).slice(0, 4).map((entry, index) => (
                            <div key={index} className="flex justify-between">
                              <span>{entry.item} ({entry.shop})</span>
                              <span className="font-medium">{formatCurrency(entry.amount)}</span>
                            </div>
                          ))}
                          {(form.shoppingEntries as any[]).length > 4 && (
                            <div className="text-gray-500 text-xs">
                              +{(form.shoppingEntries as any[]).length - 4} more entries...
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Expense Description */}
                    {form.expenseDescription && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-1">Expense Notes</p>
                        <p className="text-sm text-gray-600">{form.expenseDescription}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}