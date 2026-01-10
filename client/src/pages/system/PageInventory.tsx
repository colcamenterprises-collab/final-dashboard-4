import { ROUTE_INVENTORY } from "@/router/RouteRegistry";
import { SIDEBAR_INVENTORY } from "@/components/navigation/ModernSidebar";

export default function PageInventory() {
  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Page Inventory (System Audit)</h1>

      <section>
        <h2 className="text-lg font-semibold mb-2">All Registered Routes</h2>
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="p-2 border">Key</th>
              <th className="p-2 border">Path</th>
              <th className="p-2 border">Title</th>
              <th className="p-2 border">Section</th>
            </tr>
          </thead>
          <tbody>
            {ROUTE_INVENTORY.map(r => (
              <tr key={r.key}>
                <td className="p-2 border">{r.key}</td>
                <td className="p-2 border">{r.path}</td>
                <td className="p-2 border">{r.title}</td>
                <td className="p-2 border">{r.section}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Sidebar Entries</h2>
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="p-2 border">Section</th>
              <th className="p-2 border">Label</th>
              <th className="p-2 border">Path</th>
            </tr>
          </thead>
          <tbody>
            {SIDEBAR_INVENTORY.map((s, i) => (
              <tr key={i}>
                <td className="p-2 border">{s.section}</td>
                <td className="p-2 border">{s.label}</td>
                <td className="p-2 border">{s.path}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
