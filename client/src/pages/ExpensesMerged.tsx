import { useState } from "react";
import { ShoppingCart, Building2 } from "lucide-react";
import { JussiChatBubble } from "@/components/JussiChatBubble";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessExpenses } from "@/pages/expenses/BusinessExpenses";
import { ShiftPurchasing } from "@/pages/expenses/ShiftPurchasing";

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

      {/* Tabbed Interface */}
      <div className="card">
        <div className="card-inner">
          <Tabs defaultValue="business" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="business" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Business Expenses
              </TabsTrigger>
              <TabsTrigger value="purchasing" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Shift Purchasing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="business" className="mt-6">
              <BusinessExpenses />
            </TabsContent>

            <TabsContent value="purchasing" className="mt-6">
              <ShiftPurchasing />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Jussi Chat Bubble */}
      <JussiChatBubble />
    </div>
  );
}

export default ExpensesMerged;