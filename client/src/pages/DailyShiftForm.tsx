import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from 'react';
import { Plus, Minus, Calculator, Save, FileText } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  completedBy: z.string().min(1, "Staff name is required"),
  shiftType: z.enum(['opening', 'closing']),
  shiftDate: z.string().min(1, "Shift date is required"),
  
  // Sales Information
  grabSales: z.coerce.number().optional().default(0),
  aroiDeeSales: z.coerce.number().optional().default(0),
  qrScanSales: z.coerce.number().optional().default(0),
  cashSales: z.coerce.number().optional().default(0),
  totalSales: z.coerce.number().optional().default(0), // Auto-calculated
  
  // Expenses - Multiple entries
  wages: z.array(z.object({
    staffName: z.string().min(1, "Staff name required"),
    amount: z.coerce.number().min(0).optional().default(0),
    type: z.enum(['wages', 'overtime', 'other']).default('wages')
  })).default([]),
  
  shopping: z.array(z.object({
    item: z.string().min(1, "Item name required"),
    amount: z.coerce.number().min(0).optional().default(0),
    shopName: z.string().optional().default('')
  })).default([]),
  
  gasExpense: z.coerce.number().optional().default(0),
  totalExpenses: z.coerce.number().optional().default(0), // Auto-calculated
  
  // Cash Management - Manual Input
  startingCash: z.coerce.number().optional().default(0),
  endCash: z.coerce.number().optional().default(0), // Manual input
  bankedAmount: z.coerce.number().optional().default(0), // Manual input
  
  // Stock - In Hand (not for purchase)
  burgerBunsStock: z.coerce.number().optional().default(0),
  meatWeight: z.coerce.number().optional().default(0),
  drinkStockCount: z.coerce.number().optional().default(0),
  
  // Stock and Produce for Purchase (>0 generates shopping list)
  freshFood: z.record(z.coerce.number().optional().default(0)).default({}),
  frozenFood: z.record(z.coerce.number().optional().default(0)).default({}),
  shelfItems: z.record(z.coerce.number().optional().default(0)).default({}),
  drinkStock: z.record(z.coerce.number().optional().default(0)).default({}),
  kitchenItems: z.record(z.coerce.number().optional().default(0)).default({}),
  packagingItems: z.record(z.coerce.number().optional().default(0)).default({}),
  
  isDraft: z.boolean().optional().default(false),
});

type FormData = z.infer<typeof formSchema>;

// Stock categories for shopping list generation
const stockCategories = {
  freshFood: [
    'Lettuce', 'Tomatoes', 'Onions', 'Pickles', 'Cheese Slices', 'Bacon', 'Mushrooms'
  ],
  frozenFood: [
    'Chicken Fillets', 'Nuggets', 'French Fries', 'Onion Rings'
  ],
  shelfItems: [
    'Burger Sauce', 'Ketchup', 'Mayo', 'Mustard', 'BBQ Sauce', 'Salt', 'Pepper', 
    'Cooking Oil', 'Flour', 'Breadcrumbs', 'Spices', 'Napkins', 'Straws'
  ],
  drinkStock: [
    'Coke', 'Sprite', 'Orange Juice', 'Water Bottles', 'Coffee', 'Tea'
  ],
  kitchenItems: [
    'Cleaning Supplies', 'Dishwashing Liquid', 'Paper Towels', 'Gloves', 
    'Sanitizer', 'Trash Bags', 'Aluminum Foil', 'Plastic Wrap', 'Sponges'
  ],
  packagingItems: [
    'Burger Boxes', 'Fries Containers', 'Drink Cups', 'Lids', 'Takeaway Bags', 
    'Napkins', 'Straws', 'Cutlery Sets', 'Food Containers', 'Labels'
  ]
};

