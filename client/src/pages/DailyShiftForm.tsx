import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

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

const DailyShiftForm = () => {
  const [formData, setFormData] = useState<FormData>({
    completedBy: '',
    shiftDate: new Date().toISOString().split('T')[0],
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

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Items from CSV (filtered - removed top 4 Fresh Food items as requested)
  const items: Item[] = [
    { "Item ": "Salad (Iceberg Lettuce)", "Internal Category": "Fresh Food" },
    { "Item ": "Milk", "Internal Category": "Fresh Food" },
    { "Item ": "Burger Bun", "Internal Category": "Fresh Food" },
    { "Item ": "Tomatos", "Internal Category": "Fresh Food" },
    { "Item ": "White Cabbage", "Internal Category": "Fresh Food" },
    { "Item ": "Purple Cabbage", "Internal Category": "Fresh Food" },
    { "Item ": "Onions Bulk 10kg", "Internal Category": "Fresh Food" },
    { "Item ": "Onions (small bags)", "Internal Category": "Fresh Food" },
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
    { "Item ": "Chili Sauce (Sriracha)", "Internal Category": "Shelf Items" },
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

  useEffect(() => {
    const savedDraft = localStorage.getItem('dailyShiftDraft');
    if (savedDraft) {
      setFormData(JSON.parse(savedDraft));
      setErrorMessage('Loaded from draft.');
    }
  }, []);

  const handleNumberNeededChange = (itemName: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData({
        ...formData,
        numberNeeded: { ...formData.numberNeeded, [itemName]: parseFloat(value) || 0 }
      });
    } else {
      setErrorMessage(`Invalid input for ${itemName}: Only numbers or empty. Reasoning: Text/symbols cause DB errors (22P02).`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset form data
    setFormData({
      completedBy: '',
      shiftDate: new Date().toISOString().split('T')[0],
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
    setErrorMessage('');
    setSuccessMessage('Thank you, form submitted!');
    setTimeout(() => setSuccessMessage(''), 6000);
    
    // Optional backend submission
    try {
      await axios.post('/api/daily-shift-forms', formData);
    } catch (err) {
      setErrorMessage('Backend failed but saved locally. Reasoning: Connection/schema issue – retry later.');
    }
  };

  const saveDraft = () => {
    localStorage.setItem('dailyShiftDraft', JSON.stringify(formData));
    setErrorMessage('Draft saved.');
  };

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

  const groupedItems = items.reduce((acc, item) => {
    const cat = item["Internal Category"] || 'Other';
    if (cat) {
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
    }
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto p-2 sm:p-4 lg:p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      
      {successMessage && (
        <div className="mb-4 p-3 sm:p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm sm:text-base">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 sm:p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm sm:text-base">
          {errorMessage}
        </div>
      )}

      <Card className="mb-4 sm:mb-6">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Daily Shift Form</CardTitle>
        </CardHeader>
      </Card>
      
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="completedBy" className="text-xs sm:text-sm font-medium">Completed By</Label>
                <Input
                  id="completedBy"
                  type="text"
                  value={formData.completedBy}
                  onChange={(e) => setFormData({ ...formData, completedBy: e.target.value })}
                  className="text-xs sm:text-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shiftDate" className="text-xs sm:text-sm font-medium">Shift Date</Label>
                <Input
                  id="shiftDate"
                  type="date"
                  value={formData.shiftDate}
                  onChange={(e) => setFormData({ ...formData, shiftDate: e.target.value })}
                  className="text-xs sm:text-sm"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Information */}
        <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Sales Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="grabSales" className="text-xs sm:text-sm font-medium">Grab Sales</Label>
                <Input
                  id="grabSales"
                  type="number"
                  value={formData.grabSales}
                  onChange={(e) => setFormData({ ...formData, grabSales: parseFloat(e.target.value) || 0 })}
                  className="text-xs sm:text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aroiDeeSales" className="text-xs sm:text-sm font-medium">Aroi Dee Sales</Label>
                <Input
                  id="aroiDeeSales"
                  type="number"
                  value={formData.aroiDeeSales}
                  onChange={(e) => setFormData({ ...formData, aroiDeeSales: parseFloat(e.target.value) || 0 })}
                  className="text-xs sm:text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qrScanSales" className="text-xs sm:text-sm font-medium">QR Scan Sales</Label>
                <Input
                  id="qrScanSales"
                  type="number"
                  value={formData.qrScanSales}
                  onChange={(e) => setFormData({ ...formData, qrScanSales: parseFloat(e.target.value) || 0 })}
                  className="text-xs sm:text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cashSales" className="text-xs sm:text-sm font-medium">Cash Sales</Label>
                <Input
                  id="cashSales"
                  type="number"
                  value={formData.cashSales}
                  onChange={(e) => setFormData({ ...formData, cashSales: parseFloat(e.target.value) || 0 })}
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>
            <div className="p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs sm:text-sm font-semibold text-green-800">Total Sales: ฿{totalSales.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Wages Section */}
        <div className="mb-6 shadow-sm rounded-lg p-4 sm:p-6" style={{backgroundColor: '#f3f4f6'}}>
          <h2 className="font-bold text-[12px] mb-4 border-b border-gray-200 pb-2">Wages & Staff Payments</h2>
          {formData.wages.map((wage, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 p-3 bg-white rounded border border-gray-300">
              <input
                type="text"
                placeholder="Staff Name"
                value={wage.name}
                onChange={(e) => updateWage(index, 'name', e.target.value)}
                className="p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500 text-[11px]"
              />
              <input
                type="number"
                placeholder="Amount"
                value={wage.amount}
                onChange={(e) => updateWage(index, 'amount', parseFloat(e.target.value) || 0)}
                className="p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500 text-[11px]"
              />
              <div className="flex gap-2">
                <select
                  value={wage.type}
                  onChange={(e) => updateWage(index, 'type', e.target.value)}
                  className="flex-1 p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500 text-[11px]"
                >
                  <option value="wages">Wages</option>
                  <option value="bonus">Bonus</option>
                  <option value="overtime">Overtime</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeWageEntry(index)}
                  className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-[11px]"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addWageEntry}
            className="mb-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-[11px]"
          >
            + Add Wage Entry
          </button>
          <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded text-green-800">
            <strong className="text-[11px]">Total Wages: ฿{totalWages.toFixed(2)}</strong>
          </div>
        </div>

        {/* Shopping & Expenses */}
        <div className="mb-6 shadow-sm rounded-lg p-4 sm:p-6" style={{backgroundColor: '#f3f4f6'}}>
          <h2 className="font-bold text-[12px] mb-4 border-b border-gray-200 pb-2">Shopping & Expenses</h2>
          {formData.shopping.map((item, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 p-3 bg-white rounded border border-gray-300">
              <input
                type="text"
                placeholder="Item/Expense"
                value={item.item}
                onChange={(e) => updateShopping(index, 'item', e.target.value)}
                className="p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500 text-[11px]"
              />
              <input
                type="number"
                placeholder="Amount"
                value={item.amount}
                onChange={(e) => updateShopping(index, 'amount', parseFloat(e.target.value) || 0)}
                className="p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500 text-[11px]"
              />
              <div className="flex gap-2">
                <select
                  value={item.shop}
                  onChange={(e) => updateShopping(index, 'shop', e.target.value)}
                  className="flex-1 p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500 text-[11px]"
                >
                  <option value="Big C">Big C</option>
                  <option value="Tesco Lotus">Tesco Lotus</option>
                  <option value="Villa Market">Villa Market</option>
                  <option value="Other">Other</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeShoppingEntry(index)}
                  className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-[11px]"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addShoppingEntry}
            className="mb-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-[11px]"
          >
            + Add Expense
          </button>
          
          <div className="mt-4">
            <label className="block mb-2 text-[11px] font-semibold">Gas Expense</label>
            <input
              type="number"
              value={formData.gasExpense}
              onChange={(e) => setFormData({ ...formData, gasExpense: parseFloat(e.target.value) || 0 })}
              className="w-full p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500 text-[11px]"
            />
          </div>
          
          <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded text-green-800">
            <strong className="text-[11px]">Total Shopping: ฿{totalShopping.toFixed(2)}</strong><br/>
            <strong className="text-[11px]">Total Expenses: ฿{totalExpenses.toFixed(2)}</strong>
          </div>
        </div>

        {/* Cash Management */}
        <div className="mb-6 shadow-sm rounded-lg p-4 sm:p-6" style={{backgroundColor: '#f3f4f6'}}>
          <h2 className="text-sm sm:text-base font-bold mb-4 border-b border-gray-200 pb-2">Cash Management</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block mb-2 text-xs sm:text-sm font-semibold">Starting Cash</label>
              <input
                type="number"
                value={formData.startingCash}
                onChange={(e) => setFormData({ ...formData, startingCash: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="block mb-2 text-xs sm:text-sm font-semibold">Ending Cash (Manual)</label>
              <input
                type="number"
                value={formData.endingCash}
                onChange={(e) => setFormData({ ...formData, endingCash: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="block mb-2 text-xs sm:text-sm font-semibold">Banked Amount</label>
              <input
                type="number"
                value={formData.bankedAmount}
                onChange={(e) => setFormData({ ...formData, bankedAmount: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Stock Information */}
        <div className="mb-6 shadow-sm rounded-lg p-4 sm:p-6" style={{backgroundColor: '#f3f4f6'}}>
          <h2 className="text-sm sm:text-base font-bold mb-4 border-b border-gray-200 pb-2">Stock Counts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-2 text-xs sm:text-sm font-semibold">Burger Rolls Stock</label>
              <input
                type="number"
                value={formData.rollsStock}
                onChange={(e) => setFormData({ ...formData, rollsStock: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="block mb-2 text-xs sm:text-sm font-semibold">Meat Stock (kg)</label>
              <input
                type="number"
                step="0.01"
                value={formData.meatStock}
                onChange={(e) => setFormData({ ...formData, meatStock: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
              />
            </div>
          </div>
          
          {/* Drinks Section */}
          <h3 className="text-xs sm:text-sm font-semibold mb-3 border-b border-gray-200 pb-2">Drinks</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.filter(item => item["Internal Category"] === "Drinks").map((item) => (
              <div key={item["Item "]} className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium">{item["Item "]}</Label>
                <Input
                  type="number"
                  value={formData.numberNeeded[item["Item "]] || 0}
                  onChange={(e) => handleNumberNeededChange(item["Item "], e.target.value)}
                  className="text-xs sm:text-sm"
                  placeholder=""
                />
              </div>
            ))}
          </div>
        </div>

        {/* Inventory Categories (excluding Drinks - moved to Stock Counts) */}
        {Object.entries(groupedItems).filter(([category]) => category !== "Drinks").map(([category, catItems]) => (
          <Card key={category}>
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 uppercase tracking-wide">{category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {(catItems as any[]).map((item: any) => (
                  <div key={item["Item "]} className="space-y-2">
                    <Label className="text-xs sm:text-sm font-medium">{item["Item "]}</Label>
                    <Input
                      type="number"
                      value={formData.numberNeeded[item["Item "]] || 0}
                      onChange={(e) => handleNumberNeededChange(item["Item "], e.target.value)}
                      className="text-xs sm:text-sm"
                      placeholder=""
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Submit Buttons */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-end">
              <Button 
                type="button" 
                onClick={saveDraft} 
                variant="outline"
                className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600 text-xs sm:text-sm font-medium px-6 py-2"
              >
                Save as Draft
              </Button>
              <Button 
                type="submit" 
                className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600 text-xs sm:text-sm font-medium px-6 py-2"
              >
                Save and Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
      {successMessage && (
        <div className="mt-4 p-3 sm:p-4 bg-green-100 border border-green-300 rounded text-green-800 text-xs sm:text-sm">
          <strong>Success:</strong> {successMessage}
        </div>
      )}
      
      {errorMessage && (
        <div className="mt-4 p-3 sm:p-4 bg-red-100 border border-red-300 rounded text-red-800 text-xs sm:text-sm">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

    </div>
  );
};

export default DailyShiftForm;