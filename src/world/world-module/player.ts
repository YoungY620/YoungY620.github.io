import type { RpgActionInput } from "@rpgjs/common";
import { RpgPlayer, type RpgPlayerHooks } from "@rpgjs/server";
import { localized } from "../../i18n";
import { NINJA_ACTOR_SPEED } from "../../shared/ninja-animations";
import { emitWorldEvent, resolveText, type LocalizedText } from "./bridge";

type RuntimePlayer = RpgPlayer & {
  wayfarerSaveAt?: number;
  wayfarerPlace?: string;
};

function currentPlace(player: RpgPlayer): LocalizedText {
  const map = player.getCurrentMap();
  if (!map) return localized("world.place.town");
  if (map.id === "library") return localized("world.place.library");
  if (map.id === "town-hall") return localized("world.place.hall");
  if (map.id === "cottage") return localized("world.place.cottage");
  const { x, y } = player.position;
  if (y > 1440) return localized("world.place.dock");
  if (x > 1280 && y < 700) return localized("world.place.beach");
  if (y < 300) return y < 230 ? localized("world.place.cave") : localized("world.place.forest");
  if (y < 960) return localized("world.place.square");
  return localized("world.place.road");
}

async function handleAttack(player: RpgPlayer) {
  const map = player.getCurrentMap();
  if (!map) return;
  const nearbyNpc = map
    .getEventsBy((event) => event.name.startsWith("npc-"))
    .map((event) => ({
      event,
      distance: Math.hypot(event.position.x - player.position.x, event.position.y - player.position.y),
    }))
    .filter(({ distance }) => distance <= 74)
    .sort((a, b) => a.distance - b.distance)[0]?.event;

  emitWorldEvent("slash");
  player.setGraphicAnimation("attack", 1);
  player.playSound("/assets/ninja-v1/audio/sfx/slash.wav");
  if (!nearbyNpc) return;
  nearbyNpc.flash({ type: "both", tint: 0xffffff, alpha: 0.45, duration: 180, cycles: 2 });
  const options = (nearbyNpc as unknown as { wayfarerNpc?: { title: LocalizedText; hitLines: LocalizedText[] } }).wayfarerNpc;
  const hitLines = options?.hitLines ?? [localized("world.npc.defaultHit")];
  const title = options?.title ?? localized("world.npc.defaultTitle");
  emitWorldEvent("toast", `${resolveText(title)}：${resolveText(hitLines[Math.floor(Math.random() * hitLines.length)])}`);
  player.playSound("/assets/ninja-v1/audio/sfx/hit.wav");
}

export const player: RpgPlayerHooks = {
  async onConnected(player: RuntimePlayer) {
    player.name = "旅人";
    player.setGraphic(["ninja-player-shadow", "ninja-blue"]);
    player.setHitbox(20, 18);
    // RPGJS multiplies this value by 50 px/s. The reference uses 100 px/s on
    // 16 px tiles; this world doubles both the tiles and actor art.
    player.speed = NINJA_ACTOR_SPEED / 50;
    const loaded = await player.load("auto", { reason: "load", source: "startup" });
    if (!loaded.ok) {
      await player.changeMap("world", { x: 31 * 32, y: 56 * 32 });
    }
  },
  async onInput(player: RuntimePlayer, input: RpgActionInput<unknown>) {
    if (input.action === "attack") await handleAttack(player);
    if (input.action === "world:checkpoint") {
      const place = currentPlace(player);
      player.wayfarerPlace = place.zh;
      emitWorldEvent("place", place);
      await player.save("auto", {}, { reason: "auto", source: "movement-checkpoint" });
    }
  },
  onJoinMap(player: RuntimePlayer) {
    const place = currentPlace(player);
    player.wayfarerPlace = place.zh;
    emitWorldEvent("place", place);
  },
  onMove(player: RuntimePlayer) {
    const place = currentPlace(player);
    if (place.zh !== player.wayfarerPlace) {
      player.wayfarerPlace = place.zh;
      emitWorldEvent("place", place);
    }
    const now = Date.now();
    if (!player.wayfarerSaveAt || now - player.wayfarerSaveAt > 2500) {
      player.wayfarerSaveAt = now;
      void player.save("auto", {}, { reason: "auto", source: "movement" });
    }
  },
};
