import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StockLodgementPanels } from "@/components/stock-lodgement/StockLodgementPanels";

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
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!controlledIsOpen && (
        <DialogTrigger asChild>
          <Button className={triggerClassName}>{triggerIcon}{triggerText}</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData?.id ? "Edit" : "Lodge"} Stock Purchase</DialogTitle>
        </DialogHeader>
        <StockLodgementPanels
          mode="tabs"
          initialData={initialData}
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
