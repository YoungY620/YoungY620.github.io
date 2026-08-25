import {
  createServer,
  LocalStorageSaveStorageStrategy,
  provideAutoSave,
  provideSaveStorage,
  provideServerModules,
} from "@rpgjs/server";
import { provideTiledMap } from "@rpgjs/tiledmap/server";
import { provideWorld } from "./world-module";

export default createServer({
  providers: [
    provideWorld(),
    provideSaveStorage(new LocalStorageSaveStorageStrategy({ key: "wayfarer-world-save-v3" })),
    provideAutoSave({
      getDefaultSlot: () => 0,
      canLoad: () => true,
      canSave: () => true,
      shouldAutoSave: () => true,
    }),
    provideServerModules([]),
    provideTiledMap(),
  ],
});
