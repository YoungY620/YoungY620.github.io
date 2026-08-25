import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        dungeon: resolve(import.meta.dirname, "games/dungeon-one/index.html"),
      },
    },
  },
});
