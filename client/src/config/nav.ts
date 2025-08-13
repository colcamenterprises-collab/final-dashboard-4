// src/config/nav.ts
export const NAV = [
  {
    group: "Sales & Operations",
    items: [
      { label: "Dashboard", path: "/" },
      { label: "Daily Sales & Stock", path: "/daily-stock-sales" },
      { label: "Purchasing (Shift)", path: "/expenses/purchasing" },
      { label: "Expenses (Business)", path: "/expenses/business" },
      { label: "Analysis", path: "/analysis" }
    ],
  },
  {
    group: "Finance",
    items: [
      { label: "Reports", path: "/reports-analysis" },
      { label: "Exports", path: "/exports" },
    ],
  },
  {
    group: "System",
    items: [
      { label: "Security Status", path: "/system/status" },
      { label: "POS Management", path: "/pos-loyverse" },
    ],
  },
];