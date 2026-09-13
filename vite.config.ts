import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  root: resolve("experiments/qualification/pilot/web"),
  envDir: false,
  envPrefix: "DEADDROP_PUBLIC_",
  publicDir: false,
  build: { outDir: resolve("dist"), emptyOutDir: true, target: "es2022" },
});
