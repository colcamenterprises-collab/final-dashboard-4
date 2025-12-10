import { useEffect, useState } from "react";
import axios from "../../utils/axiosInstance";

interface UsageItem {
  name: string;
  totalUsed: number;
}

export default function IngredientUsage() {
  const [daily, setDaily] = useState<UsageItem[]>([]);
  const [top, setTop] = useState<UsageItem[]>([]);
  const [date, setDate] = useState(
    new Date().toISOString().substring(0, 10)
  );

  const loadDaily = async () => {
    const res = await axios.get(`/analytics/ingredients/daily?date=${date}`);
    setDaily(res.data.usage || []);
  };

  const loadTop = async () => {
    const res = await axios.get(`/analytics/ingredients/top?days=7`);
    setTop(res.data.data || []);
  };

  useEffect(() => {
    loadDaily();
    loadTop();
  }, [date]);

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ fontSize: 32, marginBottom: 20 }}>Ingredient Usage Analytics</h1>

      <label style={{ fontSize: 20 }}>
        Select Date:
        <input
          style={{ fontSize: 20, marginLeft: 10 }}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <h2 style={{ marginTop: 30 }}>Daily Usage</h2>
      <table style={{ width: "100%", marginBottom: 40, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#000", color: "#fff", height: 50 }}>
            <th style={{ padding: 10, textAlign: "left" }}>Ingredient</th>
            <th style={{ padding: 10, textAlign: "left" }}>Used</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((i) => (
            <tr key={i.name} style={{ borderBottom: "1px solid #ddd", height: 45 }}>
              <td style={{ padding: 10 }}>{i.name}</td>
              <td style={{ padding: 10 }}>{i.totalUsed}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Top 10 Ingredients (Last 7 Days)</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#000", color: "#fff", height: 50 }}>
            <th style={{ padding: 10, textAlign: "left" }}>Ingredient</th>
            <th style={{ padding: 10, textAlign: "left" }}>Total Used</th>
          </tr>
        </thead>
        <tbody>
          {top.map((i) => (
            <tr key={i.name} style={{ borderBottom: "1px solid #ddd", height: 45 }}>
              <td style={{ padding: 10 }}>{i.name}</td>
              <td style={{ padding: 10 }}>{i.totalUsed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
