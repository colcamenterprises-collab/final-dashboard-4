import type { ExactDateTimeRangeValue } from "./ExactDateTimeRange";

const STORAGE_KEY = "sbb.reporting.range.v1";
const TIMEZONE = "Asia/Bangkok";

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function defaultReportingRange(): ExactDateTimeRangeValue {
  return {
    fromDate: localDate(-1),
    fromTime: "17:55",
    toDate: localDate(),
    toTime: "02:15",
    timezone: TIMEZONE,
  };
}

export function loadReportingRange(): ExactDateTimeRangeValue {
  const fallback = defaultReportingRange();
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ExactDateTimeRangeValue>;
    if (!parsed.fromDate || !parsed.fromTime || !parsed.toDate || !parsed.toTime) return fallback;
    return {
      fromDate: parsed.fromDate,
      fromTime: parsed.fromTime,
      toDate: parsed.toDate,
      toTime: parsed.toTime,
      timezone: parsed.timezone || TIMEZONE,
    };
  } catch {
    return fallback;
  }
}

export function saveReportingRange(value: ExactDateTimeRangeValue) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("sbb-reporting-range-change", { detail: value }));
}

export function reportingRangeLabel(value: ExactDateTimeRangeValue) {
  return `${value.fromDate} ${value.fromTime} → ${value.toDate} ${value.toTime}`;
}

export const REPORTING_RANGE_EVENT = "sbb-reporting-range-change";
