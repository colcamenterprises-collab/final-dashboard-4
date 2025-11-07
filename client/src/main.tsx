import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Force light mode - remove dark class if present
document.documentElement.classList.remove("dark");
localStorage.removeItem("restaurant-ui-theme");

createRoot(document.getElementById("root")!).render(<App />);
