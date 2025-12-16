import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("🟢 main.tsx: SCRIPT START");

// Force light mode - remove dark class if present
document.documentElement.classList.remove("dark");
localStorage.removeItem("restaurant-ui-theme");

const rootElement = document.getElementById("root");
console.log("🟢 main.tsx: Root element found:", !!rootElement);

if (rootElement) {
  console.log("🟢 main.tsx: Creating React root...");
  const root = createRoot(rootElement);
  console.log("🟢 main.tsx: Rendering App...");
  root.render(<App />);
  console.log("🟢 main.tsx: App render called");
} else {
  console.error("🔴 main.tsx: ROOT ELEMENT NOT FOUND!");
  document.body.innerHTML = '<h1 style="color:red;padding:40px;">FATAL: #root element not found</h1>';
}
