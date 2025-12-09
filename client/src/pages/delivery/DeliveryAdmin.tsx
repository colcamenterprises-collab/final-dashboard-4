// PATCH O8 — DELIVERY ADMIN DASHBOARD
import axios from "../../utils/axiosInstance";
import { useEffect, useState } from "react";

type Driver = { id: string; name: string; phone?: string; active: boolean };
type Delivery = {
  id: string;
  orderId: string;
  status: string;
  address?: string;
  fee: number;
  driver?: Driver;
  createdAt: string;
};

export default function DeliveryAdmin() {
  const [active, setActive] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState("");

  const load = () => {
    axios.get("/delivery/active").then(res => setActive(res.data)).catch(() => {});
    axios.get("/delivery/drivers").then(res => setDrivers(res.data)).catch(() => {});
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  const assign = (deliveryId: string) => {
    axios.post("/delivery/assign", {
      deliveryId,
      driverId: selectedDriver
    }).then(load);
  };

  const updateStatus = (deliveryId: string, status: string) => {
    axios.post("/delivery/update-status", { deliveryId, status }).then(load);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Active Deliveries</h1>

      <div className="mb-6">
        <h3 className="font-semibold mb-2">Select Driver to Assign</h3>
        <select 
          className="border p-2 rounded w-full max-w-xs"
          value={selectedDriver}
          onChange={(e) => setSelectedDriver(e.target.value)}
          data-testid="select-driver"
        >
          <option value="">Choose driver</option>
          {drivers.filter(d => d.active).map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {active.length === 0 ? (
        <p className="text-gray-500">No active deliveries</p>
      ) : (
        <div className="space-y-4">
          {active.map((d) => (
            <div key={d.id} className="border rounded p-4 bg-white shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <b className="text-lg">Delivery #{d.id.slice(-6)}</b>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    d.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                    d.status === "assigned" ? "bg-blue-100 text-blue-800" :
                    d.status === "picked_up" ? "bg-purple-100 text-purple-800" :
                    d.status === "on_the_way" ? "bg-orange-100 text-orange-800" :
                    "bg-green-100 text-green-800"
                  }`}>
                    {d.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                {d.fee > 0 && <span className="text-emerald-600 font-semibold">฿{d.fee}</span>}
              </div>
              
              <p className="text-sm text-gray-600 mb-2">
                Driver: {d.driver ? d.driver.name : <span className="text-red-500">Unassigned</span>}
              </p>
              <p className="text-sm text-gray-600 mb-3">
                Address: {d.address || "Pickup"}
              </p>

              <div className="flex flex-wrap gap-2">
                {!d.driver && selectedDriver && (
                  <button 
                    onClick={() => assign(d.id)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                    data-testid="button-assign-driver"
                  >
                    Assign Driver
                  </button>
                )}
                <button 
                  onClick={() => updateStatus(d.id, "picked_up")}
                  className="px-3 py-1 bg-purple-600 text-white rounded text-sm"
                  data-testid="button-picked-up"
                >
                  Picked Up
                </button>
                <button 
                  onClick={() => updateStatus(d.id, "on_the_way")}
                  className="px-3 py-1 bg-orange-600 text-white rounded text-sm"
                  data-testid="button-on-way"
                >
                  On the Way
                </button>
                <button 
                  onClick={() => updateStatus(d.id, "delivered")}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                  data-testid="button-delivered"
                >
                  Delivered
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
