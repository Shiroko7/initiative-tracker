import React from "react";
import ReactDOM from "react-dom/client";

import { PluginGate } from "../components/PluginGate";
import { PluginThemeProvider } from "../components/PluginThemeProvider";
import Preferences from "./Preferences";

import "../index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PluginGate>
      <PluginThemeProvider>
        <Preferences />
      </PluginThemeProvider>
    </PluginGate>
  </React.StrictMode>,
);
