import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import "../components/common/Global.css";
import { HarnessRoot } from "./HarnessRoot";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <HarnessRoot />
    </React.StrictMode>,
  );
}
