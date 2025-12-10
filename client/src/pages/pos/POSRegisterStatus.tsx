import React, { useEffect, useState } from "react";
import axios from "../../utils/axiosInstance";

export default function POSRegisterStatus() {
  const [status, setStatus] = useState("checking");

  const load = async () => {
    const res = await axios.get("/api/pos/register/status");
    setStatus(res.data.status);
  };

  const openRegister = async () => {
    await axios.post("/api/pos/register/open");
    load();
  };

  const closeRegister = async () => {
    await axios.post("/api/pos/register/close");
    load();
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>Register Status</h1>
      <h2>Current: {status}</h2>

      {status === "closed" && (
        <button onClick={openRegister} style={{ fontSize: 22, padding: 10 }}>
          Open Register
        </button>
      )}

      {status === "open" && (
        <button onClick={closeRegister} style={{ fontSize: 22, padding: 10 }}>
          Close Register
        </button>
      )}
    </div>
  );
}
