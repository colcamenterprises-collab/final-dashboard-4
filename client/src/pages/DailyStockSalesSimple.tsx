import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Save, FileText } from "lucide-react";

// All inventory items
const DRINK_ITEMS = ['Bottle Water', 'Coke', 'Coke Zero', 'Fanta Strawberry', 'Kids Apple Juice', 'Kids Orange', 'Orange Fanta', 'Schweppes Manow', 'Soda Water', 'Sprite'];
const FRESH_FOOD_ITEMS = ['Iceberg Lettuce', 'Jalapenos', 'Onions', 'Purple Cabbage', 'Test Pickles Enhanced', 'White Cabbage'];
const FROZEN_FOOD_ITEMS = ['Bacon Long', 'Bacon Short', 'Chicken Nuggets', 'French Fries', 'Onion Rings', 'Sweet Potato Fries'];
const SHELF_ITEMS = ['Cajun Spice', 'Cheese', 'Chili Sauce', 'Dill Pickles', 'Ketchup', 'Mayonnaise', 'Mustard', 'Oil Fryer', 'Sweet Pickles'];
const KITCHEN_ITEMS = ['Aluminum Foil', 'Paper Towel Long', 'Paper Towel Short', 'Alcohol Sanitizer', 'Dish Washing Liquid', 'Printer Rolls'];
const PACKAGING_ITEMS = ['Burger Paper', 'Food Wrap', 'French Fries Box', 'Hand Towel', 'Kitchen Towel', 'Paper Food Bags', 'Plastic Gloves', 'Rubber Gloves Large', 'Rubber Gloves Medium', 'Rubber Gloves Small', 'Takeaway Containers', 'Wooden Skewers'];

// Minimal, bulletproof form schema
const formSchema = z.object({
  completedBy: z.string().min(1, "Name is required"),
  shiftType: z.enum(['opening', 'closing']),
  shiftDate: z.string().min(1, "Date is required"),
  
  // Sales fields - all optional with defaults
  grabSales: z.coerce.number().optional().default(0),
  foodPandaSales: z.coerce.number().optional().default(0),
  aroiDeeSales: z.coerce.number().optional().default(0),
  qrScanSales: z.coerce.number().optional().default(0),
  cashSales: z.coerce.number().optional().default(0),
  totalSales: z.coerce.number().optional().default(0),
  
  // Cash management
  startingCash: z.coerce.number().optional().default(0),
  endingCash: z.coerce.number().optional().default(0),
  
  // Expenses
  salaryWages: z.coerce.number().optional().default(0),
  shopping: z.coerce.number().optional().default(0),
  totalExpenses: z.coerce.number().optional().default(0),
  expenseDescription: z.string().optional(),
  
  // Stock counts
  burgerBunsStock: z.coerce.number().optional().default(0),
  rollsOrderedCount: z.coerce.number().optional().default(0),
  meatWeight: z.coerce.number().optional().default(0),
  
  // All inventory sections
  drinkStock: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  freshFood: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  frozenFood: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  shelfItems: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  kitchenItems: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  packagingItems: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  
  // Draft flag
  isDraft: z.boolean().optional().default(false),
});

type FormData = z.infer<typeof formSchema>;

