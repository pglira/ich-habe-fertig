import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource-variable/ibm-plex-sans/wght.css";
import "@fontsource-variable/ibm-plex-sans/wght-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
// The fonts of the notes editor (`src/lib/fonts.ts`).
import "@fontsource-variable/jetbrains-mono/wght.css";
import "@fontsource-variable/fira-code/wght.css";
import "@fontsource-variable/source-code-pro/wght.css";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/source-sans-3/wght.css";
import "@/styles/index.css";

document.documentElement.classList.add("dark");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
