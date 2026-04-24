import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  root: "src",
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    outDir: "../dist",
    emptyOutDir: true,
  },
});
