import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderOpen, Plus, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import DraftFormsLibrary from "./DraftFormsLibrary";

const DailyShiftFormSimple = () => {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'form' | 'drafts' | 'library'>('form');
  
  // Form state
  const [formData, setFormData] = useState({
    completedBy: '',
    shiftType: 'closing',
    shiftDate: new Date().toISOString().slice(0, 16),
    startingCash: 0,
    grabSales: 0,
    aroiDeeSales: 0,
    qrScanSales: 0,
    cashSales: 0,
    totalSales: 0,
    gasExpense: 0,
    totalExpenses: 0,
    endCash: 0,
    bankedAmount: 0,
    burgerBunsStock: 0,
    meatWeight: 0,
    drinkStockCount: 0,
    // Drink Stock (10 beverages)
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
    // Fresh Food (from authentic supplier list)
    topsideBeef: 0,
    brisketPointEnd: 0,
    chuckRollBeef: 0,
    otherBeefMixed: 0,
    saladIcebergLettuce: 0,
    milk: 0,
    burgerBun: 0,
    tomatos: 0,
    whiteCabbage: 0,
    purpleCabbage: 0,
    onionsBulk10kg: 0,
    onionsSmallBags: 0,
    cheese: 0,
    baconShort: 0,
    baconLong: 0,
    jalapenos: 0,
    // Frozen Food (from authentic supplier list)
    frenchFries7mm: 0,
    chickenNuggets: 0,
    chickenFillets: 0,
    sweetPotatoFries: 0,
    // Shelf Items (from authentic supplier list)
    cajunFriesSeasoning: 0,
    crispyFriedOnions: 0,
    picklesStandardDill: 0,
    picklesSweet: 0,
    mustard: 0,
    mayonnaise: 0,
    tomatoSauce: 0,
    chiliSauceSriracha: 0,
    bbqSauce: 0,
    srirachaSauce: 0,
    saltCoarseSeaSalt: 0,
    // Kitchen Supplies (from authentic supplier list)
    oilFryer: 0,
    plasticFoodWrap: 0,
    paperTowelLong: 0,
    paperTowelShort: 0,
    foodGlovesLarge: 0,
    foodGlovesMedium: 0,
    foodGlovesSmall: 0,
    aluminumFoil: 0,
    plasticMeatGloves: 0,
    kitchenCleaner: 0,
    alcoholSanitiser: 0,
    // Packaging (from authentic supplier list)
    frenchFriesBox: 0,
    plasticCarryBags6x14: 0,
    plasticCarryBags9x18: 0,
    brownPaperFoodBags: 0,
    loadedFriesBoxes: 0,
    packagingLabels: 0,
    knifeForkSpoonSet: 0,
    // Wages and Shopping entries
    wages: [{ staffName: '', amount: 0, type: 'wages' }],
    shopping: [{ item: '', amount: 0, shopName: '' }]
  });

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addWageEntry = () => {
    setFormData(prev => ({
      ...prev,
      wages: [...prev.wages, { staffName: '', amount: 0, type: 'wages' }]
    }));
  };

  const removeWageEntry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      wages: prev.wages.filter((_, i) => i !== index)
    }));
  };

  const updateWageEntry = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      wages: prev.wages.map((wage, i) => 
        i === index ? { ...wage, [field]: value } : wage
      )
    }));
  };

  const addShoppingEntry = () => {
    setFormData(prev => ({
      ...prev,
      shopping: [...prev.shopping, { item: '', amount: 0, shopName: '' }]
    }));
  };

  const removeShoppingEntry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      shopping: prev.shopping.filter((_, i) => i !== index)
    }));
  };

  const updateShoppingEntry = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      shopping: prev.shopping.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  // Calculate total expenses
  const totalWages = formData.wages.reduce((sum, wage) => sum + (wage.amount || 0), 0);
  const totalShopping = formData.shopping.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalExpenses = totalWages + totalShopping + formData.gasExpense;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.completedBy.trim()) {
      toast({
        title: "Error",
        description: "Please enter who completed this form",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch('/api/daily-stock-sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Form submitted successfully!",
          className: "bg-green-50 border-green-200 text-green-800"
        });
        
        // Reset form
        setFormData({
          completedBy: '',
          shiftType: 'closing',
          shiftDate: new Date().toISOString().slice(0, 16),
          startingCash: 0,
          grabSales: 0,
          aroiDeeSales: 0,
          qrScanSales: 0,
          cashSales: 0,
          totalSales: 0,
          gasExpense: 0,
          totalExpenses: 0,
          endCash: 0,
          bankedAmount: 0,
          burgerBunsStock: 0,
          meatWeight: 0,
          drinkStockCount: 0,
          // Reset all inventory items
          coke: 0, cokeZero: 0, sprite: 0, schweppesManow: 0, fantaOrange: 0, fantaStrawberry: 0,
          sodaWater: 0, water: 0, kidsOrange: 0, kidsApple: 0,
          // Reset authentic inventory items
          topsideBeef: 0, brisketPointEnd: 0, chuckRollBeef: 0, otherBeefMixed: 0, saladIcebergLettuce: 0, milk: 0, burgerBun: 0, tomatos: 0, whiteCabbage: 0, purpleCabbage: 0, onionsBulk10kg: 0, onionsSmallBags: 0, cheese: 0, baconShort: 0, baconLong: 0, jalapenos: 0,
          frenchFries7mm: 0, chickenNuggets: 0, chickenFillets: 0, sweetPotatoFries: 0,
          cajunFriesSeasoning: 0, crispyFriedOnions: 0, picklesStandardDill: 0, picklesSweet: 0, mustard: 0, mayonnaise: 0, tomatoSauce: 0, chiliSauceSriracha: 0, bbqSauce: 0, srirachaSauce: 0, saltCoarseSeaSalt: 0,
          oilFryer: 0, plasticFoodWrap: 0, paperTowelLong: 0, paperTowelShort: 0, foodGlovesLarge: 0, foodGlovesMedium: 0, foodGlovesSmall: 0, aluminumFoil: 0, plasticMeatGloves: 0, kitchenCleaner: 0, alcoholSanitiser: 0,
          frenchFriesBox: 0, plasticCarryBags6x14: 0, plasticCarryBags9x18: 0, brownPaperFoodBags: 0, loadedFriesBoxes: 0, packagingLabels: 0, knifeForkSpoonSet: 0,
          wages: [{ staffName: '', amount: 0, type: 'wages' }],
          shopping: [{ item: '', amount: 0, shopName: '' }]
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to submit form",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error occurred",
        variant: "destructive"
      });
    }
  };

  if (activeSection === 'drafts') {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Drafts & Library</h1>
          <div>
            <Button 
              variant="outline" 
              onClick={() => setActiveSection('form')}
              className="mr-2"
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Shift Information</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="completedBy">Completed By*</Label>
              <input 
                id="completedBy"
                value={formData.completedBy}
                onChange={(e) => updateField('completedBy', e.target.value)}
                placeholder="Staff name" 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              />
            </div>
            <div>
              <Label htmlFor="shiftType">Shift Type</Label>
              <Select value={formData.shiftType} onValueChange={(value) => updateField('shiftType', value)}>
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
              <input 
                id="shiftDate"
                type="datetime-local" 
                value={formData.shiftDate}
                onChange={(e) => updateField('shiftDate', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              />
            </div>
            <div>
              <Label htmlFor="startingCash">Starting Cash (฿)</Label>
              <input 
                id="startingCash"
                type="number" 
                value={formData.startingCash}
                onChange={(e) => updateField('startingCash', parseFloat(e.target.value) || 0)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              />
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
              <input 
                id="grabSales"
                type="number" 
                value={formData.grabSales}
                onChange={(e) => updateField('grabSales', parseFloat(e.target.value) || 0)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              />
            </div>
            <div>
              <Label htmlFor="aroiDeeSales">Aroi Dee Sales (฿)</Label>
              <input 
                id="aroiDeeSales"
                type="number" 
                value={formData.aroiDeeSales}
                onChange={(e) => updateField('aroiDeeSales', parseFloat(e.target.value) || 0)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              />
            </div>
            <div>
              <Label htmlFor="qrScanSales">QR Scan Sales (฿)</Label>
              <input 
                id="qrScanSales"
                type="number" 
                value={formData.qrScanSales}
                onChange={(e) => updateField('qrScanSales', parseFloat(e.target.value) || 0)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              />
            </div>
            <div>
              <Label htmlFor="cashSales">Cash Sales (฿)</Label>
              <input 
                id="cashSales"
                type="number" 
                value={formData.cashSales}
                onChange={(e) => updateField('cashSales', parseFloat(e.target.value) || 0)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="totalSales">Total Sales (฿)</Label>
              <input 
                id="totalSales"
                type="number" 
                value={formData.grabSales + formData.aroiDeeSales + formData.qrScanSales + formData.cashSales}
                readOnly 
                className="flex h-10 w-full rounded-md border border-input bg-gray-50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              />
            </div>
          </CardContent>
        </Card>

        {/* Stock Information */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Main Stock Items</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="burgerBunsStock">Burger Buns (count)</Label>
              <input 
                id="burgerBunsStock"
                type="number" 
                value={formData.burgerBunsStock}
                onChange={(e) => updateField('burgerBunsStock', parseFloat(e.target.value) || 0)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              />
            </div>
            <div>
              <Label htmlFor="meatWeight">Meat Weight (kg)</Label>
              <input 
                id="meatWeight"
                type="number" 
                step="0.1"
                value={formData.meatWeight}
                onChange={(e) => updateField('meatWeight', parseFloat(e.target.value) || 0)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              />
            </div>
            <div>
              <Label htmlFor="gasExpense">Gas Expense (฿)</Label>
              <input 
                id="gasExpense"
                type="number" 
                value={formData.gasExpense}
                onChange={(e) => updateField('gasExpense', parseFloat(e.target.value) || 0)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              />
            </div>
          </CardContent>
        </Card>

        {/* Expenses Section */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Wages & Staff Payments</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.wages.map((wage, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                <div>
                  <Label htmlFor={`staffName-${index}`}>Staff Name</Label>
                  <input 
                    id={`staffName-${index}`}
                    value={wage.staffName}
                    onChange={(e) => updateWageEntry(index, 'staffName', e.target.value)}
                    placeholder="Staff member name" 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                  />
                </div>
                <div>
                  <Label htmlFor={`wageAmount-${index}`}>Amount (฿)</Label>
                  <input 
                    id={`wageAmount-${index}`}
                    type="number" 
                    value={wage.amount}
                    onChange={(e) => updateWageEntry(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                  />
                </div>
                <div>
                  <Label htmlFor={`wageType-${index}`}>Type</Label>
                  <Select value={wage.type} onValueChange={(value) => updateWageEntry(index, 'type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wages">Regular Wages</SelectItem>
                      <SelectItem value="overtime">Overtime</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => removeWageEntry(index)}
                    className="h-10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button 
              type="button" 
              variant="outline" 
              onClick={addWageEntry}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Wage Entry
            </Button>
            <div className="pt-2 border-t">
              <div className="flex justify-between font-semibold">
                <span>Total Wages:</span>
                <span>฿{totalWages.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Shopping & Expenses</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.shopping.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                <div>
                  <Label htmlFor={`shoppingItem-${index}`}>Item</Label>
                  <input 
                    id={`shoppingItem-${index}`}
                    value={item.item}
                    onChange={(e) => updateShoppingEntry(index, 'item', e.target.value)}
                    placeholder="Item purchased" 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                  />
                </div>
                <div>
                  <Label htmlFor={`shoppingAmount-${index}`}>Amount (฿)</Label>
                  <input 
                    id={`shoppingAmount-${index}`}
                    type="number" 
                    value={item.amount}
                    onChange={(e) => updateShoppingEntry(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                  />
                </div>
                <div>
                  <Label htmlFor={`shopName-${index}`}>Shop Name</Label>
                  <input 
                    id={`shopName-${index}`}
                    value={item.shopName}
                    onChange={(e) => updateShoppingEntry(index, 'shopName', e.target.value)}
                    placeholder="Where purchased" 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => removeShoppingEntry(index)}
                    className="h-10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button 
              type="button" 
              variant="outline" 
              onClick={addShoppingEntry}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Shopping Item
            </Button>
            <div className="pt-2 border-t">
              <div className="flex justify-between font-semibold">
                <span>Total Shopping:</span>
                <span>฿{totalShopping.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Expenses Summary */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Expense Summary</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Total Wages:</span>
              <span>฿{totalWages.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Shopping:</span>
              <span>฿{totalShopping.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Gas Expense:</span>
              <span>฿{formData.gasExpense.toFixed(2)}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between font-bold text-lg">
                <span>Total Expenses:</span>
                <span>฿{totalExpenses.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Drink Stock */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Drink Stock (10 Beverages)</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="coke">Coke</Label>
              <input id="coke" type="number" value={formData.coke} onChange={(e) => updateField('coke', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="cokeZero">Coke Zero</Label>
              <input id="cokeZero" type="number" value={formData.cokeZero} onChange={(e) => updateField('cokeZero', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="sprite">Sprite</Label>
              <input id="sprite" type="number" value={formData.sprite} onChange={(e) => updateField('sprite', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="schweppesManow">Schweppes Manow</Label>
              <input id="schweppesManow" type="number" value={formData.schweppesManow} onChange={(e) => updateField('schweppesManow', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="fantaOrange">Fanta Orange</Label>
              <input id="fantaOrange" type="number" value={formData.fantaOrange} onChange={(e) => updateField('fantaOrange', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="fantaStrawberry">Fanta Strawberry</Label>
              <input id="fantaStrawberry" type="number" value={formData.fantaStrawberry} onChange={(e) => updateField('fantaStrawberry', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="sodaWater">Soda Water</Label>
              <input id="sodaWater" type="number" value={formData.sodaWater} onChange={(e) => updateField('sodaWater', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="water">Water</Label>
              <input id="water" type="number" value={formData.water} onChange={(e) => updateField('water', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="kidsOrange">Kids Orange</Label>
              <input id="kidsOrange" type="number" value={formData.kidsOrange} onChange={(e) => updateField('kidsOrange', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="kidsApple">Kids Apple</Label>
              <input id="kidsApple" type="number" value={formData.kidsApple} onChange={(e) => updateField('kidsApple', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Fresh Food */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Fresh Food</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="topsideBeef">Topside Beef (kg)</Label>
              <input id="topsideBeef" type="number" step="0.1" value={formData.topsideBeef} onChange={(e) => updateField('topsideBeef', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="brisketPointEnd">Brisket Point End (kg)</Label>
              <input id="brisketPointEnd" type="number" step="0.1" value={formData.brisketPointEnd} onChange={(e) => updateField('brisketPointEnd', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="chuckRollBeef">Chuck Roll Beef (kg)</Label>
              <input id="chuckRollBeef" type="number" step="0.1" value={formData.chuckRollBeef} onChange={(e) => updateField('chuckRollBeef', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="saladIcebergLettuce">Salad (Iceberg Lettuce) (kg)</Label>
              <input id="saladIcebergLettuce" type="number" step="0.1" value={formData.saladIcebergLettuce} onChange={(e) => updateField('saladIcebergLettuce', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="burgerBun">Burger Bun (count)</Label>
              <input id="burgerBun" type="number" value={formData.burgerBun} onChange={(e) => updateField('burgerBun', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="tomatos">Tomatos (kg)</Label>
              <input id="tomatos" type="number" step="0.1" value={formData.tomatos} onChange={(e) => updateField('tomatos', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="onionsBulk10kg">Onions Bulk 10kg</Label>
              <input id="onionsBulk10kg" type="number" value={formData.onionsBulk10kg} onChange={(e) => updateField('onionsBulk10kg', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="cheese">Cheese (slices)</Label>
              <input id="cheese" type="number" value={formData.cheese} onChange={(e) => updateField('cheese', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="baconShort">Bacon Short (kg)</Label>
              <input id="baconShort" type="number" step="0.1" value={formData.baconShort} onChange={(e) => updateField('baconShort', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="baconLong">Bacon Long (kg)</Label>
              <input id="baconLong" type="number" step="0.1" value={formData.baconLong} onChange={(e) => updateField('baconLong', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="jalapenos">Jalapenos (kg)</Label>
              <input id="jalapenos" type="number" step="0.1" value={formData.jalapenos} onChange={(e) => updateField('jalapenos', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Frozen Food */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Frozen Food</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="frenchFries7mm">French Fries 7mm (kg)</Label>
              <input id="frenchFries7mm" type="number" step="0.1" value={formData.frenchFries7mm} onChange={(e) => updateField('frenchFries7mm', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="chickenNuggets">Chicken Nuggets (kg)</Label>
              <input id="chickenNuggets" type="number" step="0.1" value={formData.chickenNuggets} onChange={(e) => updateField('chickenNuggets', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="chickenFillets">Chicken Fillets (kg)</Label>
              <input id="chickenFillets" type="number" step="0.1" value={formData.chickenFillets} onChange={(e) => updateField('chickenFillets', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="sweetPotatoFries">Sweet Potato Fries (kg)</Label>
              <input id="sweetPotatoFries" type="number" step="0.1" value={formData.sweetPotatoFries} onChange={(e) => updateField('sweetPotatoFries', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Shelf Items */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Shelf Items</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="cajunFriesSeasoning">Cajun Fries Seasoning (g)</Label>
              <input id="cajunFriesSeasoning" type="number" value={formData.cajunFriesSeasoning} onChange={(e) => updateField('cajunFriesSeasoning', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="crispyFriedOnions">Crispy Fried Onions (g)</Label>
              <input id="crispyFriedOnions" type="number" value={formData.crispyFriedOnions} onChange={(e) => updateField('crispyFriedOnions', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="picklesStandardDill">Pickles (Standard Dill) (g)</Label>
              <input id="picklesStandardDill" type="number" value={formData.picklesStandardDill} onChange={(e) => updateField('picklesStandardDill', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="picklesSweet">Pickles Sweet (g)</Label>
              <input id="picklesSweet" type="number" value={formData.picklesSweet} onChange={(e) => updateField('picklesSweet', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="mustard">Mustard (kg)</Label>
              <input id="mustard" type="number" step="0.1" value={formData.mustard} onChange={(e) => updateField('mustard', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="mayonnaise">Mayonnaise (litre)</Label>
              <input id="mayonnaise" type="number" step="0.1" value={formData.mayonnaise} onChange={(e) => updateField('mayonnaise', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="tomatoSauce">Tomato Sauce (litre)</Label>
              <input id="tomatoSauce" type="number" step="0.1" value={formData.tomatoSauce} onChange={(e) => updateField('tomatoSauce', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="bbqSauce">BBQ Sauce (g)</Label>
              <input id="bbqSauce" type="number" value={formData.bbqSauce} onChange={(e) => updateField('bbqSauce', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="srirachaSauce">Sriracha Sauce (g)</Label>
              <input id="srirachaSauce" type="number" value={formData.srirachaSauce} onChange={(e) => updateField('srirachaSauce', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="saltCoarseSeaSalt">Salt (Coarse Sea Salt) (kg)</Label>
              <input id="saltCoarseSeaSalt" type="number" step="0.1" value={formData.saltCoarseSeaSalt} onChange={(e) => updateField('saltCoarseSeaSalt', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Kitchen Supplies */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Kitchen Supplies</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="oilFryer">Oil (Fryer) (litre)</Label>
              <input id="oilFryer" type="number" step="0.1" value={formData.oilFryer} onChange={(e) => updateField('oilFryer', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="plasticFoodWrap">Plastic Food Wrap</Label>
              <input id="plasticFoodWrap" type="number" value={formData.plasticFoodWrap} onChange={(e) => updateField('plasticFoodWrap', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="paperTowelLong">Paper Towel Long</Label>
              <input id="paperTowelLong" type="number" value={formData.paperTowelLong} onChange={(e) => updateField('paperTowelLong', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="paperTowelShort">Paper Towel Short (Serviettes)</Label>
              <input id="paperTowelShort" type="number" value={formData.paperTowelShort} onChange={(e) => updateField('paperTowelShort', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="foodGlovesLarge">Food Gloves (Large)</Label>
              <input id="foodGlovesLarge" type="number" value={formData.foodGlovesLarge} onChange={(e) => updateField('foodGlovesLarge', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="foodGlovesMedium">Food Gloves (Medium)</Label>
              <input id="foodGlovesMedium" type="number" value={formData.foodGlovesMedium} onChange={(e) => updateField('foodGlovesMedium', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="foodGlovesSmall">Food Gloves (Small)</Label>
              <input id="foodGlovesSmall" type="number" value={formData.foodGlovesSmall} onChange={(e) => updateField('foodGlovesSmall', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="aluminumFoil">Aluminum Foil</Label>
              <input id="aluminumFoil" type="number" value={formData.aluminumFoil} onChange={(e) => updateField('aluminumFoil', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="plasticMeatGloves">Plastic Meat Gloves</Label>
              <input id="plasticMeatGloves" type="number" value={formData.plasticMeatGloves} onChange={(e) => updateField('plasticMeatGloves', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="kitchenCleaner">Kitchen Cleaner (litre)</Label>
              <input id="kitchenCleaner" type="number" step="0.1" value={formData.kitchenCleaner} onChange={(e) => updateField('kitchenCleaner', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="alcoholSanitiser">Alcohol Sanitiser (g)</Label>
              <input id="alcoholSanitiser" type="number" value={formData.alcoholSanitiser} onChange={(e) => updateField('alcoholSanitiser', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Packaging */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Packaging</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="frenchFriesBox">French Fries Box</Label>
              <input id="frenchFriesBox" type="number" value={formData.frenchFriesBox} onChange={(e) => updateField('frenchFriesBox', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="plasticCarryBags6x14">Plastic Carry Bags (6×14)</Label>
              <input id="plasticCarryBags6x14" type="number" value={formData.plasticCarryBags6x14} onChange={(e) => updateField('plasticCarryBags6x14', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="plasticCarryBags9x18">Plastic Carry Bags (9×18)</Label>
              <input id="plasticCarryBags9x18" type="number" value={formData.plasticCarryBags9x18} onChange={(e) => updateField('plasticCarryBags9x18', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="brownPaperFoodBags">Brown Paper Food Bags</Label>
              <input id="brownPaperFoodBags" type="number" value={formData.brownPaperFoodBags} onChange={(e) => updateField('brownPaperFoodBags', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="loadedFriesBoxes">Loaded Fries Boxes</Label>
              <input id="loadedFriesBoxes" type="number" value={formData.loadedFriesBoxes} onChange={(e) => updateField('loadedFriesBoxes', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="packagingLabels">Packaging Labels</Label>
              <input id="packagingLabels" type="number" value={formData.packagingLabels} onChange={(e) => updateField('packagingLabels', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="knifeForkSpoonSet">Knife, Fork, Spoon Set</Label>
              <input id="knifeForkSpoonSet" type="number" value={formData.knifeForkSpoonSet} onChange={(e) => updateField('knifeForkSpoonSet', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
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
              <input 
                id="endCash"
                type="number" 
                value={formData.endCash}
                onChange={(e) => updateField('endCash', parseFloat(e.target.value) || 0)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              />
            </div>
            <div>
              <Label htmlFor="bankedAmount">Banked Amount (฿)</Label>
              <input 
                id="bankedAmount"
                type="number" 
                value={formData.bankedAmount}
                onChange={(e) => updateField('bankedAmount', parseFloat(e.target.value) || 0)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex gap-4 pt-6">
          <Button type="submit" className="bg-black text-white hover:bg-gray-800 px-8 py-3 font-medium">
            Submit Form
          </Button>
        </div>
      </form>
    </div>
  );
};

export default DailyShiftFormSimple;