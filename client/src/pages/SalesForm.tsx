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
import { Plus, X, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import BackButton from '@/components/BackButton';

// LOCKED Sales Form Schema - exact specification
const salesFormSchema = z.object({
  // A) Shift Info
  shiftDate: z.string().min(1, 'Shift date is required'),
  completedBy: z.string().min(1, 'Staff name is required').max(64, 'Maximum 64 characters'),
  cashStart: z.number().min(0, 'Cannot be negative'),
  
  // B) Sales
  cashSales: z.number().min(0, 'Cannot be negative'),
  qrSales: z.number().min(0, 'Cannot be negative'),
  grabSales: z.number().min(0, 'Cannot be negative'),
  aroiDeeSales: z.number().min(0, 'Cannot be negative'),
  directSales: z.number().min(0, 'Cannot be negative'),
  
  // D) Summary
  endingCash: z.number().min(0, 'Cannot be negative'),
  cashBanked: z.number().min(0, 'Cannot be negative'),
  qrTransferred: z.number().min(0, 'Cannot be negative'),
});

type SalesFormData = z.infer<typeof salesFormSchema>;

interface ShoppingItem {
  id?: number;
  item: string;
  shopName: string;
  amount: number;
}

interface WageItem {
  id?: number;
  staffName: string;
  amount: number;
  type: 'Wages' | 'Overtime' | 'Bonus';
}

interface OtherMoneyOutItem {
  id?: number;
  type: string;
  amount: number;
  notes?: string;
}

export default function SalesForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Expense arrays
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [wages, setWages] = useState<WageItem[]>([]);
  const [otherMoneyOut, setOtherMoneyOut] = useState<OtherMoneyOutItem[]>([]);
  
  // New item states
  const [newShopping, setNewShopping] = useState<ShoppingItem>({
    item: '',
    shopName: '',
    amount: 0,
  });
  const [newWage, setNewWage] = useState<WageItem>({
    staffName: '',
    amount: 0,
    type: 'Wages',
  });
  const [newOtherMoney, setNewOtherMoney] = useState<OtherMoneyOutItem>({
    type: '',
    amount: 0,
    notes: '',
  });

  const form = useForm<SalesFormData>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: {
      shiftDate: new Date().toISOString().split('T')[0],
      completedBy: '',
      cashStart: 0,
      cashSales: 0,
      qrSales: 0,
      grabSales: 0,
      aroiDeeSales: 0,
      directSales: 0,
      endingCash: 0,
      cashBanked: 0,
      qrTransferred: 0,
    },
  });

  // Watch form values for calculations
  const formValues = form.watch();
  
  // Auto calculations
  const totalSales = (formValues.cashSales || 0) + 
                    (formValues.qrSales || 0) + 
                    (formValues.grabSales || 0) + 
                    (formValues.aroiDeeSales || 0) + 
                    (formValues.directSales || 0);

  const totalExpenses = shopping.reduce((sum, item) => sum + item.amount, 0) +
                       wages.reduce((sum, item) => sum + item.amount, 0) +
                       otherMoneyOut.reduce((sum, item) => sum + item.amount, 0);

  // Add shopping item
  const addShopping = useCallback(() => {
    if (newShopping.item && newShopping.shopName && newShopping.amount > 0) {
      setShopping(prev => [...prev, { ...newShopping, id: Date.now() }]);
      setNewShopping({ item: '', shopName: '', amount: 0 });
    }
  }, [newShopping]);

  // Add wage item
  const addWage = useCallback(() => {
    if (newWage.staffName && newWage.amount > 0) {
      setWages(prev => [...prev, { ...newWage, id: Date.now() }]);
      setNewWage({ staffName: '', amount: 0, type: 'Wages' });
    }
  }, [newWage]);

  // Add other money out item
  const addOtherMoney = useCallback(() => {
    if (newOtherMoney.type && newOtherMoney.amount > 0) {
      setOtherMoneyOut(prev => [...prev, { ...newOtherMoney, id: Date.now() }]);
      setNewOtherMoney({ type: '', amount: 0, notes: '' });
    }
  }, [newOtherMoney]);

  // Remove functions
  const removeShopping = useCallback((id: number) => {
    setShopping(prev => prev.filter(item => item.id !== id));
  }, []);

  const removeWage = useCallback((id: number) => {
    setWages(prev => prev.filter(item => item.id !== id));
  }, []);

  const removeOtherMoney = useCallback((id: number) => {
    setOtherMoneyOut(prev => prev.filter(item => item.id !== id));
  }, []);

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/daily-sales', 'POST', data);
    },
    onSuccess: (result) => {
      toast({
        title: "Sales form submitted",
        description: "Redirecting to Stock Form...",
      });
      // Redirect to Stock Form
      setLocation('/daily-stock');
    },
    onError: (error) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = useCallback((data: SalesFormData) => {
    // Create payload matching exact API spec
    const payload = {
      shiftDate: data.shiftDate,
      completedBy: data.completedBy,
      cashStart: data.cashStart,
      
      cashSales: data.cashSales,
      qrSales: data.qrSales,
      grabSales: data.grabSales,
      aroiDeeSales: data.aroiDeeSales,
      directSales: data.directSales,
      totalSales: totalSales,
      
      shopping: shopping.map(item => ({
        item: item.item,
        shopName: item.shopName,
        amount: item.amount,
      })),
      wages: wages.map(item => ({
        staffName: item.staffName,
        amount: item.amount,
        type: item.type,
      })),
      otherMoneyOut: otherMoneyOut.map(item => ({
        type: item.type,
        amount: item.amount,
        notes: item.notes || '',
      })),
      
      totalExpenses: totalExpenses,
      endingCash: data.endingCash,
      cashBanked: data.cashBanked,
      qrTransferred: data.qrTransferred,
    };

    submitMutation.mutate(payload);
  }, [totalSales, totalExpenses, shopping, wages, otherMoneyOut, submitMutation]);

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
                  Complete daily sales and expense tracking
                </p>
              </div>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* A) Shift Info */}
            <Card className="card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">Shift Information</CardTitle>
              </CardHeader>
              <CardContent className="card-inner">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="shiftDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shift Date (TH local) *</FormLabel>
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

                  <FormField
                    control={form.control}
                    name="cashStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cash Start (฿) *</FormLabel>
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
              </CardContent>
            </Card>

            {/* B) Sales */}
            <Card className="card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">Sales</CardTitle>
              </CardHeader>
              <CardContent className="card-inner">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
                    name="qrSales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>QR Sales (฿) *</FormLabel>
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
                    name="directSales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Direct Sales (฿) *</FormLabel>
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
                      Total Sales: ฿{totalSales.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* C) Expenses - Shopping */}
            <Card className="card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">Shopping</CardTitle>
              </CardHeader>
              <CardContent className="card-inner">
                {/* Add Shopping Item */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <Input
                    placeholder="Item (max 120 chars)"
                    value={newShopping.item}
                    maxLength={120}
                    onChange={(e) => setNewShopping(prev => ({ ...prev, item: e.target.value }))}
                  />
                  <Input
                    placeholder="Shop Name (max 80 chars)"
                    value={newShopping.shopName}
                    maxLength={80}
                    onChange={(e) => setNewShopping(prev => ({ ...prev, shopName: e.target.value }))}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount (฿)"
                    value={newShopping.amount || ''}
                    onChange={(e) => setNewShopping(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  />
                  <Button 
                    type="button" 
                    onClick={addShopping}
                    disabled={!newShopping.item || !newShopping.shopName || newShopping.amount <= 0}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add More
                  </Button>
                </div>

                {/* Shopping List */}
                {shopping.length > 0 && (
                  <div className="space-y-2">
                    {shopping.map((item, index) => (
                      <div key={item.id || index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <span className="font-medium">{item.item}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                            at {item.shopName} - ฿{item.amount.toFixed(2)}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeShopping(item.id || index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* C) Expenses - Wages */}
            <Card className="card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">Wages</CardTitle>
              </CardHeader>
              <CardContent className="card-inner">
                {/* Add Wage Item */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <Input
                    placeholder="Staff Name (max 80 chars)"
                    value={newWage.staffName}
                    maxLength={80}
                    onChange={(e) => setNewWage(prev => ({ ...prev, staffName: e.target.value }))}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount (฿)"
                    value={newWage.amount || ''}
                    onChange={(e) => setNewWage(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  />
                  <Select 
                    value={newWage.type} 
                    onValueChange={(value) => setNewWage(prev => ({ ...prev, type: value as 'Wages' | 'Overtime' | 'Bonus' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Wages">Wages</SelectItem>
                      <SelectItem value="Overtime">Overtime</SelectItem>
                      <SelectItem value="Bonus">Bonus</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    onClick={addWage}
                    disabled={!newWage.staffName || newWage.amount <= 0}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add More
                  </Button>
                </div>

                {/* Wages List */}
                {wages.length > 0 && (
                  <div className="space-y-2">
                    {wages.map((item, index) => (
                      <div key={item.id || index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <span className="font-medium">{item.staffName}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                            {item.type} - ฿{item.amount.toFixed(2)}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeWage(item.id || index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* C) Expenses - Other Money Out */}
            <Card className="card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">Other Money Out</CardTitle>
              </CardHeader>
              <CardContent className="card-inner">
                {/* Add Other Money Out Item */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <Input
                    placeholder="Type (max 80 chars)"
                    value={newOtherMoney.type}
                    maxLength={80}
                    onChange={(e) => setNewOtherMoney(prev => ({ ...prev, type: e.target.value }))}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount (฿)"
                    value={newOtherMoney.amount || ''}
                    onChange={(e) => setNewOtherMoney(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  />
                  <Input
                    placeholder="Notes (max 200 chars)"
                    value={newOtherMoney.notes}
                    maxLength={200}
                    onChange={(e) => setNewOtherMoney(prev => ({ ...prev, notes: e.target.value }))}
                  />
                  <Button 
                    type="button" 
                    onClick={addOtherMoney}
                    disabled={!newOtherMoney.type || newOtherMoney.amount <= 0}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add More
                  </Button>
                </div>

                {/* Other Money Out List */}
                {otherMoneyOut.length > 0 && (
                  <div className="space-y-2">
                    {otherMoneyOut.map((item, index) => (
                      <div key={item.id || index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <span className="font-medium">{item.type}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                            ฿{item.amount.toFixed(2)}
                            {item.notes && ` - ${item.notes}`}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOtherMoney(item.id || index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Total Expenses Display */}
                <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-orange-800 dark:text-orange-200">
                      Total Expenses: ฿{totalExpenses.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* D) Summary */}
            <Card className="card">
              <CardHeader className="card-header">
                <CardTitle className="card-title">Summary</CardTitle>
              </CardHeader>
              <CardContent className="card-inner">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="endingCash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ending Cash (฿) *</FormLabel>
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

                  <FormField
                    control={form.control}
                    name="qrTransferred"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>QR Sales Transferred (฿) *</FormLabel>
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
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={submitMutation.isPending}
                className="min-w-[200px]"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit & Continue to Stock'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}