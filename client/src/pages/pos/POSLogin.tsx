import React, { useState } from "react";
import axios from "../../utils/axiosInstance";

const VALID_PINS = ["1111", "2222", "3333"];

export default function POSLogin() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (VALID_PINS.includes(pin)) {
      localStorage.setItem("pos_logged_in", "true");
      window.location.href = "/pos";
    } else {
      setError("Invalid PIN");
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>POS Login</h1>
      <input
        type="password"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="Enter PIN"
        style={{ fontSize: 24, padding: 10, width: "60%" }}
      />
      <br /><br />
      <button onClick={handleLogin} style={{ fontSize: 24, padding: 10 }}>
        Login
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
