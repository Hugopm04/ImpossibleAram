import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { AppProvider } from "./state";
import { HoverProvider } from "./components/Hover";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <HoverProvider>
        <App />
      </HoverProvider>
    </AppProvider>
  </StrictMode>,
);
