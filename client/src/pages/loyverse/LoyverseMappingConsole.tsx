// PATCH O4 — LOYVERSE MAPPING UI
import { useEffect, useState } from "react";
import axios from "../../utils/axiosInstance";

type MenuItem = {
  id: string;
  name: string;
};

type Mapping = {
  id: string;
  menuItemId: string;
  loyverseItemId?: string;
  modifierName?: string;
  loyverseModifierId?: string;
};

export default function LoyverseMappingConsole() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  useEffect(() => {
    axios.get("/menu-ordering/full").then((res) => {
      const flat = res.data.flatMap((cat: any) => cat.items);
      setMenuItems(flat);
    });
    axios.get("/loyverse-map/all").then((r) => setMappings(r.data));
  }, []);

  const updateMapping = async (menuItemId: string, field: string, value: string) => {
    await axios.post("/loyverse-map/save", {
      menuItemId,
      loyverseItemId: field === "loyverseItemId" ? value : undefined,
    });
    const r = await axios.get("/loyverse-map/all");
    setMappings(r.data);
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Loyverse Mapping Console</h1>

      <div className="space-y-4">
        {menuItems.map((item) => {
          const map = mappings.find((m) => m.menuItemId === item.id) || {} as Mapping;
          return (
            <div key={item.id} className="border p-4 rounded bg-white shadow" data-testid={`mapping-item-${item.id}`}>
              <h2 className="font-bold">{item.name}</h2>
              <input
                className="border p-2 rounded w-full mt-2"
                placeholder="Loyverse Item ID"
                defaultValue={map.loyverseItemId || ""}
                onBlur={(e) =>
                  updateMapping(item.id, "loyverseItemId", e.target.value)
                }
                data-testid={`input-loyverse-id-${item.id}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
