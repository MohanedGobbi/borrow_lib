import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The end-to-end run points the proxy at its own Django instance (API_PROXY_TARGET, see e2e/serve-django.mjs).
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

// https://vite.dev/config/
export default defineConfig({
  // Absolute base so deep links like /books/12 still load /assets/* (Vercel SPA fallback).
  base: "/",
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/media": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router"],
        },
      },
    },
  },
});
