import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  completedBy: z.string().min(1, "Required"),
  shiftType: z.enum(['opening', 'closing']),
  shiftDate: z.string().datetime("Required"),
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
  // Individual drink stock fields
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
  // Food categories with predefined items
  freshFood: z.array(z.object({ 
    name: z.string(), 
    value: z.coerce.number().optional().default(0) 
  })).optional().default([
    { name: 'Topside Beef', value: 0 },
    { name: 'Brisket Point End', value: 0 },
    { name: 'Chuck Roll Beef', value: 0 },
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
    { name: 'Dill Pickles', value: 0 },
    { name: 'Sweet Pickles', value: 0 },
    { name: 'Cajun Spice', value: 0 },
    { name: 'White Vinegar', value: 0 },
    { name: 'Crispy Fried Onions', value: 0 },
    { name: 'Paprika (Smoked)', value: 0 },
    { name: 'Jalapenos', value: 0 },
    { name: 'Sriracha Mayonnaise', value: 0 },
    { name: 'Chipotle Mayonnaise', value: 0 }
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
    { name: 'Kitchen Cleaner', value: 0 },
    { name: 'Floor Cleaner', value: 0 },
    { name: 'Gloves Medium', value: 0 },
    { name: 'Gloves Large', value: 0 },
    { name: 'Gloves Small', value: 0 },
    { name: 'Plastic Meat Gloves', value: 0 },
    { name: 'Paper Towel Long', value: 0 },
    { name: 'Paper Towel Short', value: 0 },
    { name: 'Bin Bags 30x40', value: 0 },
    { name: 'Printer Rolls', value: 0 },
    { name: 'Sticky Tape', value: 0 }
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
    { name: 'Loaded Fries Box', value: 0 },
    { name: 'French Fries Box 600ml', value: 0 },
    { name: 'Takeaway Sauce Container', value: 0 },
    { name: 'Burger Wrapping Paper', value: 0 },
    { name: 'French Fries Paper', value: 0 },
    { name: 'Paper Bags', value: 0 },
    { name: 'Plastic Bags 8x16', value: 0 },
    { name: 'Plastic Bags 9x18', value: 0 },
    { name: 'Knife and Fork Set', value: 0 },
    { name: 'Bag Close Stickers', value: 0 },
    { name: 'Sauce Container Stickers', value: 0 },
    { name: 'Flag Stickers', value: 0 },
    { name: 'Burger Sweets Takeaway', value: 0 }
  ]),
  packagingItemsAdditional: z.array(z.object({ 
    item: z.string().min(1), 
    quantity: z.coerce.number().min(0).optional().default(0), 
    note: z.string().optional(), 
    addPermanently: z.boolean().optional().default(false) 
  })).optional().default([]),
  isDraft: z.boolean().optional().default(false),
});

