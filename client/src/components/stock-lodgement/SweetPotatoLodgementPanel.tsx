import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const sweetPotatoSchema = z.object({
  staffName: z.string().trim().min(1, "Staff Name is required"),
  sweetPotatoGrams: z.number().min(1, "Quantity must be at least 1g"),
});

type SweetPotatoForm = z.infer<typeof sweetPotatoSchema>;

interface SweetPotatoLodgementPanelProps {
  isSubmitting?: boolean;
  showCancel?: boolean;
  onCancel?: () => void;
  onSubmit: (data: SweetPotatoForm) => void;
  lang?: "en" | "th";
}

export function SweetPotatoLodgementPanel({ isSubmitting, showCancel, onCancel, onSubmit, lang = "en" }: SweetPotatoLodgementPanelProps) {
  const form = useForm<SweetPotatoForm>({
    resolver: zodResolver(sweetPotatoSchema),
    defaultValues: { staffName: "", sweetPotatoGrams: 0 },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField control={form.control} name="staffName" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs text-slate-600">Staff Name</FormLabel>
            <FormControl><Input className="h-9 text-sm rounded-[4px]" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <p className="text-xs text-slate-500">Date and timestamp are recorded automatically (Asia/Bangkok) when submitted.</p>

        <FormField control={form.control} name="sweetPotatoGrams" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs text-slate-600">Quantity (grams)</FormLabel>
            <FormControl>
              <Input
                className="h-9 text-sm rounded-[4px]"
                type="number"
                step="1"
                inputMode="numeric"
                {...field}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === "" ? 0 : parseInt(raw, 10);
                  field.onChange(isNaN(parsed) ? 0 : parsed);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex gap-3 pt-3">
          {showCancel && <Button type="button" variant="outline" size="sm" onClick={onCancel} className="flex-1 !h-9 text-sm">Cancel</Button>}
          <Button type="submit" disabled={isSubmitting} size="sm" className="flex-1 !h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white">
            {isSubmitting ? "Saving..." : "Lodge Sweet Potato"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export type { SweetPotatoForm };
