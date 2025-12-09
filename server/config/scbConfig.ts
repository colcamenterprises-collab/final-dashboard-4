// PATCH O6 — SCB CONFIG (MODE SWITCH ENABLED, SAFE)
export const SCB_MODE = process.env.SCB_MODE || "dry"; 
// modes: "dry" | "sandbox" | "live"

// Placeholder credentials (NOT USED unless live mode is activated)
export const SCB_CONFIG = {
  clientId: process.env.SCB_CLIENT_ID || "",
  clientSecret: process.env.SCB_CLIENT_SECRET || "",
  merchantId: process.env.SCB_MERCHANT_ID || "",
  billerId: process.env.SCB_BILLER_ID || "",
};
