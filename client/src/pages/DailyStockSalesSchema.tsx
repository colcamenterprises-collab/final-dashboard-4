import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";

// FORT KNOX LOCKED SCHEMA - DO NOT MODIFY WITHOUT CAM APPROVAL
const formSchema = z.object({
  // 1. Shift Information
  shift_time: z.string().min(1, "Shift time is required"),
  completed_by: z.string().min(1, "Staff name is required"),
  
  // 2. Sales Information  
  total_sales: z.coerce.number().optional().default(0),
  grab_sales: z.coerce.number().optional().default(0),
  aroi_dee_sales: z.coerce.number().optional().default(0),
  cash_sales: z.coerce.number().optional().default(0),
  qr_sales: z.coerce.number().optional().default(0),
  
  // 3. Wages & Staff Payments
  wages: z.coerce.number().optional().default(0),
  
  // 4. Shopping & Expenses
  shopping_expenses: z.string().optional().default(""),
  
  // 5. Cash Management
  starting_cash: z.coerce.number().optional().default(0),
  ending_cash: z.coerce.number().optional().default(0),
  amount_banked: z.coerce.number().optional().default(0),
  
  // 6. Burger Buns & Meat Count
  burger_buns_stock: z.coerce.number().optional().default(0),
  buns_ordered: z.coerce.number().optional().default(0),
  meat_weight: z.coerce.number().optional().default(0),
  
  // 7. Drink Stock
  drink_stock: z.string().optional().default(""),
  
  // 8-13. Stock & Summary
  fresh_food: z.string().optional().default(""),
  frozen_food: z.string().optional().default(""),
  shelf_items: z.string().optional().default(""),
  kitchen_items: z.string().optional().default(""),
  packaging_items: z.string().optional().default(""),
  total_summary: z.string().optional().default(""),
});

type FormData = z.infer<typeof formSchema>;

