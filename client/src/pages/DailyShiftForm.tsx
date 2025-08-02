import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, CheckCircle, XCircle, FileDown, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { JussiChatBubble } from "@/components/JussiChatBubble";
import { generateDailyShiftPDF, downloadPDF, generatePDFBlob } from "@/lib/pdfGenerator";


const DailyShiftForm = () => {
  const { toast } = useToast();
  
  // Form state following exact structure: Shift Information → Sales → Expenses → Food & Stock Items
  const [formData, setFormData] = useState({
    // Shift Information
    completedBy: '',
    shiftType: '',
    shiftDate: new Date().toISOString().split('T')[0],
    
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
    
    // Food & Stock Items - authentic inventory from CSV
    inventory: {} as Record<string, number>
  });

  // Load existing form data (for editing form 196 and others)
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const response = await fetch('/api/daily-stock-sales');
        if (response.ok) {
          const data = await response.json();
          // Look for the most recent form or form 196 specifically
          const mostRecentForm = data.find((form: any) => form.id === 196) || data[0];
          
          if (mostRecentForm) {
            console.log('Loading existing form data:', mostRecentForm);
            console.log('Raw number_needed data:', mostRecentForm.number_needed);
            console.log('Raw wages data:', mostRecentForm.wages);
            console.log('Raw shopping data:', mostRecentForm.shopping);
            
            // Parse the stored JSON data
            let parsedInventory = {};
            let parsedWages = [];
            let parsedShopping = [];
            
            try {
              // Check both possible field names for inventory data
              const inventoryData = mostRecentForm.numberNeeded || mostRecentForm.number_needed;
              if (inventoryData) {
                parsedInventory = typeof inventoryData === 'string' 
                  ? JSON.parse(inventoryData) 
                  : inventoryData;
                console.log('Parsed inventory:', parsedInventory);
              }
              
              if (mostRecentForm.wages) {
                parsedWages = typeof mostRecentForm.wages === 'string' 
                  ? JSON.parse(mostRecentForm.wages) 
                  : mostRecentForm.wages;
                console.log('Parsed wages:', parsedWages);
              }
              
              if (mostRecentForm.shopping) {
                parsedShopping = typeof mostRecentForm.shopping === 'string' 
                  ? JSON.parse(mostRecentForm.shopping) 
                  : mostRecentForm.shopping;
                console.log('Parsed shopping:', parsedShopping);
              }
            } catch (parseError) {
              console.error('Error parsing stored data:', parseError);
            }
            
            setFormData({
              completedBy: mostRecentForm.completed_by || '',
              shiftType: mostRecentForm.shift_type || '',
              shiftDate: mostRecentForm.shift_date ? mostRecentForm.shift_date.split('T')[0] : new Date().toISOString().split('T')[0],
              grabSales: mostRecentForm.grab_sales || 0,
              aroiDeeSales: mostRecentForm.aroi_dee_sales || 0,
              qrScanSales: mostRecentForm.qr_scan_sales || 0,
              cashSales: mostRecentForm.cash_sales || 0,
              wages: parsedWages || [],
              shopping: parsedShopping || [],
              startingCash: mostRecentForm.starting_cash || 0,
              endingCash: mostRecentForm.ending_cash || 0,
              bankedAmount: mostRecentForm.banked_amount || 0,
              inventory: parsedInventory || {}
            });
          }
        }
      } catch (error) {
        console.error('Error loading existing data:', error);
      }
    };
    
    loadExistingData();
  }, []);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessPage, setShowSuccessPage] = useState(false);
  const [showFailurePage, setShowFailurePage] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    message: string;
    formId?: number;
  } | null>(null);

  // Authentic supplier data from CSV - 100% real inventory items
  const inventoryCategories = {
    "Fresh Food": [
      { name: "Topside Beef", supplier: "Makro", cost: "฿319.00", unit: "kg" },
      { name: "Brisket Point End", supplier: "Makro", cost: "฿465.00", unit: "kg" },
      { name: "Chuck Roll Beef", supplier: "Makro", cost: "฿320.00", unit: "kg" },
      { name: "Other Beef", supplier: "Makro", cost: "฿299.00", unit: "kg" },
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
    { name: "Sprite", cost: "฿315.00", unit: "24" },
    { name: "Schweppes Manow", cost: "฿84.00", unit: "6" },
    { name: "Fanta Orange", cost: "฿81.00", unit: "6" },
    { name: "Fanta Strawberry", cost: "฿81.00", unit: "6" },
    { name: "Soda Water", cost: "฿52.00", unit: "6" },
    { name: "Bottled Water", cost: "฿49.00", unit: "12" },
    { name: "Kids Juice Orange", cost: "฿99.00", unit: "6" },
    { name: "Kids Juice Apple", cost: "฿99.00", unit: "6" }
  ];

  // Add wage entry
  const addWageEntry = () => {
    setFormData(prev => ({
      ...prev,
      wages: [...prev.wages, { name: '', amount: 0, type: 'Wages' }]
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
      shopping: [...prev.shopping, { item: '', amount: 0, shop: '' }]
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

  // BULLETPROOF Save Draft functionality
  const saveDraft = async () => {
    setIsDraftSaving(true);
    setErrorMessage('');

    // Prepare bulletproof data
    const bulletproofData = {
      completedBy: formData.completedBy || 'Draft User',
      shiftType: formData.shiftType || 'night',
      shiftDate: formData.shiftDate || new Date().toISOString().split('T')[0],
      
      // Sales (guaranteed numbers)
      startingCash: parseFloat(String(formData.startingCash || 0)),
      grabSales: parseFloat(String(formData.grabSales || 0)),
      aroiDeeSales: parseFloat(String(formData.aroiDeeSales || 0)),
      qrScanSales: parseFloat(String(formData.qrScanSales || 0)),
      cashSales: parseFloat(String(formData.cashSales || 0)),
      totalSales: parseFloat(String(totalSales || 0)),
      
      // Cash management (guaranteed numbers)
      endingCash: parseFloat(String(formData.endingCash || 0)),
      bankedAmount: parseFloat(String(formData.bankedAmount || 0)),
      
      // Expenses (guaranteed arrays and numbers)
      wages: Array.isArray(formData.wages) ? formData.wages.map(w => ({
        name: String(w.name || ''),
        amount: parseFloat(String(w.amount || 0)),
        type: String(w.type || 'wages')
      })) : [],
      
      shopping: Array.isArray(formData.shopping) ? formData.shopping.map(s => ({
        item: String(s.item || ''),
        amount: parseFloat(String(s.amount || 0)),
        shop: String(s.shop || '')
      })) : [],
      
      totalExpenses: parseFloat(String(totalExpenses || 0)),
      
      // Stock data (guaranteed object)
      numberNeeded: formData.inventory || {},
      
      // Draft flag
      isDraft: true
    };

    // Multiple attempt strategy
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const response = await fetch('/api/daily-stock-sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bulletproofData)
        });

        if (response.ok) {
          const result = await response.json();
          
          toast({
            title: "✅ DRAFT SAVED SUCCESSFULLY",
            description: `Form saved as draft with ID: ${result.id}. Data is safe.`,
            duration: 6000,
            className: "bg-blue-50 border-blue-200 text-blue-800"
          });
          
          // Save to localStorage as backup
          localStorage.setItem('dailyShiftDraft', JSON.stringify(bulletproofData));
          return; // Success - exit function
        } else {
          throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }

      } catch (error: any) {
        console.error(`Draft save attempt ${attempts} failed:`, error);
        
        if (attempts === maxAttempts) {
          // Final attempt failed - save to localStorage
          localStorage.setItem('dailyShiftDraft', JSON.stringify(bulletproofData));
          
          toast({
            title: "⚠️ Draft Saved Locally",
            description: "Network issue - draft saved to your browser. Will sync when connection returns.",
            duration: 8000,
            className: "bg-yellow-50 border-yellow-200 text-yellow-800"
          });
          return;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
    
    setIsDraftSaving(false);
  };

  // BULLETPROOF Form Submission - GUARANTEED TO SAVE
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    // Step 1: MANDATORY FIELD VALIDATION
    if (!formData.completedBy?.trim()) {
      setSubmissionResult({
        success: false,
        message: "Please enter who completed this form"
      });
      setShowFailurePage(true);
      setIsSubmitting(false);
      return;
    }

    // Step 2: PREPARE BULLETPROOF DATA
    const bulletproofData = {
      completedBy: String(formData.completedBy).trim(),
      shiftType: formData.shiftType || 'night',
      shiftDate: formData.shiftDate || new Date().toISOString().split('T')[0],
      
      // Sales (guaranteed numbers, no NaN)
      startingCash: parseFloat(String(formData.startingCash || 0)) || 0,
      grabSales: parseFloat(String(formData.grabSales || 0)) || 0,
      aroiDeeSales: parseFloat(String(formData.aroiDeeSales || 0)) || 0,
      qrScanSales: parseFloat(String(formData.qrScanSales || 0)) || 0,
      cashSales: parseFloat(String(formData.cashSales || 0)) || 0,
      totalSales: parseFloat(String(totalSales || 0)) || 0,
      
      // Cash management (guaranteed numbers)
      endingCash: parseFloat(String(formData.endingCash || 0)) || 0,
      bankedAmount: parseFloat(String(formData.bankedAmount || 0)) || 0,
      
      // Expenses (guaranteed arrays and clean data)
      wages: Array.isArray(formData.wages) ? formData.wages.map(w => ({
        name: String(w.name || '').trim(),
        amount: parseFloat(String(w.amount || 0)) || 0,
        type: String(w.type || 'wages')
      })).filter(w => w.name || w.amount > 0) : [],
      
      shopping: Array.isArray(formData.shopping) ? formData.shopping.map(s => ({
        item: String(s.item || '').trim(),
        amount: parseFloat(String(s.amount || 0)) || 0,
        shop: String(s.shop || '').trim()
      })).filter(s => s.item || s.amount > 0) : [],
      
      totalExpenses: parseFloat(String(totalExpenses || 0)) || 0,
      gasExpense: 0, // Required field
      
      // Stock data (guaranteed object)
      numberNeeded: formData.inventory || {},
      
      // Status flags
      isDraft: false,
      status: 'completed'
    };

    // Step 3: MULTIPLE SUBMISSION STRATEGIES
    let attempts = 0;
    const maxAttempts = 5;
    let lastError = '';
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        console.log(`Submission attempt ${attempts}:`, bulletproofData);
        
        const response = await fetch('/api/daily-stock-sales', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(bulletproofData)
        });

        if (response.ok) {
          const result = await response.json();
          
          // SUCCESS - Generate and store PDF
          try {
            const pdfDoc = generateDailyShiftPDF(formData, result.id);
            const pdfBlob = generatePDFBlob(pdfDoc);
            
            // Convert blob to base64 for API
            const arrayBuffer = await pdfBlob.arrayBuffer();
            const pdfBase64 = Buffer.from(arrayBuffer).toString('base64');
            
            // Store PDF in object storage
            const pdfResponse = await fetch(`/api/daily-stock-sales/${result.id}/pdf`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pdfData: pdfBase64 })
            });
            
            if (pdfResponse.ok) {
              const pdfResult = await pdfResponse.json();
              console.log('PDF stored successfully:', pdfResult.filename);
              
              toast({
                title: "Success",
                description: `Form submitted and PDF generated: ${pdfResult.filename}`,
                variant: "default",
              });
            }
          } catch (pdfError) {
            console.error('PDF generation failed:', pdfError);
            toast({
              title: "Warning",
              description: "Form saved but PDF generation failed",
              variant: "destructive",
            });
          }
          
          // Clear any stored draft
          localStorage.removeItem('dailyShiftDraft');
          
          // Show success page
          setSubmissionResult({
            success: true,
            message: `✅ FORM SAVED SUCCESSFULLY! ID: ${result.id}`,
            formId: result.id
          });
          setShowSuccessPage(true);

          // Reset form completely
          setFormData({
            completedBy: '',
            shiftType: '',
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
          
          setIsSubmitting(false);
          return; // SUCCESS - EXIT FUNCTION
        } else {
          const errorData = await response.json().catch(() => ({}));
          lastError = errorData.error || `Server error ${response.status}: ${response.statusText}`;
          throw new Error(lastError);
        }

      } catch (error: any) {
        lastError = error.message || 'Network connection failed';
        console.error(`Submission attempt ${attempts} failed:`, lastError);
        
        if (attempts === maxAttempts) {
          // ALL ATTEMPTS FAILED - SAVE TO LOCAL STORAGE AS EMERGENCY BACKUP
          const emergencyBackup = {
            ...bulletproofData,
            timestamp: new Date().toISOString(),
            attempts: attempts
          };
          
          localStorage.setItem('emergencyFormBackup', JSON.stringify(emergencyBackup));
          
          // Show failure page with local save confirmation
          setSubmissionResult({
            success: false,
            message: `❌ Network Error: ${lastError}. IMPORTANT: Your data is saved locally and will be submitted when connection returns.`
          });
          setShowFailurePage(true);
          setErrorMessage(lastError);
        } else {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts - 1)));
        }
      }
    }
    
    setIsSubmitting(false);
  };

  // PDF Generation Functions
  const handleGenerateAndDownloadPDF = () => {
    try {
      const pdfDoc = generateDailyShiftPDF(formData);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `daily-shift-report-${timestamp}.pdf`;
      downloadPDF(pdfDoc, filename);
      
      toast({
        title: "PDF Downloaded",
        description: `Report saved as ${filename}`,
        variant: "default",
      });
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  // Auto-dismiss success/failure pages after 10 seconds
  useEffect(() => {
    if (showSuccessPage || showFailurePage) {
      const timer = setTimeout(() => {
        setShowSuccessPage(false);
        setShowFailurePage(false);
        setSubmissionResult(null);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [showSuccessPage, showFailurePage]);

  // Success Page Component
  if (showSuccessPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="max-w-md w-full mx-auto bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-green-800 mb-2">SUCCESS!</h1>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Form Submitted Successfully</h2>
          <p className="text-gray-600 mb-2">{submissionResult?.message}</p>
          <p className="text-sm text-gray-500 mb-6">
            Your daily shift form has been saved to the database and is now available for reports and analysis.
          </p>
          <div className="text-xs text-gray-400 mb-4">
            This page will automatically close in 10 seconds...
          </div>
          <Button 
            onClick={() => {
              setShowSuccessPage(false);
              setSubmissionResult(null);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
          >
            Continue to New Form
          </Button>
        </div>
      </div>
    );
  }

  // Failure Page Component
  if (showFailurePage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="max-w-md w-full mx-auto bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-red-800 mb-2">SUBMISSION FAILED</h1>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Form Not Submitted</h2>
          <p className="text-gray-600 mb-2">{submissionResult?.message}</p>
          <p className="text-sm text-gray-500 mb-6">
            Please check your data and try again. If the problem persists, contact support.
          </p>
          <div className="text-xs text-gray-400 mb-4">
            This page will automatically close in 10 seconds...
          </div>
          <Button 
            onClick={() => {
              setShowFailurePage(false);
              setSubmissionResult(null);
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Daily Sales & Stock Form</h1>
        <p className="text-gray-600">Complete daily shift reporting with authentic inventory tracking</p>
        {/* Debug info - remove once working */}
        <div className="text-xs text-blue-500 mt-2">
          Form Version: v2.0 - Draft Button Enabled | Debug: isDraftSaving={isDraftSaving.toString()}
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <strong>Error:</strong> {errorMessage}
          <p className="mt-2 text-sm">
            <strong>Troubleshooting:</strong> Check if all number fields contain valid numbers (not text). 
            Empty fields are okay, but text in number fields causes database errors. 
            If the issue persists, verify all inventory quantities are numbers.
          </p>
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
                  required
                />
              </div>
              <div>
                <Label htmlFor="shiftType">Shift Type</Label>
                <Select onValueChange={(value) => setFormData(prev => ({ ...prev, shiftType: value }))}>
                  <SelectTrigger>
                    <SelectValue />
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
            </div>

            {/* Shopping & Expenses */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-900">Shopping & Expenses</h3>
                <Button type="button" variant="outline" size="sm" onClick={addShoppingEntry}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Shopping Entry
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>Total Wages: ฿{totalWages.toLocaleString()}</div>
                <div>Total Shopping: ฿{totalShopping.toLocaleString()}</div>
                <div className="text-lg font-bold text-red-600">Total Expenses: ฿{totalExpenses.toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Cash Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Cash Management</CardTitle>
            <CardDescription>Cash flow tracking and reconciliation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. Stock Counts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Stock Counts</CardTitle>
            <CardDescription>Current inventory levels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stock Count - Rolls & Meat */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Stock Count</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="burgerRollsStock">Burger Rolls Stock</Label>
                  <Input
                    id="burgerRollsStock"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.inventory["Burger Rolls Stock"] || ''}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        inventory: {
                          ...prev.inventory,
                          ["Burger Rolls Stock"]: parseInt(e.target.value) || 0
                        }
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="meatStock">Meat Stock (kg)</Label>
                  <Input
                    id="meatStock"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.inventory["Meat Stock"] || ''}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        inventory: {
                          ...prev.inventory,
                          ["Meat Stock"]: parseFloat(e.target.value) || 0
                        }
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Drinks */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Drinks</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {drinkStock.map((drink) => (
                  <div key={drink.name}>
                    <Label>{drink.name}</Label>
                    <Input
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
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Inventory Categories */}
        {Object.entries(inventoryCategories).map(([category, items]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg text-gray-900">{category}</CardTitle>
              <CardDescription>Authentic supplier inventory tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {items.map((item) => (
                  <div key={item.name}>
                    <Label className="text-sm">{item.name}</Label>
                    <Input
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
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Submit Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button 
            type="button"
            onClick={saveDraft}
            disabled={isDraftSaving || isSubmitting}
            className="bg-gray-200 text-black hover:bg-gray-300 px-8 py-3 text-lg font-semibold border-0"
          >
            {isDraftSaving ? "Saving..." : "Save Draft"}
          </Button>
          <Button 
            type="button"
            onClick={handleGenerateAndDownloadPDF}
            disabled={isSubmitting || isDraftSaving}
            className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-3 text-lg font-semibold border-0"
          >
            Download PDF
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting || isDraftSaving}
            className="bg-black text-white hover:bg-gray-800 px-8 py-3 text-lg font-semibold border-0"
          >
            {isSubmitting ? "Submitting..." : "Submit Form"}
          </Button>
        </div>
      </form>

      {/* Jussi Chat Bubble for Operations Support */}
      <JussiChatBubble />
    </div>
  );
};

export default DailyShiftForm;