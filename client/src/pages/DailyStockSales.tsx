import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { insertDailyStockSalesSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Calculator, Package, Utensils, Wine, Wrench, Box, Search, Eye, FileText, Users } from "lucide-react";
import { z } from "zod";
import type { DailyStockSales } from "@shared/schema";

// Food items from your form
const FOOD_ITEMS = [
  'Salad', 'Tomatos', 'White Cabbage', 'Purple Cabbage', 'Onions', 'Mayonnaise',
  'Mustard', 'Cajun Spice', 'Dill Pickles', 'Sweet Pickles', 'Crispy Fried Onions',
  'BBQ Sauce (Smokey)', 'Bacon Short', 'Bacon Long', 'Sweet Potato Fries', 'Cheese',
  'Chicken Nuggets', 'Onion Rings', 'French Fries', 'Jalapenos', 'Ketchup',
  'Chili Sauce (Sriracha)', 'Oil (Fryer)', 'BBQ Sauce', 'Pepper', 'Salt'
];

// Drink items with current requirements
const DRINK_ITEMS = [
  'Coke', 'Coke Zero', 'Schweppes Manow', 'Fanta Strawberry', 'Orange Fanta',
  'Sprite', 'Kids Apple Juice', 'Kids Orange', 'Soda Water', 'Bottle Water'
];

// Kitchen supplies
const KITCHEN_ITEMS = [
  'Clear Food Wrap', 'Aluminum Foil', 'Plastic Hand Gloves (Meat)', 'Rubber Gloves (Small)',
  'Rubber Gloves (Medium)', 'Rubber Gloves (Large)', 'Alcohol Sanitiser',
  'Dish Washing Liquid', 'Paper Towel (Long)', 'Sponge (dish washing)',
  'Paper Towel (Short)', 'Rolls Sticky Tape'
];

// Packaging supplies
const PACKAGING_ITEMS = [
  'French Fries Box', 'French Fries Paper', 'Paper Food Bags', 'Fork & Knife Set',
  'Loaded Fries Boxes', 'Burger Paper (12 x 14)', 'Wooden Flag Skewers',
  'Printer Rolls', 'Takeaway Sauce Containers', 'Coleslaw Container',
  'Plastic Carry Bags', 'Packaging Labels'
];

// Define line item types
const wageEntrySchema = z.object({
  name: z.string(),
  amount: z.number().min(0),
  notes: z.string().optional()
});

const shoppingEntrySchema = z.object({
  item: z.string(),
  amount: z.number().min(0),
  notes: z.string().optional()
});

const formSchema = insertDailyStockSalesSchema.extend({
  foodItems: z.record(z.number().min(0)),
  drinkStock: z.record(z.number().min(0)),
  kitchenItems: z.record(z.number().min(0)),
  packagingItems: z.record(z.number().min(0)),
  wageEntries: z.array(wageEntrySchema).default([]),
  shoppingEntries: z.array(shoppingEntrySchema).default([])
});

type FormData = z.infer<typeof formSchema>;
type WageEntry = z.infer<typeof wageEntrySchema>;
type ShoppingEntry = z.infer<typeof shoppingEntrySchema>;

