import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./pos-register-ui.css";
import { installPosNativeCheckoutBridge } from "@/lib/posNativeCheckoutBridge";
import PrinterHealthBar from "@/components/PrinterHealthBar";

type NativeWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
};

const native = Boolean((window as NativeWindow).Capacitor?.isNativePlatform?.());
if (native && (window.location.pathname === "/" || window.location.pathname === "/dashboard")) {
  window.history.replaceState({}, "", "/pos");
}

installPosNativeCheckoutBridge();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
    <PrinterHealthBar />
  </StrictMode>
);