export default function DailyStockSalesSchema() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      shift_time: "",
      completed_by: "",
      total_sales: 0,
      grab_sales: 0,
      aroi_dee_sales: 0,
      cash_sales: 0,
      qr_sales: 0,
      wages: 0,
      shopping_expenses: "",
      starting_cash: 0,
      ending_cash: 0,
      amount_banked: 0,
      burger_buns_stock: 0,
      buns_ordered: 0,
      meat_weight: 0,
      drink_stock: "",
      fresh_food: "",
      frozen_food: "",
      shelf_items: "",
      kitchen_items: "",
      packaging_items: "",
      total_summary: "",
    },
  });

  // Watch form values for calculations
  const watchedValues = form.watch();
  
  // Auto-calculate total sales including Aroi Dee Sales
  useEffect(() => {
    const total = (watchedValues.grab_sales || 0) + 
                  (watchedValues.aroi_dee_sales || 0) + 
                  (watchedValues.cash_sales || 0) + 
                  (watchedValues.qr_sales || 0);
    form.setValue('total_sales', total);
  }, [watchedValues.grab_sales, watchedValues.aroi_dee_sales, watchedValues.cash_sales, watchedValues.qr_sales, form]);

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (data: FormData) => apiRequest('/api/daily-stock-sales', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({
        title: "Form submitted successfully",
        description: "Daily sales and stock data has been saved and email sent.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/daily-stock-sales'] });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error.message || "Please check your data and try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    submitMutation.mutate(data);
  };

  return (
    <div style={{ fontFamily: 'Poppins, sans-serif' }} className="min-h-screen bg-white text-gray-900 p-10">
      <div className="max-w-4xl mx-auto">
        
        {/* Clean Navigation Header */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-4">
            <Link href="/" className="hover:text-gray-700">Home</Link> / 
            <span className="mx-1">Operations & Sales</span> / 
            <span className="mx-1 text-gray-700">Daily Sales & Stock</span>
          </nav>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-6">Operations & Sales</h1>
          
          {/* Clean Tabs */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="flex space-x-8">
              <button className="py-4 px-1 border-b-2 border-blue-500 font-medium text-blue-600 text-base">
                Daily Sales & Stock
              </button>
              <Link href="/purchasing" className="py-4 px-1 border-b-2 border-transparent font-medium text-gray-500 hover:text-gray-700 text-base">
                Purchasing
              </Link>
              <Link href="/expenses" className="py-4 px-1 border-b-2 border-transparent font-medium text-gray-500 hover:text-gray-700 text-base">
                Expenses
              </Link>
              <Link href="/reports-analysis" className="py-4 px-1 border-b-2 border-transparent font-medium text-gray-500 hover:text-gray-700 text-base">
                Reports & Analysis
              </Link>
            </nav>
          </div>
        </div>

        {/* Fort Knox Form Structure */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">

            {/* 1. Shift Information */}
            <section>
              <h2 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">1. Shift Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="shift_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block mb-2 text-base font-medium">Shift Time</FormLabel>
                      <FormControl>
                        <Input {...field} className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="e.g., 5 PM - 3 AM" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="completed_by"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block mb-2 text-base font-medium">Completed By</FormLabel>
                      <FormControl>
                        <Input {...field} className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="Staff name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* 2. Sales Information */}
            <section>
              <h2 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">2. Sales Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <FormField
                  control={form.control}
                  name="grab_sales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block mb-2 text-base font-medium">Grab Sales</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="aroi_dee_sales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block mb-2 text-base font-medium">Aroi Dee Sales</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cash_sales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block mb-2 text-base font-medium">Cash Sales</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="qr_sales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block mb-2 text-base font-medium">QR Sales</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="col-span-full p-4 bg-gray-50 rounded">
                  <p className="font-medium text-gray-700">Total Sales: ฿{Number(watchedValues.total_sales || 0).toFixed(2)}</p>
                </div>
              </div>
            </section>

            {/* 3. Wages & Staff Payments */}
            <section>
              <h2 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">3. Wages & Staff Payments</h2>
              <FormField
                control={form.control}
                name="wages"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block mb-2 text-base font-medium">Wages Paid</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* 4. Shopping & Expenses */}
            <section>
              <h2 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">4. Shopping & Expenses</h2>
              <FormField
                control={form.control}
                name="shopping_expenses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block mb-2 text-base font-medium">Expenses Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="Describe shopping and expenses" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* 5. Cash Management */}
            <section>
              <h2 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">5. Cash Management</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="starting_cash"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block mb-2 text-base font-medium">Starting Cash</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ending_cash"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block mb-2 text-base font-medium">Ending Cash</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount_banked"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block mb-2 text-base font-medium">Amount Banked</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* 6. Burger Buns & Meat Count */}
            <section>
              <h2 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">6. Burger Buns & Meat Count</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="burger_buns_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block mb-2 text-base font-medium">Burger Buns in Stock</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="buns_ordered"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block mb-2 text-base font-medium">Number of Buns Ordered</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="meat_weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block mb-2 text-base font-medium">Meat Weight (grams)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* 7. Drink Stock */}
            <section>
              <h2 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">7. Drink Stock</h2>
              <FormField
                control={form.control}
                name="drink_stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block mb-2 text-base font-medium">Drinks Purchased (List Format)</FormLabel>
                    <FormControl>
                      <Textarea {...field} className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="List drinks purchased" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* 8. Fresh Food Stock */}
            <section>
              <h2 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">8. Fresh Food Stock</h2>
              <FormField
                control={form.control}
                name="fresh_food"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="Fresh food stock details" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* 9. Frozen Food */}
            <section>
              <h2 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">9. Frozen Food</h2>
              <FormField
                control={form.control}
                name="frozen_food"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="Frozen food stock details" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* 10. Shelf Items */}
            <section>
              <h2 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">10. Shelf Items</h2>
              <FormField
                control={form.control}
                name="shelf_items"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="Shelf items stock details" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* 11. Kitchen Items */}
            <section>
              <h2 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">11. Kitchen Items</h2>
              <FormField
                control={form.control}
                name="kitchen_items"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="Kitchen items stock details" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* 12. Packaging Items */}
            <section>
              <h2 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">12. Packaging Items</h2>
              <FormField
                control={form.control}
                name="packaging_items"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="Packaging items stock details" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* 13. Total Summary */}
            <section>
              <h2 className="text-xl font-semibold border-b border-gray-300 pb-2 mb-4">13. Total Summary</h2>
              <FormField
                control={form.control}
                name="total_summary"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} className="w-full p-3 text-sm border border-gray-300 rounded" placeholder="Overall summary and notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* Submit Button */}
            <div className="pt-8">
              <Button 
                type="submit" 
                disabled={submitMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-8 text-lg font-medium rounded"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit Form & Send Email'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}