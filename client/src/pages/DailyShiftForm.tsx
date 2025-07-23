import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2 } from "lucide-react";

// Form schema with all optional fields except completedBy and shiftType
const formSchema = z.object({
  completedBy: z.string().min(1, "Name is required"),
  shiftType: z.enum(["morning", "evening", "night"], {
    required_error: "Shift type is required",
  }),
  shiftDate: z.string().optional(),
  
  // Sales data - all optional
  grabSales: z.coerce.number().default(0),
  foodpandaSales: z.coerce.number().default(0),
  walkInSales: z.coerce.number().default(0),
  
  // Wages - optional array
  wages: z.array(z.object({
    staffName: z.string().optional(),
    amount: z.coerce.number().default(0),
    type: z.string().optional(),
  })).optional().default([]),
  
  // Shopping - optional array  
  shopping: z.array(z.object({
    item: z.string().optional(),
    amount: z.coerce.number().default(0),
    shop: z.string().optional(),
  })).optional().default([]),
  
  // Drink stock - individual tracking for 10 beverages
  drinkStock: z.object({
    coke: z.coerce.number().default(0),
    cokeZero: z.coerce.number().default(0),
    sprite: z.coerce.number().default(0),
    fanta: z.coerce.number().default(0),
    water: z.coerce.number().default(0),
    sparklingWater: z.coerce.number().default(0),
    orangeJuice: z.coerce.number().default(0),
    appleJuice: z.coerce.number().default(0),
    energyDrink: z.coerce.number().default(0),
    iceTea: z.coerce.number().default(0),
  }).optional().default({}),
  
  // Food categories with additional items
  fresh: z.object({
    lettuce: z.coerce.number().default(0),
    tomatoes: z.coerce.number().default(0),
    onions: z.coerce.number().default(0),
    pickles: z.coerce.number().default(0),
    cheese: z.coerce.number().default(0),
    additionalItems: z.array(z.object({
      name: z.string().optional().default(""),
      quantity: z.coerce.number().default(0),
      addPermanently: z.boolean().default(false),
    })).optional().default([]),
  }).optional().default({}),
  
  frozen: z.object({
    burgerPatties: z.coerce.number().default(0),
    chickenFillets: z.coerce.number().default(0),
    fries: z.coerce.number().default(0),
    nuggets: z.coerce.number().default(0),
    additionalItems: z.array(z.object({
      name: z.string().optional().default(""),
      quantity: z.coerce.number().default(0),
      addPermanently: z.boolean().default(false),
    })).optional().default([]),
  }).optional().default({}),
  
  shelf: z.object({
    buns: z.coerce.number().default(0),
    sauces: z.coerce.number().default(0),
    seasonings: z.coerce.number().default(0),
    oil: z.coerce.number().default(0),
    additionalItems: z.array(z.object({
      name: z.string().optional().default(""),
      quantity: z.coerce.number().default(0),
      addPermanently: z.boolean().default(false),
    })).optional().default([]),
  }).optional().default({}),
  
  kitchen: z.object({
    cleaningSupplies: z.coerce.number().default(0),
    paperTowels: z.coerce.number().default(0),
    gloves: z.coerce.number().default(0),
    bags: z.coerce.number().default(0),
    additionalItems: z.array(z.object({
      name: z.string().optional().default(""),
      quantity: z.coerce.number().default(0),
      addPermanently: z.boolean().default(false),
    })).optional().default([]),
  }).optional().default({}),
  
  packaging: z.object({
    burgerBoxes: z.coerce.number().default(0),
    friesContainers: z.coerce.number().default(0),
    cups: z.coerce.number().default(0),
    napkins: z.coerce.number().default(0),
    additionalItems: z.array(z.object({
      name: z.string().optional().default(""),
      quantity: z.coerce.number().default(0),
      addPermanently: z.boolean().default(false),
    })).optional().default([]),
  }).optional().default({}),
  
  // Cash and notes
  startingCash: z.coerce.number().default(0),
  endingCash: z.coerce.number().default(0),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function DailyShiftForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      completedBy: "",
      shiftType: undefined,
      shiftDate: new Date().toISOString().split('T')[0],
      grabSales: 0,
      foodpandaSales: 0, 
      walkInSales: 0,
      wages: [],
      shopping: [],
      drinkStock: {
        coke: 0,
        cokeZero: 0,
        sprite: 0,
        fanta: 0,
        water: 0,
        sparklingWater: 0,
        orangeJuice: 0,
        appleJuice: 0,
        energyDrink: 0,
        iceTea: 0,
      },
      fresh: {
        lettuce: 0,
        tomatoes: 0,
        onions: 0,
        pickles: 0,
        cheese: 0,
        additionalItems: [],
      },
      frozen: {
        burgerPatties: 0,
        chickenFillets: 0,
        fries: 0,
        nuggets: 0,
        additionalItems: [],
      },
      shelf: {
        buns: 0,
        sauces: 0,
        seasonings: 0,
        oil: 0,
        additionalItems: [],
      },
      kitchen: {
        cleaningSupplies: 0,
        paperTowels: 0,
        gloves: 0,
        bags: 0,
        additionalItems: [],
      },
      packaging: {
        burgerBoxes: 0,
        friesContainers: 0,
        cups: 0,
        napkins: 0,
        additionalItems: [],
      },
      startingCash: 0,
      endingCash: 0,
      notes: "",
    },
  });

  // Watch values for calculations
  const watchedValues = form.watch();
  const totalSales = (watchedValues.grabSales || 0) + (watchedValues.foodpandaSales || 0) + (watchedValues.walkInSales || 0);
  const totalWages = watchedValues.wages?.reduce((sum, wage) => sum + (wage.amount || 0), 0) || 0;
  const totalShopping = watchedValues.shopping?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const totalExpenses = totalWages + totalShopping;

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("/api/daily-shift-forms", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          shiftDate: new Date(data.shiftDate || new Date().toISOString().split('T')[0]),
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Daily shift form submitted successfully!",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/daily-shift-forms'] });
    },
    onError: (error: any) => {
      console.error("Submit error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit form",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    console.log("Form data:", data);
    submitMutation.mutate(data);
  };

  // Helper functions for managing dynamic arrays
  const addWageEntry = () => {
    const currentWages = form.getValues("wages") || [];
    form.setValue("wages", [...currentWages, { staffName: "", amount: 0, type: "" }]);
  };

  const removeWageEntry = (index: number) => {
    const currentWages = form.getValues("wages") || [];
    form.setValue("wages", currentWages.filter((_, i) => i !== index));
  };

  const addShoppingEntry = () => {
    const currentShopping = form.getValues("shopping") || [];
    form.setValue("shopping", [...currentShopping, { item: "", amount: 0, shop: "" }]);
  };

  const removeShoppingEntry = (index: number) => {
    const currentShopping = form.getValues("shopping") || [];
    form.setValue("shopping", currentShopping.filter((_, i) => i !== index));
  };

  const addAdditionalItem = (category: keyof Pick<FormData, 'fresh' | 'frozen' | 'shelf' | 'kitchen' | 'packaging'>) => {
    const currentCategory = form.getValues(category) || {};
    const currentItems = currentCategory.additionalItems || [];
    form.setValue(`${category}.additionalItems`, [
      ...currentItems,
      { name: "", quantity: 0, addPermanently: false }
    ]);
  };

  const removeAdditionalItem = (category: keyof Pick<FormData, 'fresh' | 'frozen' | 'shelf' | 'kitchen' | 'packaging'>, index: number) => {
    const currentCategory = form.getValues(category) || {};
    const currentItems = currentCategory.additionalItems || [];
    form.setValue(`${category}.additionalItems`, currentItems.filter((_, i) => i !== index));
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Daily Shift Form</h1>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Sales: ฿{totalSales.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Total Expenses: ฿{totalExpenses.toFixed(2)}</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Shift Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="completedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff Name</FormLabel>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select shift type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="morning">Morning</SelectItem>
                        <SelectItem value="evening">Evening</SelectItem>
                        <SelectItem value="night">Night</SelectItem>
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
                    <FormLabel>Shift Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
              <CardTitle>Sales Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="grabSales"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grab Sales (฿)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="foodpandaSales"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>FoodPanda Sales (฿)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="walkInSales"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Walk-in Sales (฿)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Wages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Wages
                <Button type="button" variant="outline" size="sm" onClick={addWageEntry}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Wage Entry
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {watchedValues.wages?.map((_, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <FormField
                    control={form.control}
                    name={`wages.${index}.staffName`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Staff Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Staff name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`wages.${index}.amount`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`wages.${index}.type`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Daily, Overtime" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeWageEntry(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {(!watchedValues.wages || watchedValues.wages.length === 0) && (
                <p className="text-muted-foreground text-center py-4">No wage entries added yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Shopping */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Shopping & Expenses
                <Button type="button" variant="outline" size="sm" onClick={addShoppingEntry}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Expense
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {watchedValues.shopping?.map((_, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <FormField
                    control={form.control}
                    name={`shopping.${index}.item`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`shopping.${index}.amount`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`shopping.${index}.shop`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shop</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeShoppingEntry(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {(!watchedValues.shopping || watchedValues.shopping.length === 0) && (
                <p className="text-muted-foreground text-center py-4">No shopping entries added yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Drink Stock */}
          <Card>
            <CardHeader>
              <CardTitle>Drink Stock (10 Beverages)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries({
                coke: "Coke",
                cokeZero: "Coke Zero",
                sprite: "Sprite", 
                fanta: "Fanta",
                water: "Water",
                sparklingWater: "Sparkling Water",
                orangeJuice: "Orange Juice",
                appleJuice: "Apple Juice",
                energyDrink: "Energy Drink",
                iceTea: "Ice Tea"
              }).map(([key, label]) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={`drinkStock.${key as keyof FormData['drinkStock']}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </CardContent>
          </Card>

          {/* Food Categories */}
          {[
            { key: 'fresh', title: 'Fresh Food', items: { lettuce: 'Lettuce', tomatoes: 'Tomatoes', onions: 'Onions', pickles: 'Pickles', cheese: 'Cheese' }},
            { key: 'frozen', title: 'Frozen Food', items: { burgerPatties: 'Burger Patties', chickenFillets: 'Chicken Fillets', fries: 'Fries', nuggets: 'Nuggets' }},
            { key: 'shelf', title: 'Shelf Items', items: { buns: 'Buns', sauces: 'Sauces', seasonings: 'Seasonings', oil: 'Oil' }},
            { key: 'kitchen', title: 'Kitchen Supplies', items: { cleaningSupplies: 'Cleaning Supplies', paperTowels: 'Paper Towels', gloves: 'Gloves', bags: 'Bags' }},
            { key: 'packaging', title: 'Packaging', items: { burgerBoxes: 'Burger Boxes', friesContainers: 'Fries Containers', cups: 'Cups', napkins: 'Napkins' }}
          ].map(({ key, title, items }) => {
            const categoryKey = key as keyof Pick<FormData, 'fresh' | 'frozen' | 'shelf' | 'kitchen' | 'packaging'>;
            const categoryData = watchedValues[categoryKey] || {};
            
            return (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {title}
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => addAdditionalItem(categoryKey)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Base items */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(items).map(([itemKey, label]) => (
                      <FormField
                        key={itemKey}
                        control={form.control}
                        name={`${categoryKey}.${itemKey as any}`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  
                  {/* Additional items */}
                  {categoryData.additionalItems?.map((_, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border-t pt-4">
                      <FormField
                        control={form.control}
                        name={`${categoryKey}.additionalItems.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Item name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`${categoryKey}.additionalItems.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`${categoryKey}.additionalItems.${index}.addPermanently`}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Add Permanently</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeAdditionalItem(categoryKey, index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}

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
                    <FormLabel>Starting Cash (฿)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
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
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Any additional notes about the shift..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button 
              type="submit" 
              disabled={submitMutation.isPending}
              className="bg-black text-white hover:bg-gray-800"
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Form"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}