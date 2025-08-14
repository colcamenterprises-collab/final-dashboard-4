import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, X, Upload, TrendingUp, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import BackButton from '@/components/BackButton';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Final v2 Sales Form Schema - exact specification from user
const salesFormSchema = z.object({
  // A) Shift Information
  shiftTime: z.enum(['MORNING', 'EVENING', 'LATE']),
  shiftDate: z.string().min(1, 'Shift date is required'),
  completedBy: z.string().min(1, 'Staff name is required').max(64, 'Maximum 64 characters'),
  startingCash: z.number().min(0, 'Cannot be negative'),
  endingCashCounted: z.number().min(0, 'Cannot be negative'),
  notes: z.string().max(500, 'Maximum 500 characters').optional(),
  
  // B) Sales Information (channels)
  cashSales: z.number().min(0, 'Cannot be negative'),
  qrScanSales: z.number().min(0, 'Cannot be negative'),
  grabSales: z.number().min(0, 'Cannot be negative'),
  aroiDeeSales: z.number().min(0, 'Cannot be negative'),
  cardSales: z.number().min(0, 'Cannot be negative').optional(),
  otherSales: z.number().min(0, 'Cannot be negative').optional(),
  totalOrders: z.number().min(0, 'Cannot be negative').optional(),
  discountsRefunds: z.number().min(0, 'Cannot be negative').optional(),
  
  // C) Delivery Partner Fees
  grabCommission: z.number().min(0, 'Cannot be negative').optional(),
  merchantFundedDiscount: z.number().min(0, 'Cannot be negative').optional(),
  
  // D) Banked / Reconciliation
  cashBanked: z.number().min(0, 'Cannot be negative'),
});

type SalesFormData = z.infer<typeof salesFormSchema>;

interface ShiftPurchase {
  id?: number;
  description: string;
  amount: number;
  supplier: string;
}

