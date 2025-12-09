// PATCH O7 — PARTNER BAR ADMIN PAGE
import axios from "axios";
import { useEffect, useState } from "react";

type PartnerBar = {
  id: string;
  name: string;
  code: string;
  contactName: string | null;
  phone: string | null;
};

export default function PartnerBars() {
  const [bars, setBars] = useState<PartnerBar[]>([]);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    axios.get("/api/partners/all").then((res) => setBars(res.data));
  }, []);

  const createBar = () => {
    axios
      .post("/api/partners/create", { name, contactName, phone })
      .then(() => axios.get("/api/partners/all").then((res) => setBars(res.data)));
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Partner Bars</h1>

      <div style={{ marginBottom: 20 }}>
        <h3>Create Partner Bar</h3>
        <input placeholder="Bar Name" onChange={(e) => setName(e.target.value)} data-testid="input-bar-name" />
        <input placeholder="Contact Name" onChange={(e) => setContactName(e.target.value)} data-testid="input-contact-name" />
        <input placeholder="Phone" onChange={(e) => setPhone(e.target.value)} data-testid="input-phone" />
        <button onClick={createBar} data-testid="button-create-partner">Create</button>
      </div>

      <h3>Existing Partners</h3>
      {bars.map((b) => (
        <div key={b.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }} data-testid={`partner-card-${b.id}`}>
          <b>{b.name}</b><br />
          Code: {b.code}<br />
          Contact: {b.contactName || "—"}<br />
          Phone: {b.phone || "—"}
        </div>
      ))}
    </div>
  );
}
