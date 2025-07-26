import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface FormData {
  completedBy: string;
  shiftType: 'opening' | 'closing';
  shiftDate: string;
  startingCash: number;
  grabSales: number;
  aroiDeeSales: number;
  qrScanSales: number;
  cashSales: number;
  gasExpense: number;
  endCash: number;
  bankedAmount: number;
  burgerBunsStock: number;
  meatWeight: number;
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
  isDraft: boolean;
}

const DailyShiftForm = () => {
  const [formData, setFormData] = useState<FormData>({
    completedBy: '',
    shiftType: 'closing',
    shiftDate: new Date().toISOString().slice(0, 16),
    startingCash: 0,
    grabSales: 0,
    aroiDeeSales: 0,
    qrScanSales: 0,
    cashSales: 0,
    gasExpense: 0,
    endCash: 0,
    bankedAmount: 0,
    burgerBunsStock: 0,
    meatWeight: 0,
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
    isDraft: false
  });

  const [wages, setWages] = useState([{ staffName: '', amount: 0, type: 'wages' }]);
  const [shopping, setShopping] = useState([{ item: '', amount: 0, shopName: '' }]);

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addWageEntry = () => {
    setWages([...wages, { staffName: '', amount: 0, type: 'wages' }]);
  };

  const removeWageEntry = (index: number) => {
    if (wages.length > 1) {
      setWages(wages.filter((_, i) => i !== index));
    }
  };

  const updateWageEntry = (index: number, field: string, value: string | number) => {
    const updatedWages = [...wages];
    updatedWages[index] = { ...updatedWages[index], [field]: value };
    setWages(updatedWages);
  };

  const addShoppingEntry = () => {
    setShopping([...shopping, { item: '', amount: 0, shopName: '' }]);
  };

  const removeShoppingEntry = (index: number) => {
    if (shopping.length > 1) {
      setShopping(shopping.filter((_, i) => i !== index));
    }
  };

  const updateShoppingEntry = (index: number, field: string, value: string | number) => {
    const updatedShopping = [...shopping];
    updatedShopping[index] = { ...updatedShopping[index], [field]: value };
    setShopping(updatedShopping);
  };

  const totalSales = formData.grabSales + formData.aroiDeeSales + formData.qrScanSales + formData.cashSales;
  const totalWages = wages.reduce((sum, w) => sum + Number(w.amount), 0);
  const totalShoppingExpenses = shopping.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalExpenses = totalWages + totalShoppingExpenses + formData.gasExpense;

  const handleSubmit = async (isDraft: boolean = false) => {
    try {
      const submitData = {
        ...formData,
        wages,
        shopping,
        totalSales,
        totalExpenses,
        isDraft,
        shiftDate: new Date(formData.shiftDate).toISOString()
      };

      const response = await fetch('/api/daily-stock-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) throw new Error('Submit failed');
      
      const result = await response.json();
      alert(isDraft ? 'Draft saved successfully!' : 'Form submitted successfully!');
      
      if (!isDraft) {
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
          gasExpense: 0,
          endCash: 0,
          bankedAmount: 0,
          burgerBunsStock: 0,
          meatWeight: 0,
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
          isDraft: false
        });
        setWages([{ staffName: '', amount: 0, type: 'wages' }]);
        setShopping([{ item: '', amount: 0, shopName: '' }]);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error submitting form: ' + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6">
      <Card className="max-w-4xl mx-auto bg-gray-800 text-white border-gray-600">
        <CardHeader>
          <h1 className="font-bold text-3xl text-center">Daily Sales & Stock Form</h1>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium text-sm text-white">Completed By*</Label>
                  <Input 
                    value={formData.completedBy}
                    onChange={(e) => handleInputChange('completedBy', e.target.value)}
                    className="w-full bg-gray-600 text-white border-gray-500" 
                  />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Shift Type</Label>
                  <select 
                    value={formData.shiftType}
                    onChange={(e) => handleInputChange('shiftType', e.target.value as 'opening' | 'closing')}
                    className="w-full p-2 border rounded bg-gray-600 text-white border-gray-500"
                  >
                    <option value="opening">Opening</option>
                    <option value="closing">Closing</option>
                  </select>
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Shift Date*</Label>
                  <Input 
                    type="datetime-local"
                    value={formData.shiftDate}
                    onChange={(e) => handleInputChange('shiftDate', e.target.value)}
                    className="w-full bg-gray-600 text-white border-gray-500" 
                  />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Starting Cash (฿)</Label>
                  <Input 
                    type="number"
                    value={formData.startingCash}
                    onChange={(e) => handleInputChange('startingCash', Number(e.target.value))}
                    className="w-full bg-gray-600 text-white border-gray-500" 
                  />
                </div>
              </div>
            </div>

            {/* Sales Information */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Sales Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium text-sm text-white">Grab Sales (฿)</Label>
                  <Input 
                    type="number"
                    value={formData.grabSales}
                    onChange={(e) => handleInputChange('grabSales', Number(e.target.value))}
                    className="w-full bg-gray-600 text-white border-gray-500" 
                  />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Aroi Dee Sales (฿)</Label>
                  <Input 
                    type="number"
                    value={formData.aroiDeeSales}
                    onChange={(e) => handleInputChange('aroiDeeSales', Number(e.target.value))}
                    className="w-full bg-gray-600 text-white border-gray-500" 
                  />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">QR Scan Sales (฿)</Label>
                  <Input 
                    type="number"
                    value={formData.qrScanSales}
                    onChange={(e) => handleInputChange('qrScanSales', Number(e.target.value))}
                    className="w-full bg-gray-600 text-white border-gray-500" 
                  />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Cash Sales (฿)</Label>
                  <Input 
                    type="number"
                    value={formData.cashSales}
                    onChange={(e) => handleInputChange('cashSales', Number(e.target.value))}
                    className="w-full bg-gray-600 text-white border-gray-500" 
                  />
                </div>
              </div>
              <div className="mt-4">
                <Label className="font-medium text-sm text-white">Total Sales (฿)</Label>
                <Input disabled value={totalSales} className="w-full bg-gray-500 text-white" />
              </div>
            </div>

            {/* Expenses */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Expenses</h3>
              
              {/* Wages */}
              <div className="mb-4">
                <Label className="font-medium text-sm text-white">Wages</Label>
                {wages.map((wage, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input 
                      placeholder="Staff Name"
                      value={wage.staffName}
                      onChange={(e) => updateWageEntry(index, 'staffName', e.target.value)}
                      className="flex-1 bg-gray-600 text-white border-gray-500" 
                    />
                    <Input 
                      type="number" 
                      placeholder="Amount"
                      value={wage.amount}
                      onChange={(e) => updateWageEntry(index, 'amount', Number(e.target.value))}
                      className="flex-1 bg-gray-600 text-white border-gray-500" 
                    />
                    <select 
                      value={wage.type}
                      onChange={(e) => updateWageEntry(index, 'type', e.target.value)}
                      className="flex-1 p-2 border rounded bg-gray-600 text-white border-gray-500"
                    >
                      <option value="wages">Wages</option>
                      <option value="overtime">Overtime</option>
                      <option value="other">Other</option>
                    </select>
                    {wages.length > 1 && (
                      <Button 
                        type="button" 
                        variant="destructive" 
                        onClick={() => removeWageEntry(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" onClick={addWageEntry} className="bg-blue-600 hover:bg-blue-700">
                  Add Wage Entry
                </Button>
              </div>

              {/* Shopping */}
              <div className="mb-4">
                <Label className="font-medium text-sm text-white">Shopping</Label>
                {shopping.map((shop, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input 
                      placeholder="Item Purchased"
                      value={shop.item}
                      onChange={(e) => updateShoppingEntry(index, 'item', e.target.value)}
                      className="flex-1 bg-gray-600 text-white border-gray-500" 
                    />
                    <Input 
                      type="number" 
                      placeholder="Amount"
                      value={shop.amount}
                      onChange={(e) => updateShoppingEntry(index, 'amount', Number(e.target.value))}
                      className="flex-1 bg-gray-600 text-white border-gray-500" 
                    />
                    <Input 
                      placeholder="Shop Name"
                      value={shop.shopName}
                      onChange={(e) => updateShoppingEntry(index, 'shopName', e.target.value)}
                      className="flex-1 bg-gray-600 text-white border-gray-500" 
                    />
                    {shopping.length > 1 && (
                      <Button 
                        type="button" 
                        variant="destructive" 
                        onClick={() => removeShoppingEntry(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" onClick={addShoppingEntry} className="bg-blue-600 hover:bg-blue-700">
                  Add Shopping Entry
                </Button>
              </div>

              <div>
                <Label className="font-medium text-sm text-white">Gas Expense (฿)</Label>
                <Input 
                  type="number"
                  value={formData.gasExpense}
                  onChange={(e) => handleInputChange('gasExpense', Number(e.target.value))}
                  className="w-full bg-gray-600 text-white border-gray-500" 
                />
              </div>

              <div className="mt-4">
                <Label className="font-medium text-sm text-white">Total Expenses (฿)</Label>
                <Input disabled value={totalExpenses} className="w-full bg-gray-500 text-white" />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Summary</h3>
              <div className="space-y-2">
                <p>Total Sales: ฿{totalSales}</p>
                <p>Breakdown: Grab ฿{formData.grabSales}, Aroi Dee ฿{formData.aroiDeeSales}, QR ฿{formData.qrScanSales}, Cash ฿{formData.cashSales}</p>
                <p>Total Expenses: ฿{totalExpenses}</p>
                <p>Breakdown: Wages ฿{totalWages}, Shopping ฿{totalShoppingExpenses}, Gas ฿{formData.gasExpense}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="font-medium text-sm text-white">Total Cash in Register at Closing (฿)</Label>
                  <Input 
                    type="number"
                    value={formData.endCash}
                    onChange={(e) => handleInputChange('endCash', Number(e.target.value))}
                    className="w-full bg-gray-600 text-white border-gray-500" 
                  />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Amount to be Banked (฿)</Label>
                  <Input 
                    type="number"
                    value={formData.bankedAmount}
                    onChange={(e) => handleInputChange('bankedAmount', Number(e.target.value))}
                    className="w-full bg-gray-600 text-white border-gray-500" 
                  />
                </div>
              </div>
            </div>

            {/* Stock and Produce */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Stock and Produce</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium text-sm text-white">Burger Buns Stock (In Hand)</Label>
                  <Input 
                    type="number"
                    value={formData.burgerBunsStock}
                    onChange={(e) => handleInputChange('burgerBunsStock', Number(e.target.value))}
                    className="w-full bg-gray-600 text-white border-gray-500" 
                  />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Meat Weight (In Hand, kg)</Label>
                  <Input 
                    type="number"
                    value={formData.meatWeight}
                    onChange={(e) => handleInputChange('meatWeight', Number(e.target.value))}
                    className="w-full bg-gray-600 text-white border-gray-500" 
                  />
                </div>
              </div>
              
              <h4 className="font-semibold text-lg mt-6 mb-4">Drink Details (In Hand)</h4>
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
                    <Label className="font-medium text-sm text-white">{drink.label}</Label>
                    <Input 
                      type="number"
                      value={formData[drink.key as keyof FormData] as number}
                      onChange={(e) => handleInputChange(drink.key as keyof FormData, Number(e.target.value))}
                      className="w-full bg-gray-600 text-white border-gray-500" 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 justify-center">
              <Button 
                type="button" 
                onClick={() => handleSubmit(true)} 
                className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3"
              >
                Save as Draft
              </Button>
              <Button 
                type="button" 
                onClick={() => handleSubmit(false)} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
              >
                Submit Form
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyShiftForm;