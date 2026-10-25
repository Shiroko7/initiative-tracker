import React from "react";
import ReactDOM from "react-dom/client";
import { PluginGate } from "../components/PluginGate";
import { PluginThemeProvider } from "../components/PluginThemeProvider";
import { Carousel } from "./Carousel";
import "../index.css";
import "../tailwind.css";
import "./style.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PluginGate>
      <PluginThemeProvider>
        <Carousel />
      </PluginThemeProvider>
    </PluginGate>
  </React.StrictMode>,
);
