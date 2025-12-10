interface StockItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  updatedAt: string;
}

interface StockTableProps {
  items: StockItem[];
}

export default function StockTable({ items }: StockTableProps) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#000", color: "#fff", height: 50 }}>
          <th style={{ padding: 10, textAlign: "left" }}>Ingredient</th>
          <th style={{ padding: 10, textAlign: "left" }}>Qty</th>
          <th style={{ padding: 10, textAlign: "left" }}>Unit</th>
          <th style={{ padding: 10, textAlign: "left" }}>Updated</th>
        </tr>
      </thead>

      <tbody>
        {items.map((i) => (
          <tr key={i.id} style={{ borderBottom: "1px solid #ddd", height: 45 }}>
            <td style={{ padding: 10 }}>{i.name}</td>
            <td style={{ padding: 10 }}>{i.qty}</td>
            <td style={{ padding: 10 }}>{i.unit}</td>
            <td style={{ padding: 10 }}>
              {new Date(i.updatedAt).toLocaleString("en-GB")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
