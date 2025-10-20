import { DateTime } from "luxon";

export function shiftWindow(dateISO: string) {
  const base = DateTime.fromISO(dateISO, { zone: "Asia/Bangkok" }).startOf("day");
  const from = base.plus({ hours: 17 });
  const to = base.plus({ days: 1, hours: 3 });
  return {
    shiftDate: base.toISODate()!,
    fromISO: from.toISO()!,
    toISO: to.toISO()!,
  };
}
