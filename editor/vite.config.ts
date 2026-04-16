import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/editor/",
  server: {
    proxy: {
      "/canvas": "http://localhost:8787",
      "/api/modules": "http://localhost:8787",
      "/api/children": "http://localhost:8787",
      "/api/jd": "http://localhost:8787",
      "/api/latex": "http://localhost:8787",
      "/api/template": "http://localhost:8787",
      "/oauth": "http://localhost:8787",
    },
  },
  build: {
    outDir: "../editor-dist",
    emptyOutDir: true,
  },
});