const DailyStockSalesSimple = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      completedBy: '',
      shiftType: 'closing',
      shiftDate: new Date().toISOString().split('T')[0],
      grabSales: 0,
      foodPandaSales: 0,
      aroiDeeSales: 0,
      qrScanSales: 0,
      cashSales: 0,
      totalSales: 0,
      startingCash: 0,
      endingCash: 0,
      salaryWages: 0,
      shopping: 0,
      totalExpenses: 0,
      expenseDescription: '',
      burgerBunsStock: 0,
      rollsOrderedCount: 0,
      meatWeight: 0,
      drinkStock: Object.fromEntries(DRINK_ITEMS.map(item => [item, 0])),
      freshFood: Object.fromEntries(FRESH_FOOD_ITEMS.map(item => [item, 0])),
      frozenFood: Object.fromEntries(FROZEN_FOOD_ITEMS.map(item => [item, 0])),
      shelfItems: Object.fromEntries(SHELF_ITEMS.map(item => [item, 0])),
      kitchenItems: Object.fromEntries(KITCHEN_ITEMS.map(item => [item, 0])),
      packagingItems: Object.fromEntries(PACKAGING_ITEMS.map(item => [item, 0])),
      isDraft: false,
    }
  });

  const onSubmit = async (data: FormData, isDraft = false) => {
    setIsSubmitting(true);
    try {
      // Convert date to ISO string
      const submitData = {
        ...data,
        shiftDate: new Date(data.shiftDate).toISOString(),
        isDraft: isDraft,
        // Ensure arrays are provided for backend compatibility
        wageEntries: [],
        shoppingEntries: [],
        freshFood: {},
        frozenFood: {},
        shelfItems: {},
        foodItems: {},
        drinkStock: {},
        kitchenItems: {},
        packagingItems: {},
      };

      const response = await fetch('/api/daily-stock-sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: isDraft ? "Draft Saved!" : "Form Submitted!",
          description: isDraft ? "Your draft has been saved successfully." : "Your form has been submitted and email sent.",
          variant: "default",
        });
        
        // Reset form after successful submission (not draft)
        if (!isDraft) {
          form.reset();
        }
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast({
        title: "Error",
        description: "Failed to save form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    form.handleSubmit((data) => onSubmit(data, true))();
  };

  const handleSubmitForm = () => {
    form.handleSubmit((data) => onSubmit(data, false))();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Daily Sales & Stock Form - Simple Version
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-6">
              {/* Shift Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Shift Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="completedBy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Completed By *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your name" {...field} />
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
                                <SelectValue placeholder="Select shift type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="opening">Opening Shift</SelectItem>
                              <SelectItem value="closing">Closing Shift</SelectItem>
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
                          <FormLabel>Shift Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Sales Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sales Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="grabSales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grab Sales (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
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
                        <FormLabel>FoodPanda Sales (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
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
                        <FormLabel>Aroi Dee Sales (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
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
                        <FormLabel>QR Scan Sales (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
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
                        <FormLabel>Cash Sales (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
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
                        <FormLabel>Total Sales (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Wages & Staff Payments */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Wages & Staff Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="salaryWages"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salary/Wages (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Shopping & Expenses */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Shopping & Expenses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="shopping"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Shopping (฿)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} />
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
                          <FormLabel>Total Expenses (฿)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="expenseDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expense Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional notes about expenses..." {...field} />
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
                  <CardTitle className="text-lg">Cash Management</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startingCash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Starting Cash (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
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
                        <FormLabel>Ending Cash (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Drink Stock */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Drink Stock</CardTitle>
                </CardHeader>
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
                                placeholder="0"
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

              {/* Fresh Food Stock */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Fresh Food Stock</CardTitle>
                </CardHeader>
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
                                placeholder="0"
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
                <CardHeader>
                  <CardTitle className="text-lg">Frozen Food</CardTitle>
                </CardHeader>
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
                                placeholder="0"
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
                <CardHeader>
                  <CardTitle className="text-lg">Shelf Items</CardTitle>
                </CardHeader>
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
                                placeholder="0"
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
                <CardHeader>
                  <CardTitle className="text-lg">Kitchen Items</CardTitle>
                </CardHeader>
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
                                placeholder="0"
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
                <CardHeader>
                  <CardTitle className="text-lg">Packaging Items</CardTitle>
                </CardHeader>
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
                                placeholder="0"
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

              {/* Total Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Total Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="burgerBunsStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Burger Buns</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
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
                          <Input type="number" placeholder="0" {...field} />
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
                          <Input type="number" step="0.1" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save as Draft
                </Button>
                
                <Button
                  type="button"
                  onClick={handleSubmitForm}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {isSubmitting ? "Submitting..." : "Submit Form"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyStockSalesSimple;