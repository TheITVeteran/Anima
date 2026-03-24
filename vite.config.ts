import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "#": resolve(__dirname, "public"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:19000",
        changeOrigin: true,
      },
    },
  },
});
