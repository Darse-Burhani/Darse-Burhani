import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./fatimi-theme.css";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { registerServiceWorker } from "@/lib/pwa";
import App from "./App";

// Register PWA Service Worker for offline resilience and home screen installation
registerServiceWorker();

// Auto-recover if a new production deployment has replaced hashed asset chunks
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    const lastReload = sessionStorage.getItem("chunk_reload_time");
    const now = Date.now();
    // Throttled reload to avoid infinite loop
    if (!lastReload || now - Number(lastReload) > 8000) {
      sessionStorage.setItem("chunk_reload_time", String(now));
      window.location.reload();
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Providers>
        <App />
      </Providers>
    </BrowserRouter>
  </React.StrictMode>,
);
