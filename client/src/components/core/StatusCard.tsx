export default function StatusCard({ label, value }: { label: string; value: any }) {
  return <div className="rounded border p-3 bg-white"><div className="text-xs text-slate-500">{label}</div><div className="text-sm font-semibold text-slate-900">{value ?? 'Missing'}</div></div>;
}
