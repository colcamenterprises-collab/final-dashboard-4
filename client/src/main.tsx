import { createRoot } from "react-dom/client";

console.log("🟢 main.tsx: BARE METAL BOOT");

const root = document.getElementById("root");

if (root) {
  console.log("🟢 main.tsx: Root found, mounting React");
  createRoot(root).render(
    <div style={{ padding: 40, backgroundColor: "#f0fff0", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 48, color: "green" }}>REACT BOOT OK</h1>
      <p style={{ fontSize: 24 }}>If you see this, React is mounting.</p>
      <p style={{ fontSize: 16, color: "#666" }}>Timestamp: {new Date().toISOString()}</p>
    </div>
  );
  console.log("🟢 main.tsx: Render called");
} else {
  console.error("🔴 main.tsx: Root element not found");
}
