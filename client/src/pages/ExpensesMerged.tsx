import { Separator } from "@/components/ui/separator";
import { JussiChatBubble } from "@/components/JussiChatBubble";
import { BusinessExpenses } from "@/pages/expenses/BusinessExpenses";
import { PurchaseTallyList } from "@/components/PurchaseTallyList";

function ExpensesMerged() {
  return (
    <div className="bg-app min-h-screen px-6 sm:px-8 py-5">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-[var(--heading)]">Expense Management</h1>
          <p className="text-xs text-[var(--muted)] mt-2">
            Manage business expenses and shift purchases with proper categorization
          </p>
        </div>
      </div>

      {/* Business Expenses Only - Shift Purchasing hidden per requirements */}
      <div className="card">
        <div className="card-inner">
          <BusinessExpenses />
        </div>
      </div>

      {/* Separator */}
      <Separator className="my-8" />

      {/* Purchase Tally Section */}
      <div className="card">
        <div className="card-inner">
          <PurchaseTallyList />
        </div>
      </div>

      {/* Jussi Chat Bubble */}
      <JussiChatBubble />
    </div>
  );
}

export default ExpensesMerged;