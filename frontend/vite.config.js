import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In Docker: PHP is reachable at http://php:80
// For local dev without Docker: change target to http://localhost:8000
const PHP_TARGET =
  process.env.VITE_PHP_TARGET || "http://php:80";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // needed for Docker
    port: 5173,
    proxy: {
      // /api/1  →  http://php:80/1
      // /api/1/Naam  →  http://php:80/1/Naam
      "/api": {
        target: PHP_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    // npm run build → outputs to backend/public/
    outDir: "../backend/public/dist",
    emptyOutDir: true,
  },
});