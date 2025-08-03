import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, CheckCircle, XCircle, FileDown, Save, Printer, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { JussiChatBubble } from "@/components/JussiChatBubble";

const DailyShiftForm = () => {
  const { toast } = useToast();
  
  // COMPLETE Form State - ALL FIELDS
  const [formData, setFormData] = useState({
    // Shift Information
    completedBy: '',
    shiftType: '',
    shiftDate: new Date().toISOString().split('T')[0],
    
    // Cash Management
    startingCash: 0,
    endingCash: 0,
    bankedAmount: 0,
    
    // Sales Information
    grabSales: 0,
    aroiDeeSales: 0,
    qrScanSales: 0,
    cashSales: 0,
    
    // Gas Expense
    gasExpense: 0,
    
    // Wages & Staff Payments (Dynamic Array)
    wages: [] as Array<{ name: string; amount: number; type: string }>,
    
    // Shopping & Expenses (Dynamic Array)
    shopping: [] as Array<{ item: string; amount: number; shop: string }>,
    
    // Food & Stock Items - COMPLETE INVENTORY SYSTEM
    // Fresh Food
    freshFood: {
      iceberg_lettuce: 0,
      tomatoes: 0,
      white_cabbage: 0,
      red_onions: 0,
      cucumber: 0,
      carrots: 0
    },
    
    // Frozen Food  
    frozenFood: {
      chicken_nuggets: 0,
      bacon: 0,
      chicken_breast: 0,
      beef_patties: 0,
      chicken_patties: 0,
      french_fries: 0
    },
    
    // Shelf Items
    shelfItems: {
      burger_buns: 0,
      ketchup: 0,
      mayonnaise: 0,
      mustard: 0,
      bbq_sauce: 0,
      cheese_slices: 0,
      cooking_oil: 0
    },
    
    // Kitchen Items
    kitchenItems: {
      paper_towels: 0,
      aluminum_foil: 0,
      plastic_gloves: 0,
      kitchen_cleaner: 0,
      sanitizer: 0
    },
    
    // Packaging Items
    packagingItems: {
      fries_boxes: 0,
      small_bags: 0,
      large_bags: 0,
      paper_bags: 0,
      loaded_fries_boxes: 0,
      labels: 0,
      cutlery_sets: 0
    },
    
    // Drink Stock
    drinkStock: {
      coke: 0,
      coke_zero: 0,
      sprite: 0,
      schweppes_manow: 0,
      fanta_orange: 0,
      fanta_strawberry: 0,
      soda_water: 0,
      bottled_water: 0,
      kids_orange: 0,
      kids_apple: 0
    },
    
    // Notes and Comments
    notes: '',
    discrepancyNotes: '',
    
    // Status
    isDraft: false
  });

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

  // Load existing form data on component mount
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const response = await fetch('/api/daily-stock-sales');
        if (response.ok) {
          const data = await response.json();
          const mostRecentForm = data[0]; // Get the most recent form
          
          if (mostRecentForm) {
            // Parse and load existing data
            const parsedWages = mostRecentForm.wages ? 
              (typeof mostRecentForm.wages === 'string' ? JSON.parse(mostRecentForm.wages) : mostRecentForm.wages) : [];
            const parsedShopping = mostRecentForm.shopping ? 
              (typeof mostRecentForm.shopping === 'string' ? JSON.parse(mostRecentForm.shopping) : mostRecentForm.shopping) : [];
            
            setFormData(prev => ({
              ...prev,
              completedBy: mostRecentForm.completed_by || '',
              shiftType: mostRecentForm.shift_type || '',
              shiftDate: mostRecentForm.shift_date ? mostRecentForm.shift_date.split('T')[0] : prev.shiftDate,
              startingCash: parseFloat(mostRecentForm.starting_cash) || 0,
              endingCash: parseFloat(mostRecentForm.ending_cash) || 0,
              bankedAmount: parseFloat(mostRecentForm.banked_amount) || 0,
              grabSales: parseFloat(mostRecentForm.grab_sales) || 0,
              aroiDeeSales: parseFloat(mostRecentForm.aroi_dee_sales) || 0,
              qrScanSales: parseFloat(mostRecentForm.qr_scan_sales) || 0,
              cashSales: parseFloat(mostRecentForm.cash_sales) || 0,
              gasExpense: parseFloat(mostRecentForm.gas_expense) || 0,
              wages: parsedWages,
              shopping: parsedShopping,
              notes: mostRecentForm.notes || '',
              discrepancyNotes: mostRecentForm.discrepancy_notes || ''
            }));
          }
        }
      } catch (error) {
        console.error('Error loading existing data:', error);
      }
    };
    
    loadExistingData();
  }, []);

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
  const totalExpenses = totalWages + totalShopping + formData.gasExpense;
  const calculatedEndingCash = formData.startingCash + totalSales - totalExpenses - formData.bankedAmount;

  // PDF Generation Function with proper A4 sizing
  const generateAndDownloadPDF = () => {
    try {
      const { jsPDF } = require('jspdf');
      require('jspdf-autotable');
      
      // Create A4 PDF document
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('DAILY SALES & STOCK FORM', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Shift Information
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Shift Information:', 20, yPosition);
      yPosition += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Completed By: ${formData.completedBy}`, 25, yPosition);
      yPosition += 6;
      doc.text(`Shift Type: ${formData.shiftType}`, 25, yPosition);
      yPosition += 6;
      doc.text(`Shift Date: ${formData.shiftDate}`, 25, yPosition);
      yPosition += 12;

      // Cash Management
      doc.setFont('helvetica', 'bold');
      doc.text('Cash Management:', 20, yPosition);
      yPosition += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Starting Cash: ${formData.startingCash.toLocaleString()}`, 25, yPosition);
      yPosition += 6;
      doc.text(`Ending Cash: ${formData.endingCash.toLocaleString()}`, 25, yPosition);
      yPosition += 6;
      doc.text(`Banked Amount: ${formData.bankedAmount.toLocaleString()}`, 25, yPosition);
      yPosition += 12;

      // Sales Information
      doc.setFont('helvetica', 'bold');
      doc.text('Sales Information:', 20, yPosition);
      yPosition += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Grab Sales: ${formData.grabSales.toLocaleString()}`, 25, yPosition);
      yPosition += 6;
      doc.text(`Aroi Dee Sales: ${formData.aroiDeeSales.toLocaleString()}`, 25, yPosition);
      yPosition += 6;
      doc.text(`QR Scan Sales: ${formData.qrScanSales.toLocaleString()}`, 25, yPosition);
      yPosition += 6;
      doc.text(`Cash Sales: ${formData.cashSales.toLocaleString()}`, 25, yPosition);
      yPosition += 6;
      
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL SALES: ${totalSales.toLocaleString()}`, 25, yPosition);
      yPosition += 12;

      // Check if we need a new page
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }

      // Expenses
      doc.setFont('helvetica', 'bold');
      doc.text('Expenses:', 20, yPosition);
      yPosition += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Gas Expense: ${formData.gasExpense.toLocaleString()}`, 25, yPosition);
      yPosition += 6;
      doc.text(`Total Wages: ${totalWages.toLocaleString()}`, 25, yPosition);
      yPosition += 6;
      doc.text(`Total Shopping: ${totalShopping.toLocaleString()}`, 25, yPosition);
      yPosition += 6;
      
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL EXPENSES: ${totalExpenses.toLocaleString()}`, 25, yPosition);
      yPosition += 6;
      doc.text(`NET REVENUE: ${(totalSales - totalExpenses).toLocaleString()}`, 25, yPosition);
      yPosition += 15;

      // Footer
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, pageHeight - 10);

      // Save the PDF
      doc.save(`daily-shift-form-${formData.shiftDate}-${Date.now()}.pdf`);

      toast({
        title: "PDF Generated",
        description: "Daily shift form downloaded successfully",
        variant: "default",
      });
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Falling back to text format.",
        variant: "destructive",
      });
      
      // Fallback to text format
      const pdfContent = `DAILY SALES & STOCK FORM\n========================\n\nShift Information:\n- Completed By: ${formData.completedBy}\n- Shift Type: ${formData.shiftType}\n- Shift Date: ${formData.shiftDate}\n\nCash Management:\n- Starting Cash: ${formData.startingCash.toLocaleString()}\n- Ending Cash: ${formData.endingCash.toLocaleString()}\n- Banked Amount: ${formData.bankedAmount.toLocaleString()}\n\nSales Information:\n- Grab Sales: ${formData.grabSales.toLocaleString()}\n- Aroi Dee Sales: ${formData.aroiDeeSales.toLocaleString()}\n- QR Scan Sales: ${formData.qrScanSales.toLocaleString()}\n- Cash Sales: ${formData.cashSales.toLocaleString()}\n- TOTAL SALES: ${totalSales.toLocaleString()}\n\nGas Expense: ${formData.gasExpense.toLocaleString()}\n\nWages & Staff Payments:\n${formData.wages.map(w => `- ${w.name}: ${w.amount.toLocaleString()} (${w.type})`).join('\n')}\nTotal Wages: ${totalWages.toLocaleString()}\n\nShopping & Expenses:\n${formData.shopping.map(s => `- ${s.item}: ${s.amount.toLocaleString()} (${s.shop})`).join('\n')}\nTotal Shopping: ${totalShopping.toLocaleString()}\n\nTOTAL EXPENSES: ${totalExpenses.toLocaleString()}\nNET REVENUE: ${(totalSales - totalExpenses).toLocaleString()}\n\nGenerated: ${new Date().toLocaleString()}`;
      
      const blob = new Blob([pdfContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-shift-form-${formData.shiftDate}-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Email Individual Form Function
  const emailIndividualForm = async () => {
    try {
      const emailData = {
        to: 'colcamenterprises@gmail.com', // Default email
        subject: `Daily Shift Form - ${formData.shiftDate} - ${formData.completedBy}`,
        formData: {
          completedBy: formData.completedBy,
          shiftType: formData.shiftType,
          shiftDate: formData.shiftDate,
          startingCash: formData.startingCash,
          endingCash: formData.endingCash,
          bankedAmount: formData.bankedAmount,
          grabSales: formData.grabSales,
          aroiDeeSales: formData.aroiDeeSales,
          qrScanSales: formData.qrScanSales,
          cashSales: formData.cashSales,
          totalSales: totalSales,
          gasExpense: formData.gasExpense,
          wages: formData.wages,
          shopping: formData.shopping,
          totalWages: totalWages,
          totalShopping: totalShopping,
          totalExpenses: totalExpenses,
          netRevenue: totalSales - totalExpenses,
          freshFood: formData.freshFood,
          frozenFood: formData.frozenFood,
          shelfItems: formData.shelfItems,
          kitchenItems: formData.kitchenItems,
          packagingItems: formData.packagingItems,
          drinkStock: formData.drinkStock,
          notes: formData.notes,
          discrepancyNotes: formData.discrepancyNotes
        }
      };

      const response = await fetch('/api/email-individual-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      if (response.ok) {
        toast({
          title: "Email Sent Successfully",
          description: "Daily shift form emailed to colcamenterprises@gmail.com",
          variant: "default",
        });
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error: any) {
      console.error('Email sending failed:', error);
      toast({
        title: "Email Failed",
        description: `Failed to send email: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Save Draft Function
  const saveDraft = async () => {
    setIsDraftSaving(true);
    setErrorMessage('');

    const draftData = {
      completedBy: formData.completedBy || 'Draft User',
      shiftType: formData.shiftType || 'night',
      shiftDate: formData.shiftDate,
      startingCash: parseFloat(String(formData.startingCash)) || 0,
      grabSales: parseFloat(String(formData.grabSales)) || 0,
      aroiDeeSales: parseFloat(String(formData.aroiDeeSales)) || 0,
      qrScanSales: parseFloat(String(formData.qrScanSales)) || 0,
      cashSales: parseFloat(String(formData.cashSales)) || 0,
      totalSales: parseFloat(String(totalSales)) || 0,
      endingCash: parseFloat(String(formData.endingCash)) || 0,
      bankedAmount: parseFloat(String(formData.bankedAmount)) || 0,
      gasExpense: parseFloat(String(formData.gasExpense)) || 0,
      wages: formData.wages.map(w => ({
        name: String(w.name || ''),
        amount: parseFloat(String(w.amount)) || 0,
        type: String(w.type || 'wages')
      })),
      shopping: formData.shopping.map(s => ({
        item: String(s.item || ''),
        amount: parseFloat(String(s.amount)) || 0,
        shop: String(s.shop || '')
      })),
      totalExpenses: parseFloat(String(totalExpenses)) || 0,
      
      // Stock data combined into numberNeeded object
      numberNeeded: {
        ...formData.freshFood,
        ...formData.frozenFood,
        ...formData.shelfItems,
        ...formData.kitchenItems,
        ...formData.packagingItems,
        ...formData.drinkStock
      },
      
      notes: formData.notes || '',
      discrepancyNotes: formData.discrepancyNotes || '',
      isDraft: true,
      status: 'draft'
    };

    try {
      const response = await fetch('/api/daily-stock-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftData)
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Draft Saved Successfully",
          description: `Form saved as draft with ID: ${result.id}`,
          variant: "default",
        });
        localStorage.setItem('dailyShiftDraft', JSON.stringify(draftData));
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error: any) {
      localStorage.setItem('dailyShiftDraft', JSON.stringify(draftData));
      toast({
        title: "Draft Saved Locally",
        description: "Network issue - draft saved to your browser",
        variant: "default",
      });
    }
    
    setIsDraftSaving(false);
  };

  // Submit Form Function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    // Validation
    if (!formData.completedBy?.trim()) {
      setSubmissionResult({
        success: false,
        message: "Please enter who completed this form"
      });
      setShowFailurePage(true);
      setIsSubmitting(false);
      return;
    }

    const submitData = {
      completedBy: String(formData.completedBy).trim(),
      shiftType: formData.shiftType || 'night',
      shiftDate: formData.shiftDate,
      startingCash: parseFloat(String(formData.startingCash)) || 0,
      grabSales: parseFloat(String(formData.grabSales)) || 0,
      aroiDeeSales: parseFloat(String(formData.aroiDeeSales)) || 0,
      qrScanSales: parseFloat(String(formData.qrScanSales)) || 0,
      cashSales: parseFloat(String(formData.cashSales)) || 0,
      totalSales: parseFloat(String(totalSales)) || 0,
      endingCash: parseFloat(String(formData.endingCash)) || 0,
      bankedAmount: parseFloat(String(formData.bankedAmount)) || 0,
      gasExpense: parseFloat(String(formData.gasExpense)) || 0,
      wages: formData.wages.map(w => ({
        name: String(w.name || '').trim(),
        amount: parseFloat(String(w.amount)) || 0,
        type: String(w.type || 'wages')
      })).filter(w => w.name || w.amount > 0),
      shopping: formData.shopping.map(s => ({
        item: String(s.item || '').trim(),
        amount: parseFloat(String(s.amount)) || 0,
        shop: String(s.shop || '').trim()
      })).filter(s => s.item || s.amount > 0),
      totalExpenses: parseFloat(String(totalExpenses)) || 0,
      
      // All stock data combined
      numberNeeded: {
        ...formData.freshFood,
        ...formData.frozenFood,
        ...formData.shelfItems,
        ...formData.kitchenItems,
        ...formData.packagingItems,
        ...formData.drinkStock
      },
      
      notes: formData.notes || '',
      discrepancyNotes: formData.discrepancyNotes || '',
      isDraft: false,
      status: 'completed'
    };

    try {
      console.log('Submitting form data:', submitData);
      
      const response = await fetch('/api/daily-stock-sales', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        const result = await response.json();
        
        setSubmissionResult({
          success: true,
          message: `Form submitted successfully! ID: ${result.id}. Email notification sent to management.`,
          formId: result.id
        });
        setShowSuccessPage(true);
        
        // Clear form data
        setFormData({
          completedBy: '',
          shiftType: '',
          shiftDate: new Date().toISOString().split('T')[0],
          startingCash: 0,
          endingCash: 0,
          bankedAmount: 0,
          grabSales: 0,
          aroiDeeSales: 0,
          qrScanSales: 0,
          cashSales: 0,
          gasExpense: 0,
          wages: [],
          shopping: [],
          freshFood: {
            iceberg_lettuce: 0,
            tomatoes: 0,
            white_cabbage: 0,
            red_onions: 0,
            cucumber: 0,
            carrots: 0
          },
          frozenFood: {
            chicken_nuggets: 0,
            bacon: 0,
            chicken_breast: 0,
            beef_patties: 0,
            chicken_patties: 0,
            french_fries: 0
          },
          shelfItems: {
            burger_buns: 0,
            ketchup: 0,
            mayonnaise: 0,
            mustard: 0,
            bbq_sauce: 0,
            cheese_slices: 0,
            cooking_oil: 0
          },
          kitchenItems: {
            paper_towels: 0,
            aluminum_foil: 0,
            plastic_gloves: 0,
            kitchen_cleaner: 0,
            sanitizer: 0
          },
          packagingItems: {
            fries_boxes: 0,
            small_bags: 0,
            large_bags: 0,
            paper_bags: 0,
            loaded_fries_boxes: 0,
            labels: 0,
            cutlery_sets: 0
          },
          drinkStock: {
            coke: 0,
            coke_zero: 0,
            sprite: 0,
            schweppes_manow: 0,
            fanta_orange: 0,
            fanta_strawberry: 0,
            soda_water: 0,
            bottled_water: 0,
            kids_orange: 0,
            kids_apple: 0
          },
          notes: '',
          discrepancyNotes: '',
          isDraft: false
        });
        
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error ${response.status}`);
      }

    } catch (error: any) {
      console.error('Submission failed:', error);
      
      // Save to localStorage as backup
      localStorage.setItem('emergencyFormBackup', JSON.stringify(submitData));
      
      setSubmissionResult({
        success: false,
        message: `Submission failed: ${error.message}. Your data is saved locally as backup.`
      });
      setShowFailurePage(true);
      setErrorMessage(error.message);
    }
    
    setIsSubmitting(false);
  };

  // Auto-dismiss success/failure pages
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
            Your daily shift form has been saved and an email notification sent to management.
          </p>
          <Button 
            onClick={() => {
              setShowSuccessPage(false);
              setSubmissionResult(null);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
          >
            Create New Form
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
            Please check your data and try again. Your data has been saved locally as backup.
          </p>
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
    <div className="container max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Daily Sales & Stock Form</h1>
        <p className="text-gray-600">Complete daily shift reporting with full inventory tracking</p>
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
                <Label htmlFor="completedBy">Completed By *</Label>
                <Input
                  id="completedBy"
                  value={formData.completedBy}
                  onChange={(e) => setFormData(prev => ({ ...prev, completedBy: e.target.value }))}
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="shiftType">Shift Type</Label>
                <Select value={formData.shiftType} onValueChange={(value) => setFormData(prev => ({ ...prev, shiftType: value }))}>
                  <SelectTrigger>
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

        {/* 2. Cash Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Cash Management</CardTitle>
            <CardDescription>Cash flow and banking information</CardDescription>
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
            
            {/* Cash Summary */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Cash Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Calculated Ending Cash: <span className="font-bold">฿{calculatedEndingCash.toLocaleString()}</span></div>
                <div>Actual Ending Cash: <span className="font-bold">฿{formData.endingCash.toLocaleString()}</span></div>
                <div className={`col-span-2 ${Math.abs(calculatedEndingCash - formData.endingCash) > 100 ? 'text-red-600' : 'text-green-600'}`}>
                  Difference: <span className="font-bold">฿{Math.abs(calculatedEndingCash - formData.endingCash).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Sales Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Sales Information</CardTitle>
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
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Sales Summary</h3>
              <div className="text-2xl font-bold text-green-600">
                Total Sales: ฿{totalSales.toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Gas Expense */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Gas Expense</CardTitle>
            <CardDescription>Gas and fuel costs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm">
              <Label htmlFor="gasExpense">Gas Expense (฿)</Label>
              <Input
                id="gasExpense"
                type="number"
                min="0"
                step="0.01"
                value={formData.gasExpense}
                onChange={(e) => setFormData(prev => ({ ...prev, gasExpense: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* 5. Wages & Staff Payments */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg text-gray-900">Wages & Staff Payments</CardTitle>
                <CardDescription>Staff wages, bonuses, and payments</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addWageEntry}>
                <Plus className="w-4 h-4 mr-2" />
                Add Wage Entry
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.wages.map((wage, index) => (
              <div key={index} className="flex gap-4 items-end p-4 border rounded-lg">
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
                  />
                </div>
                <div className="flex-1">
                  <Label>Type</Label>
                  <Select value={wage.type} onValueChange={(value) => {
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
            
            {formData.wages.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No wage entries added yet. Click "Add Wage Entry" to add staff payments.
              </div>
            )}
            
            {/* Wages Summary */}
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Wages Summary</h3>
              <div className="text-xl font-bold text-yellow-600">
                Total Wages: ฿{totalWages.toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Shopping & Expenses */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg text-gray-900">Shopping & Expenses</CardTitle>
                <CardDescription>Shopping items and operational expenses</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addShoppingEntry}>
                <Plus className="w-4 h-4 mr-2" />
                Add Shopping Entry
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.shopping.map((item, index) => (
              <div key={index} className="flex gap-4 items-end p-4 border rounded-lg">
                <div className="flex-1">
                  <Label>Item</Label>
                  <Input
                    value={item.item}
                    onChange={(e) => {
                      const newShopping = [...formData.shopping];
                      newShopping[index].item = e.target.value;
                      setFormData(prev => ({ ...prev, shopping: newShopping }));
                    }}
                    placeholder="Enter item name"
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
                  <Label>Shop</Label>
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
            
            {formData.shopping.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No shopping entries added yet. Click "Add Shopping Entry" to add expenses.
              </div>
            )}
            
            {/* Shopping Summary */}
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Shopping Summary</h3>
              <div className="text-xl font-bold text-orange-600">
                Total Shopping: ฿{totalShopping.toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 7. Fresh Food Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Fresh Food Stock</CardTitle>
            <CardDescription>Fresh ingredients and produce inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Iceberg Lettuce (1kg)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.freshFood.iceberg_lettuce}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    freshFood: { ...prev.freshFood, iceberg_lettuce: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Tomatoes (1kg)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.freshFood.tomatoes}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    freshFood: { ...prev.freshFood, tomatoes: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>White Cabbage (1kg)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.freshFood.white_cabbage}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    freshFood: { ...prev.freshFood, white_cabbage: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Red Onions (1kg)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.freshFood.red_onions}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    freshFood: { ...prev.freshFood, red_onions: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Cucumber (1kg)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.freshFood.cucumber}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    freshFood: { ...prev.freshFood, cucumber: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Carrots (1kg)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.freshFood.carrots}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    freshFood: { ...prev.freshFood, carrots: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 8. Frozen Food Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Frozen Food Stock</CardTitle>
            <CardDescription>Frozen ingredients and protein inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Chicken Nuggets (1kg)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.frozenFood.chicken_nuggets}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    frozenFood: { ...prev.frozenFood, chicken_nuggets: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Bacon (500g)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.frozenFood.bacon}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    frozenFood: { ...prev.frozenFood, bacon: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Chicken Breast (1kg)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.frozenFood.chicken_breast}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    frozenFood: { ...prev.frozenFood, chicken_breast: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Beef Patties (10 pieces)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.frozenFood.beef_patties}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    frozenFood: { ...prev.frozenFood, beef_patties: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Chicken Patties (10 pieces)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.frozenFood.chicken_patties}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    frozenFood: { ...prev.frozenFood, chicken_patties: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>French Fries (2.5kg)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.frozenFood.french_fries}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    frozenFood: { ...prev.frozenFood, french_fries: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 9. Shelf Items Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Shelf Items Stock</CardTitle>
            <CardDescription>Pantry items and condiments inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Burger Buns (8 pieces)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.shelfItems.burger_buns}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    shelfItems: { ...prev.shelfItems, burger_buns: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Ketchup (340g)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.shelfItems.ketchup}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    shelfItems: { ...prev.shelfItems, ketchup: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Mayonnaise (473ml)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.shelfItems.mayonnaise}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    shelfItems: { ...prev.shelfItems, mayonnaise: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Mustard (226g)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.shelfItems.mustard}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    shelfItems: { ...prev.shelfItems, mustard: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>BBQ Sauce (510g)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.shelfItems.bbq_sauce}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    shelfItems: { ...prev.shelfItems, bbq_sauce: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Cheese Slices (10 pieces)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.shelfItems.cheese_slices}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    shelfItems: { ...prev.shelfItems, cheese_slices: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Cooking Oil (1L)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.shelfItems.cooking_oil}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    shelfItems: { ...prev.shelfItems, cooking_oil: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 10. Kitchen Items Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Kitchen Items Stock</CardTitle>
            <CardDescription>Kitchen supplies and cleaning materials</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Paper Towels (6 rolls)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.kitchenItems.paper_towels}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    kitchenItems: { ...prev.kitchenItems, paper_towels: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Aluminum Foil (90m)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.kitchenItems.aluminum_foil}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    kitchenItems: { ...prev.kitchenItems, aluminum_foil: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Plastic Gloves (24 pieces)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.kitchenItems.plastic_gloves}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    kitchenItems: { ...prev.kitchenItems, plastic_gloves: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Kitchen Cleaner (3.5L)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.kitchenItems.kitchen_cleaner}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    kitchenItems: { ...prev.kitchenItems, kitchen_cleaner: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Sanitizer (450g)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.kitchenItems.sanitizer}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    kitchenItems: { ...prev.kitchenItems, sanitizer: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 11. Packaging Items Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Packaging Items Stock</CardTitle>
            <CardDescription>Packaging materials and supplies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Fries Boxes (50 pieces)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.packagingItems.fries_boxes}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    packagingItems: { ...prev.packagingItems, fries_boxes: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Small Bags (6×14) (500 pieces)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.packagingItems.small_bags}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    packagingItems: { ...prev.packagingItems, small_bags: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Large Bags (9×18) (500 pieces)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.packagingItems.large_bags}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    packagingItems: { ...prev.packagingItems, large_bags: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Paper Bags (50 pieces)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.packagingItems.paper_bags}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    packagingItems: { ...prev.packagingItems, paper_bags: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Loaded Fries Boxes (50 pieces)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.packagingItems.loaded_fries_boxes}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    packagingItems: { ...prev.packagingItems, loaded_fries_boxes: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Labels (45 per sheet)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.packagingItems.labels}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    packagingItems: { ...prev.packagingItems, labels: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Cutlery Sets (50 pieces)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.packagingItems.cutlery_sets}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    packagingItems: { ...prev.packagingItems, cutlery_sets: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 12. Drink Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Drink Stock</CardTitle>
            <CardDescription>Beverage inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Coke (24 cans)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.drinkStock.coke}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    drinkStock: { ...prev.drinkStock, coke: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Coke Zero (24 cans)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.drinkStock.coke_zero}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    drinkStock: { ...prev.drinkStock, coke_zero: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Sprite (24 cans)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.drinkStock.sprite}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    drinkStock: { ...prev.drinkStock, sprite: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Schweppes Manow (6 cans)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.drinkStock.schweppes_manow}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    drinkStock: { ...prev.drinkStock, schweppes_manow: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Fanta Orange (6 cans)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.drinkStock.fanta_orange}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    drinkStock: { ...prev.drinkStock, fanta_orange: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Fanta Strawberry (6 cans)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.drinkStock.fanta_strawberry}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    drinkStock: { ...prev.drinkStock, fanta_strawberry: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Soda Water (6 cans)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.drinkStock.soda_water}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    drinkStock: { ...prev.drinkStock, soda_water: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Bottled Water (12 bottles)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.drinkStock.bottled_water}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    drinkStock: { ...prev.drinkStock, bottled_water: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Kids Orange Juice (6 boxes)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.drinkStock.kids_orange}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    drinkStock: { ...prev.drinkStock, kids_orange: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label>Kids Apple Juice (6 boxes)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.drinkStock.kids_apple}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    drinkStock: { ...prev.drinkStock, kids_apple: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 13. Notes and Comments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Notes and Comments</CardTitle>
            <CardDescription>Additional notes and observations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="notes">General Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Enter any additional notes or observations about the shift..."
              />
            </div>
            <div>
              <Label htmlFor="discrepancyNotes">Discrepancy Notes</Label>
              <Textarea
                id="discrepancyNotes"
                rows={3}
                value={formData.discrepancyNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, discrepancyNotes: e.target.value }))}
                placeholder="Enter any discrepancies or issues that need attention..."
              />
            </div>
          </CardContent>
        </Card>

        {/* 14. Total Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Total Summary</CardTitle>
            <CardDescription>Complete financial overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <h3 className="font-semibold text-green-800 mb-2">Total Sales</h3>
                <p className="text-2xl font-bold text-green-600">฿{totalSales.toLocaleString()}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <h3 className="font-semibold text-yellow-800 mb-2">Total Wages</h3>
                <p className="text-2xl font-bold text-yellow-600">฿{totalWages.toLocaleString()}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg text-center">
                <h3 className="font-semibold text-orange-800 mb-2">Total Shopping</h3>
                <p className="text-2xl font-bold text-orange-600">฿{totalShopping.toLocaleString()}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <h3 className="font-semibold text-red-800 mb-2">Total Expenses</h3>
                <p className="text-2xl font-bold text-red-600">฿{totalExpenses.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="mt-6 bg-blue-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-blue-800 mb-4">Net Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-lg">
                <div>Net Revenue: <span className="font-bold">฿{(totalSales - totalExpenses).toLocaleString()}</span></div>
                <div>Cash Difference: <span className={`font-bold ${Math.abs(calculatedEndingCash - formData.endingCash) > 100 ? 'text-red-600' : 'text-green-600'}`}>฿{(formData.endingCash - calculatedEndingCash).toLocaleString()}</span></div>
                <div>Banked Today: <span className="font-bold">฿{formData.bankedAmount.toLocaleString()}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 15. Form Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          {/* Left side - PDF and Email buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={generateAndDownloadPDF}
              size="lg"
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Printer className="w-5 h-5 mr-2" />
              Print PDF
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={emailIndividualForm}
              size="lg"
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <Mail className="w-5 h-5 mr-2" />
              Email Form
            </Button>
          </div>

          {/* Right side - Draft and Submit buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={saveDraft}
              disabled={isDraftSaving}
              size="lg"
            >
              <Save className="w-5 h-5 mr-2" />
              {isDraftSaving ? 'Saving Draft...' : 'Save Draft'}
            </Button>
            
            <Button
              type="submit"
              disabled={isSubmitting || !formData.completedBy?.trim()}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white min-w-[200px]"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {isSubmitting ? 'Submitting Form...' : 'Submit Complete Form'}
            </Button>
          </div>
        </div>
        
        {/* Form validation message */}
        {!formData.completedBy?.trim() && (
          <div className="text-center text-red-600 text-sm">
            Please enter who completed this form before submitting
          </div>
        )}
      </form>

      <JussiChatBubble />
    </div>
  );
};

export default DailyShiftForm;