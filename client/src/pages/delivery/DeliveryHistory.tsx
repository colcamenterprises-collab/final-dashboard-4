// PATCH O8 — DELIVERY HISTORY PAGE
import axios from "../../utils/axiosInstance";
import { useEffect, useState } from "react";

type Driver = { id: string; name: string };
type Delivery = {
  id: string;
  orderId: string;
  status: string;
  address?: string;
  fee: number;
  driver?: Driver;
  deliveredAt?: string;
  createdAt: string;
};

export default function DeliveryHistory() {
  const [history, setHistory] = useState<Delivery[]>([]);

  useEffect(() => {
    axios.get("/delivery/history").then((res) => setHistory(res.data)).catch(() => {});
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("en-GB", { 
      day: "2-digit", 
      month: "2-digit", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Delivery History</h1>

      {history.length === 0 ? (
        <p className="text-gray-500">No completed deliveries yet</p>
      ) : (
        <div className="space-y-3">
          {history.map((d) => (
            <div key={d.id} className="border rounded p-4 bg-white shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <b className="text-lg">Delivery #{d.id.slice(-6)}</b>
                  <span className="ml-2 px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                    DELIVERED
                  </span>
                </div>
                <span className="text-emerald-600 font-semibold">฿{d.fee}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Driver: {d.driver ? d.driver.name : "Unknown"}
              </p>
              <p className="text-sm text-gray-600">
                Address: {d.address || "Pickup"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Delivered: {formatDate(d.deliveredAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
