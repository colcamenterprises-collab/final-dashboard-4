export type Money = number;

export interface SalesBreakdown {
  cash: Money;
  qr: Money;
  grab: Money;
  other: Money;
  total: Money;
}

export interface ExpenseItem {
  id: string;
  label: string;
  amount: Money;
  category: "shopping" | "wage" | "other";
}

export interface DailySource {
  date: string;
  sales: SalesBreakdown;
  expenses: {
    shoppingTotal: Money;
    wageTotal: Money;
    otherTotal: Money;
    items: ExpenseItem[];
  };
  banking: {
    startingCash: Money;
    cashPayments: Money;
    qrPayments: Money;
    expensesTotal: Money;
    expectedCash: Money;
    estimatedNetBanked: Money;
  };
}

export interface ExpenseItemVariance {
  id: string;
  label: string;
  posAmount: Money;
  formAmount: Money;
  variance: Money;
  category: "shopping" | "wage" | "other";
}

export interface DailyComparisonResponse {
  date: string;
  pos: DailySource;
  form: DailySource;
  variance: {
    sales: Record<keyof SalesBreakdown, Money>;
    expenses: {
      shoppingTotal: Money;
      wageTotal: Money;
      otherTotal: Money;
      grandTotal: Money;
    };
    banking: {
      expectedCash: Money;
      estimatedNetBanked: Money;
    };
  };
}
