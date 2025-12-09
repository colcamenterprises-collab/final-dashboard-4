import React, { useEffect, useState } from "react";
import axios from "axios";

export default function ModifiersEditor() {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");

  const [newModifier, setNewModifier] = useState({
    name: "",
    price: "",
    groupId: ""
  });

  async function load() {
    const res = await axios.get("/api/menu-v3/modifiers/groups");
    setGroups(res.data);
  }

  async function createGroup() {
    await axios.post("/api/menu-v3/modifiers/groups/create", {
      name: newGroupName
    });
    setNewGroupName("");
    load();
  }

  async function addModifier() {
    await axios.post("/api/menu-v3/modifiers/create", {
      groupId: newModifier.groupId,
      name: newModifier.name,
      price: parseFloat(newModifier.price)
    });
    load();
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <h2>Modifiers</h2>

      {/* Group create */}
      <div style={{ marginBottom: "20px" }}>
        <input
          placeholder="Group name"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
        />
        <button onClick={createGroup}>Add Group</button>
      </div>

      {/* Modifier create */}
      <div style={{ marginBottom: "20px" }}>
        <select
          value={newModifier.groupId}
          onChange={(e) =>
            setNewModifier({ ...newModifier, groupId: e.target.value })
          }
        >
          <option value="">Select Group</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        <input
          placeholder="Modifier name"
          value={newModifier.name}
          onChange={(e) =>
            setNewModifier({ ...newModifier, name: e.target.value })
          }
        />

        <input
          placeholder="Price"
          value={newModifier.price}
          onChange={(e) =>
            setNewModifier({ ...newModifier, price: e.target.value })
          }
        />

        <button onClick={addModifier}>Add Modifier</button>
      </div>

      {/* List */}
      {groups.map((g) => (
        <div key={g.id} style={{ marginBottom: "20px" }}>
          <h3>{g.name}</h3>
          <ul>
            {g.modifiers.map((m) => (
              <li key={m.id}>
                {m.name} — ฿{m.price}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
