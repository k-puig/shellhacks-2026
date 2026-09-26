/// <reference path="./vite-env.d.ts" />
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { Auth0Provider } from "@auth0/auth0-react";

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

if (!domain || domain === "" || !clientId || clientId === "") {
  console.log("No domain or clientId included");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: globalThis.location.origin,
      }}
    >
      <App />
    </Auth0Provider>
  </StrictMode>,
);
