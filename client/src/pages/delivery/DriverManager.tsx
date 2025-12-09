// PATCH O8 — DRIVER MANAGER UI
import axios from "../../utils/axiosInstance";
import { useEffect, useState } from "react";

type Driver = { id: string; name: string; phone?: string; active: boolean; createdAt: string };

export default function DriverManager() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const load = () => {
    axios.get("/delivery/drivers").then(res => setDrivers(res.data)).catch(() => {});
  };

  const add = () => {
    if (!name.trim()) return;
    axios.post("/delivery/drivers/add", { name, phone }).then(() => {
      load();
      setName("");
      setPhone("");
    });
  };

  const toggle = (id: string, active: boolean) => {
    axios.post("/delivery/drivers/status", { driverId: id, active }).then(load);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Driver Management</h1>

      <div className="mb-6 p-4 border rounded bg-gray-50">
        <h3 className="font-semibold mb-3">Add New Driver</h3>
        <div className="flex gap-2 flex-wrap">
          <input 
            className="border p-2 rounded flex-1 min-w-[150px]"
            placeholder="Name *" 
            value={name}
            onChange={(e) => setName(e.target.value)} 
            data-testid="input-driver-name"
          />
          <input 
            className="border p-2 rounded flex-1 min-w-[150px]"
            placeholder="Phone" 
            value={phone}
            onChange={(e) => setPhone(e.target.value)} 
            data-testid="input-driver-phone"
          />
          <button 
            onClick={add}
            className="px-4 py-2 bg-emerald-600 text-white rounded"
            data-testid="button-add-driver"
          >
            Add Driver
          </button>
        </div>
      </div>

      <h3 className="font-semibold mb-3">Driver List</h3>
      {drivers.length === 0 ? (
        <p className="text-gray-500">No drivers registered</p>
      ) : (
        <div className="space-y-3">
          {drivers.map((d) => (
            <div key={d.id} className="border rounded p-4 bg-white flex justify-between items-center">
              <div>
                <b className="text-lg">{d.name}</b>
                <span className={`ml-2 px-2 py-1 rounded text-xs ${
                  d.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}>
                  {d.active ? "Active" : "Inactive"}
                </span>
                <p className="text-sm text-gray-600 mt-1">
                  {d.phone || "No phone"}
                </p>
              </div>
              <button 
                onClick={() => toggle(d.id, !d.active)}
                className={`px-3 py-1 rounded text-sm ${
                  d.active ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                }`}
                data-testid={`button-toggle-${d.id}`}
              >
                {d.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
