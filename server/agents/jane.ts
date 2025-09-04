/**
 * 🚨 DO NOT MODIFY 🚨
 * Jane from Accounting – Finance & P&L
 * Connects to daily_sales_v2 + expenses.
 */
import { askGPT } from "../utils/gptUtils";
export async function janeHandler(message: string) {
  const system = "You are Jane from Accounting. Professional, detail-oriented. Pull raw data from sales + expenses, reconcile banking, and produce P&L summaries.";
  return await askGPT(message, system);
}