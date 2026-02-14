import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { convertFromInputDate } from "@/lib/format";

const meatSchema = z.object({
  staffName: z.string().trim().min(1, "Staff Name is required"),
  date: z.string().min(1, "Date is required"),
  meatType: z.string().min(1, "Meat type is required"),
  weightKg: z.number().min(0.01, "Weight must be positive"),
});

type MeatForm = z.infer<typeof meatSchema>;

const MEAT_TYPES = ["Topside", "Chuck", "Brisket", "Rump", "Outside", "Mixed", "Other"];

interface MeatLodgementPanelProps {
  initialValues?: Partial<MeatForm>;
  isSubmitting?: boolean;
  showCancel?: boolean;
  submitText?: string;
  onCancel?: () => void;
  onSubmit: (data: MeatForm) => void;
}

export function MeatLodgementPanel({ initialValues, isSubmitting, showCancel, submitText = "Lodge Meat", onCancel, onSubmit }: MeatLodgementPanelProps) {
  const today = new Date().toISOString().split("T")[0];
  const form = useForm<MeatForm>({
    resolver: zodResolver(meatSchema),
    defaultValues: {
      staffName: initialValues?.staffName || "",
      date: initialValues?.date || today,
      meatType: initialValues?.meatType || "",
      weightKg: initialValues?.weightKg || 0,
    },
  });

  useEffect(() => {
    if (!initialValues) return;
    form.reset({
      staffName: initialValues.staffName || "",
      date: initialValues.date || today,
      meatType: initialValues.meatType || "",
      weightKg: initialValues.weightKg || 0,
    });
  }, [initialValues, form, today]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="staffName" render={({ field }) => (
          <FormItem><FormLabel>Staff Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <FormField control={form.control} name="date" render={({ field }) => (
          <FormItem>
            <FormLabel>Date</FormLabel>
            <FormControl>
              <div className="space-y-1">
                <Input type="date" {...field} data-testid="input-stock-date" />
                {field.value && <p className="text-xs text-gray-600">Selected: {convertFromInputDate(field.value)}</p>}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="meatType" render={({ field }) => (
          <FormItem>
            <FormLabel>Meat Type</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select meat type" /></SelectTrigger></FormControl>
              <SelectContent>{MEAT_TYPES.map((meat) => <SelectItem key={meat} value={meat}>{meat}</SelectItem>)}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="weightKg" render={({ field }) => (
          <FormItem>
            <FormLabel>Weight (kg)</FormLabel>
            <FormControl><Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
            <FormMessage />
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

export type { MeatForm };
