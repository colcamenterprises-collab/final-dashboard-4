import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const meatSchema = z.object({
  staffName: z.string().trim().min(1, "Staff Name is required"),
  meatType: z.string().min(1, "Meat type is required"),
  weightKg: z.number().min(0.01, "Weight must be positive"),
});

type MeatForm = z.infer<typeof meatSchema>;

const MEAT_TYPES = ["Topside", "Chuck", "Brisket", "Rump", "Outside", "Mixed", "Other"];

const labels = {
  en: {
    staffName: "Staff Name",
    dateNote: "Date and timestamp are recorded automatically (Asia/Bangkok) when submitted.",
    meatType: "Meat Type",
    selectMeatType: "Select meat type",
    weightKg: "Weight (kg)",
    cancel: "Cancel",
    saving: "Saving...",
    lodgeMeat: "Lodge Meat",
  },
  th: {
    staffName: "ชื่อพนักงาน",
    dateNote: "วันที่และเวลาจะบันทึกอัตโนมัติ (เวลากรุงเทพฯ) เมื่อส่ง",
    meatType: "ประเภทเนื้อ",
    selectMeatType: "เลือกประเภทเนื้อ",
    weightKg: "น้ำหนัก (กก.)",
    cancel: "ยกเลิก",
    saving: "กำลังบันทึก...",
    lodgeMeat: "บันทึกเนื้อ",
  },
};

interface MeatLodgementPanelProps {
  initialValues?: Partial<MeatForm>;
  isSubmitting?: boolean;
  showCancel?: boolean;
  submitText?: string;
  onCancel?: () => void;
  onSubmit: (data: MeatForm) => void;
  lang?: "en" | "th";
}

export function MeatLodgementPanel({ initialValues, isSubmitting, showCancel, submitText, onCancel, onSubmit, lang = "en" }: MeatLodgementPanelProps) {
  const L = labels[lang];
  const form = useForm<MeatForm>({
    resolver: zodResolver(meatSchema),
    defaultValues: {
      staffName: initialValues?.staffName || "",
      meatType: initialValues?.meatType || "",
      weightKg: initialValues?.weightKg || 0,
    },
  });

  useEffect(() => {
    if (!initialValues) return;
    form.reset({
      staffName: initialValues.staffName || "",
      meatType: initialValues.meatType || "",
      weightKg: initialValues.weightKg || 0,
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

        <FormField control={form.control} name="meatType" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs text-slate-600">{L.meatType}</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-9 text-sm rounded-[4px]">
                  <SelectValue placeholder={L.selectMeatType} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>{MEAT_TYPES.map((meat) => <SelectItem key={meat} value={meat} className="text-sm">{meat}</SelectItem>)}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="weightKg" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs text-slate-600">{L.weightKg}</FormLabel>
            <FormControl><Input className="h-9 text-sm rounded-[4px]" type="number" step="0.01" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex gap-3 pt-3">
          {showCancel && <Button type="button" variant="outline" size="sm" onClick={onCancel} className="flex-1 !h-9 text-sm">{L.cancel}</Button>}
          <Button type="submit" disabled={isSubmitting} size="sm" className="flex-1 !h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white">{isSubmitting ? L.saving : (submitText || L.lodgeMeat)}</Button>
        </div>
      </form>
    </Form>
  );
}

export type { MeatForm };
