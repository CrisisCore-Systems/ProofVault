import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { AppLockProvider } from "./features/security/AppLock";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppLockProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppLockProvider>
  </React.StrictMode>
);