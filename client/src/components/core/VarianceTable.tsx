export default function VarianceTable({ data }: { data: Record<string, any> }) { return <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto">{JSON.stringify(data, null, 2)}</pre>; }
