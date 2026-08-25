import type { EventDefinition, RpgPlayer } from "@rpgjs/server";
import { localized } from "../../i18n";
import { emitWorldEvent, type LocalizedText, type WorldDialogAction } from "./bridge";

type LinkEventOptions = {
  name: string;
  graphic: string;
  kicker: LocalizedText;
  title: LocalizedText;
  copy: LocalizedText;
  actions: WorldDialogAction[];
};

export function LinkEvent(options: LinkEventOptions): EventDefinition {
  return {
    name: `link-${options.name}`,
    onInit() {
      this.setGraphic(options.graphic);
      this.through = false;
    },
    onAction() {
      emitWorldEvent("dialog", options);
    },
  };
}

export function MusicEvent(): EventDefinition {
  return {
    name: "link-town-radio",
    onInit() {
      this.setGraphic("pan-flute");
      this.through = false;
    },
    onAction() {
      emitWorldEvent("music");
    },
  };
}

type NpcOptions = {
  id: string;
  graphic: string;
  title: LocalizedText;
  lines: LocalizedText[];
  hitLines: LocalizedText[];
};

export function ImmortalNpc(options: NpcOptions): EventDefinition {
  let lineIndex = 0;
  return {
    name: `npc-${options.id}`,
    onInit() {
      this.setGraphic(options.graphic);
      this.speed = 0.7;
      (this as unknown as { wayfarerNpc?: NpcOptions }).wayfarerNpc = options;
    },
    onAction() {
      const line = options.lines[lineIndex % options.lines.length];
      lineIndex += 1;
      emitWorldEvent("dialog", {
        kicker: localized("world.npc.chatterKicker"),
        title: options.title,
        copy: line,
        actions: [],
      });
    },
  };
}

export function MapDoor(name: string, graphic: string, destination: string, x: number, y: number): EventDefinition {
  return {
    name: `door-${name}`,
    onInit() {
      this.setGraphic(graphic);
      this.through = false;
    },
    async onAction(player: RpgPlayer) {
      await player.changeMap(destination, { x, y });
      await player.save("auto", {}, { reason: "auto", source: `door-${name}` });
    },
  };
}

export function WorldReturn(name: string, x: number, y: number): EventDefinition {
  return MapDoor(name, "scroll", "world", x, y);
}
