import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",               // ważne dla Electron (file://)
  server: { port: 5173, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
    resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
