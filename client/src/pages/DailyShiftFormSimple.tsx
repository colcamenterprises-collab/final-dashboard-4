import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderOpen } from 'lucide-react';
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
    // Fresh Food
    lettuce: 0,
    tomatoes: 0,
    onions: 0,
    cheese: 0,
    pickles: 0,
    bacon: 0,
    mushrooms: 0,
    // Frozen Food
    chickenNuggets: 0,
    chickenFillets: 0,
    frenchFries: 0,
    onionRings: 0,
    // Shelf Items
    ketchup: 0,
    mustard: 0,
    mayo: 0,
    bbqSauce: 0,
    hotsauce: 0,
    salt: 0,
    pepper: 0,
    oil: 0,
    // Kitchen Items
    napkins: 0,
    straws: 0,
    cups: 0,
    lids: 0,
    // Packaging Items
    burgerBoxes: 0,
    friesBoxes: 0,
    nuggetBoxes: 0,
    bags: 0
  });

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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
          lettuce: 0, tomatoes: 0, onions: 0, cheese: 0, pickles: 0, bacon: 0, mushrooms: 0,
          chickenNuggets: 0, chickenFillets: 0, frenchFries: 0, onionRings: 0,
          ketchup: 0, mustard: 0, mayo: 0, bbqSauce: 0, hotsauce: 0, salt: 0, pepper: 0, oil: 0,
          napkins: 0, straws: 0, cups: 0, lids: 0,
          burgerBoxes: 0, friesBoxes: 0, nuggetBoxes: 0, bags: 0
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
              <Label htmlFor="lettuce">Lettuce</Label>
              <input id="lettuce" type="number" value={formData.lettuce} onChange={(e) => updateField('lettuce', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="tomatoes">Tomatoes</Label>
              <input id="tomatoes" type="number" value={formData.tomatoes} onChange={(e) => updateField('tomatoes', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="onions">Onions</Label>
              <input id="onions" type="number" value={formData.onions} onChange={(e) => updateField('onions', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="cheese">Cheese</Label>
              <input id="cheese" type="number" value={formData.cheese} onChange={(e) => updateField('cheese', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="pickles">Pickles</Label>
              <input id="pickles" type="number" value={formData.pickles} onChange={(e) => updateField('pickles', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="bacon">Bacon</Label>
              <input id="bacon" type="number" value={formData.bacon} onChange={(e) => updateField('bacon', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="mushrooms">Mushrooms</Label>
              <input id="mushrooms" type="number" value={formData.mushrooms} onChange={(e) => updateField('mushrooms', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
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
              <Label htmlFor="chickenNuggets">Chicken Nuggets</Label>
              <input id="chickenNuggets" type="number" value={formData.chickenNuggets} onChange={(e) => updateField('chickenNuggets', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="chickenFillets">Chicken Fillets</Label>
              <input id="chickenFillets" type="number" value={formData.chickenFillets} onChange={(e) => updateField('chickenFillets', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="frenchFries">French Fries</Label>
              <input id="frenchFries" type="number" value={formData.frenchFries} onChange={(e) => updateField('frenchFries', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="onionRings">Onion Rings</Label>
              <input id="onionRings" type="number" value={formData.onionRings} onChange={(e) => updateField('onionRings', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
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
              <Label htmlFor="ketchup">Ketchup</Label>
              <input id="ketchup" type="number" value={formData.ketchup} onChange={(e) => updateField('ketchup', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="mustard">Mustard</Label>
              <input id="mustard" type="number" value={formData.mustard} onChange={(e) => updateField('mustard', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="mayo">Mayo</Label>
              <input id="mayo" type="number" value={formData.mayo} onChange={(e) => updateField('mayo', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="bbqSauce">BBQ Sauce</Label>
              <input id="bbqSauce" type="number" value={formData.bbqSauce} onChange={(e) => updateField('bbqSauce', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="hotsauce">Hot Sauce</Label>
              <input id="hotsauce" type="number" value={formData.hotsauce} onChange={(e) => updateField('hotsauce', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="salt">Salt</Label>
              <input id="salt" type="number" value={formData.salt} onChange={(e) => updateField('salt', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="pepper">Pepper</Label>
              <input id="pepper" type="number" value={formData.pepper} onChange={(e) => updateField('pepper', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="oil">Oil</Label>
              <input id="oil" type="number" value={formData.oil} onChange={(e) => updateField('oil', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Kitchen Items */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Kitchen Items</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="napkins">Napkins</Label>
              <input id="napkins" type="number" value={formData.napkins} onChange={(e) => updateField('napkins', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="straws">Straws</Label>
              <input id="straws" type="number" value={formData.straws} onChange={(e) => updateField('straws', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="cups">Cups</Label>
              <input id="cups" type="number" value={formData.cups} onChange={(e) => updateField('cups', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="lids">Lids</Label>
              <input id="lids" type="number" value={formData.lids} onChange={(e) => updateField('lids', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* Packaging Items */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Packaging Items</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="burgerBoxes">Burger Boxes</Label>
              <input id="burgerBoxes" type="number" value={formData.burgerBoxes} onChange={(e) => updateField('burgerBoxes', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="friesBoxes">Fries Boxes</Label>
              <input id="friesBoxes" type="number" value={formData.friesBoxes} onChange={(e) => updateField('friesBoxes', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="nuggetBoxes">Nugget Boxes</Label>
              <input id="nuggetBoxes" type="number" value={formData.nuggetBoxes} onChange={(e) => updateField('nuggetBoxes', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <Label htmlFor="bags">Bags</Label>
              <input id="bags" type="number" value={formData.bags} onChange={(e) => updateField('bags', parseFloat(e.target.value) || 0)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
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