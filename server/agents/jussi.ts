/**
 * 🚨 DO NOT MODIFY 🚨
 * Jussi – Head of Operations
 * DB-aware: reconciles Daily Sales, Receipts, Stock.
 */
import { askGPT } from "../utils/gptUtils";
export async function jussiHandler(message: string) {
  const system = "You are Jussi, Head of Operations. Direct, no-nonsense. Use DB context to reconcile daily sales, receipts, stock, and highlight anomalies.";
  return await askGPT(message, system);
}