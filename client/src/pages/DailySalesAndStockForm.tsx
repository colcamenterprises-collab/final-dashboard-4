import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FileText, Save, Mail, ShoppingCart } from "lucide-react";

// Form validation schema
const formSchema = z.object({
  completedBy: z.string().min(1, "Name is required"),
  shiftType: z.enum(['opening', 'closing']),
  shiftDate: z.string().min(1, "Date is required"),
  
  // Sales Information
  grabSales: z.coerce.number().optional().default(0),
  foodPandaSales: z.coerce.number().optional().default(0),
  aroiDeeSales: z.coerce.number().optional().default(0),
  qrScanSales: z.coerce.number().optional().default(0),
  cashSales: z.coerce.number().optional().default(0),
  totalSales: z.coerce.number().optional().default(0),
  
  // Cash Management
  startingCash: z.coerce.number().optional().default(0),
  endingCash: z.coerce.number().optional().default(0),
  
  // Expenses
  salaryWages: z.coerce.number().optional().default(0),
  shopping: z.coerce.number().optional().default(0),
  totalExpenses: z.coerce.number().optional().default(0),
  expenseDescription: z.string().optional(),
  
  // Core tracking items (meat, rolls, drinks)
  meat: z.coerce.number().optional().default(0), // in grams
  rolls: z.coerce.number().optional().default(0), // in units
  drinks: z.coerce.number().optional().default(0), // in units
  
  // Additional stock items
  burgerBunsStock: z.coerce.number().optional().default(0),
  rollsOrderedCount: z.coerce.number().optional().default(0),
  meatWeight: z.coerce.number().optional().default(0),
  
  // Shopping list items
  shoppingList: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  otherFields: z.record(z.any()).optional().default({}),
});

type FormData = z.infer<typeof formSchema>;

const DailySalesAndStockForm = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      completedBy: '',
      shiftType: 'closing',
      shiftDate: new Date().toISOString().split('T')[0],
      grabSales: 0,
      foodPandaSales: 0,
      aroiDeeSales: 0,
      qrScanSales: 0,
      cashSales: 0,
      totalSales: 0,
      startingCash: 0,
      endingCash: 0,
      salaryWages: 0,
      shopping: 0,
      totalExpenses: 0,
      expenseDescription: '',
      meat: 0,
      rolls: 0,
      drinks: 0,
      burgerBunsStock: 0,
      rollsOrderedCount: 0,
      meatWeight: 0,
      shoppingList: {},
      otherFields: {},
    }
  });

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      // 1. Save the form data to the database
      console.log('📤 Saving form data...', data);
      
      const saveResponse = await fetch('/api/daily-stock-sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          shiftDate: new Date(data.shiftDate).toISOString(),
          isDraft: false,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save form data');
      }

      const saveResult = await saveResponse.json();
      console.log('✅ Form saved successfully:', saveResult);

      // 2. Generate PDF + Send Email to management
      console.log('📧 Sending email with PDF...');
      
      try {
        const emailResponse = await fetch('/api/send-form-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            submissionId: saveResult.id,
            emailTo: 'management@smashbrothersburgers.com',
            formData: data
          }),
        });

        if (emailResponse.ok) {
          setEmailSent(true);
          console.log('✅ Email sent successfully');
        } else {
          console.warn('⚠️ Email sending failed, but form was saved');
        }
      } catch (emailError) {
        console.warn('⚠️ Email error:', emailError);
        // Don't fail the whole process if email fails
      }

      // 3. Update shopping list (fetch + refresh dashboard)
      console.log('🛒 Updating shopping list...');
      
      try {
        const shoppingResponse = await fetch('/api/shopping-list/update-from-latest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            formId: saveResult.id,
            stockData: {
              meat: data.meat,
              rolls: data.rolls,
              drinks: data.drinks,
              burgerBuns: data.burgerBunsStock,
            }
          }),
        });

        if (shoppingResponse.ok) {
          console.log('✅ Shopping list updated successfully');
        }
      } catch (shoppingError) {
        console.warn('⚠️ Shopping list update error:', shoppingError);
      }

      // Success feedback
      toast({
        title: "✅ Form Submitted Successfully!",
        description: emailSent 
          ? "Form saved, email sent to management, and shopping list updated."
          : "Form saved and shopping list updated. Email notification pending.",
        duration: 6000,
      });

      // Reset form after successful submission
      form.reset();
      setEmailSent(false);

    } catch (error) {
      console.error('❌ Form submission failed:', error);
      toast({
        title: "Error",
        description: `Failed to submit form: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-calculate total sales
  const watchedSales = form.watch(['grabSales', 'foodPandaSales', 'aroiDeeSales', 'qrScanSales', 'cashSales']);
  React.useEffect(() => {
    const [grab, foodPanda, aroiDee, qrScan, cash] = watchedSales;
    const total = (grab || 0) + (foodPanda || 0) + (aroiDee || 0) + (qrScan || 0) + (cash || 0);
    form.setValue('totalSales', total);
  }, [watchedSales, form]);

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Daily Sales & Stock Form
          </CardTitle>
          <p className="text-sm text-gray-600">
            Complete daily operations form with automatic email sending and shopping list updates
          </p>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              
              {/* Shift Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Shift Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="completedBy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Completed By *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="shiftType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Shift Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select shift type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="opening">Opening Shift</SelectItem>
                              <SelectItem value="closing">Closing Shift</SelectItem>
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
                  </div>
                </CardContent>
              </Card>

              {/* Sales Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sales Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="grabSales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grab Sales (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="foodPandaSales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>FoodPanda Sales (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
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
                        <FormLabel>Aroi Dee Sales (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
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
                        <FormLabel>QR Scan Sales (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cashSales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cash Sales (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="totalSales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Sales (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} disabled />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Core Tracking Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Core Stock Tracking</CardTitle>
                  <p className="text-sm text-gray-600">Primary items for daily comparison analysis</p>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="meat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meat (grams)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="rolls"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rolls (units)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="drinks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drinks (units)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Cash Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cash Management</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startingCash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Starting Cash (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="endingCash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ending Cash (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Expenses */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Expenses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="salaryWages"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Salary/Wages (฿)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="shopping"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Shopping (฿)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="expenseDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expense Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional notes about expenses..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Submit Form & Send Email
                    </>
                  )}
                </Button>
                
                {emailSent && (
                  <div className="flex items-center gap-2 text-green-600 font-medium">
                    <Mail className="h-4 w-4" />
                    Email sent to management
                  </div>
                )}
              </div>
              
              {/* Status Information */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">What happens when you submit:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• ✅ Form data saved to database</li>
                  <li>• 📧 PDF generated and emailed to management</li>
                  <li>• 🛒 Shopping list automatically updated</li>
                  <li>• 📊 Ready for Jussi comparison analysis</li>
                </ul>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailySalesAndStockForm;