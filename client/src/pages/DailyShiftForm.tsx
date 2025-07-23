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
  shiftDate: z.string().min(1, "Required"),
  startingCash: z.coerce.number().optional().default(0),
  grabSales: z.coerce.number().optional().default(0),
  aroiDeeSales: z.coerce.number().optional().default(0),
  qrScanSales: z.coerce.number().optional().default(0),
  cashSales: z.coerce.number().optional().default(0),
  totalSales: z.coerce.number().optional().default(0),
  wages: z.array(z.object({ staffName: z.string().min(1), amount: z.coerce.number().min(0).optional().default(0), type: z.enum(['wages', 'overtime', 'other']) })).optional().default([]),
  shopping: z.array(z.object({ item: z.string().min(1), amount: z.coerce.number().min(0).optional().default(0), shopName: z.string().optional() })).optional().default([]),
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
  freshFood: z.array(z.object({ name: z.string(), value: z.coerce.number().optional().default(0) })).optional().default([{ name: 'Salad (Iceberg Lettuce)', value: 0 }, { name: 'Tomatos', value: 0 }, { name: 'White Cabbage', value: 0 }, { name: 'Purple Cabbage', value: 0 }, { name: 'Bacon Short', value: 0 }, { name: 'Bacon Long', value: 0 }, { name: 'Milk', value: 0 }, { name: 'Butter', value: 0 }]),
  freshFoodAdditional: z.array(z.object({ item: z.string().min(1), quantity: z.coerce.number().min(0).optional().default(0), note: z.string().optional(), addPermanently: z.boolean().optional().default(false) })).optional().default([]),
  frozenFood: z.array(z.object({ name: z.string(), value: z.coerce.number().optional().default(0) })).optional().default([{ name: 'Chicken Nuggets', value: 0 }, { name: 'Sweet Potato Fries', value: 0 }, { name: 'French Fries (7mm)', value: 0 }, { name: 'Chicken Fillets', value: 0 }]),
  frozenFoodAdditional: z.array(z.object({ item: z.string().min(1), quantity: z.coerce.number().min(0).optional().default(0), note: z.string().optional(), addPermanently: z.boolean().optional().default(false) })).optional().default([]),
  shelfItems: z.array(z.object({ name: z.string(), value: z.coerce.number().optional().default(0) })).optional().default([{ name: 'Mayonnaise', value: 0 }, { name: 'Mustard', value: 0 }, { name: 'Dill Pickles', value: 0 }, { name: 'Sweet Pickles', value: 0 }, { name: 'Salt', value: 0 }, { name: 'Pepper', value: 0 }, { name: 'Cajun Spice', value: 0 }, { name: 'White Vinegar', value: 0 }, { name: 'Crispy Fried Onions', value: 0 }, { name: 'Paprika (Smoked)', value: 0 }, { name: 'Jalapenos', value: 0 }, { name: 'Sriracha Mayonnaise', value: 0 }, { name: 'Chipotle Sauce', value: 0 }, { name: 'Flour', value: 0 }, { name: 'French Fries Seasoning BBQ', value: 0 }]),
  shelfItemsAdditional: z.array(z.object({ item: z.string().min(1), quantity: z.coerce.number().min(0).optional().default(0), note: z.string().optional(), addPermanently: z.boolean().optional().default(false) })).optional().default([]),
  kitchenItems: z.array(z.object({ name: z.string(), value: z.coerce.number().optional().default(0) })).optional().default([{ name: 'Kitchen Cleaner', value: 0 }, { name: 'Floor Cleaner', value: 0 }, { name: 'Gloves Medium', value: 0 }, { name: 'Gloves Large', value: 0 }, { name: 'Gloves Small', value: 0 }, { name: 'Plastic Meat Gloves', value: 0 }, { name: 'Paper Towel Long', value: 0 }, { name: 'Paper Towel Short', value: 0 }, { name: 'Bin Bags 30x40', value: 0 }, { name: 'Printer Rolls', value: 0 }, { name: 'Sticky Tape', value: 0 }]),
  kitchenItemsAdditional: z.array(z.object({ item: z.string().min(1), quantity: z.coerce.number().min(0).optional().default(0), note: z.string().optional(), addPermanently: z.boolean().optional().default(false) })).optional().default([]),
  packagingItems: z.array(z.object({ name: z.string(), value: z.coerce.number().optional().default(0) })).optional().default([{ name: 'Loaded Fries Box', value: 0 }, { name: 'French Fries Box 600ml', value: 0 }, { name: 'Takeaway Sauce Container', value: 0 }, { name: 'Coleslaw Container', value: 0 }, { name: 'Burger Wrapping Paper', value: 0 }, { name: 'French Fries Paper', value: 0 }, { name: 'Paper Bags', value: 0 }, { name: 'Plastic Bags 8x16', value: 0 }, { name: 'Plastic Bags 9x18', value: 0 }, { name: 'Knife and Fork Set', value: 0 }, { name: 'Bag Close Stickers', value: 0 }, { name: 'Sauce Container Stickers', value: 0 }, { name: 'Flag Stickers', value: 0 }, { name: 'Burger Sweets Takeaway', value: 0 }]),
  packagingItemsAdditional: z.array(z.object({ item: z.string().min(1), quantity: z.coerce.number().min(0).optional().default(0), note: z.string().optional(), addPermanently: z.boolean().optional().default(false) })).optional().default([]),
  isDraft: z.boolean().optional().default(false),
});

