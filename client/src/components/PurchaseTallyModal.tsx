import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, X } from "lucide-react";

const drinkItemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  qty: z.number().min(1, "Quantity must be at least 1"),
  unit: z.string().default("pcs"),
});

const purchaseTallySchema = z.object({
  date: z.string().min(1, "Date is required"),
  supplier: z.string().optional(),
  amountTHB: z.string().optional(),
  rollsPcs: z.string().optional(),
  meatGrams: z.string().optional(), 
  notes: z.string().optional(),
  staff: z.string().optional(),
  drinks: z.array(drinkItemSchema).default([]),
});

type PurchaseTallyForm = z.infer<typeof purchaseTallySchema>;
type DrinkItem = z.infer<typeof drinkItemSchema>;

interface PurchaseTallyModalProps {
  open: boolean;
  onClose: () => void;
  entry?: any; // For editing existing entries
}

export function PurchaseTallyModal({ open, onClose, entry }: PurchaseTallyModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [drinks, setDrinks] = useState<DrinkItem[]>([]);

  // Get drinks from ingredient catalog
  const { data: ingredientsData } = useQuery({
    queryKey: ["/api/costing/ingredients"],
    queryFn: () => apiRequest("/api/costing/ingredients"),
  });

  const drinkOptions = ingredientsData?.list?.filter((item: any) => item.category === "Drinks") || [];

  const form = useForm<PurchaseTallyForm>({
    resolver: zodResolver(purchaseTallySchema),
    defaultValues: {
      date: entry?.date || new Date().toISOString().split('T')[0],
      supplier: entry?.supplier || "",
      amountTHB: entry?.amountTHB || "",
      rollsPcs: entry?.rollsPcs?.toString() || "",
      meatGrams: entry?.meatGrams?.toString() || "",
      notes: entry?.notes || "",
      staff: entry?.staff || "",
      drinks: [],
    },
  });

  // Initialize drinks when entry changes
  useEffect(() => {
    if (entry?.drinks) {
      setDrinks(entry.drinks.map((d: any) => ({
        itemName: d.itemName,
        qty: d.qty,
        unit: d.unit || "pcs"
      })));
    } else {
      setDrinks([]);
    }
  }, [entry]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/purchase-tally", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-tally"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-tally/summary"] });
      toast({ title: "Purchase tally created successfully" });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error creating purchase tally", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/purchase-tally/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-tally"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-tally/summary"] });
      toast({ title: "Purchase tally updated successfully" });
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating purchase tally", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const addDrink = () => {
    setDrinks([...drinks, { itemName: "", qty: 0, unit: "pcs" }]);
  };

  const removeDrink = (index: number) => {
    setDrinks(drinks.filter((_, i) => i !== index));
  };

  const updateDrink = (index: number, drink: DrinkItem) => {
    const newDrinks = [...drinks];
    newDrinks[index] = drink;
    setDrinks(newDrinks);
  };

  const onSubmit = (data: PurchaseTallyForm) => {
    const payload = {
      ...data,
      amountTHB: data.amountTHB || null,
      rollsPcs: data.rollsPcs ? parseInt(data.rollsPcs) : null,
      meatGrams: data.meatGrams ? parseInt(data.meatGrams) : null,
      drinks: drinks.filter(d => d.itemName && d.qty > 0),
    };

    if (entry) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Edit Purchase Tally" : "Add Purchase Tally"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Date and Basic Info */}
            <div className="responsive-grid">
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
                    <FormControl>
                      <Input placeholder="e.g., Makro, Local Market" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Amount and Staff */}
            <div className="responsive-grid">
              <FormField
                control={form.control}
                name="amountTHB"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (฿)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="staff"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff Member</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Purchase Quantities */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Purchase Quantities</h4>
              <div className="responsive-grid">
                <FormField
                  control={form.control}
                  name="rollsPcs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rolls (pcs)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="meatGrams"
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
                
              </div>
            </div>

            {/* Itemized Drinks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Drinks (itemized)</h4>
                <Button type="button" onClick={addDrink} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Drink
                </Button>
              </div>
              
              {drinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No drinks added yet. Click "Add Drink" to start.</p>
              ) : (
                <div className="space-y-2">
                  {drinks.map((drink, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end">
                      {/* Item Name with Autocomplete */}
                      <div className="col-span-7">
                        <label className="text-xs text-muted-foreground">Item</label>
                        <input
                          type="text"
                          value={drink.itemName}
                          onChange={(e) => updateDrink(index, { ...drink, itemName: e.target.value })}
                          placeholder="e.g., Coke 325ml"
                          list={`drinks-list-${index}`}
                          className="w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <datalist id={`drinks-list-${index}`}>
                          {drinkOptions.map((item: any) => (
                            <option key={item.name} value={item.name} />
                          ))}
                        </datalist>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-3">
                        <label className="text-xs text-muted-foreground">Qty</label>
                        <input
                          type="number"
                          value={drink.qty || ""}
                          onChange={(e) => updateDrink(index, { ...drink, qty: Number(e.target.value) || 0 })}
                          placeholder="0"
                          min="0"
                          className="w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      {/* Remove Button */}
                      <div className="col-span-2 flex justify-end">
                        <Button 
                          type="button" 
                          onClick={() => removeDrink(index)} 
                          variant="ghost" 
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Optional notes about this purchase..." 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1"
              >
                {createMutation.isPending || updateMutation.isPending 
                  ? "Saving..." 
                  : entry ? "Update" : "Save"
                }
              </Button>
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}