import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WageEntry {
  name: string;
  amount: number;
  type: string;
}

interface ShoppingEntry {
  item: string;
  amount: number;
  shop: string;
}

interface FormData {
  completedBy: string;
  shiftDate: string;
  shiftType: string;
  grabSales: number;
  aroiDeeSales: number;
  qrScanSales: number;
  cashSales: number;
  wages: WageEntry[];
  shopping: ShoppingEntry[];
  gasExpense: number;
  startingCash: number;
  endingCash: number;
  bankedAmount: number;
  rollsStock: number;
  meatStock: number;
  numberNeeded: Record<string, number>;
}

interface Item {
  "Item ": string;
  "Internal Category": string;
}

const DailyShiftFormMobile = () => {
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<FormData>({
    completedBy: '',
    shiftDate: new Date().toISOString().split('T')[0],
    shiftType: '',
    grabSales: 0,
    aroiDeeSales: 0,
    qrScanSales: 0,
    cashSales: 0,
    wages: [],
    shopping: [],
    gasExpense: 0,
    startingCash: 0,
    endingCash: 0,
    bankedAmount: 0,
    rollsStock: 0,
    meatStock: 0,
    numberNeeded: {}
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Authentic supplier data from CSV
  const items: Item[] = [
    { "Item ": "Salad (Iceberg Lettuce)", "Internal Category": "Fresh Food" },
    { "Item ": "Milk", "Internal Category": "Fresh Food" },
    { "Item ": "Burger Bun", "Internal Category": "Fresh Food" },
    { "Item ": "Tomatos", "Internal Category": "Fresh Food" },
    { "Item ": "White Cabbage", "Internal Category": "Fresh Food" },
    { "Item ": "Purple Cabbage", "Internal Category": "Fresh Food" },
    { "Item ": "Onions Bulk 10kg", "Internal Category": "Fresh Food" },
    { "Item ": "Cheese", "Internal Category": "Fresh Food" },
    { "Item ": "Bacon Short", "Internal Category": "Fresh Food" },
    { "Item ": "Bacon Long", "Internal Category": "Fresh Food" },
    { "Item ": "Jalapenos", "Internal Category": "Fresh Food" },
    { "Item ": "French Fries 7mm", "Internal Category": "Frozen Food" },
    { "Item ": "Chicken Nuggets", "Internal Category": "Frozen Food" },
    { "Item ": "Chicken Fillets", "Internal Category": "Frozen Food" },
    { "Item ": "Sweet Potato Fries", "Internal Category": "Frozen Food" },
    { "Item ": "Cajun Fries Seasoning", "Internal Category": "Shelf Items" },
    { "Item ": "Crispy Fried Onions", "Internal Category": "Shelf Items" },
    { "Item ": "Pickles(standard dill pickles)", "Internal Category": "Shelf Items" },
    { "Item ": "Pickles Sweet (standard)", "Internal Category": "Shelf Items" },
    { "Item ": "Mustard", "Internal Category": "Shelf Items" },
    { "Item ": "Mayonnaise", "Internal Category": "Shelf Items" },
    { "Item ": "Tomato Sauce", "Internal Category": "Shelf Items" },
    { "Item ": "BBQ Sauce", "Internal Category": "Shelf Items" },
    { "Item ": "Sriracha Sauce", "Internal Category": "Shelf Items" },
    { "Item ": "Salt (Coarse Sea Salt)", "Internal Category": "Shelf Items" },
    { "Item ": "Oil (Fryer)", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Plastic Food Wrap", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Paper Towel Long", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Paper Towel Short (Serviettes)", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Food Gloves (Large)", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Food Gloves (Medium)", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Food Gloves (Small)", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Aluminum Foil", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Plastic Meat Gloves", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Kitchen Cleaner", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Alcohol Sanitiser", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Coke", "Internal Category": "Drinks" },
    { "Item ": "Coke Zero", "Internal Category": "Drinks" },
    { "Item ": "Fanta Orange", "Internal Category": "Drinks" },
    { "Item ": "Fanta Strawberry", "Internal Category": "Drinks" },
    { "Item ": "Schweppes Manow", "Internal Category": "Drinks" },
    { "Item ": "Kids Juice (Orange)", "Internal Category": "Drinks" },
    { "Item ": "Kids Juice (Apple)", "Internal Category": "Drinks" },
    { "Item ": "Sprite", "Internal Category": "Drinks" },
    { "Item ": "Soda Water", "Internal Category": "Drinks" },
    { "Item ": "Bottled Water", "Internal Category": "Drinks" },
    { "Item ": "French Fries Box", "Internal Category": "Packaging" },
    { "Item ": "Plastic Carry Bags (Size- 6×14)", "Internal Category": "Packaging" },
    { "Item ": "Plastic Carry Bags (Size - 9×18)", "Internal Category": "Packaging" },
    { "Item ": "Brown Paper Food Bags", "Internal Category": "Packaging" },
    { "Item ": "Loaded Fries Boxes", "Internal Category": "Packaging" },
    { "Item ": "Packaging Labels", "Internal Category": "Packaging" },
    { "Item ": "Knife, Fork, Spoon Set", "Internal Category": "Packaging" }
  ];

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const category = item["Internal Category"];
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, Item[]>);

  // Load saved draft on component mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('dailyShiftDraft');
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        setFormData(parsedDraft);
        toast({
          title: "Draft Loaded",
          description: "Your saved draft has been loaded.",
        });
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }, [toast]);

  // Calculate totals
  const totalSales = formData.grabSales + formData.aroiDeeSales + formData.qrScanSales + formData.cashSales;
  const totalWages = formData.wages.reduce((sum, wage) => sum + (wage.amount || 0), 0);
  const totalShopping = formData.shopping.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalExpenses = totalWages + totalShopping + formData.gasExpense;

  // Wage Management
  const addWageEntry = () => {
    setFormData({
      ...formData,
      wages: [...formData.wages, { name: '', amount: 0, type: 'wages' }]
    });
  };

  const removeWageEntry = (index: number) => {
    setFormData({
      ...formData,
      wages: formData.wages.filter((_, i) => i !== index)
    });
  };

  const updateWage = (index: number, field: keyof WageEntry, value: string | number) => {
    const updatedWages = [...formData.wages];
    updatedWages[index] = { ...updatedWages[index], [field]: value };
    setFormData({ ...formData, wages: updatedWages });
  };

  // Shopping Management
  const addShoppingEntry = () => {
    setFormData({
      ...formData,
      shopping: [...formData.shopping, { item: '', amount: 0, shop: 'Big C' }]
    });
  };

  const removeShoppingEntry = (index: number) => {
    setFormData({
      ...formData,
      shopping: formData.shopping.filter((_, i) => i !== index)
    });
  };

  const updateShopping = (index: number, field: keyof ShoppingEntry, value: string | number) => {
    const updatedShopping = [...formData.shopping];
    updatedShopping[index] = { ...updatedShopping[index], [field]: value };
    setFormData({ ...formData, shopping: updatedShopping });
  };

  // Handle inventory input changes
  const handleNumberNeededChange = (itemName: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData({
      ...formData,
      numberNeeded: { ...formData.numberNeeded, [itemName]: numValue }
    });
  };

  // Save draft function
  const saveDraft = () => {
    localStorage.setItem('dailyShiftDraft', JSON.stringify(formData));
    toast({
      title: "Draft Saved",
      description: "Your form has been saved as a draft.",
    });
  };

  // Submit form function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.completedBy || !formData.shiftType) {
      toast({
        title: "Missing Information",
        description: "Please fill in your name and shift type.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/daily-stock-sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // Clear form and draft
        setFormData({
          completedBy: '',
          shiftDate: new Date().toISOString().split('T')[0],
          shiftType: '',
          grabSales: 0,
          aroiDeeSales: 0,
          qrScanSales: 0,
          cashSales: 0,
          wages: [],
          shopping: [],
          gasExpense: 0,
          startingCash: 0,
          endingCash: 0,
          bankedAmount: 0,
          rollsStock: 0,
          meatStock: 0,
          numberNeeded: {}
        });
        
        localStorage.removeItem('dailyShiftDraft');
        
        setSuccessMessage('Thank you, form submitted successfully!');
        setTimeout(() => setSuccessMessage(''), 6000);

        toast({
          title: "Form Submitted",
          description: "Your shift report has been submitted successfully.",
        });
      } else {
        throw new Error('Submission failed');
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Error",
        description: "There was an error submitting your form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile-first container with proper padding */}
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Header */}
          <div className="text-center pb-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Daily Shift Form</h1>
            <p className="text-gray-600 text-sm">Complete your end-of-shift reporting</p>
          </div>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="completedBy">Staff Name *</Label>
                <Input
                  id="completedBy"
                  type="text"
                  value={formData.completedBy}
                  onChange={(e) => setFormData({ ...formData, completedBy: e.target.value })}
                  placeholder="Enter your name"
                  required
                  className="text-base"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="shiftType">Shift Type *</Label>
                <Select value={formData.shiftType} onValueChange={(value) => setFormData({ ...formData, shiftType: value })}>
                  <SelectTrigger className="text-base">
                    <SelectValue placeholder="Select shift type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day Shift</SelectItem>
                    <SelectItem value="evening">Evening Shift</SelectItem>
                    <SelectItem value="night">Night Shift</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="shiftDate">Shift Date</Label>
                <Input
                  id="shiftDate"
                  type="date"
                  value={formData.shiftDate}
                  onChange={(e) => setFormData({ ...formData, shiftDate: e.target.value })}
                  className="text-base"
                />
              </div>
            </CardContent>
          </Card>

          {/* Sales Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sales Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grabSales">Grab Sales (฿)</Label>
                  <Input
                    id="grabSales"
                    type="number"
                    step="0.01"
                    value={formData.grabSales}
                    onChange={(e) => setFormData({ ...formData, grabSales: parseFloat(e.target.value) || 0 })}
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aroiDeeSales">Aroi Dee Sales (฿)</Label>
                  <Input
                    id="aroiDeeSales"
                    type="number"
                    step="0.01"
                    value={formData.aroiDeeSales}
                    onChange={(e) => setFormData({ ...formData, aroiDeeSales: parseFloat(e.target.value) || 0 })}
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qrScanSales">QR Scan Sales (฿)</Label>
                  <Input
                    id="qrScanSales"
                    type="number"
                    step="0.01"
                    value={formData.qrScanSales}
                    onChange={(e) => setFormData({ ...formData, qrScanSales: parseFloat(e.target.value) || 0 })}
                    className="text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cashSales">Cash Sales (฿)</Label>
                  <Input
                    id="cashSales"
                    type="number"
                    step="0.01"
                    value={formData.cashSales}
                    onChange={(e) => setFormData({ ...formData, cashSales: parseFloat(e.target.value) || 0 })}
                    className="text-base"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-lg font-semibold text-green-800">
                  Total Sales: ฿{totalSales.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Wages & Staff Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Wages & Staff Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.wages.map((wage, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Entry {index + 1}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeWageEntry(index)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <Label>Staff Name</Label>
                      <Input
                        type="text"
                        value={wage.name}
                        onChange={(e) => updateWage(index, 'name', e.target.value)}
                        placeholder="Enter staff name"
                        className="text-base"
                      />
                    </div>
                    
                    <div>
                      <Label>Amount (฿)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={wage.amount}
                        onChange={(e) => updateWage(index, 'amount', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="text-base"
                      />
                    </div>
                    
                    <div>
                      <Label>Type</Label>
                      <Select value={wage.type} onValueChange={(value) => updateWage(index, 'type', value)}>
                        <SelectTrigger className="text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wages">Wages</SelectItem>
                          <SelectItem value="bonus">Bonus</SelectItem>
                          <SelectItem value="overtime">Overtime</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
              
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-lg font-semibold text-blue-800">
                  Total Wages: ฿{totalWages.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Shopping & Expenses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Shopping & Expenses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.shopping.map((item, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Expense {index + 1}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeShoppingEntry(index)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <Label>Item/Expense</Label>
                      <Input
                        type="text"
                        value={item.item}
                        onChange={(e) => updateShopping(index, 'item', e.target.value)}
                        placeholder="Enter item or expense"
                        className="text-base"
                      />
                    </div>
                    
                    <div>
                      <Label>Amount (฿)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => updateShopping(index, 'amount', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="text-base"
                      />
                    </div>
                    
                    <div>
                      <Label>Shop</Label>
                      <Select value={item.shop} onValueChange={(value) => updateShopping(index, 'shop', value)}>
                        <SelectTrigger className="text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Big C">Big C</SelectItem>
                          <SelectItem value="Makro">Makro</SelectItem>
                          <SelectItem value="Tesco">Tesco</SelectItem>
                          <SelectItem value="7-Eleven">7-Eleven</SelectItem>
                          <SelectItem value="Local Market">Local Market</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                Add Expense
              </Button>
              
              <div className="space-y-2">
                <Label htmlFor="gasExpense">Gas Expense (฿)</Label>
                <Input
                  id="gasExpense"
                  type="number"
                  step="0.01"
                  value={formData.gasExpense}
                  onChange={(e) => setFormData({ ...formData, gasExpense: parseFloat(e.target.value) || 0 })}
                  className="text-base"
                />
              </div>
              
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-lg font-semibold text-orange-800">
                  Total Shopping: ฿{totalShopping.toFixed(2)}
                </p>
                <p className="text-lg font-semibold text-orange-800">
                  Total Expenses: ฿{totalExpenses.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cash Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cash Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="startingCash">Starting Cash (฿)</Label>
                <Input
                  id="startingCash"
                  type="number"
                  step="0.01"
                  value={formData.startingCash}
                  onChange={(e) => setFormData({ ...formData, startingCash: parseFloat(e.target.value) || 0 })}
                  className="text-base"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endingCash">Ending Cash (฿)</Label>
                <Input
                  id="endingCash"
                  type="number"
                  step="0.01"
                  value={formData.endingCash}
                  onChange={(e) => setFormData({ ...formData, endingCash: parseFloat(e.target.value) || 0 })}
                  className="text-base"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bankedAmount">Banked Amount (฿)</Label>
                <Input
                  id="bankedAmount"
                  type="number"
                  step="0.01"
                  value={formData.bankedAmount}
                  onChange={(e) => setFormData({ ...formData, bankedAmount: parseFloat(e.target.value) || 0 })}
                  className="text-base"
                />
              </div>
            </CardContent>
          </Card>

          {/* Stock Counts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stock Counts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rollsStock">Burger Rolls Stock</Label>
                <Input
                  id="rollsStock"
                  type="number"
                  value={formData.rollsStock}
                  onChange={(e) => setFormData({ ...formData, rollsStock: parseFloat(e.target.value) || 0 })}
                  className="text-base"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="meatStock">Meat Stock (kg)</Label>
                <Input
                  id="meatStock"
                  type="number"
                  step="0.01"
                  value={formData.meatStock}
                  onChange={(e) => setFormData({ ...formData, meatStock: parseFloat(e.target.value) || 0 })}
                  className="text-base"
                />
              </div>
              
              {/* Drinks Section */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Drinks</h3>
                <div className="space-y-3">
                  {items.filter(item => item["Internal Category"] === "Drinks").map((item) => (
                    <div key={item["Item "]} className="space-y-2">
                      <Label className="text-sm">{item["Item "]}</Label>
                      <Input
                        type="number"
                        value={formData.numberNeeded[item["Item "]] || 0}
                        onChange={(e) => handleNumberNeededChange(item["Item "], e.target.value)}
                        className="text-base"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Categories */}
          {Object.entries(groupedItems).filter(([category]) => category !== "Drinks").map(([category, catItems]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg uppercase tracking-wide">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {catItems.map((item) => (
                    <div key={item["Item "]} className="space-y-2">
                      <Label className="text-sm">{item["Item "]}</Label>
                      <Input
                        type="number"
                        value={formData.numberNeeded[item["Item "]] || 0}
                        onChange={(e) => handleNumberNeededChange(item["Item "], e.target.value)}
                        className="text-base"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Submit Buttons */}
          <div className="space-y-3 pt-6">
            <Button 
              type="button" 
              onClick={saveDraft} 
              variant="outline"
              className="w-full py-3 text-base"
              disabled={isSubmitting}
            >
              Save as Draft
            </Button>
            <Button 
              type="submit" 
              className="w-full py-3 text-base bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Form"}
            </Button>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="p-4 bg-green-100 border border-green-300 rounded-lg">
              <p className="text-green-800 font-medium">{successMessage}</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default DailyShiftFormMobile;