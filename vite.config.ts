import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Enable polyfills for specific modules
      // Needed for sql.js
      include: ["fs", "stream", "crypto", "buffer", "path", "util", "vm"],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  build: {
    outDir: "build",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
        },
      },
    },
  },
  assetsInclude: ["**/*.wasm"],
});
