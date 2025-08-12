import { useState } from "react";
import { ShoppingCart, Building2 } from "lucide-react";
import { JussiChatBubble } from "@/components/JussiChatBubble";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessExpenses } from "@/pages/expenses/BusinessExpenses";
import { ShiftPurchasing } from "@/pages/expenses/ShiftPurchasing";

function ExpensesMerged() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Expense Management</h1>
          <p className="text-muted-foreground">
            Manage business expenses and shift purchases with proper categorization
          </p>
        </div>
      </div>

      {/* Tabbed Interface */}
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

        <TabsContent value="business" className="space-y-6">
          <BusinessExpenses />
        </TabsContent>

        <TabsContent value="purchasing" className="space-y-6">
          <ShiftPurchasing />
        </TabsContent>
      </Tabs>

      {/* Jussi Chat Bubble */}
      <JussiChatBubble />
    </div>
  );
}

export default ExpensesMerged;