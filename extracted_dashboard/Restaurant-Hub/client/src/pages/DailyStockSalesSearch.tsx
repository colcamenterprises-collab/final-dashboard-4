import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, Eye, FileText, DollarSign, Users, Package } from "lucide-react";
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

  const formatCurrency = (value: string | number) => {
    return `$${parseFloat(value.toString()).toFixed(2)}`;
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
            <p className="font-medium">{format(new Date(form.shiftDate), 'PPP')}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={form.shiftType === 'Night Shift' ? 'secondary' : 'outline'}>
            {form.shiftType}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Total Sales</p>
                <p className="font-bold text-green-600">{formatCurrency(form.totalSales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm text-gray-600">Total Expenses</p>
                <p className="font-bold text-red-600">{formatCurrency(form.totalExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Starting Cash</p>
                <p className="font-medium">{formatCurrency(form.startingCash)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Ending Cash</p>
                <p className="font-medium">{formatCurrency(form.endingCash)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wage Entries */}
      {form.wageEntries && (form.wageEntries as any[]).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Salary / Wages</CardTitle>
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
            <CardTitle className="text-lg">Shopping</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(form.shoppingEntries as any[]).map((entry, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-medium">{entry.item}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="space-y-4">
                {forms.map((form: DailyStockSales) => (
                  <div key={form.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <h3 className="font-medium">{form.completedBy}</h3>
                          <Badge variant={form.shiftType === 'Night Shift' ? 'secondary' : 'outline'}>
                            {form.shiftType}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {format(new Date(form.shiftDate), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Sales: </span>
                            <span className="font-medium text-green-600">{formatCurrency(form.totalSales)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Expenses: </span>
                            <span className="font-medium text-red-600">{formatCurrency(form.totalExpenses)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Wages: </span>
                            <span className="font-medium">{(form.wageEntries as any[] || []).length} entries</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Shopping: </span>
                            <span className="font-medium">{(form.shoppingEntries as any[] || []).length} items</span>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedForm(form)}
                        className="flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </Button>
                    </div>
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