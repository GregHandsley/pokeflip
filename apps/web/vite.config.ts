// apps/web/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";     // <-- add this
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwind()],             // <-- and this
  server: { host: true, port: 5173 },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});