export default function DailyStockSales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedForm, setSelectedForm] = useState<DailyStockSales | null>(null);

  // Search query for completed forms
  const { data: completedForms = [], isLoading: searchLoading } = useQuery({
    queryKey: ['/api/daily-stock-sales/search', searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery);
      
      const response = await fetch(`/api/daily-stock-sales/search?${params}`);
      if (!response.ok) throw new Error('Failed to search forms');
      return response.json();
    }
  });
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      completedBy: "",
      shiftType: "Night Shift",
      shiftDate: new Date(),
      startingCash: "0",
      endingCash: "0",
      grabSales: "0",
      foodPandaSales: "0",
      aroiDeeSales: "0",
      qrScanSales: "0",
      cashSales: "0",
      totalSales: "0",
      salaryWages: "0",
      shopping: "0",
      gasExpense: "0",
      totalExpenses: "0",
      expenseDescription: "",
      wageEntries: [],
      shoppingEntries: [],
      burgerBunsStock: 0,
      rollsOrderedCount: 0,
      meatWeight: "0",
      rollsOrderedConfirmed: false,
      foodItems: Object.fromEntries(FOOD_ITEMS.map(item => [item, 0])),
      drinkStock: Object.fromEntries(DRINK_ITEMS.map(item => [item, 0])),
      kitchenItems: Object.fromEntries(KITCHEN_ITEMS.map(item => [item, 0])),
      packagingItems: Object.fromEntries(PACKAGING_ITEMS.map(item => [item, 0]))
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => apiRequest('/api/daily-stock-sales', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      toast({
        title: "Form Submitted Successfully",
        description: "Daily stock and sales data has been saved and shopping list generated."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/shopping-list'] });
      form.reset();
    },
    onError: (error) => {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: "Failed to submit form. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Auto-calculate total sales
  const calculateTotalSales = () => {
    const grab = parseFloat(form.getValues('grabSales') || '0');
    const foodPanda = parseFloat(form.getValues('foodPandaSales') || '0');
    const aroiDee = parseFloat(form.getValues('aroiDeeSales') || '0');
    const qrScan = parseFloat(form.getValues('qrScanSales') || '0');
    const cash = parseFloat(form.getValues('cashSales') || '0');
    
    const total = grab + foodPanda + aroiDee + qrScan + cash;
    form.setValue('totalSales', total.toFixed(2));
  };

  // Auto-calculate total expenses
  const formatCurrency = (value: string | number) => {
    return `$${parseFloat(value.toString()).toFixed(2)}`;
  };

  const calculateTotalExpenses = () => {
    const salary = parseFloat(form.getValues('salaryWages') || '0');
    const shopping = parseFloat(form.getValues('shopping') || '0');
    const gas = parseFloat(form.getValues('gasExpense') || '0');
    
    const total = salary + shopping + gas;
    form.setValue('totalExpenses', total.toFixed(2));
  };

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Daily Stock and Sales</h1>
      </div>

      <Tabs defaultValue="new-form" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="new-form">New Form</TabsTrigger>
          <TabsTrigger value="search">Search Completed Forms</TabsTrigger>
        </TabsList>
        
        <TabsContent value="new-form" className="space-y-6">
          <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Who is Completing Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Who is Completing Form
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="completedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Who is Completing Form?</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter your name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="shiftType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Night Shift">Night Shift</SelectItem>
                        <SelectItem value="Day Shift">Day Shift</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shiftDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Today's Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Cash Management */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Management</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startingCash"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cash in Register at Start of Shift</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />


            </CardContent>
          </Card>

          {/* Sales Data */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="grabSales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grab Sales</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          onChange={(e) => {
                            field.onChange(e);
                            setTimeout(calculateTotalSales, 100);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="foodPandaSales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Direct Sales</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          onChange={(e) => {
                            field.onChange(e);
                            setTimeout(calculateTotalSales, 100);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="aroiDeeSales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aroi Dee Sales</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          onChange={(e) => {
                            field.onChange(e);
                            setTimeout(calculateTotalSales, 100);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="qrScanSales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>QR / Scan Sales</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          onChange={(e) => {
                            field.onChange(e);
                            setTimeout(calculateTotalSales, 100);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cashSales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cash Sales</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          onChange={(e) => {
                            field.onChange(e);
                            setTimeout(calculateTotalSales, 100);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="totalSales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Sales Amount</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" readOnly className="bg-gray-50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card>
            <CardHeader>
              <CardTitle>Expenses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Wages Section */}
              <div>
                <h3 className="text-lg font-medium mb-3">Salary / Wages</h3>
                <p className="text-sm text-gray-600 mb-3">Please list each staff member individually</p>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3 text-sm font-medium text-gray-700">
                    <div className="col-span-4">Name</div>
                    <div className="col-span-3">Amount</div>
                    <div className="col-span-4">Notes</div>
                    <div className="col-span-1">Action</div>
                  </div>
                  
                  {(form.watch('wageEntries') || []).map((_, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3">
                      <FormField
                        control={form.control}
                        name={`wageEntries.${index}.name`}
                        render={({ field }) => (
                          <FormItem className="col-span-4">
                            <FormControl>
                              <Input {...field} placeholder="Cameron" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`wageEntries.${index}.amount`}
                        render={({ field }) => (
                          <FormItem className="col-span-3">
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="0.01" 
                                placeholder="1000"
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`wageEntries.${index}.notes`}
                        render={({ field }) => (
                          <FormItem className="col-span-4">
                            <FormControl>
                              <Input {...field} placeholder="Paid 100 overtime" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="col-span-1">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const current = form.getValues('wageEntries');
                            form.setValue('wageEntries', current.filter((_, i) => i !== index));
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      const current = form.getValues('wageEntries');
                      form.setValue('wageEntries', [...current, { name: '', amount: 0, notes: '' }]);
                    }}
                  >
                    Add Wage Entry
                  </Button>
                  
                  <div className="text-right">
                    <strong>Total Wages: ${(form.watch('wageEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Shopping Section */}
              <div>
                <h3 className="text-lg font-medium mb-3">Shopping & Other Expenses</h3>
                <p className="text-sm text-gray-600 mb-3">Please list each item individually</p>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3 text-sm font-medium text-gray-700">
                    <div className="col-span-4">Item</div>
                    <div className="col-span-3">Amount</div>
                    <div className="col-span-4">Notes</div>
                    <div className="col-span-1">Action</div>
                  </div>
                  
                  {(form.watch('shoppingEntries') || []).map((_, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3">
                      <FormField
                        control={form.control}
                        name={`shoppingEntries.${index}.item`}
                        render={({ field }) => (
                          <FormItem className="col-span-4">
                            <FormControl>
                              <Input {...field} placeholder="Bin Bags" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`shoppingEntries.${index}.amount`}
                        render={({ field }) => (
                          <FormItem className="col-span-3">
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="0.01" 
                                placeholder="300"
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`shoppingEntries.${index}.notes`}
                        render={({ field }) => (
                          <FormItem className="col-span-4">
                            <FormControl>
                              <Input {...field} placeholder="Notes" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="col-span-1">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const current = form.getValues('shoppingEntries');
                            form.setValue('shoppingEntries', current.filter((_, i) => i !== index));
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      const current = form.getValues('shoppingEntries');
                      form.setValue('shoppingEntries', [...current, { item: '', amount: 0, notes: '' }]);
                    }}
                  >
                    Add Shopping Item
                  </Button>
                  
                  <div className="text-right">
                    <strong>Total Shopping & Other: ${(form.watch('shoppingEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Total Expenses */}
              <div className="flex justify-end">
                <FormField
                  control={form.control}
                  name="totalExpenses"
                  render={({ field }) => (
                    <FormItem className="w-full md:w-1/2">
                      <FormLabel>Total Expenses</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          readOnly 
                          className="bg-gray-50"
                          value={
                            (form.watch('wageEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0) +
                            (form.watch('shoppingEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Sales and Expenses Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Sales and Expenses Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="totalSales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Sales Amount</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" readOnly className="bg-gray-50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="totalExpenses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Expenses</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          readOnly 
                          className="bg-gray-50"
                          value={
                            (form.watch('wageEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0) +
                            (form.watch('shoppingEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endingCash"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cash in Register at End of Shift</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Cash Balance Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Cash Balance Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-center">
                  {(() => {
                    const startingCash = parseFloat(form.watch('startingCash') || '0');
                    const cashSales = parseFloat(form.watch('cashSales') || '0');
                    const totalExpenses = (form.watch('wageEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0) +
                                        (form.watch('shoppingEntries') || []).reduce((sum, entry) => sum + (entry.amount || 0), 0);
                    const expectedCash = startingCash + cashSales - totalExpenses;
                    const actualCash = parseFloat(form.watch('endingCash') || '0');
                    const variance = Math.abs(expectedCash - actualCash);
                    const isBalanced = variance <= 20; // 20 baht variance tolerance

                    return (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Cash Balance Status</p>
                        <span className={`inline-flex px-4 py-2 rounded-full text-lg font-medium ${
                          isBalanced 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {isBalanced ? 'Balanced' : 'Not Balanced'}
                        </span>
                        <p className="text-xs text-gray-500 mt-2">
                          Detailed calculations available to management after form submission
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stock Counts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Stock Counts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="burgerBunsStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Burger Buns in Stock</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          min="0" 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rollsOrderedCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rolls Ordered</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          min="0" 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="meatWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meat Weight</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="drinkStockCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Drinks (Drink Stock Count)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          min="0" 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Food Items Required */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Food Items Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Fresh Food */}
              <div>
                <h3 className="text-lg font-medium mb-3">Fresh Food</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <FormField
                    control={form.control}
                    name="freshFood.salad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Salad</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.tomatos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Tomatos</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.whiteCabbage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">White Cabbage</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.purpleCabbage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Purple Cabbage</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.onions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Onions</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.baconShort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Bacon Short</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.baconLong"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Bacon Long</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.cheese"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Cheese</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.milk"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Milk</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freshFood.butter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Butter</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            className="h-8"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Other Fresh Food Items */}
                <div className="mt-4">
                  <h4 className="text-md font-medium mb-2">Other items not listed</h4>
                  <div className="space-y-2">
                    {(form.watch('freshFood.otherItems') || []).map((item, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          placeholder="Item name"
                          value={item.name || ''}
                          onChange={(e) => {
                            const current = form.getValues('freshFood.otherItems') || [];
                            current[index] = { ...current[index], name: e.target.value };
                            form.setValue('freshFood.otherItems', current);
                          }}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="Quantity"
                          value={item.quantity || ''}
                          onChange={(e) => {
                            const current = form.getValues('freshFood.otherItems') || [];
                            current[index] = { ...current[index], quantity: parseInt(e.target.value) || 0 };
                            form.setValue('freshFood.otherItems', current);
                          }}
                          className="w-24"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const current = form.getValues('freshFood.otherItems') || [];
                            form.setValue('freshFood.otherItems', current.filter((_, i) => i !== index));
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        const current = form.getValues('freshFood.otherItems') || [];
                        form.setValue('freshFood.otherItems', [...current, { name: '', quantity: 0 }]);
                      }}
                    >
                      Add Other Fresh Food Item
                    </Button>
                  </div>
                </div>
              </div>

              {/* Shelf Items */}
              <div>
                <h3 className="text-lg font-medium mb-3">Shelf Items</h3>
                <div className="text-sm text-gray-600 mb-4">
                  Shelf items section - please specify which items should be included here.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confirmation */}
          <Card>
            <CardHeader>
              <CardTitle>Confirmation</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="rollsOrderedConfirmed"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Confirm that you have ordered rolls</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
              className="min-w-[200px]"
            >
              {createMutation.isPending ? "Submitting..." : "Submit Form"}
            </Button>
          </div>
          </form>
        </Form>
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search Completed Forms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Search by staff name, date, notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={() => {}} className="flex items-center space-x-2">
                    <Search className="h-4 w-4" />
                    <span>Search</span>
                  </Button>
                </div>

                {searchLoading ? (
                  <div className="text-center py-8">
                    <p>Searching forms...</p>
                  </div>
                ) : selectedForm ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Form Details</h3>
                      <Button variant="outline" onClick={() => setSelectedForm(null)}>
                        Back to Results
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-sm text-gray-600">Completed By</p>
                          <p className="font-medium">{selectedForm.completedBy}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div>
                          <p className="text-sm text-gray-600">Shift Date</p>
                          <p className="font-medium">{format(new Date(selectedForm.shiftDate), 'PPP')}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={selectedForm.shiftType === 'Night Shift' ? 'secondary' : 'outline'}>
                          {selectedForm.shiftType}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <div>
                              <p className="text-sm text-gray-600">Total Sales</p>
                              <p className="font-bold text-green-600">{formatCurrency(selectedForm.totalSales)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <div>
                              <p className="text-sm text-gray-600">Total Expenses</p>
                              <p className="font-bold text-red-600">{formatCurrency(selectedForm.totalExpenses)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <div>
                              <p className="text-sm text-gray-600">Starting Cash</p>
                              <p className="font-medium">{formatCurrency(selectedForm.startingCash)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <div>
                              <p className="text-sm text-gray-600">Ending Cash</p>
                              <p className="font-medium">{formatCurrency(selectedForm.endingCash)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Search Results ({completedForms.length} forms found)</h3>
                    {completedForms.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No forms found matching your search criteria</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {completedForms.map((form: DailyStockSales) => (
                          <div key={form.id} className="border rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-4 mb-2">
                                  <h4 className="font-medium">{form.completedBy}</h4>
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
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}