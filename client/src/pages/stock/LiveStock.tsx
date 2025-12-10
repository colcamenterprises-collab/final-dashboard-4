import { useEffect, useState } from "react";
import axios from "../../utils/axiosInstance";
import StockTable from "../../components/StockTable";

interface StockItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  updatedAt: string;
}

export default function LiveStock() {
  const [items, setItems] = useState<StockItem[]>([]);

  const load = async () => {
    const res = await axios.get("/stock/live");
    setItems(res.data.items || []);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ fontSize: 32, marginBottom: 20 }}>Live Stock Levels</h1>
      <StockTable items={items} />
    </div>
  );
}
