export const REPORTING_TIMEZONE = "Asia/Bangkok";

// Canonical ownership boundary for Smash Brothers Burgers reporting.
// Historical Loyverse owns transactions strictly before this instant.
// SBB POS owns transactions at or after this instant.
export const SBB_REPORTING_CUTOVER_ISO = "2026-08-09T03:00:00+07:00";

export type ReportingSourceSystem = "loyverse" | "sbb_pos";

export function sourceOwnsTimestamp(source: ReportingSourceSystem, occurredAt: Date): boolean {
  const cutover = new Date(SBB_REPORTING_CUTOVER_ISO).getTime();
  const value = occurredAt.getTime();
  if (!Number.isFinite(value)) return false;
  return source === "loyverse" ? value < cutover : value >= cutover;
}

export function assertValidReportingRange(from: Date, to: Date): void {
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
    throw new Error("Reporting range contains an invalid date/time");
  }
  if (to <= from) {
    throw new Error("Reporting end date/time must be after start date/time");
  }
}
