import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  completedBy: z.string().min(1, "Required"),
  shiftType: z.enum(['opening', 'closing']),
  shiftDate: z.string().min(1, "Required"),
  startingCash: z.coerce.number().optional().default(0),
  grabSales: z.coerce.number().optional().default(0),
  aroiDeeSales: z.coerce.number().optional().default(0),
  qrScanSales: z.coerce.number().optional().default(0),
  cashSales: z.coerce.number().optional().default(0),
  totalSales: z.coerce.number().optional().default(0),
  wages: z.array(z.object({ 
    staffName: z.string().min(1), 
    amount: z.coerce.number().min(0).optional().default(0), 
    type: z.enum(['wages', 'overtime', 'other']) 
  })).optional().default([]),
  shopping: z.array(z.object({ 
    item: z.string().min(1), 
    amount: z.coerce.number().min(0).optional().default(0), 
    shopName: z.string().optional() 
  })).optional().default([]),
  gasExpense: z.coerce.number().optional().default(0),
  totalExpenses: z.coerce.number().optional().default(0),
  endCash: z.coerce.number().optional().default(0),
  bankedAmount: z.coerce.number().optional().default(0),
  burgerBunsStock: z.coerce.number().optional().default(0),
  meatWeight: z.coerce.number().optional().default(0),
  drinkStockCount: z.coerce.number().optional().default(0),
  coke: z.coerce.number().optional().default(0),
  cokeZero: z.coerce.number().optional().default(0),
  sprite: z.coerce.number().optional().default(0),
  schweppesManow: z.coerce.number().optional().default(0),
  fantaOrange: z.coerce.number().optional().default(0),
  fantaStrawberry: z.coerce.number().optional().default(0),
  sodaWater: z.coerce.number().optional().default(0),
  water: z.coerce.number().optional().default(0),
  kidsOrange: z.coerce.number().optional().default(0),
  kidsApple: z.coerce.number().optional().default(0),
  freshFood: z.array(z.object({ 
    name: z.string(), 
    value: z.coerce.number().optional().default(0) 
  })).optional().default([
    { name: 'Salad (Iceberg Lettuce)', value: 0 }, 
    { name: 'Tomatos', value: 0 }, 
    { name: 'White Cabbage', value: 0 }, 
    { name: 'Purple Cabbage', value: 0 }, 
    { name: 'Bacon Short', value: 0 }, 
    { name: 'Bacon Long', value: 0 }, 
    { name: 'Milk', value: 0 }, 
    { name: 'Butter', value: 0 }
  ]),
  freshFoodAdditional: z.array(z.object({ 
    item: z.string().min(1), 
    quantity: z.coerce.number().min(0).optional().default(0), 
    note: z.string().optional(), 
    addPermanently: z.boolean().optional().default(false) 
  })).optional().default([]),
  frozenFood: z.array(z.object({ 
    name: z.string(), 
    value: z.coerce.number().optional().default(0) 
  })).optional().default([
    { name: 'Chicken Nuggets', value: 0 }, 
    { name: 'Sweet Potato Fries', value: 0 }
  ]),
  frozenFoodAdditional: z.array(z.object({ 
    item: z.string().min(1), 
    quantity: z.coerce.number().min(0).optional().default(0), 
    note: z.string().optional(), 
    addPermanently: z.boolean().optional().default(false) 
  })).optional().default([]),
  shelfItems: z.array(z.object({ 
    name: z.string(), 
    value: z.coerce.number().optional().default(0) 
  })).optional().default([
    { name: 'Burger Sauce', value: 0 }, 
    { name: 'Mayo', value: 0 }, 
    { name: 'Ketchup', value: 0 }, 
    { name: 'Mustard', value: 0 }, 
    { name: 'BBQ Sauce', value: 0 }, 
    { name: 'Sweet Chili', value: 0 }, 
    { name: 'Sriracha', value: 0 }, 
    { name: 'Salt', value: 0 }, 
    { name: 'Pepper', value: 0 }, 
    { name: 'Oil', value: 0 }, 
    { name: 'Vinegar', value: 0 }, 
    { name: 'Sugar', value: 0 }, 
    { name: 'Flour', value: 0 }
  ]),
  shelfItemsAdditional: z.array(z.object({ 
    item: z.string().min(1), 
    quantity: z.coerce.number().min(0).optional().default(0), 
    note: z.string().optional(), 
    addPermanently: z.boolean().optional().default(false) 
  })).optional().default([]),
  kitchenItems: z.array(z.object({ 
    name: z.string(), 
    value: z.coerce.number().optional().default(0) 
  })).optional().default([
    { name: 'Gloves', value: 0 }, 
    { name: 'Aprons', value: 0 }, 
    { name: 'Cleaning Supplies', value: 0 }, 
    { name: 'Paper Towels', value: 0 }, 
    { name: 'Toilet Paper', value: 0 }, 
    { name: 'Hand Soap', value: 0 }, 
    { name: 'Dish Soap', value: 0 }, 
    { name: 'Sanitizer', value: 0 }, 
    { name: 'Trash Bags', value: 0 }, 
    { name: 'Food Wrap', value: 0 }, 
    { name: 'Aluminum Foil', value: 0 }, 
    { name: 'Parchment Paper', value: 0 }
  ]),
  kitchenItemsAdditional: z.array(z.object({ 
    item: z.string().min(1), 
    quantity: z.coerce.number().min(0).optional().default(0), 
    note: z.string().optional(), 
    addPermanently: z.boolean().optional().default(false) 
  })).optional().default([]),
  packagingItems: z.array(z.object({ 
    name: z.string(), 
    value: z.coerce.number().optional().default(0) 
  })).optional().default([
    { name: 'Burger Boxes', value: 0 }, 
    { name: 'Fries Containers', value: 0 }, 
    { name: 'Drink Cups', value: 0 }, 
    { name: 'Lids', value: 0 }, 
    { name: 'Straws', value: 0 }, 
    { name: 'Napkins', value: 0 }, 
    { name: 'Wet Wipes', value: 0 }, 
    { name: 'Takeaway Bags', value: 0 }, 
    { name: 'Delivery Bags', value: 0 }, 
    { name: 'Sauce Cups', value: 0 }, 
    { name: 'Cutlery Sets', value: 0 }, 
    { name: 'Receipt Paper', value: 0 }
  ]),
  packagingItemsAdditional: z.array(z.object({ 
    item: z.string().min(1), 
    quantity: z.coerce.number().min(0).optional().default(0), 
    note: z.string().optional(), 
    addPermanently: z.boolean().optional().default(false) 
  })).optional().default([])
});

