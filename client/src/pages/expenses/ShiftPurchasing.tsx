import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Plus, ShoppingCart, Receipt, TrendingUp, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";

const purchaseFormSchema = z.object({
  description: z.string().min(1, "Item description is required"),
  amount: z.string().min(1, "Amount is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Amount must be a positive number"),
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  supplier: z.string().min(1, "Supplier is required"),
  items: z.string().optional(),
  notes: z.string().optional(),
});

type PurchaseFormData = z.infer<typeof purchaseFormSchema>;

export function ShiftPurchasing() {
  const { toast } = useToast();
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);

  // Fetch shift purchases only (SHIFT_FORM source)
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['/api/expenses', { source: 'SHIFT_FORM' }],
    queryFn: () => apiRequest('/api/expenses?source=SHIFT_FORM'),
  });

  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      description: "",
      amount: "",
      category: "PURCHASE",
      date: format(new Date(), "yyyy-MM-dd"),
      supplier: "",
      items: "",
      notes: "",
    },
  });

  const createPurchase = useMutation({
    mutationFn: (data: PurchaseFormData) => 
      apiRequest('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          amount: parseFloat(data.amount),
          source: 'SHIFT_FORM', // Always set as shift purchase
          paymentMethod: 'Cash'
        }),
      }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      
      // Trigger snapshot recompute for latest shift
      try {
        const snapshots = await apiRequest('/api/snapshots?limit=1');
        if (snapshots && snapshots.length > 0) {
          await apiRequest(`/api/snapshots/${snapshots[0].id}/recompute`, {
            method: 'POST'
          });
        }
      } catch (error) {
        console.warn('Could not recompute snapshot:', error);
      }
      
      toast({ title: "Success", description: "Shift purchase added and variance updated" });
      setIsAddPurchaseOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add purchase",
        variant: "destructive" 
      });
    },
  });

  const totalAmount = purchases.reduce((sum: number, purchase: any) => sum + (purchase.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Shift Purchasing</h2>
          <p className="text-muted-foreground">
            Purchases made during shifts (affects shift variance & inventory)
          </p>
        </div>
        <Dialog open={isAddPurchaseOpen} onOpenChange={setIsAddPurchaseOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Shift Purchase
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Shift Purchase</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createPurchase.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Description</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Burger Buns, Ground Beef, Lettuce" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (฿)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="supplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 7-11, Makro, Lotus" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="items"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Items/Quantity (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 20 buns, 2kg beef" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional purchase details" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createPurchase.isPending}>
                  {createPurchase.isPending ? "Adding Purchase..." : "Add Shift Purchase"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alert about variance impact */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Shift purchases are automatically included in variance calculations. 
          Adding purchases here will update the latest shift's expected closing stock.
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shift Purchases</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">฿{totalAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Affects shift variance
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchases.length}</div>
            <p className="text-xs text-muted-foreground">
              During shift operations
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Purchase</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ฿{purchases.length > 0 ? (totalAmount / purchases.length).toLocaleString() : '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Per purchase
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Purchases List */}
      <Card>
        <CardHeader>
          <CardTitle>Shift Purchases</CardTitle>
          <CardDescription>
            Purchases made during shift operations that affect inventory variance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Items/Qty</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Loading shift purchases...</TableCell>
                </TableRow>
              ) : purchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    <div className="py-8">
                      <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No shift purchases found</p>
                      <p className="text-sm text-muted-foreground">Add purchases made during shifts here</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                purchases.map((purchase: any) => (
                  <TableRow key={purchase.id}>
                    <TableCell>
                      {format(new Date(purchase.date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">{purchase.description}</TableCell>
                    <TableCell>{purchase.supplier || '-'}</TableCell>
                    <TableCell>฿{purchase.amount.toLocaleString()}</TableCell>
                    <TableCell>{purchase.items || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700">
                        Shift
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}