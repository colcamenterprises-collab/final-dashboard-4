import { useEffect, useState } from "react";
import StatusCard from "@/components/core/StatusCard";

export default function Home() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/core/dashboard', { credentials: 'include' }).then(r=>r.json()).then(setData); }, []);
  return <div className="max-w-5xl space-y-4"><h1 className="text-2xl font-semibold text-slate-900">Command Center</h1><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <StatusCard label="Current Shift Date" value={data?.shiftDate ?? 'Missing'} />
    <StatusCard label="Shift Window" value={data?.shiftWindow ?? 'Missing'} />
    <StatusCard label="POS Status" value={data?.pos?.connected ? 'Connected' : 'Disconnected'} />
    <StatusCard label="Latest Receipt Time" value={data?.pos?.latestReceiptDate ?? 'Missing'} />
    <StatusCard label="Latest Shift Report Date" value={data?.pos?.latestShiftReportDate ?? 'Missing'} />
    <StatusCard label="Daily Sales V2" value={data?.shift?.dailySalesFormStatus ?? 'Missing'} />
    <StatusCard label="Daily Stock V2" value={data?.shift?.dailyStockFormStatus ?? 'Missing'} />
    <StatusCard label="Purchasing" value={data?.shift?.purchasingStatus ?? 'Missing'} />
    <StatusCard label="Alert Count" value={data?.alerts?.count ?? 'Missing'} />
  </div></div>;
}
