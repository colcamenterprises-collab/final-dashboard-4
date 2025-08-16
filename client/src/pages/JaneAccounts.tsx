export default function JaneAccounts() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Jane — Accounting</h1>
      <p className="text-neutral-600 mb-4">Reconciliation, P&L rollups, vendor statements.</p>
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm text-neutral-500">
          (We'll wire her to statements + receipts for automated reconciliation.)
        </div>
      </div>
    </div>
  );
}