import PageShell from "@/layouts/PageShell";

export default function ShiftReports() {
  return (
    <PageShell>
      <div className="space-y-6">
        <h1 className="h1">Shift Reports</h1>
        <div className="rounded-2xl border bg-white p-6">
          <p className="text-sm text-neutral-600 mb-4">
            Daily sales + stock, expenses, and checklist summaries.
          </p>
          <div className="text-center py-8 text-gray-500">
            <p>Report history will be displayed here.</p>
            <p className="text-sm mt-2">Table or list of last 30 reports coming soon.</p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}