import { useEffect, useState } from "react";
import axios from "../../utils/axiosInstance";

interface VarianceItem {
  name: string;
  expected: number;
  used: number;
  variance: number;
  severity: "green" | "yellow" | "red";
}

export default function StockVariance() {
  const [date, setDate] = useState(
    new Date().toISOString().substring(0, 10)
  );
  const [variance, setVariance] = useState<VarianceItem[]>([]);

  const load = async () => {
    const res = await axios.get(`/stock/variance/shift?date=${date}`);
    setVariance(res.data.variance || []);
  };

  useEffect(() => {
    load();
  }, [date]);

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ fontSize: 32, marginBottom: 20 }}>Stock Variance</h1>

      <label style={{ fontSize: 20 }}>
        Select Date:
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ marginLeft: 10, fontSize: 20 }}
        />
      </label>

      <table style={{ width: "100%", marginTop: 30, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#000", color: "#fff", height: 50 }}>
            <th style={{ padding: 10, textAlign: "left" }}>Ingredient</th>
            <th style={{ padding: 10, textAlign: "left" }}>Expected</th>
            <th style={{ padding: 10, textAlign: "left" }}>Used</th>
            <th style={{ padding: 10, textAlign: "left" }}>Variance</th>
            <th style={{ padding: 10, textAlign: "left" }}>Status</th>
          </tr>
        </thead>

        <tbody>
          {variance.map((v) => (
            <tr key={v.name} style={{ borderBottom: "1px solid #ddd", height: 45 }}>
              <td style={{ padding: 10 }}>{v.name}</td>
              <td style={{ padding: 10 }}>{v.expected}</td>
              <td style={{ padding: 10 }}>{v.used}</td>
              <td style={{ padding: 10 }}>{v.variance}</td>
              <td
                style={{
                  padding: 10,
                  color:
                    v.severity === "red"
                      ? "red"
                      : v.severity === "yellow"
                      ? "goldenrod"
                      : "green",
                  fontWeight: "bold"
                }}
              >
                {v.severity.toUpperCase()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