const DailyShiftForm = () => {
  const { toast } = useToast();
  const form = useForm({ 
    resolver: zodResolver(formSchema), 
    defaultValues: formSchema.parse({ 
      shiftDate: new Date().toISOString(),
      wages: [{ staffName: '', amount: 0, type: 'wages' }],
      shopping: [{ item: '', amount: 0, shopName: '' }]
    }) 
  });
  
  const { watch, setValue, reset } = form;
  const [wagesEntries, setWagesEntries] = useState(1);
  const [shoppingEntries, setShoppingEntries] = useState(1);
  const [freshAdditional, setFreshAdditional] = useState(0);
  const [frozenAdditional, setFrozenAdditional] = useState(0);
  const [shelfAdditional, setShelfAdditional] = useState(0);
  const [kitchenAdditional, setKitchenAdditional] = useState(0);
  const [packagingAdditional, setPackagingAdditional] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const sales = watch(['grabSales', 'aroiDeeSales', 'qrScanSales', 'cashSales']);
  const expenses = watch(['gasExpense']);
  const wages = watch('wages');
  const shopping = watch('shopping');

  useEffect(() => {
    const salesTotal = sales.reduce((sum, val) => sum + Number(val || 0), 0);
    setValue('totalSales', salesTotal);
  }, [sales, setValue]);

  useEffect(() => {
    const wagesTotal = wages.reduce((sum, w) => sum + Number(w.amount || 0), 0);
    const shoppingTotal = shopping.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const expTotal = wagesTotal + shoppingTotal + Number(expenses[0] || 0);
    setValue('totalExpenses', expTotal);
  }, [wages, shopping, expenses, setValue]);

  const onSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/daily-stock-sales', { 
        method: 'POST', 
        body: JSON.stringify(data), 
        headers: {'Content-Type': 'application/json'} 
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (!data.isDraft) {
          // Generate shopping list excluding drinks, burger buns, and meat
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
            ...data.packagingItemsAdditional.filter((f: any) => f.quantity > 0),
          ].filter((item: any) => 
            item.name !== 'Burger Buns' && 
            item.name !== 'Meat' && 
            !['coke', 'cokeZero', 'sprite', 'schweppesManow', 'fantaOrange', 'fantaStrawberry', 'sodaWater', 'water', 'kidsOrange', 'kidsApple'].includes(item.name?.toLowerCase())
          );
          
          const shoppingList = purchaseItems.map((i: any) => ({ 
            itemName: i.name || i.item, 
            quantity: i.value || i.quantity, 
            unit: 'unit', 
            formId: result.id, 
            listDate: new Date(data.shiftDate) 
          }));
          
          await fetch('/api/shopping-list/bulk', { 
            method: 'POST', 
            body: JSON.stringify(shoppingList),
            headers: {'Content-Type': 'application/json'}
          });
        }
        
        toast({
          title: "Success!",
          description: data.isDraft ? "Draft saved successfully" : "Form submitted successfully",
          variant: "default",
        });
        
        reset();
        setWagesEntries(1);
        setShoppingEntries(1);
        setFreshAdditional(0);
        setFrozenAdditional(0);
        setShelfAdditional(0);
        setKitchenAdditional(0);
        setPackagingAdditional(0);
      } else {
        throw new Error('Submit failed');
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to submit form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">Daily Sales & Stock Form</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Completed By*</Label>
                <Input {...form.register("completedBy")} />
              </div>
              <div>
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
              <div>
                <Label>Shift Date*</Label>
                <Input type="datetime-local" {...form.register("shiftDate")} />
              </div>
            </div>

            {/* Cash Management */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Cash Management</h3>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Starting Cash (฿)</Label>
                  <Input type="number" {...form.register("startingCash")} />
                </div>
                <div>
                  <Label>Total Cash in Register at Closing (฿)</Label>
                  <Input type="number" {...form.register("endCash")} />
                </div>
                <div>
                  <Label>Amount to be Banked (฿)</Label>
                  <Input type="number" {...form.register("bankedAmount")} />
                </div>
              </CardContent>
            </Card>

            {/* Sales Information */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Sales Information</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label>Grab Sales (฿)</Label>
                    <Input type="number" {...form.register("grabSales")} />
                  </div>
                  <div>
                    <Label>Aroi Dee Sales (฿)</Label>
                    <Input type="number" {...form.register("aroiDeeSales")} />
                  </div>
                  <div>
                    <Label>QR Scan Sales (฿)</Label>
                    <Input type="number" {...form.register("qrScanSales")} />
                  </div>
                  <div>
                    <Label>Cash Sales (฿)</Label>
                    <Input type="number" {...form.register("cashSales")} />
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <Label>Total Sales (฿)</Label>
                  <Input disabled value={watch('totalSales')} className="font-bold" />
                </div>
              </CardContent>
            </Card>

            {/* Expenses Section */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Expenses</h3>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Wages */}
                <div>
                  <Label className="text-base font-medium">Wages</Label>
                  {[...Array(wagesEntries)].map((_, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                      <Input placeholder="Staff Name" {...form.register(`wages.${i}.staffName`)} />
                      <Input type="number" placeholder="Amount" {...form.register(`wages.${i}.amount`)} />
                      <Select onValueChange={(value) => setValue(`wages.${i}.type`, value as 'wages' | 'overtime' | 'other')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wages">Wages</SelectItem>
                          <SelectItem value="overtime">Overtime</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <Button type="button" onClick={() => setWagesEntries(wagesEntries + 1)} variant="outline" className="mt-2">
                    Add Wage Entry
                  </Button>
                </div>

                {/* Shopping */}
                <div>
                  <Label className="text-base font-medium">Shopping</Label>
                  {[...Array(shoppingEntries)].map((_, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                      <Input placeholder="Item Purchased" {...form.register(`shopping.${i}.item`)} />
                      <Input type="number" placeholder="Amount" {...form.register(`shopping.${i}.amount`)} />
                      <Input placeholder="Shop Name" {...form.register(`shopping.${i}.shopName`)} />
                    </div>
                  ))}
                  <Button type="button" onClick={() => setShoppingEntries(shoppingEntries + 1)} variant="outline" className="mt-2">
                    Add Shopping Entry
                  </Button>
                </div>

                <div>
                  <Label>Gas Expense (฿)</Label>
                  <Input type="number" {...form.register("gasExpense")} />
                </div>

                <div className="bg-gray-50 p-4 rounded">
                  <Label>Total Expenses (฿)</Label>
                  <Input disabled value={watch('totalExpenses')} className="font-bold" />
                </div>
              </CardContent>
            </Card>

            {/* Stock and Produce */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Stock and Produce</h3>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Burger Buns Stock (In Hand)</Label>
                    <Input type="number" {...form.register("burgerBunsStock")} />
                  </div>
                  <div>
                    <Label>Meat Weight (In Hand, kg)</Label>
                    <Input type="number" {...form.register("meatWeight")} />
                  </div>
                  <div>
                    <Label>Drink Stock Count (In Hand)</Label>
                    <Input type="number" {...form.register("drinkStockCount")} />
                  </div>
                </div>

                {/* Drink Details */}
                <div>
                  <h4 className="text-base font-medium mb-3">Drink Details (In Hand)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <Label>Coke</Label>
                      <Input type="number" {...form.register("coke")} />
                    </div>
                    <div>
                      <Label>Coke Zero</Label>
                      <Input type="number" {...form.register("cokeZero")} />
                    </div>
                    <div>
                      <Label>Sprite</Label>
                      <Input type="number" {...form.register("sprite")} />
                    </div>
                    <div>
                      <Label>Schweppes Manow</Label>
                      <Input type="number" {...form.register("schweppesManow")} />
                    </div>
                    <div>
                      <Label>Fanta Orange</Label>
                      <Input type="number" {...form.register("fantaOrange")} />
                    </div>
                    <div>
                      <Label>Fanta Strawberry</Label>
                      <Input type="number" {...form.register("fantaStrawberry")} />
                    </div>
                    <div>
                      <Label>Soda Water</Label>
                      <Input type="number" {...form.register("sodaWater")} />
                    </div>
                    <div>
                      <Label>Water</Label>
                      <Input type="number" {...form.register("water")} />
                    </div>
                    <div>
                      <Label>Kids Orange</Label>
                      <Input type="number" {...form.register("kidsOrange")} />
                    </div>
                    <div>
                      <Label>Kids Apple</Label>
                      <Input type="number" {...form.register("kidsApple")} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fresh Food */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Fresh Food</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {form.watch('freshFood').map((item, index) => (
                    <div key={index}>
                      <Label>{item.name}</Label>
                      <Input type="number" {...form.register(`freshFood.${index}.value`)} />
                    </div>
                  ))}
                </div>
                
                <div>
                  <h4 className="text-base font-medium mb-3">Additional Items Not Listed</h4>
                  {[...Array(freshAdditional)].map((_, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 items-end">
                      <div>
                        <Label>Item to be Purchased</Label>
                        <Input {...form.register(`freshFoodAdditional.${i}.item`)} />
                      </div>
                      <div>
                        <Label>Quantity</Label>
                        <Input type="number" {...form.register(`freshFoodAdditional.${i}.quantity`)} />
                      </div>
                      <div>
                        <Label>Note</Label>
                        <Input {...form.register(`freshFoodAdditional.${i}.note`)} />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox {...form.register(`freshFoodAdditional.${i}.addPermanently`)} />
                        <Label>Add Permanently</Label>
                      </div>
                    </div>
                  ))}
                  <Button type="button" onClick={() => setFreshAdditional(freshAdditional + 1)} variant="outline">
                    Add Item
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Frozen Food */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Frozen Food</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {form.watch('frozenFood').map((item, index) => (
                    <div key={index}>
                      <Label>{item.name}</Label>
                      <Input type="number" {...form.register(`frozenFood.${index}.value`)} />
                    </div>
                  ))}
                </div>
                
                <div>
                  <h4 className="text-base font-medium mb-3">Additional Items Not Listed</h4>
                  {[...Array(frozenAdditional)].map((_, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 items-end">
                      <div>
                        <Label>Item to be Purchased</Label>
                        <Input {...form.register(`frozenFoodAdditional.${i}.item`)} />
                      </div>
                      <div>
                        <Label>Quantity</Label>
                        <Input type="number" {...form.register(`frozenFoodAdditional.${i}.quantity`)} />
                      </div>
                      <div>
                        <Label>Note</Label>
                        <Input {...form.register(`frozenFoodAdditional.${i}.note`)} />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox {...form.register(`frozenFoodAdditional.${i}.addPermanently`)} />
                        <Label>Add Permanently</Label>
                      </div>
                    </div>
                  ))}
                  <Button type="button" onClick={() => setFrozenAdditional(frozenAdditional + 1)} variant="outline">
                    Add Item
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Shelf Items */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Shelf Items</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {form.watch('shelfItems').map((item, index) => (
                    <div key={index}>
                      <Label>{item.name}</Label>
                      <Input type="number" {...form.register(`shelfItems.${index}.value`)} />
                    </div>
                  ))}
                </div>
                
                <div>
                  <h4 className="text-base font-medium mb-3">Additional Items Not Listed</h4>
                  {[...Array(shelfAdditional)].map((_, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 items-end">
                      <div>
                        <Label>Item to be Purchased</Label>
                        <Input {...form.register(`shelfItemsAdditional.${i}.item`)} />
                      </div>
                      <div>
                        <Label>Quantity</Label>
                        <Input type="number" {...form.register(`shelfItemsAdditional.${i}.quantity`)} />
                      </div>
                      <div>
                        <Label>Note</Label>
                        <Input {...form.register(`shelfItemsAdditional.${i}.note`)} />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox {...form.register(`shelfItemsAdditional.${i}.addPermanently`)} />
                        <Label>Add Permanently</Label>
                      </div>
                    </div>
                  ))}
                  <Button type="button" onClick={() => setShelfAdditional(shelfAdditional + 1)} variant="outline">
                    Add Item
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Kitchen Items */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Kitchen Items</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {form.watch('kitchenItems').map((item, index) => (
                    <div key={index}>
                      <Label>{item.name}</Label>
                      <Input type="number" {...form.register(`kitchenItems.${index}.value`)} />
                    </div>
                  ))}
                </div>
                
                <div>
                  <h4 className="text-base font-medium mb-3">Additional Items Not Listed</h4>
                  {[...Array(kitchenAdditional)].map((_, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 items-end">
                      <div>
                        <Label>Item to be Purchased</Label>
                        <Input {...form.register(`kitchenItemsAdditional.${i}.item`)} />
                      </div>
                      <div>
                        <Label>Quantity</Label>
                        <Input type="number" {...form.register(`kitchenItemsAdditional.${i}.quantity`)} />
                      </div>
                      <div>
                        <Label>Note</Label>
                        <Input {...form.register(`kitchenItemsAdditional.${i}.note`)} />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox {...form.register(`kitchenItemsAdditional.${i}.addPermanently`)} />
                        <Label>Add Permanently</Label>
                      </div>
                    </div>
                  ))}
                  <Button type="button" onClick={() => setKitchenAdditional(kitchenAdditional + 1)} variant="outline">
                    Add Item
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Packaging Items */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Packaging Items</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {form.watch('packagingItems').map((item, index) => (
                    <div key={index}>
                      <Label>{item.name}</Label>
                      <Input type="number" {...form.register(`packagingItems.${index}.value`)} />
                    </div>
                  ))}
                </div>
                
                <div>
                  <h4 className="text-base font-medium mb-3">Additional Items Not Listed</h4>
                  {[...Array(packagingAdditional)].map((_, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 items-end">
                      <div>
                        <Label>Item to be Purchased</Label>
                        <Input {...form.register(`packagingItemsAdditional.${i}.item`)} />
                      </div>
                      <div>
                        <Label>Quantity</Label>
                        <Input type="number" {...form.register(`packagingItemsAdditional.${i}.quantity`)} />
                      </div>
                      <div>
                        <Label>Note</Label>
                        <Input {...form.register(`packagingItemsAdditional.${i}.note`)} />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox {...form.register(`packagingItemsAdditional.${i}.addPermanently`)} />
                        <Label>Add Permanently</Label>
                      </div>
                    </div>
                  ))}
                  <Button type="button" onClick={() => setPackagingAdditional(packagingAdditional + 1)} variant="outline">
                    Add Item
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Summary</h3>
              </CardHeader>
              <CardContent className="space-y-2">
                <p><strong>Total Sales:</strong> ฿{watch('totalSales')}</p>
                <p><strong>Breakdown:</strong> Grab ฿{watch('grabSales')}, Aroi Dee ฿{watch('aroiDeeSales')}, QR ฿{watch('qrScanSales')}, Cash ฿{watch('cashSales')}</p>
                <p><strong>Total Expenses:</strong> ฿{watch('totalExpenses')}</p>
                <p><strong>Breakdown:</strong> Wages ฿{watch('wages').reduce((sum, w) => sum + Number(w.amount || 0), 0)}, Shopping ฿{watch('shopping').reduce((sum, s) => sum + Number(s.amount || 0), 0)}, Gas ฿{watch('gasExpense')}</p>
                <p><strong>Drink Stock:</strong> Coke {watch('coke')}, Coke Zero {watch('cokeZero')}, Sprite {watch('sprite')}, Schweppes Manow {watch('schweppesManow')}, Fanta Orange {watch('fantaOrange')}, Fanta Strawberry {watch('fantaStrawberry')}, Soda Water {watch('sodaWater')}, Water {watch('water')}, Kids Orange {watch('kidsOrange')}, Kids Apple {watch('kidsApple')}</p>
              </CardContent>
            </Card>

            {/* Submit Buttons */}
            <div className="flex space-x-4">
              <Button 
                type="submit" 
                disabled={submitting}
                className="flex-1"
                onClick={() => setValue('isDraft', false)}
              >
                {submitting ? 'Submitting...' : 'Submit Form'}
              </Button>
              <Button 
                type="submit" 
                variant="outline" 
                disabled={submitting}
                className="flex-1"
                onClick={() => setValue('isDraft', true)}
              >
                {submitting ? 'Saving...' : 'Save as Draft'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* AI Chat Widget */}
      <iframe 
        src="/chatbox-template.html?agent=ollie" 
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '340px',
          height: '400px',
          border: 'none',
          zIndex: 10000,
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
        }}
        title="Ollie - Operations Assistant"
      />
    </div>
  );
};

export default DailyShiftForm;