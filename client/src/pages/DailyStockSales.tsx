import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { insertDailyStockSalesSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Calculator, Package, Utensils, Wine, Wrench, Box } from "lucide-react";
import { z } from "zod";

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
        <h1 className="text-2xl font-bold">Daily Stock and Sales Form</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Basic Information
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
                    <FormLabel>Cash at Start of Shift</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" placeholder="0.00" />
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
                    <FormLabel>Total Cash in Register</FormLabel>
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
                  
                  {form.watch('wageEntries').map((_, index) => (
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
                    <strong>Total Wages: ${form.watch('wageEntries').reduce((sum, entry) => sum + entry.amount, 0).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Shopping Section */}
              <div>
                <h3 className="text-lg font-medium mb-3">Shopping</h3>
                <p className="text-sm text-gray-600 mb-3">Please list each item individually</p>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3 text-sm font-medium text-gray-700">
                    <div className="col-span-4">Item</div>
                    <div className="col-span-3">Amount</div>
                    <div className="col-span-4">Notes</div>
                    <div className="col-span-1">Action</div>
                  </div>
                  
                  {form.watch('shoppingEntries').map((_, index) => (
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
                    <strong>Total Shopping: ${form.watch('shoppingEntries').reduce((sum, entry) => sum + entry.amount, 0).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Gas Expense and Total */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gasExpense"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gas Expense</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                        />
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
                            form.watch('wageEntries').reduce((sum, entry) => sum + entry.amount, 0) +
                            form.watch('shoppingEntries').reduce((sum, entry) => sum + entry.amount, 0) +
                            parseFloat(form.watch('gasExpense') || '0')
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

          {/* Stock Counts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Stock Counts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Stock Items */}
              <div>
                <h3 className="text-lg font-medium mb-3">Basic Stock</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="burgerBunsStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Burger Buns In Stock</FormLabel>
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
                        <FormLabel>Meat Weight (kg)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="0.00" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Food Items */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Utensils className="h-4 w-4" />
                  Food Items Required
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {FOOD_ITEMS.map((item) => (
                    <FormField
                      key={item}
                      control={form.control}
                      name={`foodItems.${item}` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{item}</FormLabel>
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
                  ))}
                </div>
              </div>

              {/* Drink Stock */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Wine className="h-4 w-4" />
                  Drink Stock Count
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {DRINK_ITEMS.map((item) => (
                    <FormField
                      key={item}
                      control={form.control}
                      name={`drinkStock.${item}` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{item}</FormLabel>
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
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kitchen Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Kitchen Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {KITCHEN_ITEMS.map((item) => (
                <FormField
                  key={item}
                  control={form.control}
                  name={`kitchenItems.${item}` as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">{item}</FormLabel>
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
              ))}
            </CardContent>
          </Card>

          {/* Packaging Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5" />
                Packaging & Supplies
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {PACKAGING_ITEMS.map((item) => (
                <FormField
                  key={item}
                  control={form.control}
                  name={`packagingItems.${item}` as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">{item}</FormLabel>
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
              ))}
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
    </div>
  );
}