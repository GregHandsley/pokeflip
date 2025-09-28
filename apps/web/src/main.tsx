import React from "react";
import { createRoot } from "react-dom/client";
import "@/styles/theme.css";      // <-- singular
import "@/styles/globals.css";
import { AppRouter } from "@/app/router";

createRoot(document.getElementById("root")!).render(<AppRouter />);