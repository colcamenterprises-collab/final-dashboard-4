export default function SourceHealthPanel({ source }: { source: any }) { return <pre className="text-xs bg-slate-50 p-3 rounded">{JSON.stringify(source, null, 2)}</pre>; }
