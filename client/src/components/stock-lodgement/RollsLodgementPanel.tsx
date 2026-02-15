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

const labels = {
  en: {
    staffName: "Staff Name",
    dateNote: "Date and timestamp are recorded automatically (Asia/Bangkok) when submitted.",
    quantity: "Quantity (rolls)",
    amount: "Amount (THB)",
    paid: "Paid?",
    paidHint: "Create expense entry if paid",
    cancel: "Cancel",
    saving: "Saving...",
    lodgeRolls: "Lodge Rolls",
  },
  th: {
    staffName: "ชื่อพนักงาน",
    dateNote: "วันที่และเวลาจะบันทึกอัตโนมัติ (เวลากรุงเทพฯ) เมื่อส่ง",
    quantity: "จำนวน (ม้วน)",
    amount: "จำนวนเงิน (บาท)",
    paid: "จ่ายแล้ว?",
    paidHint: "สร้างรายการค่าใช้จ่ายถ้าจ่ายแล้ว",
    cancel: "ยกเลิก",
    saving: "กำลังบันทึก...",
    lodgeRolls: "บันทึกขนมปัง",
  },
};

interface RollsLodgementPanelProps {
  initialValues?: Partial<RollsForm>;
  isSubmitting?: boolean;
  showCancel?: boolean;
  submitText?: string;
  onCancel?: () => void;
  onSubmit: (data: RollsForm) => void;
  lang?: "en" | "th";
}

export function RollsLodgementPanel({
  initialValues,
  isSubmitting,
  showCancel,
  submitText,
  onCancel,
  onSubmit,
  lang = "en",
}: RollsLodgementPanelProps) {
  const L = labels[lang];
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField control={form.control} name="staffName" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs text-slate-600">{L.staffName}</FormLabel>
            <FormControl><Input className="h-9 text-sm rounded-[4px]" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <p className="text-xs text-slate-500">{L.dateNote}</p>

        <FormField control={form.control} name="quantity" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs text-slate-600">{L.quantity}</FormLabel>
            <FormControl>
              <Input
                className="h-9 text-sm rounded-[4px]"
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
            <FormLabel className="text-xs text-slate-600">{L.amount}</FormLabel>
            <FormControl>
              <Input className="h-9 text-sm rounded-[4px]" type="number" step="0.01" disabled {...field} value={typeof field.value === "number" ? field.value.toFixed(2) : field.value} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="paid" render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-[4px] border border-slate-200 p-3">
            <div>
              <FormLabel className="text-sm text-slate-700">{L.paid}</FormLabel>
              <div className="text-xs text-slate-500">{L.paidHint}</div>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )} />

        <div className="flex gap-3 pt-3">
          {showCancel && <Button type="button" variant="outline" size="sm" onClick={onCancel} className="flex-1 !h-9 text-sm">{L.cancel}</Button>}
          <Button type="submit" disabled={isSubmitting} size="sm" className="flex-1 !h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white">{isSubmitting ? L.saving : (submitText || L.lodgeRolls)}</Button>
        </div>
      </form>
    </Form>
  );
}

export type { RollsForm };
