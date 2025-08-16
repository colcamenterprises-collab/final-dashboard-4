export default function ProfitLoss() {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Profit & Loss</h1>
      <p className="text-neutral-600 mb-4">Monthly P&L reporting with Jan–Dec columns.</p>
      <div className="rounded-2xl border bg-white p-5 shadow-sm overflow-x-auto">
        <table className="min-w-[800px] w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2">Account</th>
              {months.map(m => <th key={m} className="text-right p-2">{m}</th>)}
              <th className="text-right p-2">YTD</th>
            </tr>
          </thead>
          <tbody>
            {["Sales","COGS","Gross Profit","Expenses","Net Profit"].map(row => (
              <tr key={row} className="border-t">
                <td className="p-2 font-medium">{row}</td>
                {months.map(m => <td key={m} className="p-2 text-right">0</td>)}
                <td className="p-2 text-right font-semibold">0</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}