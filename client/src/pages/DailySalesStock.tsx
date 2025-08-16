// src/pages/DailySalesStock.tsx
export default function DailySalesStock() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-4">Daily Sales & Stock</h1>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <p className="mb-2">Form 1 → Sales/Cash/Expenses. Then auto-route to Form 2.</p>
        <p className="mb-4">Form 2 → Stock Counts & Purchasing. Completion → Email + PDF.</p>
        <div className="text-sm text-neutral-500">(Mount your locked Prisma forms here.)</div>
      </div>
    </div>
  );
}