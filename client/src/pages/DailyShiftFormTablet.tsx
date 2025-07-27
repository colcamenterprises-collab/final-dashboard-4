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

// Tablet-optimized styles
const tabletInputStyle = {
  fontSize: '16px',
  minHeight: '48px',
  padding: '12px',
  borderRadius: '6px',
  border: '2px solid #d1d5db',
  backgroundColor: '#ffffff'
};

const tabletButtonStyle = {
  minHeight: '48px',
  fontSize: '16px',
  fontWeight: '600',
  borderRadius: '6px',
  padding: '12px 24px'
};

const DailyShiftFormTablet = () => {
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
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', padding: '16px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center', paddingBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
              Daily Shift Form
            </h1>
            <p style={{ color: '#6b7280', fontSize: '18px' }}>Complete your end-of-shift reporting</p>
          </div>

          {/* Basic Information */}
          <Card>
            <CardHeader style={{ paddingBottom: '16px' }}>
              <CardTitle style={{ fontSize: '24px', fontWeight: '600' }}>Basic Information</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <Label style={{ fontSize: '18px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                  Staff Name *
                </Label>
                <input
                  type="text"
                  value={formData.completedBy}
                  onChange={(e) => setFormData({ ...formData, completedBy: e.target.value })}
                  placeholder="Enter your name"
                  required
                  style={tabletInputStyle}
                />
              </div>
              
              <div>
                <Label style={{ fontSize: '18px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                  Shift Type *
                </Label>
                <Select value={formData.shiftType} onValueChange={(value) => setFormData({ ...formData, shiftType: value })}>
                  <SelectTrigger style={tabletInputStyle}>
                    <SelectValue placeholder="Select shift type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day Shift</SelectItem>
                    <SelectItem value="evening">Evening Shift</SelectItem>
                    <SelectItem value="night">Night Shift</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label style={{ fontSize: '18px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                  Shift Date
                </Label>
                <input
                  type="date"
                  value={formData.shiftDate}
                  onChange={(e) => setFormData({ ...formData, shiftDate: e.target.value })}
                  style={tabletInputStyle}
                />
              </div>
            </CardContent>
          </Card>

          {/* Sales Information */}
          <Card>
            <CardHeader style={{ paddingBottom: '16px' }}>
              <CardTitle style={{ fontSize: '24px', fontWeight: '600' }}>Sales Information</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <Label style={{ fontSize: '18px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                  Grab Sales (฿)
                </Label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.grabSales}
                  onChange={(e) => setFormData({ ...formData, grabSales: parseFloat(e.target.value) || 0 })}
                  style={tabletInputStyle}
                />
              </div>
              <div>
                <Label style={{ fontSize: '18px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                  Aroi Dee Sales (฿)
                </Label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.aroiDeeSales}
                  onChange={(e) => setFormData({ ...formData, aroiDeeSales: parseFloat(e.target.value) || 0 })}
                  style={tabletInputStyle}
                />
              </div>
              <div>
                <Label style={{ fontSize: '18px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                  QR Scan Sales (฿)
                </Label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.qrScanSales}
                  onChange={(e) => setFormData({ ...formData, qrScanSales: parseFloat(e.target.value) || 0 })}
                  style={tabletInputStyle}
                />
              </div>
              <div>
                <Label style={{ fontSize: '18px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                  Cash Sales (฿)
                </Label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cashSales}
                  onChange={(e) => setFormData({ ...formData, cashSales: parseFloat(e.target.value) || 0 })}
                  style={tabletInputStyle}
                />
              </div>
              
              <div style={{ 
                padding: '16px', 
                backgroundColor: '#f0fdf4', 
                border: '2px solid #bbf7d0', 
                borderRadius: '8px',
                marginTop: '16px'
              }}>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#166534' }}>
                  Total Sales: ฿{totalSales.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Wages & Staff Payments */}
          <Card>
            <CardHeader style={{ paddingBottom: '16px' }}>
              <CardTitle style={{ fontSize: '24px', fontWeight: '600' }}>Wages & Staff Payments</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {formData.wages.map((wage, index) => (
                <div key={index} style={{ 
                  padding: '16px', 
                  border: '2px solid #e5e7eb', 
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '18px', fontWeight: '600', color: '#374151' }}>Entry {index + 1}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeWageEntry(index)}
                      style={{ ...tabletButtonStyle, backgroundColor: '#fef2f2', color: '#dc2626', border: '2px solid #fecaca' }}
                    >
                      <Trash2 style={{ height: '20px', width: '20px' }} />
                    </Button>
                  </div>
                  
                  <div>
                    <Label style={{ fontSize: '16px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                      Staff Name
                    </Label>
                    <input
                      type="text"
                      value={wage.name}
                      onChange={(e) => updateWage(index, 'name', e.target.value)}
                      placeholder="Enter staff name"
                      style={tabletInputStyle}
                    />
                  </div>
                  
                  <div>
                    <Label style={{ fontSize: '16px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                      Amount (฿)
                    </Label>
                    <input
                      type="number"
                      step="0.01"
                      value={wage.amount}
                      onChange={(e) => updateWage(index, 'amount', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      style={tabletInputStyle}
                    />
                  </div>
                  
                  <div>
                    <Label style={{ fontSize: '16px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                      Type
                    </Label>
                    <Select value={wage.type} onValueChange={(value) => updateWage(index, 'type', value)}>
                      <SelectTrigger style={tabletInputStyle}>
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
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={addWageEntry}
                style={{ ...tabletButtonStyle, width: '100%' }}
              >
                <Plus style={{ height: '20px', width: '20px', marginRight: '8px' }} />
                Add Wage Entry
              </Button>
              
              <div style={{ 
                padding: '16px', 
                backgroundColor: '#eff6ff', 
                border: '2px solid #bfdbfe', 
                borderRadius: '8px',
                marginTop: '16px'
              }}>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e40af' }}>
                  Total Wages: ฿{totalWages.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '24px' }}>
            <button 
              type="button" 
              onClick={saveDraft} 
              disabled={isSubmitting}
              style={{ 
                ...tabletButtonStyle, 
                backgroundColor: '#f3f4f6', 
                color: '#374151',
                border: '2px solid #d1d5db',
                width: '100%'
              }}
            >
              Save as Draft
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              style={{ 
                ...tabletButtonStyle, 
                backgroundColor: '#2563eb', 
                color: '#ffffff',
                border: '2px solid #2563eb',
                width: '100%'
              }}
            >
              {isSubmitting ? "Submitting..." : "Submit Form"}
            </button>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#f0fdf4', 
              border: '2px solid #bbf7d0', 
              borderRadius: '8px',
              marginTop: '16px'
            }}>
              <p style={{ color: '#166534', fontWeight: '600', fontSize: '18px' }}>{successMessage}</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default DailyShiftFormTablet;