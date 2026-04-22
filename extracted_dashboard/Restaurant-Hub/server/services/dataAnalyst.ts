import { db } from "../db";
import { loyverseShiftReports } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { loyverseReceiptService } from "./loyverseReceipts";

type AnalysisItem = {
  name: string;
  quantity: number;
  totalSales: number;
};

type AnalysisModifier = {
  name: string;
  option: string;
  count: number;
  totalAmount: number;
};

type AnalysisBlocker = {
  code: string;
  message: string;
  where: string;
  canonical_source: string;
  auto_build_attempted: boolean;
};

export interface DailyAnalysisResult {
  shift: {
    reportId: string;
    shiftDate: string;
    shiftStart: string;
    shiftEnd: string;
    totalSales: string;
    totalReceipts: number;
  } | null;
  drinks: AnalysisItem[];
  burgers: AnalysisItem[];
  sides: AnalysisItem[];
  modifiers: AnalysisModifier[];
  blockers: AnalysisBlocker[];
}

function parseReceiptItems(receipt: any): any[] {
  try {
    if (Array.isArray(receipt.items)) {
      return receipt.items;
    }

    if (typeof receipt.items === "string") {
      return JSON.parse(receipt.items);
    }

    if (Array.isArray(receipt.rawData?.line_items)) {
      return receipt.rawData.line_items;
    }
  } catch (error) {
    console.error("Data Analyst: failed to parse receipt items:", error);
  }

  return [];
}

function normalizeItemName(item: any): string {
  return item.item_name || item.name || "UNKNOWN_ITEM";
}

function classifyItem(name: string): "drinks" | "burgers" | "sides" | "other" {
  const normalized = name.toLowerCase();

  if (
    normalized.includes("coke") ||
    normalized.includes("sprite") ||
    normalized.includes("fanta") ||
    normalized.includes("water") ||
    normalized.includes("juice") ||
    normalized.includes("soda") ||
    normalized.includes("schweppes")
  ) {
    return "drinks";
  }

  if (
    normalized.includes("burger") ||
    normalized.includes("smash") ||
    normalized.includes("meal set") ||
    normalized.includes("set (meal") ||
    normalized.includes("meal deal")
  ) {
    return "burgers";
  }

  if (
    normalized.includes("fries") ||
    normalized.includes("nugget") ||
    normalized.includes("onion ring") ||
    normalized.includes("side")
  ) {
    return "sides";
  }

  return "other";
}

function sortByQuantity(items: AnalysisItem[]) {
  return items.sort((a, b) => b.quantity - a.quantity);
}

export async function getDailyAnalysis(shiftDate?: string): Promise<DailyAnalysisResult> {
  const blockers: AnalysisBlocker[] = [];

  const shiftRows = shiftDate
    ? await db
        .select()
        .from(loyverseShiftReports)
        .where(eq(loyverseShiftReports.shiftDate, shiftDate))
        .limit(1)
    : await db.select().from(loyverseShiftReports).orderBy(desc(loyverseShiftReports.shiftDate)).limit(1);

  if (!shiftRows.length) {
    blockers.push({
      code: "SHIFT_NOT_FOUND",
      message: shiftDate
        ? `No shift report found for date ${shiftDate}`
        : "No shift report found for latest date",
      where: "loyverseShiftReports",
      canonical_source: "loyverse_shift_reports",
      auto_build_attempted: false,
    });

    return {
      shift: null,
      drinks: [],
      burgers: [],
      sides: [],
      modifiers: [],
      blockers,
    };
  }

  const shift = shiftRows[0];
  const receipts = await loyverseReceiptService.getReceiptsByDateRange(
    new Date(shift.shiftStart),
    new Date(shift.shiftEnd),
  );

  const drinkMap: Record<string, AnalysisItem> = {};
  const burgerMap: Record<string, AnalysisItem> = {};
  const sideMap: Record<string, AnalysisItem> = {};
  const modifierMap: Record<string, AnalysisModifier> = {};
  const uncategorizedItems = new Set<string>();

  receipts.forEach((receipt: any) => {
    const items = parseReceiptItems(receipt);

    items.forEach((item: any) => {
      const name = normalizeItemName(item);
      const quantity = parseInt(item.quantity || "1");
      const totalSales = parseFloat(item.total_money || item.gross_total_money || item.price || "0");
      const bucket = classifyItem(name);

      const upsert = (collection: Record<string, AnalysisItem>) => {
        if (!collection[name]) {
          collection[name] = { name, quantity: 0, totalSales: 0 };
        }
        collection[name].quantity += quantity;
        collection[name].totalSales += totalSales;
      };

      if (bucket === "drinks") {
        upsert(drinkMap);
      } else if (bucket === "burgers") {
        upsert(burgerMap);
      } else if (bucket === "sides") {
        upsert(sideMap);
      } else {
        uncategorizedItems.add(name);
      }

      if (Array.isArray(item.line_modifiers)) {
        item.line_modifiers.forEach((modifier: any) => {
          const modifierName = modifier.name || "UNKNOWN_MODIFIER";
          const option = modifier.option || modifierName;
          const key = `${modifierName}:${option}`;
          const amount = parseFloat(modifier.money_amount || "0");

          if (!modifierMap[key]) {
            modifierMap[key] = {
              name: modifierName,
              option,
              count: 0,
              totalAmount: 0,
            };
          }

          modifierMap[key].count += 1;
          modifierMap[key].totalAmount += amount;
        });
      }
    });
  });

  if (uncategorizedItems.size > 0) {
    blockers.push({
      code: "UNMAPPED_ITEMS",
      message: `${uncategorizedItems.size} item(s) are not mapped to drinks, burgers, or sides`,
      where: "receipts.line_items",
      canonical_source: "loyverse_receipts",
      auto_build_attempted: false,
    });
  }

  return {
    shift: {
      reportId: shift.reportId,
      shiftDate: shift.shiftDate,
      shiftStart: shift.shiftStart,
      shiftEnd: shift.shiftEnd,
      totalSales: shift.totalSales,
      totalReceipts: receipts.length,
    },
    drinks: sortByQuantity(Object.values(drinkMap)),
    burgers: sortByQuantity(Object.values(burgerMap)),
    sides: sortByQuantity(Object.values(sideMap)),
    modifiers: Object.values(modifierMap).sort((a, b) => b.count - a.count),
    blockers,
  };
}
