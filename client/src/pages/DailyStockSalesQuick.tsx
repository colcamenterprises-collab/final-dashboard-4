import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

// All inventory items
const FRESH_FOOD_ITEMS = ['Salad', 'Tomatos', 'White Cabbage', 'Purple Cabbage', 'Onions', 'Milk', 'Butter'];
const FROZEN_FOOD_ITEMS = ['Sweet Potato Fries', 'Chicken Nuggets', 'Chicken Fillets', 'French Fries'];
const SHELF_ITEMS = ['Mayonnaise', 'Mustard', 'Cajun Spice', 'Dill Pickles', 'Sweet Pickles', 'Crispy Fried Onions', 'BBQ Sauce (Smokey)', 'Jalapenos', 'Ketchup', 'Chili Sauce (Sriracha)', 'Oil (Fryer)', 'Pepper', 'Salt'];
const DRINK_ITEMS = ['Coke', 'Schweppes Manow', 'Coke Zero', 'Fanta Strawberry', 'Fanta Orange', 'Kids Apple Juice', 'Kids Orange', 'Soda Water', 'Bottle Water', 'Sprite'];
const KITCHEN_ITEMS = ['Clear Food Wrap', 'Aluminum Foil', 'Plastic Hand Gloves (Meat)', 'Rubber Gloves (Small)', 'Rubber Gloves (Medium)', 'Rubber Gloves (Large)', 'Alcohol Sanitiser', 'Dish Washing Liquid', 'Paper Towel (Long)', 'Sponge (dish washing)', 'Paper Towel (Short)', 'Rolls Sticky Tape'];
const PACKAGING_ITEMS = ['French Fries Box', 'French Fries Paper', 'Paper Food Bags', 'Fork & Knife Set', 'Loaded Fries Boxes', 'Burger Paper (12 x 14)', 'Wooden Flag Skewers', 'Printer Rolls', 'Takeaway Sauce Containers', 'Coleslaw Container', 'Plastic Carry Bags', 'Packaging Labels'];

const formSchema = z.object({
  completedBy: z.string().min(1, "Required"),
  shiftType: z.enum(['opening', 'closing']),
  shiftDate: z.date(),
  grabSales: z.coerce.number().min(0).default(0),
  foodPandaSales: z.coerce.number().min(0).default(0),
  aroiDeeSales: z.coerce.number().min(0).default(0),
  qrScanSales: z.coerce.number().min(0).default(0),
  cashSales: z.coerce.number().min(0).default(0),
  totalSales: z.coerce.number().min(0).default(0),
  salaryWages: z.coerce.number().min(0).default(0),
  shopping: z.coerce.number().min(0).default(0),
  gasExpense: z.coerce.number().min(0).default(0),
  totalExpenses: z.coerce.number().min(0).default(0),
  expenseDescription: z.string().optional(),
  burgerBunsStock: z.coerce.number().min(0).default(0),
  rollsOrderedCount: z.coerce.number().min(0).default(0),
  meatWeight: z.coerce.number().min(0).default(0),
  freshFood: z.record(z.coerce.number().min(0).default(0)).default({}),
  frozenFood: z.record(z.coerce.number().min(0).default(0)).default({}),
  shelfItems: z.record(z.coerce.number().min(0).default(0)).default({}),
  drinkStock: z.record(z.coerce.number().min(0).default(0)).default({}),
  kitchenItems: z.record(z.coerce.number().min(0).default(0)).default({}),
  packagingItems: z.record(z.coerce.number().min(0).default(0)).default({})
});

type FormData = z.infer<typeof formSchema>;

