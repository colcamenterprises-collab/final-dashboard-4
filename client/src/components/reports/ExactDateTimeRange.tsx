import { useEffect, useMemo } from "react";
import { loadReportingRange, REPORTING_RANGE_EVENT, saveReportingRange } from "./reportingRangeStore";

export type ExactDateTimeRangeValue = {
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  timezone: string;
};

export function reportingRangeParams(value: ExactDateTimeRangeValue): string {
  return new URLSearchParams({
    fromDate: value.fromDate,
    fromTime: value.fromTime,
    toDate: value.toDate,
    toTime: value.toTime,
    timezone: value.timezone,
  }).toString();
}

function sameRange(a: ExactDateTimeRangeValue, b: ExactDateTimeRangeValue) {
  return a.fromDate === b.fromDate
    && a.fromTime === b.fromTime
    && a.toDate === b.toDate
    && a.toTime === b.toTime
    && a.timezone === b.timezone;
}

export function ExactDateTimeRange({
  value,
  onChange,
  timezoneLabel,
}: {
  value: ExactDateTimeRangeValue;
  onChange: (value: ExactDateTimeRangeValue) => void;
  timezoneLabel?: string;
}) {
  useEffect(() => {
    const stored = loadReportingRange();
    if (!sameRange(stored, value)) onChange(stored);

    const handleRangeChange = (event: Event) => {
      const next = (event as CustomEvent<ExactDateTimeRangeValue>).detail;
      if (next && !sameRange(next, value)) onChange(next);
    };
    window.addEventListener(REPORTING_RANGE_EVENT, handleRangeChange);
    return () => window.removeEventListener(REPORTING_RANGE_EVENT, handleRangeChange);
  }, []); // hydrate once when each reporting page opens

  const invalid = useMemo(() => {
    const from = new Date(`${value.fromDate}T${value.fromTime}:00`);
    const to = new Date(`${value.toDate}T${value.toTime}:00`);
    return !value.fromDate || !value.fromTime || !value.toDate || !value.toTime || !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from;
  }, [value]);

  const patch = (key: keyof ExactDateTimeRangeValue, nextValue: string) => {
    const next = { ...value, [key]: nextValue };
    saveReportingRange(next);
    onChange(next);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Reporting date and time range">
      <div className="grid gap-3 md:grid-cols-[1fr_130px_1fr_130px_auto] md:items-end">
        <label className="text-xs font-semibold text-slate-600">
          From date
          <input type="date" value={value.fromDate} onChange={(event) => patch("fromDate", event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          From time
          <input type="time" value={value.fromTime} onChange={(event) => patch("fromTime", event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          To date
          <input type="date" value={value.toDate} onChange={(event) => patch("toDate", event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          To time
          <input type="time" value={value.toTime} onChange={(event) => patch("toTime", event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900" />
        </label>
        <div className="pb-2 text-xs text-slate-500">{timezoneLabel || value.timezone}</div>
      </div>
      {invalid && <p className="mt-3 text-xs font-semibold text-red-600">The end date/time must be after the start date/time.</p>}
    </section>
  );
}

export default ExactDateTimeRange;
