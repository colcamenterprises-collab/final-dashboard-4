// PATCH O7 — PARTNER PERFORMANCE DASHBOARD
import axios from "axios";
import { useEffect, useState } from "react";

type PartnerStat = {
  id: string;
  name: string;
  code: string;
  orders: number;
  revenue: number;
};

export default function PartnerAnalytics() {
  const [stats, setStats] = useState<PartnerStat[]>([]);

  useEffect(() => {
    axios.get("/api/partners/analytics").then((res) => setStats(res.data));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Partner Performance</h1>

      {stats.map((s) => (
        <div key={s.id} style={{ marginBottom: 15, border: "1px solid #ccc", padding: 10 }} data-testid={`partner-stat-${s.id}`}>
          <b>{s.name}</b><br />
          Code: {s.code}<br />
          Orders: {s.orders}<br />
          Revenue: ฿{s.revenue}<br />
        </div>
      ))}
    </div>
  );
}
