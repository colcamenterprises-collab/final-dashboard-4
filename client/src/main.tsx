import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

document.documentElement.classList.remove("dark");
localStorage.removeItem("restaurant-ui-theme");

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(<App />);
} else {
  document.body.innerHTML = '<h1 style="color:red;padding:40px;">FATAL: #root element not found</h1>';
}
