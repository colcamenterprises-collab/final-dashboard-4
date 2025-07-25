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
    drinkStockCount: 0
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
          drinkStockCount: 0
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