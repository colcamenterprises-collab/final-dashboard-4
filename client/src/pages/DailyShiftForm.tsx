import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from 'react';
import { Trash2, Plus, FolderOpen, FileText } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import DraftFormsLibrary from "./DraftFormsLibrary";

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
  drinks: z.record(z.string(), z.coerce.number().optional().default(0)).optional().default({}),
  freshFood: z.record(z.string(), z.coerce.number().optional().default(0)).optional().default({}),
  freshFoodAdditional: z.array(z.object({ 
    item: z.string().min(1), 
    quantity: z.coerce.number().min(0).optional().default(0), 
    note: z.string().optional(), 
    addPermanently: z.boolean().optional().default(false) 
  })).optional().default([]),
  frozenFood: z.record(z.string(), z.coerce.number().optional().default(0)).optional().default({}),
  frozenFoodAdditional: z.array(z.object({ 
    item: z.string().min(1), 
    quantity: z.coerce.number().min(0).optional().default(0), 
    note: z.string().optional(), 
    addPermanently: z.boolean().optional().default(false) 
  })).optional().default([]),
  shelfItems: z.record(z.string(), z.coerce.number().optional().default(0)).optional().default({}),
  shelfItemsAdditional: z.array(z.object({ 
    item: z.string().min(1), 
    quantity: z.coerce.number().min(0).optional().default(0), 
    note: z.string().optional(), 
    addPermanently: z.boolean().optional().default(false) 
  })).optional().default([]),
  kitchenItems: z.record(z.string(), z.coerce.number().optional().default(0)).optional().default({}),
  kitchenItemsAdditional: z.array(z.object({ 
    item: z.string().min(1), 
    quantity: z.coerce.number().min(0).optional().default(0), 
    note: z.string().optional(), 
    addPermanently: z.boolean().optional().default(false) 
  })).optional().default([]),
  packagingItems: z.record(z.string(), z.coerce.number().optional().default(0)).optional().default({}),
  packagingItemsAdditional: z.array(z.object({ 
    item: z.string().min(1), 
    quantity: z.coerce.number().min(0).optional().default(0), 
    note: z.string().optional(), 
    addPermanently: z.boolean().optional().default(false) 
  })).optional().default([]),
  purchasedAmounts: z.record(z.string(), z.coerce.number().optional().default(0)).optional().default({})
});

interface Supplier {
  id: number;
  item: string;
  category: string;
  supplier: string;
  brand: string;
  cost: number;
  packagingQty: string;
  unit: string;
  portionSize: string;
  minStock: string;
}

