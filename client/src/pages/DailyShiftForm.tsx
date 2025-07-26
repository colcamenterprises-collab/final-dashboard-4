import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const DailyShiftForm = () => {
  const [formData, setFormData] = useState({
    completedBy: '',
    shiftType: 'opening',
    shiftDate: new Date().toISOString().slice(0, 16),
    startingCash: 0,
    grabSales: 0,
    aroiDeeSales: 0,
    qrScanSales: 0,
    cashSales: 0,
    wages: [{ staffName: '', amount: 0, type: 'wages' }],
    shopping: [{ item: '', amount: 0, shopName: '' }],
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
    freshFood: { 'Salad (Iceberg Lettuce)': 0, Tomatos: 0, 'White Cabbage': 0, 'Purple Cabbage': 0, 'Bacon Short': 0, 'Bacon Long': 0, Milk: 0, Butter: 0 },
    frozenFood: { 'Chicken Nuggets': 0, 'Sweet Potato Fries': 0, 'French Fries (7mm)': 0, 'Chicken Fillets': 0 },
    shelfItems: { Mayonnaise: 0, Mustard: 0, 'Dill Pickles': 0, 'Sweet Pickles': 0, Salt: 0, Pepper: 0, 'Cajun Spice': 0, 'White Vinegar': 0, 'Crispy Fried Onions': 0, 'Paprika (Smoked)': 0, Jalapenos: 0, 'Sriracha Mayonnaise': 0, 'Chipotle Mayonnaise': 0, Flour: 0, 'French Fries Seasoning BBQ': 0 },
    kitchenItems: { 'Kitchen Cleaner': 0, 'Floor Cleaner': 0, 'Dishwashing Liquid': 0, 'Gloves Medium': 0, 'Gloves Large': 0, 'Gloves Small': 0, 'Plastic Meat Gloves': 0, 'Paper Towel Long': 0, 'Paper Towel Short': 0, 'Bin Bags 30x40': 0, 'Printer Rolls': 0, 'Sticky Tape': 0 },
    packagingItems: { 'Loaded Fries Box': 0, 'French Fries Box 600ml': 0, 'Takeaway Sauce Container': 0, 'Coleslaw Container': 0, 'Burger Wrapping Paper': 0, 'French Fries Paper': 0, 'Paper Bags': 0, 'Plastic Bags 8x16': 0, 'Plastic Bags 9x18': 0, 'Knife and Fork Set': 0, 'Bag Close Stickers': 0, 'Sauce Container Stickers': 0, 'Flag Stickers': 0, 'Burger Sweets Takeaway': 0 },
    isDraft: false,
  });

  const [totalSales, setTotalSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    const salesTotal = (formData.grabSales || 0) + (formData.aroiDeeSales || 0) + (formData.qrScanSales || 0) + (formData.cashSales || 0);
    setTotalSales(salesTotal);
    const wagesTotal = formData.wages.reduce((sum, w) => sum + (w.amount || 0), 0);
    const shoppingTotal = formData.shopping.reduce((sum, s) => sum + (s.amount || 0), 0);
    const expTotal = wagesTotal + shoppingTotal + (formData.gasExpense || 0);
    setTotalExpenses(expTotal);
  }, [formData.grabSales, formData.aroiDeeSales, formData.qrScanSales, formData.cashSales, formData.wages, formData.shopping, formData.gasExpense]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value === '' ? 0 : Number(value) || value }));
  };

  const handleArrayChange = (e, index, field) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newArray = [...prev[field]];
      newArray[index] = { ...newArray[index], [name.split('.')[1]]: value === '' ? 0 : Number(value) || value };
      return { ...prev, [field]: newArray };
    });
  };

  const addWageEntry = () => setFormData(prev => ({ ...prev, wages: [...prev.wages, { staffName: '', amount: 0, type: 'wages' }] }));
  const removeWageEntry = (index) => setFormData(prev => ({ ...prev, wages: prev.wages.filter((_, i) => i !== index) }));
  const addShoppingEntry = () => setFormData(prev => ({ ...prev, shopping: [...prev.shopping, { item: '', amount: 0, shopName: '' }] }));
  const removeShoppingEntry = (index) => setFormData(prev => ({ ...prev, shopping: prev.shopping.filter((_, i) => i !== index) }));

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/daily-stock-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Submit failed');
      const result = await response.json();
      if (!formData.isDraft) {
        const purchaseItems = [
          ...Object.entries(formData.freshFood).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value })),
          ...Object.entries(formData.frozenFood).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value })),
          ...Object.entries(formData.shelfItems).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value })),
          ...Object.entries(formData.kitchenItems).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value })),
          ...Object.entries(formData.packagingItems).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value })),
        ].filter(item => item.name !== 'Burger Buns' && item.name !== 'Meat' && !['Coke', 'Coke Zero', 'Sprite', 'Schweppes Manow', 'Fanta Orange', 'Fanta Strawberry', 'Soda Water', 'Water', 'Kids Orange', 'Kids Apple'].includes(item.name));
        await fetch('/api/shopping-list/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(purchaseItems.map(i => ({ itemName: i.name, quantity: i.value, unit: 'unit', formId: result.id, listDate: formData.shiftDate }))),
        });
      }
      alert('Form submitted successfully');
      setFormData(prev => ({ ...prev, isDraft: false })); // Reset draft flag on save
    } catch (err) {
      console.error('Submit error:', err);
      alert('Error submitting form: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6">
      <Card className="max-w-4xl mx-auto bg-gray-800 text-white border-gray-600">
        <CardHeader>
          <h1 className="font-bold text-3xl text-center">Daily Sales & Stock Form</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium text-sm text-white">Completed By*</Label>
                  <Input name="completedBy" value={formData.completedBy} onChange={handleChange} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Shift Type</Label>
                  <select name="shiftType" value={formData.shiftType} onChange={handleChange} className="w-full p-2 border rounded bg-gray-600 text-white border-gray-500">
                    <option value="opening">Opening</option>
                    <option value="closing">Closing</option>
                  </select>
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Shift Date*</Label>
                  <Input type="datetime-local" name="shiftDate" value={formData.shiftDate} onChange={handleChange} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Starting Cash (฿)</Label>
                  <Input type="number" name="startingCash" value={formData.startingCash} onChange={handleChange} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
              </div>
            </div>

            {/* Sales Information */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Sales Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium text-sm text-white">Grab Sales (฿)</Label>
                  <Input type="number" name="grabSales" value={formData.grabSales} onChange={handleChange} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Aroi Dee Sales (฿)</Label>
                  <Input type="number" name="aroiDeeSales" value={formData.aroiDeeSales} onChange={handleChange} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">QR Scan Sales (฿)</Label>
                  <Input type="number" name="qrScanSales" value={formData.qrScanSales} onChange={handleChange} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Cash Sales (฿)</Label>
                  <Input type="number" name="cashSales" value={formData.cashSales} onChange={handleChange} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
              </div>
              <div className="mt-4">
                <Label className="font-medium text-sm text-white">Total Sales (฿)</Label>
                <Input type="number" value={totalSales} disabled className="w-full bg-gray-500 text-white" />
              </div>
            </div>

            {/* Expenses */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Expenses</h3>
              
              {/* Wages */}
              <div className="mb-4">
                <Label className="font-medium text-sm text-white">Wages</Label>
                {formData.wages.map((wage, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input placeholder="Staff Name" name={`wages[${i}].staffName`} value={wage.staffName} onChange={(e) => handleArrayChange(e, i, 'wages')} className="flex-1 bg-gray-600 text-white border-gray-500" />
                    <Input type="number" placeholder="Amount" name={`wages[${i}].amount`} value={wage.amount} onChange={(e) => handleArrayChange(e, i, 'wages')} className="flex-1 bg-gray-600 text-white border-gray-500" />
                    <select name={`wages[${i}].type`} value={wage.type} onChange={(e) => handleArrayChange(e, i, 'wages')} className="flex-1 p-2 border rounded bg-gray-600 text-white border-gray-500">
                      <option value="wages">Wages</option>
                      <option value="overtime">Overtime</option>
                      <option value="other">Other</option>
                    </select>
                    {formData.wages.length > 1 && <Button type="button" variant="destructive" onClick={() => removeWageEntry(i)} className="ml-2">Remove</Button>}
                  </div>
                ))}
                <Button type="button" onClick={addWageEntry} className="bg-blue-600 hover:bg-blue-700">Add Wage Entry</Button>
              </div>

              {/* Shopping */}
              <div className="mb-4">
                <Label className="font-medium text-sm text-white">Shopping</Label>
                {formData.shopping.map((shop, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input placeholder="Item Purchased" name={`shopping[${i}].item`} value={shop.item} onChange={(e) => handleArrayChange(e, i, 'shopping')} className="flex-1 bg-gray-600 text-white border-gray-500" />
                    <Input type="number" placeholder="Amount" name={`shopping[${i}].amount`} value={shop.amount} onChange={(e) => handleArrayChange(e, i, 'shopping')} className="flex-1 bg-gray-600 text-white border-gray-500" />
                    <Input placeholder="Shop Name" name={`shopping[${i}].shopName`} value={shop.shopName} onChange={(e) => handleArrayChange(e, i, 'shopping')} className="flex-1 bg-gray-600 text-white border-gray-500" />
                    {formData.shopping.length > 1 && <Button type="button" variant="destructive" onClick={() => removeShoppingEntry(i)} className="ml-2">Remove</Button>}
                  </div>
                ))}
                <Button type="button" onClick={addShoppingEntry} className="bg-blue-600 hover:bg-blue-700">Add Shopping Entry</Button>
              </div>

              <div>
                <Label className="font-medium text-sm text-white">Gas Expense (฿)</Label>
                <Input type="number" name="gasExpense" value={formData.gasExpense} onChange={handleChange} className="w-full bg-gray-600 text-white border-gray-500" />
              </div>

              <div className="mt-4">
                <Label className="font-medium text-sm text-white">Total Expenses (฿)</Label>
                <Input type="number" value={totalExpenses} disabled className="w-full bg-gray-500 text-white" />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Summary</h3>
              <div className="space-y-2 text-white">
                <p>Total Sales: ฿{totalSales}</p>
                <p>Breakdown: Grab ฿{formData.grabSales}, Aroi Dee ฿{formData.aroiDeeSales}, QR ฿{formData.qrScanSales}, Cash ฿{formData.cashSales}</p>
                <p>Total Expenses: ฿{totalExpenses}</p>
                <p>Breakdown: Wages ฿{formData.wages.reduce((sum, w) => sum + (w.amount || 0), 0)}, Shopping ฿{formData.shopping.reduce((sum, s) => sum + (s.amount || 0), 0)}, Gas ฿{formData.gasExpense}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="font-medium text-sm text-white">Total Cash in Register at Closing (฿)</Label>
                  <Input type="number" name="endCash" value={formData.endCash} onChange={handleChange} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Amount to be Banked (฿)</Label>
                  <Input type="number" name="bankedAmount" value={formData.bankedAmount} onChange={handleChange} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
              </div>
            </div>

            {/* Stock and Produce */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Stock and Produce</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium text-sm text-white">Burger Buns Stock (In Hand)</Label>
                  <Input type="number" name="burgerBunsStock" value={formData.burgerBunsStock} onChange={handleChange} className="w-full bg-gray-600 text-white border-gray-500" />
                </div>
                <div>
                  <Label className="font-medium text-sm text-white">Meat Weight (In Hand, kg)</Label>
                  <Input type="number" name="meatWeight" value={formData.meatWeight} onChange={handleChange} className="w-full bg-gray-600 text-white border-gray-500" />
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
                    <Input type="number" name={drink.key} value={formData[drink.key]} onChange={handleChange} className="w-full bg-gray-600 text-white border-gray-500" />
                  </div>
                ))}
              </div>
            </div>

            {/* Fresh Food */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Fresh Food</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(formData.freshFood).map(([name, value]) => (
                  <div key={name}>
                    <Label className="font-medium text-sm text-white">{name}</Label>
                    <Input type="number" value={value} onChange={(e) => setFormData(prev => ({ ...prev, freshFood: { ...prev.freshFood, [name]: Number(e.target.value) || 0 } }))} className="w-full bg-gray-600 text-white border-gray-500" />
                  </div>
                ))}
              </div>
            </div>

            {/* Frozen Food */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Frozen Food</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(formData.frozenFood).map(([name, value]) => (
                  <div key={name}>
                    <Label className="font-medium text-sm text-white">{name}</Label>
                    <Input type="number" value={value} onChange={(e) => setFormData(prev => ({ ...prev, frozenFood: { ...prev.frozenFood, [name]: Number(e.target.value) || 0 } }))} className="w-full bg-gray-600 text-white border-gray-500" />
                  </div>
                ))}
              </div>
            </div>

            {/* Shelf Items */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Shelf Items</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(formData.shelfItems).map(([name, value]) => (
                  <div key={name}>
                    <Label className="font-medium text-sm text-white">{name}</Label>
                    <Input type="number" value={value} onChange={(e) => setFormData(prev => ({ ...prev, shelfItems: { ...prev.shelfItems, [name]: Number(e.target.value) || 0 } }))} className="w-full bg-gray-600 text-white border-gray-500" />
                  </div>
                ))}
              </div>
            </div>

            {/* Kitchen Items */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Kitchen Items</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(formData.kitchenItems).map(([name, value]) => (
                  <div key={name}>
                    <Label className="font-medium text-sm text-white">{name}</Label>
                    <Input type="number" value={value} onChange={(e) => setFormData(prev => ({ ...prev, kitchenItems: { ...prev.kitchenItems, [name]: Number(e.target.value) || 0 } }))} className="w-full bg-gray-600 text-white border-gray-500" />
                  </div>
                ))}
              </div>
            </div>

            {/* Packaging Items */}
            <div className="bg-gray-700 p-6 rounded-lg">
              <h3 className="font-bold text-xl mb-4">Packaging Items</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(formData.packagingItems).map(([name, value]) => (
                  <div key={name}>
                    <Label className="font-medium text-sm text-white">{name}</Label>
                    <Input type="number" value={value} onChange={(e) => setFormData(prev => ({ ...prev, packagingItems: { ...prev.packagingItems, [name]: Number(e.target.value) || 0 } }))} className="w-full bg-gray-600 text-white border-gray-500" />
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 justify-center">
              <Button type="submit" onClick={() => setFormData(prev => ({ ...prev, isDraft: true }))} className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3">Save Draft</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3">Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyShiftForm;