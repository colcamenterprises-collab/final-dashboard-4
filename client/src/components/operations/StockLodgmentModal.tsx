import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { X, Plus } from "lucide-react";

const rollsSchema = z.object({
  quantity: z.number().min(1, "Quantity must be at least 1"),
  cost: z.number().min(0, "Cost must be positive"),
  paid: z.boolean().default(false),
});

const drinksSchema = z.object({
  items: z.array(z.object({
    type: z.string().min(1, "Drink type is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
  })).min(1, "At least one drink item is required"),
});

const meatSchema = z.object({
  meatType: z.string().min(1, "Meat type is required"),
  weightKg: z.number().min(0.01, "Weight must be positive"),
});

type RollsForm = z.infer<typeof rollsSchema>;
type DrinksForm = z.infer<typeof drinksSchema>;
type MeatForm = z.infer<typeof meatSchema>;

interface StockLodgmentModalProps {
  onSuccess?: () => void;
  triggerClassName?: string;
  triggerText?: string;
  triggerIcon?: React.ReactNode;
}

const DRINK_TYPES = [
  "Coke", "Coke Zero", "Sprite", "Schweppes Manow", "Red Fanta", 
  "Orange Fanta", "Red Singha", "Yellow Singha", "Pink Singha", "Soda Water"
];

const MEAT_TYPES = [
  "Topside", "Chuck", "Brisket", "Rump", "Outside", "Mixed", "Other"
];

export function StockLodgmentModal({ 
  onSuccess, 
  triggerClassName,
  triggerText = "Lodge Stock Purchase",
  triggerIcon
}: StockLodgmentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"rolls" | "meat" | "drinks">("rolls");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const rollsForm = useForm<RollsForm>({
    resolver: zodResolver(rollsSchema),
    defaultValues: { quantity: 0, cost: 0, paid: false }
  });

  const drinksForm = useForm<DrinksForm>({
    resolver: zodResolver(drinksSchema),
    defaultValues: { items: [{ type: "", quantity: 0 }] }
  });

  const meatForm = useForm<MeatForm>({
    resolver: zodResolver(meatSchema),
    defaultValues: { meatType: "", weightKg: 0 }
  });

  const { fields, append, remove } = useFieldArray({
    control: drinksForm.control,
    name: "items"
  });

  // Auto-calculate cost for rolls (qty * 8 THB)
  const handleQuantityChange = (quantity: number) => {
    const cost = quantity * 8;
    rollsForm.setValue("cost", cost);
  };

  const stockMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/expensesV2/stock", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_, variables) => {
      const stockType = variables.type === 'rolls' ? 'Rolls' : 
                       variables.type === 'meat' ? 'Meat' : 'Drinks';
      toast({
        title: `${stockType} Lodged Successfully`,
        description: "Stock purchase has been recorded",
        variant: "success" as any,
        duration: 3000,
      });
      setIsOpen(false);
      rollsForm.reset();
      drinksForm.reset();
      meatForm.reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to record stock lodgment",
        variant: "destructive",
      });
    },
  });

  const handleRollsSubmit = (data: RollsForm) => {
    stockMutation.mutate({
      type: "rolls",
      quantity: data.quantity,
      cost: data.cost,
      paid: data.paid,
    });
  };

  const handleDrinksSubmit = (data: DrinksForm) => {
    stockMutation.mutate({
      type: "drinks",
      items: data.items,
    });
  };

  const handleMeatSubmit = (data: MeatForm) => {
    stockMutation.mutate({
      type: "meat",
      meatType: data.meatType,
      weightKg: data.weightKg,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}>
          {triggerIcon}
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lodge Stock Purchase</DialogTitle>
        </DialogHeader>
        
        {/* Tab Navigation */}
        <div className="flex border-b mb-4">
          <button
            type="button"
            onClick={() => setActiveTab("rolls")}
            className={`px-4 py-2 text-sm ${
              activeTab === "rolls" 
                ? "border-b-2 border-blue-500 text-blue-600" 
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Rolls
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("meat")}
            className={`px-4 py-2 text-sm ${
              activeTab === "meat" 
                ? "border-b-2 border-blue-500 text-blue-600" 
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Meat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("drinks")}
            className={`px-4 py-2 text-sm ${
              activeTab === "drinks" 
                ? "border-b-2 border-blue-500 text-blue-600" 
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Drinks
          </button>
        </div>

        {/* Rolls Tab */}
        {activeTab === "rolls" && (
          <Form {...rollsForm}>
            <form onSubmit={rollsForm.handleSubmit(handleRollsSubmit)} className="space-y-4">
              <FormField
                control={rollsForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity (rolls)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => {
                          const quantity = parseInt(e.target.value) || 0;
                          field.onChange(quantity);
                          handleQuantityChange(quantity);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={rollsForm.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (THB)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        disabled
                        {...field}
                        value={field.value.toFixed(2)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={rollsForm.control}
                name="paid"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="text-base">Paid?</FormLabel>
                      <div className="text-sm text-gray-500">
                        Create expense entry if paid
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={stockMutation.isPending}
                  className="flex-1"
                >
                  {stockMutation.isPending ? "Saving..." : "Lodge Rolls"}
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* Drinks Tab */}
        {activeTab === "drinks" && (
          <Form {...drinksForm}>
            <form onSubmit={drinksForm.handleSubmit(handleDrinksSubmit)} className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Drink {index + 1}</h4>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <FormField
                    control={drinksForm.control}
                    name={`items.${index}.type`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drink Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select drink type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DRINK_TYPES.map((drink) => (
                              <SelectItem key={drink} value={drink}>
                                {drink}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={drinksForm.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ type: "", quantity: 0 })}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Drink
              </Button>
              
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={stockMutation.isPending}
                  className="flex-1"
                >
                  {stockMutation.isPending ? "Saving..." : "Lodge Drinks"}
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* Meat Tab */}
        {activeTab === "meat" && (
          <Form {...meatForm}>
            <form onSubmit={meatForm.handleSubmit(handleMeatSubmit)} className="space-y-4">
              <FormField
                control={meatForm.control}
                name="meatType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meat Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select meat type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MEAT_TYPES.map((meat) => (
                          <SelectItem key={meat} value={meat}>
                            {meat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={meatForm.control}
                name="weightKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={stockMutation.isPending}
                  className="flex-1"
                >
                  {stockMutation.isPending ? "Saving..." : "Lodge Meat"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}