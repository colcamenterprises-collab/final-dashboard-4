import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";  
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

interface FormData {
  completedBy: string;
  shiftType: 'opening' | 'closing';
  shiftDate: string;
  startingCash: number;
  grabSales: number;
  aroiDeeSales: number;
  qrScanSales: number;
  cashSales: number;
  totalSales: number;
  wages: Array<{ staffName: string; amount: number; type: string; }>;
  shopping: Array<{ item: string; amount: number; shopName: string; }>;
  gasExpense: number;
  totalExpenses: number;
  endCash: number;
  bankedAmount: number;
  burgerBunsStock: number;
  meatWeight: number;
  drinkStockCount: number;
  coke: number;
  cokeZero: number;
  sprite: number;
  schweppesManow: number;
  fantaOrange: number;
  fantaStrawberry: number;
  sodaWater: number;
  water: number;
  kidsOrange: number;
  kidsApple: number;
  freshFood: Array<{ name: string; value: number; }>;
  frozenFood: Array<{ name: string; value: number; }>;
  shelfItems: Array<{ name: string; value: number; }>;
  kitchenItems: Array<{ name: string; value: number; }>;
  packagingItems: Array<{ name: string; value: number; }>;
  isDraft: boolean;
}

const DailyShiftForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    completedBy: '',
    shiftType: 'closing',
    shiftDate: new Date().toISOString().split('T')[0],
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
    freshFood: [
      { name: 'Salad (Iceberg Lettuce)', value: 0 },
      { name: 'Tomatos', value: 0 },
      { name: 'White Cabbage', value: 0 },
      { name: 'Purple Cabbage', value: 0 },
      { name: 'Bacon Short', value: 0 },
      { name: 'Bacon Long', value: 0 },
      { name: 'Milk', value: 0 },
      { name: 'Butter', value: 0 }
    ],
    frozenFood: [
      { name: 'Chicken Nuggets', value: 0 },
      { name: 'Sweet Potato Fries', value: 0 },
      { name: 'French Fries (7mm)', value: 0 },
      { name: 'Chicken Fillets', value: 0 }
    ],
    shelfItems: [
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
      { name: 'Chipotle Sauce', value: 0 },
      { name: 'Flour', value: 0 },
      { name: 'French Fries Seasoning BBQ', value: 0 }
    ],
    kitchenItems: [
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
    ],
    packagingItems: [
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
    ],
    isDraft: false
  });

  // Auto-calculate totals
  const updateTotals = (data: FormData) => {
    const salesTotal = data.grabSales + data.aroiDeeSales + data.qrScanSales + data.cashSales;
    const wagesTotal = data.wages.reduce((sum, w) => sum + w.amount, 0);
    const shoppingTotal = data.shopping.reduce((sum, s) => sum + s.amount, 0);
    const expensesTotal = wagesTotal + shoppingTotal + data.gasExpense;
    
    setFormData(prev => ({
      ...prev,
      totalSales: salesTotal,
      totalExpenses: expensesTotal
    }));
  };

  const handleInputChange = (field: keyof FormData, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    
    // Auto-calculate on sales/expense changes
    if (['grabSales', 'aroiDeeSales', 'qrScanSales', 'cashSales', 'gasExpense'].includes(field)) {
      setTimeout(() => updateTotals(newData), 0);
    }
  };

  const handleArrayChange = (arrayName: keyof FormData, index: number, field: string, value: any) => {
    const newData = { ...formData };
    const array = newData[arrayName] as any[];
    if (array[index]) {
      array[index][field] = value;
      setFormData(newData);
      
      if (arrayName === 'wages' || arrayName === 'shopping') {
        setTimeout(() => updateTotals(newData), 0);
      }
    }
  };

  const addWageEntry = () => {
    setFormData(prev => ({
      ...prev,
      wages: [...prev.wages, { staffName: '', amount: 0, type: 'wages' }]
    }));
  };

  const addShoppingEntry = () => {
    setFormData(prev => ({
      ...prev,
      shopping: [...prev.shopping, { item: '', amount: 0, shopName: '' }]
    }));
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!formData.completedBy.trim()) {
      toast({ title: "Error", description: "Please enter who completed this form", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const submissionData = { ...formData, isDraft };
      const response = await fetch('/api/daily-stock-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (!isDraft) {
          // Generate shopping list automatically
          const purchaseItems = [
            ...formData.freshFood.filter(f => f.value > 0),
            ...formData.frozenFood.filter(f => f.value > 0),
            ...formData.shelfItems.filter(f => f.value > 0),
            ...formData.kitchenItems.filter(k => k.value > 0),
            ...formData.packagingItems.filter(p => p.value > 0)
          ].filter(item => !['Burger Buns', 'Meat'].includes(item.name));

          if (purchaseItems.length > 0) {
            const shoppingList = purchaseItems.map(item => ({
              itemName: item.name,
              quantity: item.value,
              unit: 'unit',
              formId: result.id,
              listDate: new Date(formData.shiftDate).toISOString(),
            }));

            await fetch('/api/shopping-list/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(shoppingList),
            });
          }
        }

        toast({ 
          title: "Success", 
          description: isDraft ? "Draft saved successfully" : "Form submitted successfully",
          className: "bg-green-50 border-green-200"
        });

        if (!isDraft) {
          // Reset form after successful submission
          const initialState = {
            ...formData,
            completedBy: '',
            wages: [{ staffName: '', amount: 0, type: 'wages' }],
            shopping: [{ item: '', amount: 0, shopName: '' }],
            totalSales: 0,
            totalExpenses: 0
          };
          setFormData(initialState);
        }
      } else {
        throw new Error('Submission failed');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast({ title: "Error", description: "Failed to submit form", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">Daily Sales & Stock Form</h1>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Completed By*</Label>
                <Input 
                  value={formData.completedBy}
                  onChange={(e) => handleInputChange('completedBy', e.target.value)}
                />
              </div>
              <div>
                <Label>Shift Type</Label>
                <select 
                  value={formData.shiftType}
                  onChange={(e) => handleInputChange('shiftType', e.target.value as 'opening' | 'closing')}
                  className="w-full p-2 border rounded"
                >
                  <option value="opening">Opening</option>
                  <option value="closing">Closing</option>
                </select>
              </div>
              <div>
                <Label>Shift Date*</Label>
                <Input 
                  type="date" 
                  value={formData.shiftDate}
                  onChange={(e) => handleInputChange('shiftDate', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Starting Cash (฿)</Label>
              <Input 
                type="number" 
                value={formData.startingCash}
                onChange={(e) => handleInputChange('startingCash', Number(e.target.value) || 0)}
              />
            </div>

            {/* Sales Information */}
            <h3 className="text-lg font-semibold">Sales Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Grab Sales (฿)</Label>
                <Input 
                  type="number" 
                  value={formData.grabSales}
                  onChange={(e) => handleInputChange('grabSales', Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Aroi Dee Sales (฿)</Label>
                <Input 
                  type="number" 
                  value={formData.aroiDeeSales}
                  onChange={(e) => handleInputChange('aroiDeeSales', Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>QR Scan Sales (฿)</Label>
                <Input 
                  type="number" 
                  value={formData.qrScanSales}
                  onChange={(e) => handleInputChange('qrScanSales', Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Cash Sales (฿)</Label>
                <Input 
                  type="number" 
                  value={formData.cashSales}
                  onChange={(e) => handleInputChange('cashSales', Number(e.target.value) || 0)}
                />
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded">
              <Label>Total Sales (฿)</Label>
              <Input disabled value={formData.totalSales} />
            </div>

            {/* Expenses */}
            <h3 className="text-lg font-semibold">Expenses</h3>
            
            <h4 className="font-medium">Wages</h4>
            {formData.wages.map((wage, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded">
                <div>
                  <Label>Staff Name</Label>
                  <Input 
                    value={wage.staffName}
                    onChange={(e) => handleArrayChange('wages', index, 'staffName', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Amount (฿)</Label>
                  <Input 
                    type="number" 
                    value={wage.amount}
                    onChange={(e) => handleArrayChange('wages', index, 'amount', Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <select 
                    value={wage.type}
                    onChange={(e) => handleArrayChange('wages', index, 'type', e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="wages">Wages</option>
                    <option value="overtime">Overtime</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            ))}
            <Button type="button" onClick={addWageEntry} variant="outline">Add Wage Entry</Button>

            <h4 className="font-medium">Shopping</h4>
            {formData.shopping.map((shop, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded">
                <div>
                  <Label>Item Purchased</Label>
                  <Input 
                    value={shop.item}
                    onChange={(e) => handleArrayChange('shopping', index, 'item', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Amount (฿)</Label>
                  <Input 
                    type="number" 
                    value={shop.amount}
                    onChange={(e) => handleArrayChange('shopping', index, 'amount', Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Shop Name</Label>
                  <Input 
                    value={shop.shopName}
                    onChange={(e) => handleArrayChange('shopping', index, 'shopName', e.target.value)}
                  />
                </div>
              </div>
            ))}
            <Button type="button" onClick={addShoppingEntry} variant="outline">Add Shopping Entry</Button>

            <div>
              <Label>Gas Expense (฿)</Label>
              <Input 
                type="number" 
                value={formData.gasExpense}
                onChange={(e) => handleInputChange('gasExpense', Number(e.target.value) || 0)}
              />
            </div>

            <div className="p-4 bg-gray-50 rounded">
              <Label>Total Expenses (฿)</Label>
              <Input disabled value={formData.totalExpenses} />
            </div>

            {/* Summary */}
            <h3 className="text-lg font-semibold">Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Total Cash in Register at Closing (฿)</Label>
                <Input 
                  type="number" 
                  value={formData.endCash}
                  onChange={(e) => handleInputChange('endCash', Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Amount to be Banked (฿)</Label>
                <Input 
                  type="number" 
                  value={formData.bankedAmount}
                  onChange={(e) => handleInputChange('bankedAmount', Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Stock and Produce */}
            <h3 className="text-lg font-semibold">Stock and Produce</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Burger Buns Stock (In Hand)</Label>
                <Input 
                  type="number" 
                  value={formData.burgerBunsStock}
                  onChange={(e) => handleInputChange('burgerBunsStock', Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Meat Weight (In Hand, kg)</Label>
                <Input 
                  type="number" 
                  value={formData.meatWeight}
                  onChange={(e) => handleInputChange('meatWeight', Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Drink Stock Count (In Hand)</Label>
                <Input 
                  type="number" 
                  value={formData.drinkStockCount}
                  onChange={(e) => handleInputChange('drinkStockCount', Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Drink Details */}
            <h4 className="font-medium">Drink Details (In Hand)</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { key: 'coke', label: 'Coke' },
                { key: 'cokeZero', label: 'Coke Zero' },
                { key: 'sprite', label: 'Sprite' },
                { key: 'schweppesManow', label: 'Schweppes Manow' },
                { key: 'fantaOrange', label: 'Fanta Orange' },
                { key: 'fantaStrawberry', label: 'Fanta Strawberry' },
                { key: 'sodaWater', label: 'Soda Water' },
                { key: 'water', label: 'Water' },
                { key: 'kidsOrange', label: 'Kids Orange' },
                { key: 'kidsApple', label: 'Kids Apple' }
              ].map(drink => (
                <div key={drink.key}>
                  <Label>{drink.label}</Label>
                  <Input 
                    type="number" 
                    value={formData[drink.key as keyof FormData] as number}
                    onChange={(e) => handleInputChange(drink.key as keyof FormData, Number(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>

            {/* Fresh Food */}
            <h3 className="text-lg font-semibold">Fresh Food</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {formData.freshFood.map((item, index) => (
                <div key={index}>
                  <Label>{item.name}</Label>
                  <Input 
                    type="number" 
                    value={item.value}
                    onChange={(e) => handleArrayChange('freshFood', index, 'value', Number(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>

            {/* Frozen Food */}
            <h3 className="text-lg font-semibold">Frozen Food</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {formData.frozenFood.map((item, index) => (
                <div key={index}>
                  <Label>{item.name}</Label>
                  <Input 
                    type="number" 
                    value={item.value}
                    onChange={(e) => handleArrayChange('frozenFood', index, 'value', Number(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>

            {/* Shelf Items */}
            <h3 className="text-lg font-semibold">Shelf Items</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {formData.shelfItems.map((item, index) => (
                <div key={index}>
                  <Label>{item.name}</Label>
                  <Input 
                    type="number" 
                    value={item.value}
                    onChange={(e) => handleArrayChange('shelfItems', index, 'value', Number(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>

            {/* Kitchen Items */}
            <h3 className="text-lg font-semibold">Kitchen Items</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {formData.kitchenItems.map((item, index) => (
                <div key={index}>
                  <Label>{item.name}</Label>
                  <Input 
                    type="number" 
                    value={item.value}
                    onChange={(e) => handleArrayChange('kitchenItems', index, 'value', Number(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>

            {/* Packaging Items */}
            <h3 className="text-lg font-semibold">Packaging Items</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {formData.packagingItems.map((item, index) => (
                <div key={index}>
                  <Label>{item.name}</Label>
                  <Input 
                    type="number" 
                    value={item.value}
                    onChange={(e) => handleArrayChange('packagingItems', index, 'value', Number(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4">
              <Button 
                onClick={() => handleSubmit(false)} 
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Submitting...' : 'Submit Form'}
              </Button>
              <Button 
                onClick={() => handleSubmit(true)} 
                variant="outline" 
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Saving...' : 'Save Draft'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyShiftForm;