import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { 
  Clock, 
  TrendingUp, 
  User, 
  ShoppingCart, 
  DollarSign,
  ChefHat,
  Coffee,
  Refrigerator,
  Snowflake,
  Package,
  ClipboardList,
  Calculator,
  Save,
  Send
} from "lucide-react";
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Daily Sales & Stock Form</h1>
          <p className="text-gray-600">Version: Fort Knox - Locked Structure</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* 1. Shift Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  1. Shift Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="shift_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift Time</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 5 PM - 3 AM" />
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
                      <FormLabel>Completed By</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Staff name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 2. Sales Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  2. Sales Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="grab_sales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grab Sales (฿)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
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
                      <FormLabel>Aroi Dee Sales (฿)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
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
                      <FormLabel>Cash Sales (฿)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
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
                      <FormLabel>QR Sales (฿)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="col-span-full p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-700">Total Sales</p>
                  <p className="text-2xl font-bold text-green-600">฿{(watchedValues.total_sales || 0).toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>

            {/* 3. Wages & Staff Payments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  3. Wages & Staff Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="wages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wages Paid (฿)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 4. Shopping & Expenses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  4. Shopping & Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="shopping_expenses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expenses Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Describe shopping and expenses" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 5. Cash Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  5. Cash Management
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="starting_cash"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Starting Cash (฿)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
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
                      <FormLabel>Ending Cash (฿)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
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
                      <FormLabel>Amount Banked (฿)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 6. Burger Buns & Meat Count */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChefHat className="h-5 w-5" />
                  6. Burger Buns & Meat Count
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="burger_buns_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Burger Buns in Stock</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="0" />
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
                      <FormLabel>Number of Buns Ordered</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="0" />
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
                      <FormLabel>Meat Weight (grams)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 7. Drink Stock */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coffee className="h-5 w-5" />
                  7. Drink Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="drink_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Drinks Purchased (List Format)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="List drinks purchased" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 8. Fresh Food Stock */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Refrigerator className="h-5 w-5" />
                  8. Fresh Food Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="fresh_food"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea {...field} placeholder="Fresh food stock details" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 9. Frozen Food */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Snowflake className="h-5 w-5" />
                  9. Frozen Food
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="frozen_food"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea {...field} placeholder="Frozen food stock details" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 10. Shelf Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  10. Shelf Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="shelf_items"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea {...field} placeholder="Shelf items stock details" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 11. Kitchen Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChefHat className="h-5 w-5" />
                  11. Kitchen Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="kitchen_items"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea {...field} placeholder="Kitchen items stock details" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 12. Packaging Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  12. Packaging Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="packaging_items"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea {...field} placeholder="Packaging items stock details" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 13. Total Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  13. Total Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="total_summary"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea {...field} placeholder="Overall summary and notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit Buttons */}
            <div className="flex gap-4 justify-end">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => form.reset()}
              >
                <Save className="h-4 w-4 mr-2" />
                Reset Form
              </Button>
              <Button 
                type="submit" 
                disabled={submitMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitMutation.isPending ? 'Submitting...' : 'Submit & Send Email'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}