const DailyShiftForm = () => {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      completedBy: '',
      shiftType: 'closing',
      shiftDate: new Date().toISOString().slice(0, 16),
      startingCash: 0,
      grabSales: 0,
      aroiDeeSales: 0,
      qrScanSales: 0,
      cashSales: 0,
      totalSales: 0,
      wages: [{ staffName: '', amount: 0, type: 'wages' }],
      shopping: [{ item: '', amount: 0, shopName: '' }],
      gasExpense: 0,
      totalExpenses: 0,
      endCash: 0,
      bankedAmount: 0,
      burgerBunsStock: 0,
      meatWeight: 0,
      drinkStockCount: 0,
      coke: 0,
      cokeZero: 0,
      sprite: 0,
      schweppesManow: 0,
      fantaOrange: 0,
      fantaStrawberry: 0,
      sodaWater: 0,
      water: 0,
      kidsOrange: 0,
      kidsApple: 0,
      freshFood: [
        { name: 'Salad (Iceberg Lettuce)', value: 0 }, 
        { name: 'Tomatos', value: 0 }, 
        { name: 'White Cabbage', value: 0 }, 
        { name: 'Purple Cabbage', value: 0 }, 
        { name: 'Bacon Short', value: 0 }, 
        { name: 'Bacon Long', value: 0 }, 
        { name: 'Milk', value: 0 }, 
        { name: 'Butter', value: 0 }
      ],
      freshFoodAdditional: [],
      frozenFood: [
        { name: 'Chicken Nuggets', value: 0 }, 
        { name: 'Sweet Potato Fries', value: 0 }
      ],
      frozenFoodAdditional: [],
      shelfItems: [
        { name: 'Burger Sauce', value: 0 }, 
        { name: 'Mayo', value: 0 }, 
        { name: 'Ketchup', value: 0 }, 
        { name: 'Mustard', value: 0 }, 
        { name: 'BBQ Sauce', value: 0 }, 
        { name: 'Sweet Chili', value: 0 }, 
        { name: 'Sriracha', value: 0 }, 
        { name: 'Salt', value: 0 }, 
        { name: 'Pepper', value: 0 }, 
        { name: 'Oil', value: 0 }, 
        { name: 'Vinegar', value: 0 }, 
        { name: 'Sugar', value: 0 }, 
        { name: 'Flour', value: 0 }
      ],
      shelfItemsAdditional: [],
      kitchenItems: [
        { name: 'Gloves', value: 0 }, 
        { name: 'Aprons', value: 0 }, 
        { name: 'Cleaning Supplies', value: 0 }, 
        { name: 'Paper Towels', value: 0 }, 
        { name: 'Toilet Paper', value: 0 }, 
        { name: 'Hand Soap', value: 0 }, 
        { name: 'Dish Soap', value: 0 }, 
        { name: 'Sanitizer', value: 0 }, 
        { name: 'Trash Bags', value: 0 }, 
        { name: 'Food Wrap', value: 0 }, 
        { name: 'Aluminum Foil', value: 0 }, 
        { name: 'Parchment Paper', value: 0 }
      ],
      kitchenItemsAdditional: [],
      packagingItems: [
        { name: 'Burger Boxes', value: 0 }, 
        { name: 'Fries Containers', value: 0 }, 
        { name: 'Drink Cups', value: 0 }, 
        { name: 'Lids', value: 0 }, 
        { name: 'Straws', value: 0 }, 
        { name: 'Napkins', value: 0 }, 
        { name: 'Wet Wipes', value: 0 }, 
        { name: 'Takeaway Bags', value: 0 }, 
        { name: 'Delivery Bags', value: 0 }, 
        { name: 'Sauce Cups', value: 0 }, 
        { name: 'Cutlery Sets', value: 0 }, 
        { name: 'Receipt Paper', value: 0 }
      ],
      packagingItemsAdditional: []
    }
  });

  const { watch, setValue } = form;
  const [freshAdditional, setFreshAdditional] = useState(0);
  const [frozenAdditional, setFrozenAdditional] = useState(0);
  const [shelfAdditional, setShelfAdditional] = useState(0);
  const [kitchenAdditional, setKitchenAdditional] = useState(0);
  const [packagingAdditional, setPackagingAdditional] = useState(0);

  // Watch values for auto-calculations
  const sales = watch(['grabSales', 'aroiDeeSales', 'qrScanSales', 'cashSales']);
  const expenses = watch(['gasExpense']);
  const wages = watch('wages');
  const shopping = watch('shopping');

  // Auto-calculate total sales
  useEffect(() => {
    const salesTotal = sales.reduce((sum, val) => sum + Number(val || 0), 0);
    setValue('totalSales', salesTotal);
  }, [sales, setValue]);

  // Auto-calculate total expenses
  useEffect(() => {
    const wagesTotal = wages.reduce((sum, w) => sum + Number(w.amount || 0), 0);
    const shoppingTotal = shopping.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const expTotal = wagesTotal + shoppingTotal + Number(expenses[0] || 0);
    setValue('totalExpenses', expTotal);
  }, [wages, shopping, expenses, setValue]);

  const addWageEntry = () => {
    const currentWages = form.getValues('wages');
    setValue('wages', [...currentWages, { staffName: '', amount: 0, type: 'wages' }]);
  };

  const removeWageEntry = (index: number) => {
    const currentWages = form.getValues('wages');
    if (currentWages.length > 1) {
      setValue('wages', currentWages.filter((_, i) => i !== index));
    }
  };

  const addShoppingEntry = () => {
    const currentShopping = form.getValues('shopping');
    setValue('shopping', [...currentShopping, { item: '', amount: 0, shopName: '' }]);
  };

  const removeShoppingEntry = (index: number) => {
    const currentShopping = form.getValues('shopping');
    if (currentShopping.length > 1) {
      setValue('shopping', currentShopping.filter((_, i) => i !== index));
    }
  };

  const onSubmit = async (data: any) => {
    try {
      const response = await fetch('/api/daily-stock-sales', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Daily shift form submitted successfully!",
        });

        // Generate shopping list for items > 0 (exclude drinks/rolls/meat - in hand only)
        const purchaseItems = [
          ...data.freshFood.filter((f: any) => f.value > 0),
          ...data.freshFoodAdditional.filter((f: any) => f.quantity > 0),
          ...data.frozenFood.filter((f: any) => f.value > 0),
          ...data.frozenFoodAdditional.filter((f: any) => f.quantity > 0),
          ...data.shelfItems.filter((f: any) => f.value > 0),
          ...data.shelfItemsAdditional.filter((f: any) => f.quantity > 0),
          ...data.kitchenItems.filter((f: any) => f.value > 0),
          ...data.kitchenItemsAdditional.filter((f: any) => f.quantity > 0),
          ...data.packagingItems.filter((f: any) => f.value > 0),
          ...data.packagingItemsAdditional.filter((f: any) => f.quantity > 0)
        ];

        if (purchaseItems.length > 0) {
          console.log('Generated shopping list:', purchaseItems);
        }

        // Reset form
        form.reset();
      } else {
        throw new Error('Failed to submit form');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit form. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Daily Sales & Stock Form</h1>
        <p className="text-gray-600 mt-2">Complete your shift reporting with auto-calculations</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Shift Information</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="completedBy">Completed By*</Label>
              <Input {...form.register("completedBy")} placeholder="Staff name" />
            </div>
            <div>
              <Label htmlFor="shiftType">Shift Type</Label>
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
            <div>
              <Label htmlFor="shiftDate">Shift Date*</Label>
              <Input type="datetime-local" {...form.register("shiftDate")} />
            </div>
            <div>
              <Label htmlFor="startingCash">Starting Cash (฿)</Label>
              <Input type="number" {...form.register("startingCash")} />
            </div>
          </CardContent>
        </Card>

        {/* Sales Information */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Sales Summary</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="grabSales">Grab Sales (฿)</Label>
              <Input type="number" {...form.register("grabSales")} />
            </div>
            <div>
              <Label htmlFor="aroiDeeSales">Aroi Dee Sales (฿)</Label>
              <Input type="number" {...form.register("aroiDeeSales")} />
            </div>
            <div>
              <Label htmlFor="qrScanSales">QR Scan Sales (฿)</Label>
              <Input type="number" {...form.register("qrScanSales")} />
            </div>
            <div>
              <Label htmlFor="cashSales">Cash Sales (฿)</Label>
              <Input type="number" {...form.register("cashSales")} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="totalSales">Total Sales (฿)</Label>
              <Input type="number" {...form.register("totalSales")} readOnly className="bg-gray-50" />
            </div>
          </CardContent>
        </Card>

        {/* Wages */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Wages & Staff Payments</h2>
          </CardHeader>
          <CardContent>
            {wages.map((wage, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>Staff Name</Label>
                  <Input {...form.register(`wages.${index}.staffName`)} placeholder="Staff name" />
                </div>
                <div>
                  <Label>Amount (฿)</Label>
                  <Input type="number" {...form.register(`wages.${index}.amount`)} />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select onValueChange={(value) => setValue(`wages.${index}.type`, value as 'wages' | 'overtime' | 'other')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wages">Wages</SelectItem>
                      <SelectItem value="overtime">Overtime</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeWageEntry(index)}
                    disabled={wages.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" onClick={addWageEntry} variant="outline" className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Add Wage Entry
            </Button>
          </CardContent>
        </Card>

        {/* Shopping Expenses */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Shopping & Expenses</h2>
          </CardHeader>
          <CardContent>
            {shopping.map((shop, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>Item</Label>
                  <Input {...form.register(`shopping.${index}.item`)} placeholder="Item purchased" />
                </div>
                <div>
                  <Label>Amount (฿)</Label>
                  <Input type="number" {...form.register(`shopping.${index}.amount`)} />
                </div>
                <div>
                  <Label>Shop Name</Label>
                  <Input {...form.register(`shopping.${index}.shopName`)} placeholder="Store name" />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeShoppingEntry(index)}
                    disabled={shopping.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" onClick={addShoppingEntry} variant="outline" className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
            
            <div className="mt-4">
              <Label htmlFor="gasExpense">Gas Expense (฿)</Label>
              <Input type="number" {...form.register("gasExpense")} />
            </div>
            
            <div className="mt-4">
              <Label htmlFor="totalExpenses">Total Expenses (฿)</Label>
              <Input type="number" {...form.register("totalExpenses")} readOnly className="bg-gray-50" />
            </div>
          </CardContent>
        </Card>

        {/* Cash Management */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Cash Management</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="endCash">Ending Cash (฿)</Label>
              <Input type="number" {...form.register("endCash")} />
            </div>
            <div>
              <Label htmlFor="bankedAmount">Banked Amount (฿)</Label>
              <Input type="number" {...form.register("bankedAmount")} />
            </div>
          </CardContent>
        </Card>

        {/* Stock Counts */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Stock Counts</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="burgerBunsStock">Burger Buns Stock</Label>
              <Input type="number" {...form.register("burgerBunsStock")} />
            </div>
            <div>
              <Label htmlFor="meatWeight">Meat Weight (kg)</Label>
              <Input type="number" {...form.register("meatWeight")} />
            </div>
            <div>
              <Label htmlFor="drinkStockCount">Drink Stock Count</Label>
              <Input type="number" {...form.register("drinkStockCount")} />
            </div>
          </CardContent>
        </Card>

        {/* Individual Drink Tracking */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Individual Drink Tracking</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="coke">Coke</Label>
              <Input type="number" {...form.register("coke")} />
            </div>
            <div>
              <Label htmlFor="cokeZero">Coke Zero</Label>
              <Input type="number" {...form.register("cokeZero")} />
            </div>
            <div>
              <Label htmlFor="sprite">Sprite</Label>
              <Input type="number" {...form.register("sprite")} />
            </div>
            <div>
              <Label htmlFor="schweppesManow">Schweppes Manow</Label>
              <Input type="number" {...form.register("schweppesManow")} />
            </div>
            <div>
              <Label htmlFor="fantaOrange">Fanta Orange</Label>
              <Input type="number" {...form.register("fantaOrange")} />
            </div>
            <div>
              <Label htmlFor="fantaStrawberry">Fanta Strawberry</Label>
              <Input type="number" {...form.register("fantaStrawberry")} />
            </div>
            <div>
              <Label htmlFor="sodaWater">Soda Water</Label>
              <Input type="number" {...form.register("sodaWater")} />
            </div>
            <div>
              <Label htmlFor="water">Water</Label>
              <Input type="number" {...form.register("water")} />
            </div>
            <div>
              <Label htmlFor="kidsOrange">Kids Orange</Label>
              <Input type="number" {...form.register("kidsOrange")} />
            </div>
            <div>
              <Label htmlFor="kidsApple">Kids Apple</Label>
              <Input type="number" {...form.register("kidsApple")} />
            </div>
          </CardContent>
        </Card>

        {/* Fresh Food Inventory */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Fresh Food Inventory</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {form.watch('freshFood').map((item, index) => (
                <div key={index}>
                  <Label>{item.name}</Label>
                  <Input type="number" {...form.register(`freshFood.${index}.value`)} />
                </div>
              ))}
            </div>
            
            {freshAdditional > 0 && Array.from({ length: freshAdditional }, (_, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>Additional Item</Label>
                  <Input placeholder="Item name" />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" placeholder="0" />
                </div>
                <div>
                  <Label>Note</Label>
                  <Input placeholder="Optional note" />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setFreshAdditional(freshAdditional - 1)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            <Button
              type="button"
              onClick={() => setFreshAdditional(freshAdditional + 1)}
              variant="outline"
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Fresh Food Item
            </Button>
          </CardContent>
        </Card>

        {/* Frozen Food Inventory */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Frozen Food Inventory</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {form.watch('frozenFood').map((item, index) => (
                <div key={index}>
                  <Label>{item.name}</Label>
                  <Input type="number" {...form.register(`frozenFood.${index}.value`)} />
                </div>
              ))}
            </div>
            
            {frozenAdditional > 0 && Array.from({ length: frozenAdditional }, (_, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>Additional Item</Label>
                  <Input placeholder="Item name" />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" placeholder="0" />
                </div>
                <div>
                  <Label>Note</Label>
                  <Input placeholder="Optional note" />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setFrozenAdditional(frozenAdditional - 1)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            <Button
              type="button"
              onClick={() => setFrozenAdditional(frozenAdditional + 1)}
              variant="outline"
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Frozen Food Item
            </Button>
          </CardContent>
        </Card>

        {/* Shelf Items Inventory */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Shelf Items Inventory</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {form.watch('shelfItems').map((item, index) => (
                <div key={index}>
                  <Label>{item.name}</Label>
                  <Input type="number" {...form.register(`shelfItems.${index}.value`)} />
                </div>
              ))}
            </div>
            
            {shelfAdditional > 0 && Array.from({ length: shelfAdditional }, (_, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>Additional Item</Label>
                  <Input placeholder="Item name" />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" placeholder="0" />
                </div>
                <div>
                  <Label>Note</Label>
                  <Input placeholder="Optional note" />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShelfAdditional(shelfAdditional - 1)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            <Button
              type="button"
              onClick={() => setShelfAdditional(shelfAdditional + 1)}
              variant="outline"
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Shelf Item
            </Button>
          </CardContent>
        </Card>

        {/* Kitchen Items Inventory */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Kitchen Items Inventory</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {form.watch('kitchenItems').map((item, index) => (
                <div key={index}>
                  <Label>{item.name}</Label>
                  <Input type="number" {...form.register(`kitchenItems.${index}.value`)} />
                </div>
              ))}
            </div>
            
            {kitchenAdditional > 0 && Array.from({ length: kitchenAdditional }, (_, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>Additional Item</Label>
                  <Input placeholder="Item name" />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" placeholder="0" />
                </div>
                <div>
                  <Label>Note</Label>
                  <Input placeholder="Optional note" />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setKitchenAdditional(kitchenAdditional - 1)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            <Button
              type="button"
              onClick={() => setKitchenAdditional(kitchenAdditional + 1)}
              variant="outline"
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Kitchen Item
            </Button>
          </CardContent>
        </Card>

        {/* Packaging Items Inventory */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Packaging Items Inventory</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {form.watch('packagingItems').map((item, index) => (
                <div key={index}>
                  <Label>{item.name}</Label>
                  <Input type="number" {...form.register(`packagingItems.${index}.value`)} />
                </div>
              ))}
            </div>
            
            {packagingAdditional > 0 && Array.from({ length: packagingAdditional }, (_, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>Additional Item</Label>
                  <Input placeholder="Item name" />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" placeholder="0" />
                </div>
                <div>
                  <Label>Note</Label>
                  <Input placeholder="Optional note" />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPackagingAdditional(packagingAdditional - 1)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            <Button
              type="button"
              onClick={() => setPackagingAdditional(packagingAdditional + 1)}
              variant="outline"
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Packaging Item
            </Button>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-center">
          <Button type="submit" className="bg-black text-white px-8 py-2 text-lg">
            Submit Daily Shift Form
          </Button>
        </div>
      </form>
    </div>
  );
};

export default DailyShiftForm;