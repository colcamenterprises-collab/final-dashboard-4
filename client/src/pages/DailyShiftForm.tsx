import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from 'react';

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
    { name: 'Sweet Potato Fries', value: 0 }, 
    { name: 'French Fries (7mm)', value: 0 }, 
    { name: 'Chicken Fillets', value: 0 }
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
    { name: 'Mayonnaise', value: 0 }, 
    { name: 'Mustard', value: 0 }, 
    { name: 'Dill Pickles', value: 0 }, 
    { name: 'Sweet Pickles', value: 0 }, 
    { name: 'Salt', value: 0 }, 
    { name: 'Pepper', value: 0 }, 
    { name: 'Cajun Spice', value: 0 }, 
    { name: 'White Vinegar', value: 0 }, 
    { name: 'Crispy Fried Onions', value: 0 }, 
    { name: 'Paprika (Smoked)', value: 0 }, 
    { name: 'Jalapenos', value: 0 }, 
    { name: 'Sriracha Mayonnaise', value: 0 }, 
    { name: 'Chipotle Mayonnaise', value: 0 }, 
    { name: 'Flour', value: 0 }, 
    { name: 'French Fries Seasoning BBQ', value: 0 }
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
    { name: 'Dishwashing Liquid', value: 0 }, 
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
    { name: 'Coleslaw Container', value: 0 }, 
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
  const form = useForm({ 
    resolver: zodResolver(formSchema), 
    defaultValues: formSchema.parse({ 
      shiftDate: new Date().toISOString(),
      shiftType: 'closing'
    }) 
  });
  
  const { watch, setValue, handleSubmit, register } = form;
  const [wagesEntries, setWagesEntries] = useState(1);
  const [shoppingEntries, setShoppingEntries] = useState(1);
  const [freshAdditional, setFreshAdditional] = useState(0);
  const [frozenAdditional, setFrozenAdditional] = useState(0);
  const [shelfAdditional, setShelfAdditional] = useState(0);
  const [kitchenAdditional, setKitchenAdditional] = useState(0);
  const [packagingAdditional, setPackagingAdditional] = useState(0);

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
    try {
      const response = await fetch('/api/daily-stock-sales', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Submit failed');
      const result = await response.json();
      
      if (!data.isDraft) {
        // Generate shopping list from items with quantities > 0
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
        ].filter(item => 
          item.name !== 'Burger Buns' && 
          item.name !== 'Meat' && 
          !['Coke', 'Coke Zero', 'Sprite', 'Schweppes Manow', 'Fanta Orange', 'Fanta Strawberry', 'Soda Water', 'Water', 'Kids Orange', 'Kids Apple'].includes(item.name)
        );
        
        const shoppingList = purchaseItems.map(i => ({
          itemName: i.name || i.item,
          quantity: i.value || i.quantity,
          unit: 'unit',
          formId: result.id,
          listDate: new Date(data.shiftDate).toISOString(),
        }));
        
        await fetch('/api/shopping-list/bulk', {
          method: 'POST',
          body: JSON.stringify(shoppingList),
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      form.reset();
      alert('Form submitted successfully!');
    } catch (err) {
      console.error('Form submission error:', err);
      alert('Error submitting form: ' + (err as Error).message);
    }
  };

  const saveDraft = () => {
    const data = form.getValues();
    data.isDraft = true;
    onSubmit(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6">
      <Card className="max-w-4xl mx-auto bg-gray-800 text-white border-gray-600">
        <CardHeader>
          <h1 className="font-bold text-3xl text-center">Daily Sales & Stock Form</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="font-medium text-sm text-white">Completed By*</Label>
                <Input {...register("completedBy")} className="w-full bg-gray-700 text-white border-gray-600" />
              </div>
              <div>
                <Label className="font-medium text-sm text-white">Shift Type</Label>
                <select {...register("shiftType")} className="w-full p-2 border rounded bg-gray-700 text-white border-gray-600">
                  <option value="opening">Opening</option>
                  <option value="closing">Closing</option>
                </select>
              </div>
              <div>
                <Label className="font-medium text-sm text-white">Shift Date*</Label>
                <Input type="datetime-local" {...register("shiftDate")} className="w-full bg-gray-700 text-white border-gray-600" />
              </div>
              <div>
                <Label className="font-medium text-sm text-white">Starting Cash (฿)</Label>
                <Input type="number" {...register("startingCash")} className="w-full bg-gray-700 text-white border-gray-600" />
              </div>
            </div>

            {/* Sales Information */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Sales Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium text-sm text-white">Grab Sales (฿)</Label>
                  <Input type="number" {...register("grabSales")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Aroi Dee Sales (฿)</Label>
                  <Input type="number" {...register("aroiDeeSales")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">QR Scan Sales (฿)</Label>
                  <Input type="number" {...register("qrScanSales")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Cash Sales (฿)</Label>
                  <Input type="number" {...register("cashSales")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
              </div>
              <div className="mt-4">
                <Label className="font-medium text-sm text-white">Total Sales (฿)</Label>
                <Input disabled value={watch('totalSales')} className="w-full bg-gray-500 text-white" />
              </div>
            </div>

            {/* Expenses */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Expenses</h3>
              
              {/* Wages */}
              <div className="mb-4">
                <Label className="font-medium text-sm text-white">Wages</Label>
                {[...Array(wagesEntries)].map((_, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input placeholder="Staff Name" {...register(`wages.${i}.staffName` as const)} className="flex-1 bg-gray-600 text-white border-gray-500" />
                    <Input type="number" placeholder="Amount" {...register(`wages.${i}.amount` as const)} className="flex-1 bg-gray-600 text-white border-gray-500" />
                    <select {...register(`wages.${i}.type` as const)} className="flex-1 p-2 border rounded bg-gray-600 text-white border-gray-500">
                      <option value="wages">Wages</option>
                      <option value="overtime">Overtime</option>
                      <option value="other">Other</option>
                    </select>
                    {wagesEntries > 1 && (
                      <Button type="button" variant="destructive" onClick={() => setWagesEntries(wagesEntries - 1)}>
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" onClick={() => setWagesEntries(wagesEntries + 1)} className="bg-blue-600 hover:bg-blue-700">
                  Add Wage Entry
                </Button>
              </div>

              {/* Shopping */}
              <div className="mb-4">
                <Label className="font-medium text-sm text-white">Shopping</Label>
                {[...Array(shoppingEntries)].map((_, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input placeholder="Item Purchased" {...register(`shopping.${i}.item` as const)} className="flex-1 bg-gray-600 text-white border-gray-500" />
                    <Input type="number" placeholder="Amount" {...register(`shopping.${i}.amount` as const)} className="flex-1 bg-gray-600 text-white border-gray-500" />
                    <Input placeholder="Shop Name" {...register(`shopping.${i}.shopName` as const)} className="flex-1 bg-gray-600 text-white border-gray-500" />
                    {shoppingEntries > 1 && (
                      <Button type="button" variant="destructive" onClick={() => setShoppingEntries(shoppingEntries - 1)}>
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" onClick={() => setShoppingEntries(shoppingEntries + 1)} className="bg-blue-600 hover:bg-blue-700">
                  Add Shopping Entry
                </Button>
              </div>

              <div>
                <Label className="font-medium text-sm text-white">Gas Expense (฿)</Label>
                <Input type="number" {...register("gasExpense")} className="w-full bg-gray-600 text-white border-gray-500" />
              </div>

              <div className="mt-4">
                <Label className="font-medium text-sm text-white">Total Expenses (฿)</Label>
                <Input disabled value={watch('totalExpenses')} className="w-full bg-gray-500 text-white" />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Summary</h3>
              <div className="space-y-2">
                <p>Total Sales: ฿{watch('totalSales')}</p>
                <p>Breakdown: Grab ฿{watch('grabSales')}, Aroi Dee ฿{watch('aroiDeeSales')}, QR ฿{watch('qrScanSales')}, Cash ฿{watch('cashSales')}</p>
                <p>Total Expenses: ฿{watch('totalExpenses')}</p>
                <p>Breakdown: Wages ฿{watch('wages').reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0)}, Shopping ฿{watch('shopping').reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0)}, Gas ฿{watch('gasExpense')}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="font-medium text-sm text-white">Total Cash in Register at Closing (฿)</Label>
                  <Input type="number" {...register("endCash")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Amount to be Banked (฿)</Label>
                  <Input type="number" {...register("bankedAmount")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
              </div>
            </div>

            {/* Stock and Produce */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Stock and Produce</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium text-sm text-white">Burger Buns Stock (In Hand)</Label>
                  <Input type="number" {...register("burgerBunsStock")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Meat Weight (In Hand, kg)</Label>
                  <Input type="number" {...register("meatWeight")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
              </div>
              
              <h4 className="font-semibold text-lg mt-6 mb-4">Drink Details (In Hand)</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <Label className="font-medium text-sm text-white">Coke</Label>
                  <Input type="number" {...register("coke")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Coke Zero</Label>
                  <Input type="number" {...register("cokeZero")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Sprite</Label>
                  <Input type="number" {...register("sprite")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Schweppes Manow</Label>
                  <Input type="number" {...register("schweppesManow")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Fanta Orange</Label>
                  <Input type="number" {...register("fantaOrange")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Fanta Strawberry</Label>
                  <Input type="number" {...register("fantaStrawberry")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Soda Water</Label>
                  <Input type="number" {...register("sodaWater")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Water</Label>
                  <Input type="number" {...register("water")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Kids Orange</Label>
                  <Input type="number" {...register("kidsOrange")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Kids Apple</Label>
                  <Input type="number" {...register("kidsApple")} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 justify-center">
              <Button type="button" onClick={saveDraft} className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3">
                Save as Draft
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3">
                Submit Form
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyShiftForm;