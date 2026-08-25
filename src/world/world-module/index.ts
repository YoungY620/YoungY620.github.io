import { createModule } from "@rpgjs/common";
import server from "./server";

export function provideWorld() {
  return createModule("wayfarer-world", [{ server }]);
}