const DailyShiftForm = () => {
  const { toast } = useToast();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      completedBy: '',
      shiftType: 'closing',
      shiftDate: new Date().toISOString().slice(0, 16),
      wages: [{ staffName: '', amount: 0, type: 'wages' }],
      shopping: [{ item: '', amount: 0, shopName: '' }],
      freshFood: {},
      frozenFood: {},
      shelfItems: {},
      drinkStock: {},
      kitchenItems: {},
      packagingItems: {},
    }
  });

  const { control, watch, setValue, handleSubmit, register } = form;
  
  const wagesArray = useFieldArray({ control, name: "wages" });
  const shoppingArray = useFieldArray({ control, name: "shopping" });

  // Watch values for auto-calculation
  const salesValues = watch(['grabSales', 'aroiDeeSales', 'qrScanSales', 'cashSales']);
  const expenseValues = watch(['gasExpense']);
  const wagesValues = watch('wages');
  const shoppingValues = watch('shopping');

  // Auto-calculate total sales
  useEffect(() => {
    const total = salesValues.reduce((sum, val) => sum + Number(val || 0), 0);
    setValue('totalSales', total);
  }, [salesValues, setValue]);

  // Auto-calculate total expenses
  useEffect(() => {
    const wagesTotal = wagesValues.reduce((sum, wage) => sum + Number(wage.amount || 0), 0);
    const shoppingTotal = shoppingValues.reduce((sum, shop) => sum + Number(shop.amount || 0), 0);
    const gasTotal = Number(expenseValues[0] || 0);
    const total = wagesTotal + shoppingTotal + gasTotal;
    setValue('totalExpenses', total);
  }, [wagesValues, shoppingValues, expenseValues, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      // Submit form data
      const response = await apiRequest('/api/daily-stock-sales', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });

      // Generate shopping list if not draft
      if (!data.isDraft) {
        const purchaseItems: any[] = [];
        
        // Collect items from all stock categories where value > 0
        Object.entries(stockCategories).forEach(([category, items]) => {
          const categoryData = data[category as keyof typeof stockCategories];
          items.forEach(item => {
            const quantity = categoryData[item] || 0;
            if (quantity > 0) {
              purchaseItems.push({
                itemName: item,
                quantity: quantity,
                unit: 'units',
                category: category,
                formId: response.id,
                listDate: data.shiftDate,
                notes: `${category}: ${quantity} units needed`
              });
            }
          });
        });

        if (purchaseItems.length > 0) {
          await apiRequest('/api/shopping-list/bulk', {
            method: 'POST',
            body: JSON.stringify(purchaseItems),
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      toast({
        title: "Success",
        description: data.isDraft ? "Draft saved successfully" : "Form submitted and shopping list generated",
      });

      // Reset form
      form.reset();
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save form",
        variant: "destructive",
      });
    }
  };

  const renderStockSection = (category: keyof typeof stockCategories, title: string) => (
    <div className="space-y-3">
      <h4 className="font-semibold text-gray-900">{title}</h4>
      <div className="grid grid-cols-2 gap-3">
        {stockCategories[category].map((item) => (
          <div key={item} className="space-y-1">
            <Label className="text-sm text-gray-600">{item}</Label>
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              {...register(`${category}.${item}` as any)}
              className="h-8"
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            <h2 className="text-2xl font-bold">Daily Sales & Stock Form</h2>
          </div>
          <p className="text-gray-600">Auto-calculating totals with shopping list generation</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Shift Information</h3>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Completed By *</Label>
                  <Input {...register("completedBy")} placeholder="Staff name" />
                </div>
                <div className="space-y-2">
                  <Label>Shift Type</Label>
                  <Select onValueChange={(value) => setValue('shiftType', value as 'opening' | 'closing')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select shift type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="opening">Opening</SelectItem>
                      <SelectItem value="closing">Closing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Shift Date *</Label>
                  <Input type="datetime-local" {...register("shiftDate")} />
                </div>
                <div className="space-y-2">
                  <Label>Starting Cash (฿)</Label>
                  <Input type="number" min="0" step="0.01" {...register("startingCash")} placeholder="0.00" />
                </div>
              </CardContent>
            </Card>

            {/* Sales Information */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Sales Information</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Grab Sales (฿)</Label>
                    <Input type="number" min="0" step="0.01" {...register("grabSales")} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Aroi Dee Sales (฿)</Label>
                    <Input type="number" min="0" step="0.01" {...register("aroiDeeSales")} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>QR Scan Sales (฿)</Label>
                    <Input type="number" min="0" step="0.01" {...register("qrScanSales")} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cash Sales (฿)</Label>
                    <Input type="number" min="0" step="0.01" {...register("cashSales")} placeholder="0.00" />
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Sales:</span>
                    <span className="text-xl font-bold text-blue-600">฿{Number(watch('totalSales') || 0).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Expenses</h3>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Wages Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Wages</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => wagesArray.append({ staffName: '', amount: 0, type: 'wages' })}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Wage Entry
                    </Button>
                  </div>
                  {wagesArray.fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2 p-3 border rounded-lg">
                      <Input
                        placeholder="Staff name"
                        {...register(`wages.${index}.staffName`)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount"
                        {...register(`wages.${index}.amount`)}
                        className="w-32"
                      />
                      <Select onValueChange={(value) => setValue(`wages.${index}.type`, value as 'wages' | 'overtime' | 'other')}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wages">Wages</SelectItem>
                          <SelectItem value="overtime">Overtime</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {wagesArray.fields.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => wagesArray.remove(index)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Shopping Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Shopping</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => shoppingArray.append({ item: '', amount: 0, shopName: '' })}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Shopping Entry
                    </Button>
                  </div>
                  {shoppingArray.fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2 p-3 border rounded-lg">
                      <Input
                        placeholder="Item purchased"
                        {...register(`shopping.${index}.item`)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount"
                        {...register(`shopping.${index}.amount`)}
                        className="w-32"
                      />
                      <Input
                        placeholder="Shop name"
                        {...register(`shopping.${index}.shopName`)}
                        className="w-40"
                      />
                      {shoppingArray.fields.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => shoppingArray.remove(index)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Gas Expense */}
                <div className="space-y-2">
                  <Label>Gas Expense (฿)</Label>
                  <Input type="number" min="0" step="0.01" {...register("gasExpense")} placeholder="0.00" className="w-48" />
                </div>

                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Expenses:</span>
                    <span className="text-xl font-bold text-red-600">฿{Number(watch('totalExpenses') || 0).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Cash Management Summary</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Sales Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Grab Sales:</span>
                        <span>฿{Number(watch('grabSales') || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Aroi Dee Sales:</span>
                        <span>฿{Number(watch('aroiDeeSales') || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>QR Scan Sales:</span>
                        <span>฿{Number(watch('qrScanSales') || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cash Sales:</span>
                        <span>฿{Number(watch('cashSales') || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>Total Sales:</span>
                        <span>฿{Number(watch('totalSales') || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium">Expense Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Wages:</span>
                        <span>฿{wagesValues.reduce((sum, w) => sum + Number(w.amount || 0), 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Shopping:</span>
                        <span>฿{shoppingValues.reduce((sum, s) => sum + Number(s.amount || 0), 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Gas Expense:</span>
                        <span>฿{Number(watch('gasExpense') || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>Total Expenses:</span>
                        <span>฿{Number(watch('totalExpenses') || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div className="space-y-2">
                    <Label>Total Cash in Register at Closing (฿) *</Label>
                    <Input type="number" min="0" step="0.01" {...register("endCash")} placeholder="Manual input required" />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount to be Banked (฿) *</Label>
                    <Input type="number" min="0" step="0.01" {...register("bankedAmount")} placeholder="Manual input required" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stock - In Hand */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Stock In Hand (Not for Purchase)</h3>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Burger Buns Stock</Label>
                  <Input type="number" min="0" {...register("burgerBunsStock")} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Meat Weight (kg)</Label>
                  <Input type="number" min="0" step="0.1" {...register("meatWeight")} placeholder="0.0" />
                </div>
                <div className="space-y-2">
                  <Label>Drink Stock Count</Label>
                  <Input type="number" min="0" {...register("drinkStockCount")} placeholder="0" />
                </div>
              </CardContent>
            </Card>

            {/* Stock and Produce for Purchase */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Stock and Produce Needed (Generates Shopping List)</h3>
                <p className="text-sm text-gray-600">Enter quantities needed for items to be purchased. Items with values greater than 0 will generate shopping list entries.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderStockSection('freshFood', 'Fresh Food')}
                {renderStockSection('frozenFood', 'Frozen Food')}
                {renderStockSection('shelfItems', 'Shelf Items')}
                {renderStockSection('drinkStock', 'Drink Stock')}
                {renderStockSection('kitchenItems', 'Kitchen Items')}
                {renderStockSection('packagingItems', 'Packaging Items')}
              </CardContent>
            </Card>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-6">
              <Button type="submit" className="bg-black text-white">
                <Save className="h-4 w-4 mr-2" />
                Submit Form
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => {
                  setValue('isDraft', true);
                  handleSubmit(onSubmit)();
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Save as Draft
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyShiftForm;