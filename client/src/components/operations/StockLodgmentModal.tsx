import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StockLodgementPanels } from "@/components/stock-lodgement/StockLodgementPanels";

const modalLabels = {
  en: { lodge: "Lodge", edit: "Edit", stockPurchase: "Stock Purchase" },
  th: { lodge: "บันทึก", edit: "แก้ไข", stockPurchase: "การซื้อสต็อก" },
};

interface StockLodgmentModalProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  triggerClassName?: string;
  triggerText?: string;
  triggerIcon?: React.ReactNode;
  initialData?: {
    type: "rolls" | "meat" | "drinks";
    id?: number;
    date?: string;
    quantity?: number;
    cost?: number;
    paid?: boolean;
    meatType?: string;
    weightKg?: number;
    drinkType?: string;
  };
}

export function StockLodgmentModal({ isOpen: controlledIsOpen, onOpenChange, onSuccess, triggerClassName, triggerText = "Lodge Stock Purchase", triggerIcon, initialData }: StockLodgmentModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [lang, setLang] = useState<"en" | "th">("en");
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;
  const L = modalLabels[lang];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!controlledIsOpen && (
        <DialogTrigger asChild>
          <Button className={triggerClassName}>{triggerIcon}{triggerText}</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>{initialData?.id ? L.edit : L.lodge} {L.stockPurchase}</DialogTitle>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-medium ${lang === 'en' ? 'text-emerald-600' : 'text-slate-600'}`}>EN</span>
              <button
                type="button"
                className="relative w-10 h-5 rounded-full border-2 transition-all duration-300 bg-emerald-500 border-emerald-500"
                onClick={() => setLang(lang === 'en' ? 'th' : 'en')}
              >
                <div className={`absolute top-0 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${lang === 'en' ? 'left-0' : 'left-5'}`} />
              </button>
              <span className={`text-xs font-medium ${lang === 'th' ? 'text-emerald-600' : 'text-slate-600'}`}>ไทย</span>
            </div>
          </div>
        </DialogHeader>
        <StockLodgementPanels
          mode="tabs"
          initialData={initialData}
          lang={lang}
          onCancel={() => setIsOpen(false)}
          onSuccess={() => {
            setIsOpen(false);
            onSuccess?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
