// src/pages/DailySalesLibrary.tsx
// Minimal render to verify route + page wiring. Replace list with real data.
type Row = { id: string; submittedAt: string };

const mock: Row[] = [
  { id: "demo-1", submittedAt: "2025-08-15T03:00:00+07:00" },
  { id: "demo-2", submittedAt: "2025-08-14T03:00:00+07:00" },
];

export default function DailySalesLibrary() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-4">Daily Sales Library</h1>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mock.map((m) => (
            <div key={m.id} className="border rounded-xl p-4">
              <div className="font-semibold">
                {new Date(m.submittedAt).toLocaleString()}
              </div>
              <div className="text-sm text-neutral-500">ID: {m.id}</div>
              <div className="mt-3 flex gap-2">
                <button className="px-3 py-1 border rounded-lg">View PDF</button>
                <button className="px-3 py-1 border rounded-lg">Archive</button>
              </div>
            </div>
          ))}
        </div>
        <div className="text-sm text-neutral-500 mt-4">
          (Replace mock data with Prisma query; title should be submission date.)
        </div>
      </div>
    </div>
  );
}