import { resolve } from "node:path";
import { defineConfig } from "vite";
import { rpgjs, tiledMapFolderPlugin } from "@rpgjs/vite";
import startServer from "./src/world/server";

export default defineConfig({
  base: "/",
  optimizeDeps: {
    include: ["pixi.js > @xmldom/xmldom"],
  },
  plugins: [
    tiledMapFolderPlugin({
      sourceFolder: "./src/world/tiled",
      publicPath: "/map",
      buildOutputPath: "map",
    }),
    ...rpgjs({
      server: startServer,
      entryPoints: { rpg: "./src/entry.ts" },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        world: resolve(import.meta.dirname, "index.html"),
      },
    },
  },
});
