import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initTabletFixes } from "./utils/tabletFix";

// Initialize tablet fixes for responsive design
initTabletFixes();

createRoot(document.getElementById("root")!).render(<App />);
