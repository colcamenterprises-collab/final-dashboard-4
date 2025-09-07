import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus } from "lucide-react";

const expenseLodgmentSchema = z.object({
  date: z.string().min(1, "Date is required"),
  supplier: z.string().min(1, "Supplier is required"),  
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive("Amount must be greater than 0"),
});

type ExpenseLodgmentForm = z.infer<typeof expenseLodgmentSchema>;

interface ExpenseLodgmentModalProps {
  onSuccess?: () => void;
  triggerClassName?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialData?: {
    date: string;
    supplier: string;
    category: string;
    description: string;
    amount: string;
  };
  expenseId?: string;
}

// Hardcoded categories and suppliers until lookup tables are seeded
const CATEGORIES = [
  'Food & Beverage',
  'Staff Expenses (from Account)', 
  'Rent',
  'Administration',
  'Advertising',
  'Delivery Fee',
  'Director Payment',
  'Fittings & Fixtures',
  'Kitchen Supplies',
  'Office Supplies',
  'Packaging',
  'Fees',
  'Subscriptions',
  'Travel',
  'Utilities',
  'Other'
];

const SUPPLIERS = [
  'Makro',
  'Mr DIY', 
  'Bakery',
  'Big C',
  'Printers',
  'Supercheap',
  'Loyverse',
  'DTAC',
  'AIS',
  'Landlord',
  'Gas',
  'GO Wholesale',
  'Grab Merchant',
  'HomePro',
  'Lawyer',
  'Lazada',
  'Tesco Lotus',
  'Other'
];

export function ExpenseLodgmentModal({ 
  onSuccess, 
  triggerClassName, 
  isOpen: controlledOpen, 
  onOpenChange: controlledOnOpenChange,
  initialData,
  expenseId 
}: ExpenseLodgmentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  // Use controlled or internal state
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalIsOpen;
  const setIsOpen = controlledOnOpenChange || setInternalIsOpen;
  
  const isEditMode = !!expenseId;

  const form = useForm<ExpenseLodgmentForm>({
    resolver: zodResolver(expenseLodgmentSchema),
    defaultValues: {
      date: initialData?.date || new Date().toISOString().split('T')[0],
      supplier: initialData?.supplier || "",
      category: initialData?.category || "",
      description: initialData?.description || "",
      amount: initialData ? parseFloat(initialData.amount) : 0,
    },
  });

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      form.reset({
        date: initialData.date,
        supplier: initialData.supplier,
        category: initialData.category,
        description: initialData.description,
        amount: parseFloat(initialData.amount),
      });
    }
  }, [initialData, form]);

  // Create/Update expense mutation
  const expenseMutation = useMutation({
    mutationFn: async (data: ExpenseLodgmentForm) => {
      // Transform data to match the backend API format
      const payload = {
        date: data.date,
        supplier: data.supplier,
        category: data.category,
        description: data.description,
        amount: data.amount, // Store as THB
        createdAt: new Date().toISOString(),
      };

      const url = isEditMode ? `/api/expensesV2/${expenseId}` : "/api/expensesV2";
      const method = isEditMode ? "PUT" : "POST";

      return apiRequest(url, {
        method: method,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expensesV2"] });
      toast({
        title: "Success",
        description: isEditMode ? "Expense updated successfully" : "Business expense logged successfully",
      });
      setIsOpen(false);
      form.reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} expense:`, error);
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditMode ? 'update' : 'log'} expense`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExpenseLodgmentForm) => {
    expenseMutation.mutate(data);
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      form.reset({
        date: new Date().toISOString().split('T')[0],
        supplier: "",
        category: "",
        description: "",
        amount: 0,
      });
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className={triggerClassName || "bg-black text-white hover:bg-gray-800"}
        >
          <Plus className="h-4 w-4 mr-2" />
          Lodge Business Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Business Expense" : "Lodge Business Expense"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SUPPLIERS.map((supplier) => (
                        <SelectItem key={supplier} value={supplier}>
                          {supplier}
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter expense description" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (THB)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsOpen(false)}
                disabled={expenseMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={expenseMutation.isPending}
              >
                {expenseMutation.isPending ? "Saving..." : isEditMode ? "Update Expense" : "Save Expense"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}