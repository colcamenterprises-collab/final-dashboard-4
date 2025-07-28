import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DailyShiftForm = () => {
  const { toast } = useToast();
  
  // Form state following exact structure: Shift Information → Sales → Expenses → Food & Stock Items
  const [formData, setFormData] = useState({
    // Shift Information
    completedBy: "",
    shiftDate: new Date().toISOString().split("T")[0],
    
    // Sales
    grabSales: 0,
    aroiDeeSales: 0,
    qrScanSales: 0,
    cashSales: 0,
    
    // Expenses - Wages & Staff Payments
    wages: [] as Array<{ name: string; amount: number; type: string }>,
    
    // Expenses - Shopping & Expenses  
    shopping: [] as Array<{ item: string; amount: number; shop: string }>,
    
    // Cash Management
    startingCash: 0,
    endingCash: 0,
    bankedAmount: 0,
    rollsStock: 0,
    meatStock: 0,
    
    // Food & Stock Items - authentic inventory from CSV
    inventory: {} as Record<string, number>
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Authentic supplier data from CSV - 100% real inventory items
  const inventoryCategories = {
    "Fresh Food": [
      { name: "Salad (Iceberg Lettuce)", supplier: "Makro", cost: "฿99.00", unit: "kg" },
      { name: "Milk", supplier: "Makro", cost: "฿80.00", unit: "litre" },
      { name: "Burger Bun", supplier: "Bakery", cost: "฿8.00", unit: "each" },
      { name: "Tomatos", supplier: "Makro", cost: "฿89.00", unit: "kg" },
      { name: "White Cabbage", supplier: "Makro", cost: "฿45.00", unit: "kg" },
      { name: "Purple Cabbage", supplier: "Makro", cost: "฿41.25", unit: "kg" },
      { name: "Onions Bulk 10kg", supplier: "Makro", cost: "฿290.00", unit: "10kg" },
      { name: "Onions (small bags)", supplier: "Makro", cost: "฿29.00", unit: "kg" },
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
      { name: "Plastic Food Wrap", supplier: "Makro", cost: "฿375.00", unit: "500M" },
      { name: "Paper Towel Long", supplier: "Makro", cost: "฿79.00", unit: "1 bag 6 pieces" },
      { name: "Paper Towel Short (Serviettes)", supplier: "Makro", cost: "฿116.00", unit: "1 bag 6 pieces" },
      { name: "Food Gloves (Large)", supplier: "Makro", cost: "฿197.00", unit: "100" },
      { name: "Food Gloves (Medium)", supplier: "Supercheap", cost: "฿133.00", unit: "100" },
      { name: "Food Gloves (Small)", supplier: "Makro", cost: "฿133.00", unit: "100" },
      { name: "Aluminum Foil", supplier: "Makro", cost: "฿385.00", unit: "29.5 CM 90M" },
      { name: "Plastic Meat Gloves", supplier: "Makro", cost: "฿22.50", unit: "1 bag 24 pieces" },
      { name: "Kitchen Cleaner", supplier: "Makro", cost: "฿149.00", unit: "3.5 ltre" },
      { name: "Alcohol Sanitiser", supplier: "Makro", cost: "฿69.00", unit: "450g" }
    ],
    "Packaging": [
      { name: "French Fries Box", supplier: "Makro", cost: "฿105.00", unit: "1 bag 50 piece" },
      { name: "Plastic Carry Bags (Size- 6×14)", supplier: "Makro", cost: "฿36.00", unit: "500h" },
      { name: "Plastic Carry Bags (Size - 9×18)", supplier: "Makro", cost: "฿36.00", unit: "500g" },
      { name: "Brown Paper Food Bags", supplier: "Online", cost: "฿139.00", unit: "50 Bags " },
      { name: "Loaded Fries Boxes", supplier: "Makro", cost: "฿89.00", unit: "50 Boxes" },
      { name: "Packaging Labels", supplier: "", cost: "฿50.00", unit: "45 per sheet" },
      { name: "Knife, Fork, Spoon Set", supplier: "", cost: "฿89.00", unit: "50" }
    ]
  };

  const drinkStock = [
    { name: "Coke", cost: "฿315.00", unit: "24" },
    { name: "Coke Zero", cost: "฿315.00", unit: "24" },
    { name: "Fanta Orange", cost: "฿81.00", unit: "6" },
    { name: "Fanta Strawberry", cost: "฿81.00", unit: "6" },
    { name: "Schweppes Manow", cost: "฿84.00", unit: "6" },
    { name: "Kids Juice (Orange)", cost: "฿99.00", unit: "6" },
    { name: "Kids Juice (Apple)", cost: "฿99.00", unit: "6" },
    { name: "Sprite", cost: "฿81.00", unit: "6" },
    { name: "Soda Water", cost: "฿52.00", unit: "6" },
    { name: "Bottled Water", cost: "฿49.00", unit: "12" }
  ];

  // Add wage entry
  const addWageEntry = () => {
    setFormData(prev => ({
      ...prev,
      wages: [...prev.wages, { name: "", amount: 0, type: "Wages" }]
    }));
  };

  // Remove wage entry
  const removeWageEntry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      wages: prev.wages.filter((_, i) => i !== index)
    }));
  };

  // Add shopping entry  
  const addShoppingEntry = () => {
    setFormData(prev => ({
      ...prev,
      shopping: [...prev.shopping, { item: "", amount: 0, shop: "" }]
    }));
  };

  // Remove shopping entry
  const removeShoppingEntry = (index: number) => {
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/daily-shift-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error(`Failed to submit form: ${response.statusText}`);
      }

      const result = await response.json();
      
      alert("Thank you, form submitted!");

      // Reset form
      setFormData({
        completedBy: "",
        shiftDate: new Date().toISOString().split("T")[0],
        grabSales: 0,
        aroiDeeSales: 0,
        qrScanSales: 0,
        cashSales: 0,
        wages: [],
        shopping: [],
        startingCash: 0,
        endingCash: 0,
        bankedAmount: 0,
        rollsStock: 0,
        meatStock: 0,
        inventory: {}
      });

    } catch (error: any) {
      let errorMessage = "Failed to submit form. Please try again.";
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setErrorMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white text-black min-h-screen">
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
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-[12px] font-bold text-gray-900">Shift Information</CardTitle>
              <CardDescription>Basic shift details and staff information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="completedBy" className="text-[11px]">Completed By</Label>
                  <Input
                    id="completedBy"
                    className="bg-gray-100 text-[11px]"
                    placeholder=""
                    value={formData.completedBy}
                    onChange={(e) => setFormData(prev => ({ ...prev, completedBy: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="shiftDate" className="text-[11px]">Shift Date</Label>
                  <Input
                    id="shiftDate"
                    type="date"
                    className="bg-gray-100 text-[11px]"
                    value={formData.shiftDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, shiftDate: e.target.value }))}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Sales */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-[12px] font-bold text-gray-900">Sales Information</CardTitle>
              <CardDescription>Revenue breakdown by platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="grabSales" className="text-[11px]">Grab Sales (฿)</Label>
                  <Input
                    id="grabSales"
                    type="number"
                    min="0"
                    step="0.01"
                    className="bg-gray-100 text-[11px]"
                    placeholder=""
                    value={formData.grabSales}
                    onChange={(e) => setFormData(prev => ({ ...prev, grabSales: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="aroiDeeSales" className="text-[11px]">Aroi Dee Sales (฿)</Label>
                  <Input
                    id="aroiDeeSales"
                    type="number"
                    min="0"
                    step="0.01"
                    className="bg-gray-100 text-[11px]"
                    placeholder=""
                    value={formData.aroiDeeSales}
                    onChange={(e) => setFormData(prev => ({ ...prev, aroiDeeSales: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="qrScanSales" className="text-[11px]">QR Scan Sales (฿)</Label>
                  <Input
                    id="qrScanSales"
                    type="number"
                    min="0"
                    step="0.01"
                    className="bg-gray-100 text-[11px]"
                    placeholder=""
                    value={formData.qrScanSales}
                    onChange={(e) => setFormData(prev => ({ ...prev, qrScanSales: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="cashSales" className="text-[11px]">Cash Sales (฿)</Label>
                  <Input
                    id="cashSales"
                    type="number"
                    min="0"
                    step="0.01"
                    className="bg-gray-100 text-[11px]"
                    placeholder=""
                    value={formData.cashSales}
                    onChange={(e) => setFormData(prev => ({ ...prev, cashSales: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              
              {/* Sales Summary */}
              <div className="bg-gray-100 p-4 rounded-lg">
                <h3 className="text-[12px] font-bold text-gray-900 mb-2">Sales Summary</h3>
                <div className="text-2xl font-bold text-green-600">
                  Total Sales: ฿{totalSales.toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Wages & Staff Payments */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-[12px] font-bold text-gray-900">Wages & Staff Payments</CardTitle>
              <CardDescription>Staff compensation and wage entries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-[12px] font-bold text-gray-900">Wage Entries</h3>
                <Button type="button" variant="outline" size="sm" onClick={addWageEntry}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Entry
                </Button>
              </div>
              
              {formData.wages.map((wage, index) => (
                <div key={index} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label className="text-[11px]">Staff Name</Label>
                    <Input
                      className="bg-gray-100 text-[11px]"
                      placeholder=""
                      value={wage.name}
                      onChange={(e) => {
                        const newWages = [...formData.wages];
                        newWages[index].name = e.target.value;
                        setFormData(prev => ({ ...prev, wages: newWages }));
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[11px]">Amount (฿)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="bg-gray-100 text-[11px]"
                      placeholder=""
                      value={wage.amount}
                      onChange={(e) => {
                        const newWages = [...formData.wages];
                        newWages[index].amount = parseFloat(e.target.value) || 0;
                        setFormData(prev => ({ ...prev, wages: newWages }));
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[11px]">Type</Label>
                    <Select onValueChange={(value) => {
                      const newWages = [...formData.wages];
                      newWages[index].type = value;
                      setFormData(prev => ({ ...prev, wages: newWages }));
                    }}>
                      <SelectTrigger className="bg-gray-100">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Wages">Wages</SelectItem>
                        <SelectItem value="Bonus">Bonus</SelectItem>
                        <SelectItem value="Overtime">Overtime</SelectItem>
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
            </CardContent>
          </Card>

          {/* 4. Shopping & Expenses */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-[12px] font-bold text-gray-900">Shopping & Expenses</CardTitle>
              <CardDescription>Purchase tracking and expense management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-[12px] font-bold text-gray-900">Shopping Entries</h3>
                <Button type="button" variant="outline" size="sm" onClick={addShoppingEntry}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Entry
                </Button>
              </div>
              
              {formData.shopping.map((item, index) => (
                <div key={index} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label className="text-[11px]">Item/Expense</Label>
                    <Input
                      className="bg-gray-100 text-[11px]"
                      placeholder=""
                      value={item.item}
                      onChange={(e) => {
                        const newShopping = [...formData.shopping];
                        newShopping[index].item = e.target.value;
                        setFormData(prev => ({ ...prev, shopping: newShopping }));
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[11px]">Amount (฿)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="bg-gray-100 text-[11px]"
                      placeholder=""
                      value={item.amount}
                      onChange={(e) => {
                        const newShopping = [...formData.shopping];
                        newShopping[index].amount = parseFloat(e.target.value) || 0;
                        setFormData(prev => ({ ...prev, shopping: newShopping }));
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[11px]">Shop/Source</Label>
                    <Input
                      className="bg-gray-100 text-[11px]"
                      placeholder=""
                      value={item.shop}
                      onChange={(e) => {
                        const newShopping = [...formData.shopping];
                        newShopping[index].shop = e.target.value;
                        setFormData(prev => ({ ...prev, shopping: newShopping }));
                      }}
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
            </CardContent>
          </Card>

          {/* 5. Cash Management */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-[12px] font-bold text-gray-900">Cash Management</CardTitle>
              <CardDescription>Cash flow tracking and reconciliation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="startingCash" className="text-[11px]">Starting Cash (฿)</Label>
                  <Input
                    id="startingCash"
                    type="number"
                    min="0"
                    step="0.01"
                    className="bg-gray-100 text-[11px]"
                    placeholder=""
                    value={formData.startingCash}
                    onChange={(e) => setFormData(prev => ({ ...prev, startingCash: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="endingCash" className="text-[11px]">Ending Cash (฿)</Label>
                  <Input
                    id="endingCash"
                    type="number"
                    min="0"
                    step="0.01"
                    className="bg-gray-100 text-[11px]"
                    placeholder=""
                    value={formData.endingCash}
                    onChange={(e) => setFormData(prev => ({ ...prev, endingCash: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="bankedAmount" className="text-[11px]">Banked Amount (฿)</Label>
                  <Input
                    id="bankedAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    className="bg-gray-100 text-[11px]"
                    placeholder=""
                    value={formData.bankedAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankedAmount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 6. Stock Counts */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="text-[12px] font-bold text-gray-900">Stock Counts</CardTitle>
              <CardDescription>Essential stock tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Rolls & Meat */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rollsStock" className="text-[11px]">Burger Rolls Stock</Label>
                  <Input
                    id="rollsStock"
                    type="number"
                    min="0"
                    className="bg-gray-100 text-[11px]"
                    placeholder=""
                    value={formData.rollsStock}
                    onChange={(e) => setFormData(prev => ({ ...prev, rollsStock: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label htmlFor="meatStock" className="text-[11px]">Meat Stock (kg)</Label>
                  <Input
                    id="meatStock"
                    type="number"
                    min="0"
                    step="0.01"
                    className="bg-gray-100 text-[11px]"
                    placeholder=""
                    value={formData.meatStock}
                    onChange={(e) => setFormData(prev => ({ ...prev, meatStock: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* Drinks */}
              <div>
                <h3 className="text-[12px] font-bold text-gray-900 mb-4">Drinks</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {drinkStock.map((drink) => (
                    <div key={drink.name}>
                      <Label className="text-[11px]">{drink.name}</Label>
                      <Input
                        type="number"
                        min="0"
                        className="bg-gray-100 text-[11px]"
                        placeholder=""
                        value={formData.inventory[drink.name] || ""}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            inventory: {
                              ...prev.inventory,
                              [drink.name]: parseInt(e.target.value) || 0
                            }
                          }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 7. Inventory Categories */}
          {Object.entries(inventoryCategories).map(([category, items]) => (
            <Card key={category} className="bg-gray-50">
              <CardHeader>
                <CardTitle className="text-[12px] font-bold text-gray-900">{category}</CardTitle>
                <CardDescription>Authentic supplier inventory tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {items.map((item) => (
                    <div key={item.name}>
                      <Label className="text-[11px]">{item.name}</Label>
                      <Input
                        type="number"
                        min="0"
                        className="bg-gray-100 text-[11px]"
                        placeholder=""
                        value={formData.inventory[item.name] || ""}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            inventory: {
                              ...prev.inventory,
                              [item.name]: parseInt(e.target.value) || 0
                            }
                          }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-blue-500 text-white px-8 py-3 text-lg font-semibold"
            >
              {isSubmitting ? "Submitting..." : "Save and Submit"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DailyShiftForm;
