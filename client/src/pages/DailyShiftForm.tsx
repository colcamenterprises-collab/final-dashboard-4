import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const DailyShiftForm = () => {
  const { toast } = useToast();
  const [formValues, setFormValues] = useState({ 
    completedBy: '',
    shiftType: '',
    shiftDate: new Date().toISOString().split('T')[0],
    numberNeeded: {} 
  });
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authentic items from CSV - Full supplier list
  const items = [
    // Fresh Food
    { "Item ": "Topside Beef", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿319.00" },
    { "Item ": "Brisket Point End", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿299.00" },
    { "Item ": "Chuck Roll Beef", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿319.00" },
    { "Item ": "Other Beef (Mixed)", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿310.00" },
    { "Item ": "Salad (Iceberg Lettuce)", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿99.00" },
    { "Item ": "Milk", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿80.00" },
    { "Item ": "Burger Bun", "Internal Category": "Fresh Food", "Supplier": "Bakery", "Cost ": "฿8.00" },
    { "Item ": "Tomatos", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿89.00" },
    { "Item ": "White Cabbage", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿45.00" },
    { "Item ": "Purple Cabbage", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿41.25" },
    { "Item ": "Onions Bulk 10kg", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿290.00" },
    { "Item ": "Onions (small bags)", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿29.00" },
    { "Item ": "Cheese", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿359.00" },
    { "Item ": "Bacon Short", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿305.00" },
    { "Item ": "Bacon Long", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿430.00" },
    { "Item ": "Jalapenos", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿190.00" },
    
    // Frozen Food
    { "Item ": "French Fries 7mm", "Internal Category": "Frozen Food", "Supplier": "Makro", "Cost ": "฿129.00" },
    { "Item ": "Chicken Nuggets", "Internal Category": "Frozen Food", "Supplier": "Makro", "Cost ": "฿155.00" },
    { "Item ": "Chicken Fillets", "Internal Category": "Frozen Food", "Supplier": "Makro", "Cost ": "฿199.00" },
    { "Item ": "Sweet Potato Fries", "Internal Category": "Frozen Food", "Supplier": "Makro", "Cost ": "฿145.00" },
    
    // Shelf Items
    { "Item ": "Cajun Fries Seasoning", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿508.00" },
    { "Item ": "Crispy Fried Onions", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿79.00" },
    { "Item ": "Pickles(standard dill pickles)", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿89.00" },
    { "Item ": "Pickles Sweet (standard)", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿89.00" },
    { "Item ": "Mustard", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿88.00" },
    { "Item ": "Mayonnaise", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿90.00" },
    { "Item ": "Tomato Sauce", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿175.00" },
    { "Item ": "Chili Sauce (Sriracha)", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿108.00" },
    { "Item ": "BBQ Sauce", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿110.00" },
    { "Item ": "Sriracha Sauce", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿108.00" },
    { "Item ": "Salt (Coarse Sea Salt)", "Internal Category": "Shelf Items", "Supplier": "Online", "Cost ": "฿121.00" },
    
    // Kitchen Supplies
    { "Item ": "Oil (Fryer)", "Internal Category": "Kitchen Supplies", "Supplier": "Makro", "Cost ": "฿195.00" },
    
    // Drinks
    { "Item ": "Coke", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿315.00" },
    { "Item ": "Coke Zero", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿315.00" },
    { "Item ": "Fanta Orange", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿81.00" },
    { "Item ": "Fanta Strawberry", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿81.00" },
    { "Item ": "Schweppes Manow", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿84.00" },
    { "Item ": "Kids Juice (Orange)", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿99.00" },
    { "Item ": "Kids Juice (Apple)", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿99.00" },
    { "Item ": "Sprite", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿81.00" },
    { "Item ": "Soda Water", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿52.00" },
    { "Item ": "Bottled Water", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿49.00" }
  ];

  useEffect(() => {
    const savedDraft = localStorage.getItem('dailyShiftDraft');
    if (savedDraft) {
      try {
        setFormValues(JSON.parse(savedDraft));
        toast({ title: "Draft Loaded", description: "Your saved draft has been loaded." });
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }, [toast]);

  const handleInputChange = (field: string, value: string) => {
    setFormValues({
      ...formValues,
      [field]: value
    });
  };

  const handleNumberNeededChange = (itemName: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormValues({
        ...formValues,
        numberNeeded: { ...formValues.numberNeeded, [itemName]: value }
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Map to backend schema fields
      const submitData = {
        completed_by: formValues.completedBy,
        shift_type: formValues.shiftType,
        shift_date: formValues.shiftDate,
        numberNeeded: formValues.numberNeeded,
        status: 'completed',
        is_draft: false
      };

      const response = await fetch('/api/daily-shift-forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit form');
      }

      const result = await response.json();
      
      // Add to submissions list for display
      const newSubmission = { 
        ...formValues, 
        date: new Date().toLocaleString(),
        id: result.id || Date.now()
      };
      setSubmissions([newSubmission, ...submissions]);
      
      // Reset form
      setFormValues({ 
        completedBy: '',
        shiftType: '',
        shiftDate: new Date().toISOString().split('T')[0],
        numberNeeded: {} 
      });
      
      // Clear draft
      localStorage.removeItem('dailyShiftDraft');
      
      toast({ 
        title: "Form Submitted Successfully", 
        description: "Your daily shift form has been saved to the database.",
        className: "bg-green-500 text-white"
      });

    } catch (error: any) {
      console.error('Submission error:', error);
      setErrorMessage(error.message || 'Failed to submit form. Please try again.');
      toast({ 
        title: "Submission Failed", 
        description: error.message || 'Please check your inputs and try again.',
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveDraft = () => {
    localStorage.setItem('dailyShiftDraft', JSON.stringify(formValues));
    toast({ title: "Draft Saved", description: "Your form has been saved as a draft." });
  };

  const groupedItems = items.reduce((acc, item) => {
    const cat = item["Internal Category"] || 'Other';
    if (cat) {
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
    }
    return acc;
  }, {} as Record<string, typeof items>);

  return (
    <div className="p-6 bg-gradient-to-r from-gray-800 to-gray-900 text-white min-h-screen">
      <Card className="bg-gray-800 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Daily Sales & Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 p-4 rounded-lg bg-gray-700">
              <div>
                <Label className="text-white font-semibold">Completed By</Label>
                <input
                  type="text"
                  placeholder="Staff Name"
                  value={formValues.completedBy}
                  onChange={(e) => handleInputChange('completedBy', e.target.value)}
                  className="w-full p-2 bg-gray-600 text-white rounded border-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>
              <div>
                <Label className="text-white font-semibold">Shift Type</Label>
                <select
                  value={formValues.shiftType}
                  onChange={(e) => handleInputChange('shiftType', e.target.value)}
                  className="w-full p-2 bg-gray-600 text-white rounded border-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="">Select Shift</option>
                  <option value="Day Shift">Day Shift</option>
                  <option value="Evening Shift">Evening Shift</option>
                  <option value="Night Shift">Night Shift</option>
                </select>
              </div>
              <div>
                <Label className="text-white font-semibold">Date</Label>
                <input
                  type="date"
                  value={formValues.shiftDate}
                  onChange={(e) => handleInputChange('shiftDate', e.target.value)}
                  className="w-full p-2 bg-gray-600 text-white rounded border-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>
            </div>

            {/* Inventory Categories */}
            {Object.entries(groupedItems).map(([category, catItems]) => (
              <div key={category} className="mb-8 p-4 rounded-lg shadow-xl bg-gray-800 border border-gray-600">
                <h2 className="text-2xl font-bold uppercase tracking-wide mb-4 border-b-2 border-orange-500 pb-2 text-orange-500">
                  {category}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {catItems.map((item) => (
                    <div key={item["Item "]} className="bg-white/10 p-4 rounded-lg border border-gray-600 hover:bg-white/20 transition-colors">
                      <label className="block mb-2 font-semibold text-white">{item["Item "]}</label>
                      <input
                        type="text"
                        placeholder="Number Needed"
                        value={formValues.numberNeeded[item["Item "]] || ''}
                        onChange={(e) => handleNumberNeededChange(item["Item "], e.target.value)}
                        className="w-full p-2 bg-gray-700 text-white rounded border-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Action Buttons */}
            <div className="flex space-x-4 justify-center">
              <Button 
                type="button" 
                onClick={saveDraft} 
                className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-3 rounded font-bold"
                disabled={isSubmitting}
              >
                Save as Draft
              </Button>
              <Button 
                type="submit" 
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded font-bold"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Form'}
              </Button>
            </div>
          </form>

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-4 p-4 bg-red-500 rounded text-white">
              <strong>Error:</strong> {errorMessage}
            </div>
          )}

          {/* Submission List */}
          {submissions.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4 text-white">Recent Submissions</h2>
              <div className="space-y-2">
                {submissions.slice(0, 5).map((sub, index) => (
                  <div key={index} className="p-3 bg-gray-700 rounded border border-gray-600">
                    <div className="font-semibold">{sub.completedBy} - {sub.shiftType}</div>
                    <div className="text-sm text-gray-300">{sub.date}</div>
                    <div className="text-sm text-gray-400">
                      {Object.entries(sub.numberNeeded).filter(([_, value]) => value && value !== '0').length} items requested
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyShiftForm;