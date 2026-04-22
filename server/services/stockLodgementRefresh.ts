export type LodgementItemType = "rolls" | "meat" | "drinks";
export type LodgementIssueCode = "review-required" | "invalid-stock-input" | null;
export type LodgementOutcome = "none" | "active" | "resolved" | "retained" | "downgraded";

export function classifyLedgerIssue(itemType: LodgementItemType, ledger: any): { code: LodgementIssueCode; message: string | null } {
  if (!ledger) return { code: "review-required", message: "No reconciliation ledger row available for shift date." };

  const status = String(ledger.status || "").toUpperCase();
  const purchased = Number(
    itemType === "rolls"
      ? ledger.rolls_purchased
      : itemType === "meat"
        ? ledger.meat_purchased_g
        : ledger.drinks_purchased
  );
  const actual = itemType === "rolls"
    ? ledger.actual_rolls_end
    : itemType === "meat"
      ? ledger.actual_meat_end_g
      : ledger.actual_drinks_end;

  if (actual === null || actual === undefined) {
    return { code: "review-required", message: "Closing stock is missing; review required until valid stock input exists." };
  }
  if (!Number.isFinite(purchased) || purchased <= 0) {
    return { code: "review-required", message: "Purchase/lodgement input is missing or late for this shift." };
  }
  if (status === "ALERT" || status === "WARNING") {
    return { code: "invalid-stock-input", message: "Stock input remains inconsistent after recalculation." };
  }
  return { code: null, message: null };
}

export function deriveIssueOutcome(beforeCode: LodgementIssueCode, afterCode: LodgementIssueCode): LodgementOutcome {
  if (!beforeCode && !afterCode) return "none";
  if (beforeCode && !afterCode) return "resolved";
  if (beforeCode === "invalid-stock-input" && afterCode === "review-required") return "downgraded";
  if (beforeCode === afterCode && afterCode) return "retained";
  return afterCode ? "active" : "none";
}
