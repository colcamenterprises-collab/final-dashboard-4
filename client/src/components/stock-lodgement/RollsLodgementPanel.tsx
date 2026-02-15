import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const rollsSchema = z.object({
  staffName: z.string().trim().min(1, "Staff Name is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  cost: z.number().min(0, "Cost must be positive"),
  paid: z.boolean().default(false),
});

type RollsForm = z.infer<typeof rollsSchema>;

interface RollsLodgementPanelProps {
  initialValues?: Partial<RollsForm>;
  isSubmitting?: boolean;
  showCancel?: boolean;
  submitText?: string;
  onCancel?: () => void;
  onSubmit: (data: RollsForm) => void;
}

export function RollsLodgementPanel({
  initialValues,
  isSubmitting,
  showCancel,
  submitText = "Lodge Rolls",
  onCancel,
  onSubmit,
}: RollsLodgementPanelProps) {
  const form = useForm<RollsForm>({
    resolver: zodResolver(rollsSchema),
    defaultValues: {
      staffName: initialValues?.staffName || "",
      quantity: initialValues?.quantity || 0,
      cost: initialValues?.cost || 0,
      paid: initialValues?.paid || false,
    },
  });

  useEffect(() => {
    if (!initialValues) return;
    form.reset({
      staffName: initialValues.staffName || "",
      quantity: initialValues.quantity || 0,
      cost: initialValues.cost || 0,
      paid: initialValues.paid || false,
    });
  }, [initialValues, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="staffName" render={({ field }) => (
          <FormItem>
            <FormLabel>Staff Name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <p className="text-xs text-slate-500">Date and timestamp are recorded automatically (Asia/Bangkok) when submitted.</p>

        <FormField control={form.control} name="quantity" render={({ field }) => (
          <FormItem>
            <FormLabel>Quantity (rolls)</FormLabel>
            <FormControl>
              <Input
                type="number"
                {...field}
                onChange={(e) => {
                  const quantity = parseInt(e.target.value) || 0;
                  field.onChange(quantity);
                  form.setValue("cost", quantity * 8);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="cost" render={({ field }) => (
          <FormItem>
            <FormLabel>Amount (THB)</FormLabel>
            <FormControl>
              <Input type="number" step="0.01" disabled {...field} value={typeof field.value === "number" ? field.value.toFixed(2) : field.value} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="paid" render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <FormLabel className="text-base">Paid?</FormLabel>
              <div className="text-sm text-gray-500">Create expense entry if paid</div>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )} />

        <div className="flex gap-3 pt-4">
          {showCancel && <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>}
          <Button type="submit" disabled={isSubmitting} className="flex-1">{isSubmitting ? "Saving..." : submitText}</Button>
        </div>
      </form>
    </Form>
  );
}

export type { RollsForm };
