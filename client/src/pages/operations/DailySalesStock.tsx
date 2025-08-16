/**
 * ⚠️ LOCKED FILE — Do not replace or refactor without Cam's written approval.
 * This is the FINAL implementation used in production. All alternatives were removed on purpose.
 */

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// Daily Sales & Stock Form Schema (LOCKED)
const dailySalesSchema = z.object({
  shiftDate: z.string().min(1, 'Shift date is required'),
  completedBy: z.string().min(1, 'Staff name is required'),
  cashStart: z.number().min(0, 'Starting cash must be positive'),
  cashEnd: z.number().min(0, 'Ending cash must be positive'),
  cashBanked: z.number().min(0, 'Cash banked must be positive'),
  cashSales: z.number().min(0, 'Cash sales must be positive'),
  qrSales: z.number().min(0, 'QR sales must be positive'),
  grabSales: z.number().min(0, 'Grab sales must be positive'),
  aroiDeeSales: z.number().min(0, 'Aroi Dee sales must be positive'),
  burgerBunsStart: z.number().min(0, 'Starting buns must be positive'),
  burgerBunsEnd: z.number().min(0, 'Ending buns must be positive'),
  meatCountStart: z.number().min(0, 'Starting meat count must be positive'),
  meatCountEnd: z.number().min(0, 'Ending meat count must be positive'),
  notes: z.string().optional()
});

type DailySalesForm = z.infer<typeof dailySalesSchema>;

export default function DailySalesStock() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const { toast } = useToast();

  const form = useForm<DailySalesForm>({
    resolver: zodResolver(dailySalesSchema),
    defaultValues: {
      shiftDate: new Date().toISOString().split('T')[0],
      completedBy: '',
      cashStart: 0,
      cashEnd: 0,
      cashBanked: 0,
      cashSales: 0,
      qrSales: 0,
      grabSales: 0,
      aroiDeeSales: 0,
      burgerBunsStart: 0,
      burgerBunsEnd: 0,
      meatCountStart: 0,
      meatCountEnd: 0,
      notes: ''
    }
  });

  // Check if form is locked for today
  useEffect(() => {
    const checkLockStatus = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/daily-sales/check-lock?date=${today}`);
        if (response.ok) {
          const data = await response.json();
          setIsLocked(data.isLocked);
        }
      } catch (error) {
        console.error('Error checking lock status:', error);
      }
    };
    checkLockStatus();
  }, []);

  const onSubmit = async (data: DailySalesForm) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/daily-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Daily sales form submitted successfully"
        });
        setIsLocked(true);
        // Redirect to stock form
        window.location.href = '/daily-stock';
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to submit form",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error", 
        description: "Network error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLocked) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Form Locked</h2>
          <p className="text-gray-600 mb-4">Daily sales form has been submitted for today.</p>
          <Button onClick={() => window.location.href = '/daily-sales-library'}>
            View Submissions
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Daily Sales & Stock Form</h1>
        <p className="text-gray-600">Complete your daily shift reporting</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Shift Information */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Shift Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shiftDate">Shift Date</Label>
              <Input
                id="shiftDate"
                type="date"
                {...form.register('shiftDate')}
              />
              {form.formState.errors.shiftDate && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.shiftDate.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="completedBy">Completed By</Label>
              <Input
                id="completedBy"
                placeholder="Staff name"
                {...form.register('completedBy')}
              />
              {form.formState.errors.completedBy && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.completedBy.message}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Cash Management */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Cash Management</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="cashStart">Starting Cash (฿)</Label>
              <Input
                id="cashStart"
                type="number"
                step="0.01"
                {...form.register('cashStart', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="cashEnd">Ending Cash (฿)</Label>
              <Input
                id="cashEnd"
                type="number"
                step="0.01"
                {...form.register('cashEnd', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="cashBanked">Cash Banked (฿)</Label>
              <Input
                id="cashBanked"
                type="number"
                step="0.01"
                {...form.register('cashBanked', { valueAsNumber: true })}
              />
            </div>
          </div>
        </Card>

        {/* Sales Information */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Sales Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cashSales">Cash Sales (฿)</Label>
              <Input
                id="cashSales"
                type="number"
                step="0.01"
                {...form.register('cashSales', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="qrSales">QR Sales (฿)</Label>
              <Input
                id="qrSales"
                type="number"
                step="0.01"
                {...form.register('qrSales', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="grabSales">Grab Sales (฿)</Label>
              <Input
                id="grabSales"
                type="number"
                step="0.01"
                {...form.register('grabSales', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="aroiDeeSales">Aroi Dee Sales (฿)</Label>
              <Input
                id="aroiDeeSales"
                type="number"
                step="0.01"
                {...form.register('aroiDeeSales', { valueAsNumber: true })}
              />
            </div>
          </div>
        </Card>

        {/* Stock Counts */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Burger Buns & Meat Count</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Burger Buns</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="burgerBunsStart">Starting Count</Label>
                  <Input
                    id="burgerBunsStart"
                    type="number"
                    {...form.register('burgerBunsStart', { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="burgerBunsEnd">Ending Count</Label>
                  <Input
                    id="burgerBunsEnd"
                    type="number"
                    {...form.register('burgerBunsEnd', { valueAsNumber: true })}
                  />
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3">Meat Count</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="meatCountStart">Starting Count</Label>
                  <Input
                    id="meatCountStart"
                    type="number"
                    {...form.register('meatCountStart', { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="meatCountEnd">Ending Count</Label>
                  <Input
                    id="meatCountEnd"
                    type="number"
                    {...form.register('meatCountEnd', { valueAsNumber: true })}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Notes */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Additional Notes</h3>
          <Textarea
            placeholder="Any additional notes or observations..."
            {...form.register('notes')}
            rows={4}
          />
        </Card>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit & Continue to Stock Form'}
          </Button>
        </div>
      </form>
    </div>
  );
}