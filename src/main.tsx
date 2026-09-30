import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./global.scss";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <a
      className="skip-link"
      href="#main-content"
      onClick={(e) => {
        e.preventDefault();
        document.getElementById("main-content")?.focus();
      }}
    >
      Skip to content
    </a>
    <App />
  </StrictMode>,
);
