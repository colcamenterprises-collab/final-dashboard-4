import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DailyShiftForm = () => {
  const { toast } = useToast();
  
  // Form state following exact structure: Shift Information → Sales → Expenses → Food & Stock Items
  const [formData, setFormData] = useState({
    // Shift Information
    shiftType: '',
    completedBy: '',
    shiftDate: new Date().toISOString().split('T')[0],
    
    // Sales
    grabSales: 0,
    aroiDeeSales: 0,
    qrScanSales: 0,
    cashSales: 0,
    
    // Expenses - Wages & Staff Payments
    wages: [],
    
    // Expenses - Shopping & Expenses  
    shopping: [],
    
    // Cash Management
    startingCash: 0,
    endingCash: 0,
    bankedAmount: 0,
    
    // Food & Stock Items - authentic inventory from CSV
    inventory: {}
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Authentic supplier data from CSV - 100% real inventory items
  const inventoryCategories = {
    "Fresh Food": [
      { name: "Topside Beef", supplier: "Makro", cost: "฿319.00", unit: "kg" },
      { name: "Brisket Point End", supplier: "Makro", cost: "฿299.00", unit: "kg" },
      { name: "Chuck Roll Beef", supplier: "Makro", cost: "฿319.00", unit: "kg" },
      { name: "Salad (Iceberg Lettuce)", supplier: "Makro", cost: "฿99.00", unit: "kg" },
      { name: "Burger Bun", supplier: "Bakery", cost: "฿8.00", unit: "each" },
      { name: "Tomatos", supplier: "Makro", cost: "฿89.00", unit: "kg" },
      { name: "Onions Bulk 10kg", supplier: "Makro", cost: "฿290.00", unit: "10kg" },
      { name: "Cheese", supplier: "Makro", cost: "฿359.00", unit: "kg" },
      { name: "Bacon Short", supplier: "Makro", cost: "฿305.00", unit: "kg" },
      { name: "Bacon Long", supplier: "Makro", cost: "฿430.00", unit: "2kg" },
      { name: "Jalapenos", supplier: "Makro", cost: "฿190.00", unit: "kg" }
    ],
    "Frozen Food": [
      { name: "French Fries 7mm", supplier: "Makro", cost: "฿129.00", unit: "2kg" },
      { name: "Chicken Nuggets", supplier: "Makro", cost: "฿155.00", unit: "kg" },
      { name: "Chicken Fillets", supplier: "Makro", cost: "฿199.00", unit: "kg" },
      { name: "Sweet Potato Fries", supplier: "Makro", cost: "฿145.00", unit: "kg" }
    ],
    "Shelf Items": [
      { name: "Cajun Fries Seasoning", supplier: "Makro", cost: "฿508.00", unit: "510g" },
      { name: "Crispy Fried Onions", supplier: "Makro", cost: "฿79.00", unit: "500g" },
      { name: "Pickles (Standard Dill)", supplier: "Makro", cost: "฿89.00", unit: "480g" },
      { name: "Pickles Sweet", supplier: "Makro", cost: "฿89.00", unit: "480g" },
      { name: "Mustard", supplier: "Makro", cost: "฿88.00", unit: "kg" },
      { name: "Mayonnaise", supplier: "Makro", cost: "฿90.00", unit: "litre" },
      { name: "Tomato Sauce", supplier: "Makro", cost: "฿175.00", unit: "5L" },
      { name: "BBQ Sauce", supplier: "Makro", cost: "฿110.00", unit: "500g" },
      { name: "Sriracha Sauce", supplier: "Makro", cost: "฿108.00", unit: "950g" },
      { name: "Salt (Coarse Sea Salt)", supplier: "Online", cost: "฿121.00", unit: "kg" }
    ],
    "Kitchen Supplies": [
      { name: "Oil (Fryer)", supplier: "Makro", cost: "฿195.00", unit: "5L" },
      { name: "Plastic Food Wrap", supplier: "Makro", cost: "฿139.00", unit: "each" },
      { name: "Paper Towel Long", supplier: "Makro", cost: "฿205.00", unit: "6 rolls" },
      { name: "Paper Towel Short", supplier: "Makro", cost: "฿115.00", unit: "8 rolls" },
      { name: "Food Gloves Large", supplier: "Makro", cost: "฿89.00", unit: "100pcs" },
      { name: "Food Gloves Medium", supplier: "Makro", cost: "฿89.00", unit: "100pcs" },
      { name: "Food Gloves Small", supplier: "Makro", cost: "฿89.00", unit: "100pcs" },
      { name: "Aluminum Foil", supplier: "Makro", cost: "฿145.00", unit: "roll" },
      { name: "Plastic Meat Gloves", supplier: "Makro", cost: "฿45.00", unit: "100pcs" },
      { name: "Kitchen Cleaner", supplier: "Makro", cost: "฿35.00", unit: "bottle" },
      { name: "Alcohol Sanitiser", supplier: "Makro", cost: "฿69.00", unit: "bottle" }
    ],
    "Packaging": [
      { name: "French Fries Box", supplier: "Packaging Bangkok", cost: "฿1.80", unit: "each" },
      { name: "Plastic Carry Bags (6×14)", supplier: "Packaging Bangkok", cost: "฿0.89", unit: "each" },
      { name: "Plastic Carry Bags (9×18)", supplier: "Packaging Bangkok", cost: "฿1.50", unit: "each" },
      { name: "Brown Paper Food Bags", supplier: "Packaging Bangkok", cost: "฿2.40", unit: "each" },
      { name: "Loaded Fries Boxes", supplier: "Packaging Bangkok", cost: "฿2.30", unit: "each" },
      { name: "Packaging Labels", supplier: "Packaging Bangkok", cost: "฿0.45", unit: "each" },
      { name: "Knife/Fork/Spoon Set", supplier: "Packaging Bangkok", cost: "฿0.65", unit: "set" }
    ]
  };

  const drinkStock = [
    { name: "Coke", cost: "฿315.00", unit: "24 cans" },
    { name: "Coke Zero", cost: "฿315.00", unit: "24 cans" },
    { name: "Sprite", cost: "฿315.00", unit: "24 cans" },
    { name: "Schweppes Manow", cost: "฿84.00", unit: "6 cans" },
    { name: "Fanta Orange", cost: "฿81.00", unit: "6 cans" },
    { name: "Fanta Strawberry", cost: "฿81.00", unit: "6 cans" },
    { name: "Soda Water", cost: "฿84.00", unit: "6 cans" },
    { name: "Bottled Water", cost: "฿45.00", unit: "12 bottles" },
    { name: "Kids Juice Orange", cost: "฿99.00", unit: "6 cans" },
    { name: "Kids Juice Apple", cost: "฿99.00", unit: "6 cans" }
  ];

  // Add wage entry
  const addWageEntry = () => {
    setFormData(prev => ({
      ...prev,
      wages: [...prev.wages, { name: '', amount: 0, type: 'regular' }]
    }));
  };

  // Remove wage entry
  const removeWageEntry = (index) => {
    setFormData(prev => ({
      ...prev,
      wages: prev.wages.filter((_, i) => i !== index)
    }));
  };

  // Add shopping entry  
  const addShoppingEntry = () => {
    setFormData(prev => ({
      ...prev,
      shopping: [...prev.shopping, { item: '', amount: 0, shop: '' }]
    }));
  };

  // Remove shopping entry
  const removeShoppingEntry = (index) => {
    setFormData(prev => ({
      ...prev,
      shopping: prev.shopping.filter((_, i) => i !== index)
    }));
  };

  // Calculate totals
  const totalSales = formData.grabSales + formData.aroiDeeSales + formData.qrScanSales + formData.cashSales;
  const totalWages = formData.wages.reduce((sum, wage) => sum + (wage.amount || 0), 0);
  const totalShopping = formData.shopping.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalExpenses = totalWages + totalShopping;

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/daily-shift-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error(`Failed to submit form: ${response.statusText}`);
      }

      const result = await response.json();
      
      toast({
        title: "Form Submitted Successfully",
        description: `Shift form saved with ID: ${result.id}`,
        duration: 6000,
      });

      // Reset form
      setFormData({
        shiftType: '',
        completedBy: '',
        shiftDate: new Date().toISOString().split('T')[0],
        grabSales: 0,
        aroiDeeSales: 0,
        qrScanSales: 0,
        cashSales: 0,
        wages: [],
        shopping: [],
        startingCash: 0,
        endingCash: 0,
        bankedAmount: 0,
        inventory: {}
      });

    } catch (error) {
      setErrorMessage(error.message);
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Daily Sales & Stock Form</h1>
        <p className="text-gray-600">Complete daily shift reporting with authentic inventory tracking</p>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 1. Shift Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Shift Information</CardTitle>
            <CardDescription>Basic shift details and staff information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="completedBy">Completed By</Label>
                <Input
                  id="completedBy"
                  value={formData.completedBy}
                  onChange={(e) => setFormData(prev => ({ ...prev, completedBy: e.target.value }))}
                  placeholder="Staff name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="shiftType">Shift Type</Label>
                <Select onValueChange={(value) => setFormData(prev => ({ ...prev, shiftType: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day Shift</SelectItem>
                    <SelectItem value="evening">Evening Shift</SelectItem>
                    <SelectItem value="night">Night Shift</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="shiftDate">Shift Date</Label>
                <Input
                  id="shiftDate"
                  type="date"
                  value={formData.shiftDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, shiftDate: e.target.value }))}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Sales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Sales</CardTitle>
            <CardDescription>Revenue breakdown by platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="grabSales">Grab Sales (฿)</Label>
                <Input
                  id="grabSales"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.grabSales}
                  onChange={(e) => setFormData(prev => ({ ...prev, grabSales: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="aroiDeeSales">Aroi Dee Sales (฿)</Label>
                <Input
                  id="aroiDeeSales"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.aroiDeeSales}
                  onChange={(e) => setFormData(prev => ({ ...prev, aroiDeeSales: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="qrScanSales">QR Scan Sales (฿)</Label>
                <Input
                  id="qrScanSales"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.qrScanSales}
                  onChange={(e) => setFormData(prev => ({ ...prev, qrScanSales: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="cashSales">Cash Sales (฿)</Label>
                <Input
                  id="cashSales"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cashSales}
                  onChange={(e) => setFormData(prev => ({ ...prev, cashSales: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            
            {/* Sales Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Sales Summary</h3>
              <div className="text-2xl font-bold text-green-600">
                Total Sales: ฿{totalSales.toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Expenses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Expenses</CardTitle>
            <CardDescription>Wages, shopping, and operational expenses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Wages & Staff Payments */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-900">Wages & Staff Payments</h3>
                <Button type="button" variant="outline" size="sm" onClick={addWageEntry}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Wage Entry
                </Button>
              </div>
              
              {formData.wages.map((wage, index) => (
                <div key={index} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label>Staff Name</Label>
                    <Input
                      value={wage.name}
                      onChange={(e) => {
                        const newWages = [...formData.wages];
                        newWages[index].name = e.target.value;
                        setFormData(prev => ({ ...prev, wages: newWages }));
                      }}
                      placeholder="Enter staff name"
                    />
                  </div>
                  <div className="flex-1">
                    <Label>Amount (฿)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={wage.amount}
                      onChange={(e) => {
                        const newWages = [...formData.wages];
                        newWages[index].amount = parseFloat(e.target.value) || 0;
                        setFormData(prev => ({ ...prev, wages: newWages }));
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex-1">
                    <Label>Type</Label>
                    <Select onValueChange={(value) => {
                      const newWages = [...formData.wages];
                      newWages[index].type = value;
                      setFormData(prev => ({ ...prev, wages: newWages }));
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="overtime">Overtime</SelectItem>
                        <SelectItem value="bonus">Bonus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeWageEntry(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Shopping & Expenses */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-900">Shopping & Expenses</h3>
                <Button type="button" variant="outline" size="sm" onClick={addShoppingEntry}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Expense
                </Button>
              </div>
              
              {formData.shopping.map((item, index) => (
                <div key={index} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label>Item/Expense</Label>
                    <Input
                      value={item.item}
                      onChange={(e) => {
                        const newShopping = [...formData.shopping];
                        newShopping[index].item = e.target.value;
                        setFormData(prev => ({ ...prev, shopping: newShopping }));
                      }}
                      placeholder="Enter item or expense"
                    />
                  </div>
                  <div className="flex-1">
                    <Label>Amount (฿)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount}
                      onChange={(e) => {
                        const newShopping = [...formData.shopping];
                        newShopping[index].amount = parseFloat(e.target.value) || 0;
                        setFormData(prev => ({ ...prev, shopping: newShopping }));
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex-1">
                    <Label>Shop/Source</Label>
                    <Input
                      value={item.shop}
                      onChange={(e) => {
                        const newShopping = [...formData.shopping];
                        newShopping[index].shop = e.target.value;
                        setFormData(prev => ({ ...prev, shopping: newShopping }));
                      }}
                      placeholder="Enter shop name"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeShoppingEntry(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Expense Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Expense Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Total Wages: ฿{totalWages.toLocaleString()}</div>
                <div>Total Shopping: ฿{totalShopping.toLocaleString()}</div>
              </div>
              <div className="text-xl font-bold text-red-600 mt-2">
                Total Expenses: ฿{totalExpenses.toLocaleString()}
              </div>
            </div>

            {/* Cash Management */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Cash Management</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="startingCash">Starting Cash (฿)</Label>
                  <Input
                    id="startingCash"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.startingCash}
                    onChange={(e) => setFormData(prev => ({ ...prev, startingCash: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="endingCash">Ending Cash (฿)</Label>
                  <Input
                    id="endingCash"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.endingCash}
                    onChange={(e) => setFormData(prev => ({ ...prev, endingCash: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="bankedAmount">Banked Amount (฿)</Label>
                  <Input
                    id="bankedAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.bankedAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankedAmount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Food & Stock Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Food & Stock Items</CardTitle>
            <CardDescription>Authentic inventory tracking from supplier CSV data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drink Stock */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Drink Stock</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {drinkStock.map((drink) => (
                  <div key={drink.name}>
                    <Label htmlFor={`drink-${drink.name}`}>{drink.name}</Label>
                    <Input
                      id={`drink-${drink.name}`}
                      type="number"
                      min="0"
                      value={formData.inventory[drink.name] || ''}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          inventory: {
                            ...prev.inventory,
                            [drink.name]: parseInt(e.target.value) || 0
                          }
                        }));
                      }}
                      placeholder="0"
                    />
                    <div className="text-xs text-gray-500">{drink.cost} / {drink.unit}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Inventory Categories */}
            {Object.entries(inventoryCategories).map(([category, items]) => (
              <div key={category}>
                <h3 className="font-medium text-gray-900 mb-4">{category}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {items.map((item) => (
                    <div key={item.name}>
                      <Label htmlFor={`item-${item.name}`}>{item.name}</Label>
                      <Input
                        id={`item-${item.name}`}
                        type="number"
                        min="0"
                        value={formData.inventory[item.name] || ''}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            inventory: {
                              ...prev.inventory,
                              [item.name]: parseInt(e.target.value) || 0
                            }
                          }));
                        }}
                        placeholder="0"
                      />
                      <div className="text-xs text-gray-500">
                        {item.cost} / {item.unit} - {item.supplier}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-center">
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || !formData.completedBy || !formData.shiftType}
            className="w-full md:w-auto"
          >
            {isSubmitting ? "Submitting..." : "Submit Daily Shift Form"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default DailyShiftForm;