export default function DailyStockSalesQuick() {
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      completedBy: "",
      shiftType: "closing",
      shiftDate: new Date(),
      grabSales: 0,
      foodPandaSales: 0,
      aroiDeeSales: 0,
      qrScanSales: 0,
      cashSales: 0,
      totalSales: 0,
      salaryWages: 0,
      shopping: 0,
      gasExpense: 0,
      totalExpenses: 0,
      expenseDescription: "",
      burgerBunsStock: 0,
      rollsOrderedCount: 0,
      meatWeight: 0,
      freshFood: Object.fromEntries(FRESH_FOOD_ITEMS.map(item => [item, 0])),
      frozenFood: Object.fromEntries(FROZEN_FOOD_ITEMS.map(item => [item, 0])),
      shelfItems: Object.fromEntries(SHELF_ITEMS.map(item => [item, 0])),
      drinkStock: Object.fromEntries(DRINK_ITEMS.map(item => [item, 0])),
      kitchenItems: Object.fromEntries(KITCHEN_ITEMS.map(item => [item, 0])),
      packagingItems: Object.fromEntries(PACKAGING_ITEMS.map(item => [item, 0]))
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => apiRequest('/api/daily-stock-sales', 'POST', data),
    onSuccess: () => {
      toast({ title: "Form submitted successfully!" });
      form.reset();
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to submit form", variant: "destructive" });
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Quick Daily Stock & Sales</h1>
        <p className="text-gray-600 mt-2">Complete your shift end report</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
          
          {/* Basic Info */}
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="completedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="closing">Closing</SelectItem>
                        <SelectItem value="opening">Opening</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Sales */}
          <Card>
            <CardHeader><CardTitle>Sales</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="grabSales" render={({ field }) => (
                <FormItem>
                  <FormLabel>Grab Sales</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="foodPandaSales" render={({ field }) => (
                <FormItem>
                  <FormLabel>Food Panda Sales</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="aroiDeeSales" render={({ field }) => (
                <FormItem>
                  <FormLabel>Aroi Dee Sales</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="qrScanSales" render={({ field }) => (
                <FormItem>
                  <FormLabel>QR Scan Sales</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cashSales" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cash Sales</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="totalSales" render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Sales</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card>
            <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormField control={form.control} name="salaryWages" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salary/Wages</FormLabel>
                    <FormControl><Input {...field} type="number" min="0" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="shopping" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shopping</FormLabel>
                    <FormControl><Input {...field} type="number" min="0" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gasExpense" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gas Expense</FormLabel>
                    <FormControl><Input {...field} type="number" min="0" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="totalExpenses" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Expenses</FormLabel>
                    <FormControl><Input {...field} type="number" min="0" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="expenseDescription" render={({ field }) => (
                <FormItem>
                  <FormLabel>Expense Notes</FormLabel>
                  <FormControl><Textarea {...field} placeholder="Additional notes about expenses..." /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Stock Counts */}
          <Card>
            <CardHeader><CardTitle>Stock Counts</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="burgerBunsStock" render={({ field }) => (
                <FormItem>
                  <FormLabel>Burger Buns</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="rollsOrderedCount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rolls Ordered</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="meatWeight" render={({ field }) => (
                <FormItem>
                  <FormLabel>Meat Weight (kg)</FormLabel>
                  <FormControl><Input {...field} type="number" step="0.01" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Drinks */}
          <Card>
            <CardHeader><CardTitle>Drink Stock</CardTitle></CardHeader>
            <CardContent>
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
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Fresh Food */}
          <Card>
            <CardHeader><CardTitle>Fresh Food</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {FRESH_FOOD_ITEMS.map((item) => (
                  <FormField
                    key={item}
                    control={form.control}
                    name={`freshFood.${item}` as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{item}</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Shelf Items */}
          <Card>
            <CardHeader><CardTitle>Shelf Items</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {SHELF_ITEMS.map((item) => (
                  <FormField
                    key={item}
                    control={form.control}
                    name={`shelfItems.${item}` as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{item}</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Frozen Food */}
          <Card>
            <CardHeader><CardTitle>Frozen Food</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {FROZEN_FOOD_ITEMS.map((item) => (
                  <FormField
                    key={item}
                    control={form.control}
                    name={`frozenFood.${item}` as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">{item}</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="0" 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Kitchen Items */}
          <Card>
            <CardHeader><CardTitle>Kitchen Items</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Packaging Items */}
          <Card>
            <CardHeader><CardTitle>Packaging Items</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            disabled={createMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-3"
          >
            {createMutation.isPending ? "Submitting..." : "Submit Shift Report"}
          </Button>
        </form>
      </Form>
    </div>
  );
}