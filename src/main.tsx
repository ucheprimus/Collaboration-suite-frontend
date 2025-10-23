import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";
import { supabase } from "./lib/supabaseClient";
// src/main.tsx
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

import { SessionContextProvider } from "@supabase/auth-helpers-react";


const container = document.getElementById("root");
if (!container) throw new Error("Root container not found");

createRoot(container).render(
  <StrictMode>
        <SessionContextProvider supabaseClient={supabase}>
      <App />
    </SessionContextProvider>
  </StrictMode>
);