const DailyShiftForm = () => {
  const form = useForm({ resolver: zodResolver(formSchema), defaultValues: formSchema.parse({ shiftDate: new Date().toISOString().split('T')[0] }) });
  const { watch, setValue, handleSubmit } = form;
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

  const onSubmit = async (data) => {
    try {
      const response = await fetch('/api/daily-stock-sales', {
        method: 'POST',
        body: JSON.stringify({ ...data, shiftDate: new Date(data.shiftDate).toISOString() }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const result = await response.json();
        if (!data.isDraft) {
          const purchaseItems = [
            ...data.freshFood.filter(f => f.value > 0),
            ...data.freshFoodAdditional.filter(f => f.quantity > 0),
            ...data.frozenFood.filter(f => f.value > 0),
            ...data.frozenFoodAdditional.filter(f => f.quantity > 0),
            ...data.shelfItems.filter(f => f.value > 0),
            ...data.shelfItemsAdditional.filter(f => f.quantity > 0),
            ...data.kitchenItems.filter(f => f.value > 0),
            ...data.kitchenItemsAdditional.filter(f => f.quantity > 0),
            ...data.packagingItems.filter(f => f.value > 0),
            ...data.packagingItemsAdditional.filter(f => f.quantity > 0),
          ].filter(item => item.name !== 'Burger Buns' && item.name !== 'Meat' && !['Coke', 'Coke Zero', 'Sprite', 'Schweppes Manow', 'Fanta Orange', 'Fanta Strawberry', 'Soda Water', 'Water', 'Kids Orange', 'Kids Apple'].includes(item.name));
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
          // Permanent add if checked
          for (const add of [...data.freshFoodAdditional.filter(f => f.addPermanently), ...data.frozenFoodAdditional.filter(f => f.addPermanently), ...data.shelfItemsAdditional.filter(f => f.addPermanently), ...data.kitchenItemsAdditional.filter(f => f.addPermanently), ...data.packagingItemsAdditional.filter(f => f.addPermanently)]) {
            await fetch('/api/ingredients', {
              method: 'POST',
              body: JSON.stringify({ name: add.item, price: 0, packageSize: 0, portionSize: 0, unit: 'unit' }),
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
        form.reset();
      } else {
        throw new Error('Submit failed');
      }
    } catch (err) {
      console.error('Form submission error:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">Daily Sales & Stock Form</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Completed By*</Label>
                <Input {...form.register("completedBy")} />
              </div>
              <div>
                <Label>Shift Type</Label>
                <select {...form.register("shiftType")} className="w-full p-2 border rounded">
                  <option value="opening">Opening</option>
                  <option value="closing">Closing</option>
                </select>
              </div>
              <div>
                <Label>Shift Date*</Label>
                <Input type="date" {...form.register("shiftDate")} />
              </div>
            </div>
            
            <div>
              <Label>Starting Cash (฿)</Label>
              <Input type="number" {...form.register("startingCash")} />
            </div>

            <h3 className="text-lg font-semibold">Sales Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="p-4 bg-gray-50 rounded">
              <Label>Total Sales (฿)</Label>
              <Input disabled value={form.watch('totalSales')} />
            </div>

            <h3 className="text-lg font-semibold">Expenses</h3>
            <div className="space-y-4">
              <h4 className="font-medium">Wages</h4>
              {[...Array(wagesEntries)].map((_, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded">
                  <div>
                    <Label>Staff Name</Label>
                    <Input placeholder="Staff Name" {...form.register(`wages.${i}.staffName`)} />
                  </div>
                  <div>
                    <Label>Amount (฿)</Label>
                    <Input type="number" placeholder="Amount" {...form.register(`wages.${i}.amount`)} />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <select {...form.register(`wages.${i}.type`)} className="w-full p-2 border rounded">
                      <option value="wages">Wages</option>
                      <option value="overtime">Overtime</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              ))}
              <Button type="button" onClick={() => setWagesEntries(wagesEntries + 1)} variant="outline">Add Wage Entry</Button>

              <h4 className="font-medium">Shopping</h4>
              {[...Array(shoppingEntries)].map((_, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded">
                  <div>
                    <Label>Item Purchased</Label>
                    <Input placeholder="Item Purchased" {...form.register(`shopping.${i}.item`)} />
                  </div>
                  <div>
                    <Label>Amount (฿)</Label>
                    <Input type="number" placeholder="Amount" {...form.register(`shopping.${i}.amount`)} />
                  </div>
                  <div>
                    <Label>Shop Name</Label>
                    <Input placeholder="Shop Name" {...form.register(`shopping.${i}.shopName`)} />
                  </div>
                </div>
              ))}
              <Button type="button" onClick={() => setShoppingEntries(shoppingEntries + 1)} variant="outline">Add Shopping Entry</Button>

              <div>
                <Label>Gas Expense (฿)</Label>
                <Input type="number" {...form.register("gasExpense")} />
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded">
              <Label>Total Expenses (฿)</Label>
              <Input disabled value={form.watch('totalExpenses')} />
            </div>

            <h3 className="text-lg font-semibold">Summary</h3>
            <div className="space-y-2">
              <p>Total Sales: ฿{form.watch('totalSales')}</p>
              <p>Breakdown: Grab ฿{form.watch('grabSales')}, Aroi Dee ฿{form.watch('aroiDeeSales')}, QR ฿{form.watch('qrScanSales')}, Cash ฿{form.watch('cashSales')}</p>
              <p>Total Expenses: ฿{form.watch('totalExpenses')}</p>
              <p>Breakdown: Wages ฿{form.watch('wages').reduce((sum, w) => sum + Number(w.amount || 0), 0)}, Shopping ฿{form.watch('shopping').reduce((sum, s) => sum + Number(s.amount || 0), 0)}, Gas ฿{form.watch('gasExpense')}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Total Cash in Register at Closing (฿)</Label>
                <Input type="number" {...form.register("endCash")} />
              </div>
              <div>
                <Label>Amount to be Banked (฿)</Label>
                <Input type="number" {...form.register("bankedAmount")} />
              </div>
            </div>

            <h3 className="text-lg font-semibold">Stock and Produce</h3>
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

            <h4 className="font-medium">Drink Details (In Hand)</h4>
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

            <h3 className="text-lg font-semibold">Fresh Food</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {form.watch('freshFood').map((item, index) => (
                <div key={index}>
                  <Label>{item.name}</Label>
                  <Input type="number" {...form.register(`freshFood.${index}.value`)} />
                </div>
              ))}
            </div>

            <h4 className="font-medium">Additional Items Not Listed</h4>
            {[...Array(freshAdditional)].map((_, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded">
                <div>
                  <Label>Item to be Purchased</Label>
                  <Input placeholder="Item to be Purchased" {...form.register(`freshFoodAdditional.${i}.item`)} />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" placeholder="Quantity" {...form.register(`freshFoodAdditional.${i}.quantity`)} />
                </div>
                <div>
                  <Label>Note</Label>
                  <Input placeholder="Note" {...form.register(`freshFoodAdditional.${i}.note`)} />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox {...form.register(`freshFoodAdditional.${i}.addPermanently`)} />
                  <Label>Add Permanently</Label>
                </div>
              </div>
            ))}
            <Button type="button" onClick={() => setFreshAdditional(freshAdditional + 1)} variant="outline">Add Item</Button>

            <div className="flex gap-4">
              <Button type="submit" className="flex-1">Save</Button>
              <Button type="submit" onClick={() => form.setValue('isDraft', true)} variant="outline" className="flex-1">Save Draft</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyShiftForm;