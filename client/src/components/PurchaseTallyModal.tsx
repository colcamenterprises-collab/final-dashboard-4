import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const purchaseTallySchema = z.object({
  date: z.string().min(1, "Date is required"),
  supplier: z.string().optional(),
  amountTHB: z.string().optional(),
  rollsPcs: z.string().optional(),
  meatGrams: z.string().optional(), 
  drinksPcs: z.string().optional(),
  notes: z.string().optional(),
  staff: z.string().optional(),
});

type PurchaseTallyForm = z.infer<typeof purchaseTallySchema>;

interface PurchaseTallyModalProps {
  open: boolean;
  onClose: () => void;
  entry?: any; // For editing existing entries
}

export function PurchaseTallyModal({ open, onClose, entry }: PurchaseTallyModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<PurchaseTallyForm>({
    resolver: zodResolver(purchaseTallySchema),
    defaultValues: {
      date: entry?.date || new Date().toISOString().split('T')[0],
      supplier: entry?.supplier || "",
      amountTHB: entry?.amountTHB || "",
      rollsPcs: entry?.rollsPcs?.toString() || "",
      meatGrams: entry?.meatGrams?.toString() || "",
      drinksPcs: entry?.drinksPcs?.toString() || "",
      notes: entry?.notes || "",
      staff: entry?.staff || "",
    },
  });

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

  const onSubmit = (data: PurchaseTallyForm) => {
    // Convert string numbers to integers/decimals
    const payload = {
      ...data,
      amountTHB: data.amountTHB ? parseFloat(data.amountTHB) : null,
      rollsPcs: data.rollsPcs ? parseInt(data.rollsPcs) : null,
      meatGrams: data.meatGrams ? parseInt(data.meatGrams) : null,
      drinksPcs: data.drinksPcs ? parseInt(data.drinksPcs) : null,
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
                
                <FormField
                  control={form.control}
                  name="drinksPcs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Drinks (pcs)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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