export default function SalesForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [shiftPurchases, setShiftPurchases] = useState<ShiftPurchase[]>([]);
  const [newPurchase, setNewPurchase] = useState<ShiftPurchase>({
    description: '',
    amount: 0,
    supplier: '',
  });
  const [status, setStatus] = useState<'DRAFT' | 'SUBMITTED' | 'LOCKED'>('DRAFT');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showVarianceConfirm, setShowVarianceConfirm] = useState(false);
  const [varianceReason, setVarianceReason] = useState('');

  const form = useForm<SalesFormData>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: {
      shiftTime: 'EVENING',
      shiftDate: new Date().toISOString().split('T')[0],
      completedBy: '',
      startingCash: 0,
      endingCashCounted: 0,
      cashSales: 0,
      qrScanSales: 0,
      grabSales: 0,
      aroiDeeSales: 0,
      cardSales: 0,
      otherSales: 0,
      totalOrders: 0,
      discountsRefunds: 0,
      grabCommission: 0,
      merchantFundedDiscount: 0,
      cashBanked: 0,
      notes: '',
    },
  });

  // Watch form values for calculations
  const formValues = form.watch();
  
  // Calculations per specification
  const totalSalesPOS = (formValues.cashSales || 0) + 
                       (formValues.qrScanSales || 0) + 
                       (formValues.grabSales || 0) + 
                       (formValues.aroiDeeSales || 0) + 
                       (formValues.cardSales || 0) + 
                       (formValues.otherSales || 0) - 
                       (formValues.discountsRefunds || 0);

  const totalShiftPurchases = shiftPurchases.reduce((sum, purchase) => sum + purchase.amount, 0);
  
  const expectedCashClose = (formValues.startingCash || 0) + 
                           (formValues.cashSales || 0) - 
                           totalShiftPurchases;
  
  const cashVariance = (formValues.endingCashCounted || 0) - expectedCashClose;

  // Shift time options per specification
  const shiftTimeOptions = [
    { value: 'MORNING', label: 'Morning (10–17)', start: '10:00', end: '17:00' },
    { value: 'EVENING', label: 'Evening (17–03)', start: '17:00', end: '03:00' },
    { value: 'LATE', label: 'Late (23–07)', start: '23:00', end: '07:00' },
  ];

  // Convert THB to satang (minor units) for storage
  const convertToSatang = (thb: number) => Math.round(thb * 100);

  // Add shift purchase
  const addShiftPurchase = useCallback(() => {
    if (newPurchase.description && newPurchase.amount > 0) {
      setShiftPurchases(prev => [...prev, { ...newPurchase, id: Date.now() }]);
      setNewPurchase({ description: '', amount: 0, supplier: '' });
    }
  }, [newPurchase]);

  // Remove shift purchase
  const removeShiftPurchase = useCallback((id: number) => {
    setShiftPurchases(prev => prev.filter(p => p.id !== id));
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      return validTypes.includes(file.type) && file.size <= maxSize;
    });
    
    if (attachments.length + validFiles.length > 5) {
      toast({
        title: "Too many files",
        description: "Maximum 5 files allowed",
        variant: "destructive",
      });
      return;
    }
    
    setAttachments(prev => [...prev, ...validFiles]);
  }, [attachments.length, toast]);

  // Remove attachment
  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/shift-sales', 'POST', data);
    },
    onSuccess: (result) => {
      toast({
        title: "Sales form submitted",
        description: "Redirecting to Stock Form...",
      });
      // Redirect to Stock Form with shift ID
      setLocation(`/stock-form?shiftId=${result.id}`);
    },
    onError: (error) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/shift-sales', 'POST', { ...data, status: 'DRAFT' });
    },
    onSuccess: () => {
      toast({
        title: "Draft saved",
        description: "Your progress has been saved",
      });
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = useCallback((data: SalesFormData) => {
    // Check for significant cash variance (> 20 THB)
    if (Math.abs(cashVariance) > 20 && !showVarianceConfirm) {
      setShowVarianceConfirm(true);
      return;
    }

    // Convert all money values to satang
    const salesData = {
      // Convert time and date
      shiftTime: data.shiftTime,
      shiftDate: data.shiftDate,
      completedBy: data.completedBy,
      
      // Convert cash amounts to satang
      startingCashSatang: convertToSatang(data.startingCash),
      endingCashSatang: convertToSatang(data.endingCashCounted),
      cashBankedSatang: convertToSatang(data.cashBanked),
      
      // Convert sales amounts to satang
      cashSatang: convertToSatang(data.cashSales),
      qrSatang: convertToSatang(data.qrScanSales),
      grabSatang: convertToSatang(data.grabSales),
      aroiDeeSatang: convertToSatang(data.aroiDeeSales),
      cardSatang: convertToSatang(data.cardSales || 0),
      otherSatang: convertToSatang(data.otherSales || 0),
      
      // Other fields
      totalOrders: data.totalOrders || 0,
      discountsSatang: convertToSatang(data.discountsRefunds || 0),
      
      // Delivery fees
      grabCommissionSatang: convertToSatang(data.grabCommission || 0),
      merchantFundedDiscountSatang: convertToSatang(data.merchantFundedDiscount || 0),
      
      // Shift purchases
      totalShiftPurchasesSatang: convertToSatang(totalShiftPurchases),
      shiftPurchases: shiftPurchases.map(p => ({
        description: p.description,
        supplier: p.supplier,
        amountSatang: convertToSatang(p.amount),
      })),
      
      // Meta
      notes: data.notes || '',
      status: 'SUBMITTED',
      attachments: attachments.map(f => f.name),
      varianceReason: showVarianceConfirm ? varianceReason : null,
    };

    submitMutation.mutate(salesData);
  }, [cashVariance, showVarianceConfirm, convertToSatang, totalShiftPurchases, shiftPurchases, attachments, varianceReason, submitMutation]);

  // Save draft
  const saveDraft = useCallback(() => {
    const draftData = {
      ...form.getValues(),
      status: 'DRAFT',
      shiftPurchases,
      attachments: attachments.map(f => f.name),
    };
    saveDraftMutation.mutate(draftData);
  }, [form, shiftPurchases, attachments, saveDraftMutation]);

  // Check if form is complete
  const isFormComplete = form.formState.isValid && 
    formValues.completedBy && 
    formValues.startingCash >= 0 && 
    formValues.endingCashCounted >= 0 &&
    formValues.cashSales >= 0 &&
    formValues.qrScanSales >= 0 &&
    formValues.grabSales >= 0 &&
    formValues.aroiDeeSales >= 0 &&
    formValues.cashBanked >= 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-4">
              <BackButton />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Daily Sales</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Step 1 of 2 • Sales Information & Cash Management
                </p>
              </div>
            </div>
          </div>
          
          {/* Status Badge */}
          <Badge variant={status === 'LOCKED' ? 'destructive' : status === 'SUBMITTED' ? 'default' : 'secondary'}>
            {status === 'LOCKED' ? 'Locked' : status === 'SUBMITTED' ? 'Submitted' : 'Draft'}
          </Badge>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Card 1: Shift Information */}
            <Card className="card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">Shift Information</CardTitle>
              </CardHeader>
              <CardContent className="card-inner">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="shiftTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shift Time *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select shift time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {shiftTimeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shiftDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shift Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="completedBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Completed By *</FormLabel>
                        <FormControl>
                          <Input placeholder="Staff name (max 64 chars)" {...field} maxLength={64} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="startingCash"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Starting Cash (฿) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00"
                              {...field} 
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endingCashCounted"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ending Cash Counted (฿) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00"
                              {...field} 
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Shift notes (max 500 chars)" 
                          {...field} 
                          maxLength={500}
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Card 2: Sales Information */}
            <Card className="card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">Sales Information</CardTitle>
              </CardHeader>
              <CardContent className="card-inner">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="cashSales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cash Sales (฿) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="qrScanSales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>QR Scan Sales (฿) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="grabSales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grab Sales (฿) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="aroiDeeSales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aroi Dee Sales (฿) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cardSales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Card Sales (฿)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="otherSales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Other Sales (฿)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="totalOrders"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Orders</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0"
                            {...field} 
                            onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="discountsRefunds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discounts / Refunds (฿)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Total Sales Display */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-800 dark:text-blue-200">
                      Total Sales (POS): ฿{totalSalesPOS.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Delivery Partner Fees */}
            <Card className="card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">Delivery Partner Fees</CardTitle>
              </CardHeader>
              <CardContent className="card-inner">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="grabCommission"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grab Commission (฿)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="merchantFundedDiscount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Fee Discount (Merchant-Funded) (฿)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Captured for reconciliation and variance explanations; do not post to P&L from this form.
                </p>
              </CardContent>
            </Card>

            {/* Card 4: Banked / Reconciliation */}
            <Card className="card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">Banked / Reconciliation</CardTitle>
              </CardHeader>
              <CardContent className="card-inner">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="cashBanked"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cash Banked (฿) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Expected Cash Close:</span>
                        <span className="font-semibold">฿{expectedCashClose.toFixed(2)}</span>
                      </div>
                      <div className={`flex justify-between items-center ${Math.abs(cashVariance) > 20 ? 'text-red-600' : 'text-green-600'}`}>
                        <span className="text-sm font-medium">Cash Variance:</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold">฿{cashVariance.toFixed(2)}</span>
                          {Math.abs(cashVariance) > 20 && <AlertTriangle className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                    
                    {Math.abs(cashVariance) > 20 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Cash variance exceeds ฿20. Please acknowledge and provide reason before submission.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 5: Shift Purchases */}
            <Card className="card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">Shift Purchases</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  For variance only, not P&L
                </p>
              </CardHeader>
              <CardContent className="card-inner">
                {/* Add New Purchase */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <Input
                    placeholder="Description"
                    value={newPurchase.description}
                    onChange={(e) => setNewPurchase(prev => ({ ...prev, description: e.target.value }))}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount (฿)"
                    value={newPurchase.amount || ''}
                    onChange={(e) => setNewPurchase(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  />
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Supplier"
                      value={newPurchase.supplier}
                      onChange={(e) => setNewPurchase(prev => ({ ...prev, supplier: e.target.value }))}
                    />
                    <Button 
                      type="button" 
                      onClick={addShiftPurchase}
                      disabled={!newPurchase.description || newPurchase.amount <= 0}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Purchases List */}
                {shiftPurchases.length > 0 && (
                  <div className="space-y-2">
                    {shiftPurchases.map((purchase, index) => (
                      <div key={purchase.id || index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <span className="font-medium">{purchase.description}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                            {purchase.supplier} - ฿{purchase.amount.toFixed(2)}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeShiftPurchase(purchase.id || index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <span className="font-semibold text-blue-800 dark:text-blue-200">
                        Total Shift Purchases: ฿{totalShiftPurchases.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 6: Attachments & Notes */}
            <Card className="card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">Attachments</CardTitle>
              </CardHeader>
              <CardContent className="card-inner">
                <div className="space-y-4">
                  <div>
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload">
                      <Button type="button" variant="outline" className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Photos/Receipts (max 5 files, 5MB each)
                      </Button>
                    </label>
                  </div>
                  
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <span className="text-sm">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Variance Confirmation Modal */}
            {showVarianceConfirm && (
              <Card className="card border-red-200 bg-red-50 dark:bg-red-900/20">
                <CardHeader className="card-header">
                  <CardTitle className="card-title text-red-800 dark:text-red-200">
                    Cash Variance Confirmation
                  </CardTitle>
                </CardHeader>
                <CardContent className="card-inner">
                  <p className="text-red-700 dark:text-red-300 mb-4">
                    Cash variance of ฿{cashVariance.toFixed(2)} exceeds the ฿20 threshold. 
                    Please provide a reason for this variance.
                  </p>
                  <Textarea
                    placeholder="Explain the reason for cash variance..."
                    value={varianceReason}
                    onChange={(e) => setVarianceReason(e.target.value)}
                    className="mb-4"
                  />
                  <div className="flex space-x-2">
                    <Button 
                      type="button" 
                      onClick={() => setShowVarianceConfirm(false)}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="button" 
                      onClick={() => form.handleSubmit(onSubmit)()}
                      disabled={!varianceReason.trim()}
                    >
                      Acknowledge & Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Form Actions */}
            <div className="flex justify-between space-x-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={saveDraft}
                disabled={saveDraftMutation.isPending}
              >
                Save Draft
              </Button>
              
              <Button 
                type="submit" 
                disabled={!isFormComplete || submitMutation.isPending || status === 'LOCKED'}
                className="min-w-[200px]"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Save & Continue to Stock'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}