const DailyShiftForm = () => {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'form' | 'drafts' | 'library'>('form');
  
  // Fetch suppliers data from JSON endpoint
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers-json"],
  });

  // Organize suppliers by category
  const suppliersByCategory = suppliers.reduce((acc: Record<string, Supplier[]>, supplier: Supplier) => {
    const category = supplier.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(supplier);
    return acc;
  }, {});

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
      drinks: {},
      freshFood: {},
      freshFoodAdditional: [],
      frozenFood: {},
      frozenFoodAdditional: [],
      shelfItems: {},
      shelfItemsAdditional: [],
      kitchenItems: {},
      kitchenItemsAdditional: [],
      packagingItems: {},
      packagingItemsAdditional: [],
      purchasedAmounts: {}
    }
  });

  const { watch, setValue, register } = form;
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

  // Render different sections based on activeSection
  if (activeSection === 'drafts' || activeSection === 'library') {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Drafts & Library</h1>
            <p className="text-gray-600 mt-2">Manage draft forms and view completed forms</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="ghost" 
              onClick={() => setActiveSection('form')}
              className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-medium px-4 py-2 rounded-lg shadow-sm transition-all duration-200"
            >
              Back to Form
            </Button>
          </div>
        </div>
        <DraftFormsLibrary />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daily Sales & Stock Form</h1>
          <p className="text-gray-600 mt-2">Complete your shift reporting with auto-calculations</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="ghost" 
            onClick={() => setActiveSection('drafts')}
            className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-medium px-4 py-2 rounded-lg shadow-sm transition-all duration-200"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Drafts & Library
          </Button>
        </div>
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
          <CardContent>
            {suppliersLoading ? (
              <div>Loading drinks...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {suppliersByCategory['Drinks']?.map((supplier: Supplier) => {
                  const fieldName = `drinks.${supplier.item}` as const;
                  return (
                    <div key={supplier.id}>
                      <Label>{supplier.item}</Label>
                      <Input type="number" {...form.register(fieldName as any)} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fresh Food Inventory */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Fresh Food Inventory</h2>
          </CardHeader>
          <CardContent>
            {suppliersLoading ? (
              <div>Loading items...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {suppliersByCategory['Fresh Food']?.map((supplier: Supplier) => {
                  const fieldName = `freshFood.${supplier.item}` as const;
                  return (
                    <div key={supplier.id}>
                      <Label>{supplier.item}</Label>
                      <Input type="number" {...form.register(fieldName as any)} />
                    </div>
                  );
                })}
              </div>
            )}
            
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
            {suppliersLoading ? (
              <div>Loading items...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {suppliersByCategory['Frozen Food']?.map((supplier: Supplier) => {
                  const fieldName = `frozenFood.${supplier.item}` as const;
                  return (
                    <div key={supplier.id}>
                      <Label>{supplier.item}</Label>
                      <Input type="number" {...form.register(fieldName as any)} />
                    </div>
                  );
                })}
              </div>
            )}
            
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
            {suppliersLoading ? (
              <div>Loading items...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {suppliersByCategory['Shelf Items']?.map((supplier: Supplier) => {
                  const fieldName = `shelfItems.${supplier.item}` as const;
                  return (
                    <div key={supplier.id}>
                      <Label>{supplier.item}</Label>
                      <Input type="number" {...form.register(fieldName as any)} />
                    </div>
                  );
                })}
              </div>
            )}
            
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
            {suppliersLoading ? (
              <div>Loading items...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {suppliersByCategory['Kitchen Supplies']?.map((supplier: Supplier) => {
                  const fieldName = `kitchenItems.${supplier.item}` as const;
                  return (
                    <div key={supplier.id}>
                      <Label>{supplier.item}</Label>
                      <Input type="number" {...form.register(fieldName as any)} />
                    </div>
                  );
                })}
              </div>
            )}
            
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
            {suppliersLoading ? (
              <div>Loading items...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {suppliersByCategory['Packaging']?.map((supplier: Supplier) => {
                  const fieldName = `packagingItems.${supplier.item}` as const;
                  return (
                    <div key={supplier.id}>
                      <Label>{supplier.item}</Label>
                      <Input type="number" {...form.register(fieldName as any)} />
                    </div>
                  );
                })}
              </div>
            )}
            
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

        {/* All Suppliers Inventory Section */}
        {!suppliersLoading && suppliers.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Complete Inventory Management</h3>
              <p className="text-sm text-gray-600">Track purchased amounts for all suppliers and items</p>
            </CardHeader>
            <CardContent>
              {Object.entries(suppliersByCategory).map(([category, categoryItems]) => (
                <div key={category} className="mb-8">
                  <h4 className="text-md font-semibold text-gray-800 mb-4 border-b pb-2">{category}</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left table-auto border border-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 border-r text-xs font-medium text-gray-600">Item</th>
                          <th className="px-4 py-2 border-r text-xs font-medium text-gray-600">Cost (฿)</th>
                          <th className="px-4 py-2 border-r text-xs font-medium text-gray-600">Packaging Qty</th>
                          <th className="px-4 py-2 border-r text-xs font-medium text-gray-600">Portion Size</th>
                          <th className="px-4 py-2 border-r text-xs font-medium text-gray-600">Min Stock</th>
                          <th className="px-4 py-2 text-xs font-medium text-gray-600">Purchased Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryItems.map((item: Supplier) => (
                          <tr key={item.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2 border-r text-sm font-medium text-gray-900">{item.item}</td>
                            <td className="px-4 py-2 border-r text-sm text-gray-700">฿{item.cost.toFixed(2)}</td>
                            <td className="px-4 py-2 border-r text-sm text-gray-700">{item.packagingQty}</td>
                            <td className="px-4 py-2 border-r text-sm text-gray-700">{item.portionSize}</td>
                            <td className="px-4 py-2 border-r text-sm text-gray-700">{item.minStock}</td>
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                placeholder="0"
                                className="w-20 h-8 text-sm border border-gray-300 rounded px-2"
                                min="0"
                                step="0.01"
                                {...register(`purchasedAmounts.${item.id}` as any)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

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