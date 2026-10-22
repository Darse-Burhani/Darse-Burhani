import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./fatimi-theme.css";
import "./globals.css";
import "./twilight-overrides.css";
import { Providers } from "@/components/Providers";
import { registerServiceWorker } from "@/lib/pwa";
import App from "./App";

// Register PWA Service Worker for offline resilience and home screen installation
registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Providers>
        <App />
      </Providers>
    </BrowserRouter>
  </React.StrictMode>,
);
