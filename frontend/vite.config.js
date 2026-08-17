import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.js"],
    globals: true,
  },
});