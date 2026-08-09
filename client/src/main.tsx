import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./pos-register-ui.css";
import { installPosNativeCheckoutBridge } from "@/lib/posNativeCheckoutBridge";

installPosNativeCheckoutBridge();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
