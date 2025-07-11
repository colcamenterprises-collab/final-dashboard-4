import React, { useEffect, useState } from "react";
import axios from "axios";

interface Discrepancy {
  item: string;
  expected: number;
  actual: number;
  difference: number;
  threshold: number;
  isOutOfBounds: boolean;
  alert: string | null;
}

export const DiscrepancyCard: React.FC = () => {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDiscrepancies = async () => {
      try {
        const res = await axios.get("/api/dashboard/stock-discrepancies");
        setDiscrepancies(res.data.discrepancies);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch stock discrepancies");
      }
    };

    loadDiscrepancies();
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!discrepancies) return <div>Loading stock analysis...</div>;

  return (
    <div className="card">
      <h3>Stock Discrepancy Report</h3>
      <table className="table" style={{ width: "100%", textAlign: "left", marginTop: "10px" }}>
        <thead>
          <tr>
            <th>Item</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Difference</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {discrepancies.map((d, idx) => (
            <tr key={idx} style={{ backgroundColor: d.isOutOfBounds ? "#ffe5e5" : "#f6f6f6" }}>
              <td>{d.item}</td>
              <td>{d.expected}</td>
              <td>{d.actual}</td>
              <td>{d.difference > 0 ? `+${d.difference}` : d.difference}</td>
              <td>
                {d.isOutOfBounds ? (
                  <span style={{ color: "red", fontWeight: "bold" }}>⚠️ {d.alert}</span>
                ) : (
                  <span style={{ color: "green" }}>✅ OK</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
