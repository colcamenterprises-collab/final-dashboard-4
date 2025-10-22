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

export interface BankingCalc {
  startingCash: Money;
  cashPayments: Money;
  qrPayments: Money;
  expensesTotal: Money;
  expectedCash: Money;
  estimatedNetBanked: Money;
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
  banking: BankingCalc;
}

export type Availability = "ok" | "missing_pos" | "missing_form" | "missing_both";

export interface DailyComparisonResponse {
  date: string;
  availability: Availability;
  pos?: DailySource;
  form?: DailySource;
  variance?: {
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
