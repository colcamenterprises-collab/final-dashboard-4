import PageShell from "@/layouts/PageShell";

export default function JussiOps() {
  return (
    <PageShell>
      <div className="space-y-6">
        <h1 className="h1">Jussi — Ops AI</h1>
        <div className="rounded-2xl border bg-white p-5 h-[520px] grid place-items-center text-neutral-400">
          <div className="text-center">
            <div className="text-4xl mb-4">🤖</div>
            <p className="text-lg font-medium mb-2">Jussi AI Assistant</p>
            <p className="text-sm">Chat panel placeholder (connected to Upload/Receipts when ready)</p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}