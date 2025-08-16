// src/pages/DailySalesStock.tsx
// Placeholder shell. Your locked Prisma forms render inside this page.
export default function DailySalesStock() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-4">Daily Sales & Stock</h1>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <p className="mb-2">
          Form 1 → Sales/Cash/Expenses. On submit, auto-route to Form 2.
        </p>
        <p className="mb-4">
          Form 2 → Stock Counts & Purchasing. On completion → email + PDF.
        </p>
        <div className="text-sm text-neutral-500">
          (Your existing form components go here.)
        </div>
      </div>
    </div>
  );
}