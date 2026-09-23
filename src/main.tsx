import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { inject } from "@vercel/analytics";
import "./index.css";
import "./i18n/index.js";
import { App } from "./App.js";
import { captureProviderRedirectError } from "./lib/auth-redirect.js";
import { registerServiceWorker } from "./lib/sw-registration.js";

captureProviderRedirectError();

registerServiceWorker();
inject();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
