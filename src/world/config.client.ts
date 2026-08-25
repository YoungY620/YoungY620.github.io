import {
  Presets,
  provideClientGlobalConfig,
  provideClientModules,
  type RpgClientEngine,
} from "@rpgjs/client";
import { Animation, Direction } from "@rpgjs/common";
import { provideTiledMap } from "@rpgjs/tiledmap/client";
import {
  NINJA_ACTOR_DIRECTION_COLUMN,
  NINJA_ACTOR_FRAME_TICKS,
  NINJA_ACTOR_ROWS,
  NINJA_ACTOR_Y_OFFSET,
} from "../shared/ninja-animations";
import { provideWorld } from "./world-module";

type ZoomableViewport = {
  children?: unknown[];
  constructor?: { name?: string };
  setZoom?: (scale: number, center?: boolean) => unknown;
  toWorld?: (...args: unknown[]) => unknown;
};

let activeViewport: ZoomableViewport | undefined;
let activeMapId = "world";

type WorldKeyboardBridge = {
  engine: RpgClientEngine;
};

type WorldWindow = Window & {
  __wayfarerKeyboardBridge?: WorldKeyboardBridge;
};

export const installWorldInputBridge = (engine: RpgClientEngine) => {
  const worldWindow = window as WorldWindow;
  if (worldWindow.__wayfarerKeyboardBridge) {
    worldWindow.__wayfarerKeyboardBridge.engine = engine;
    return;
  }
  worldWindow.__wayfarerKeyboardBridge = { engine };
};

const findViewport = (node: unknown): ZoomableViewport | undefined => {
  if (!node || typeof node !== "object") return undefined;
  const candidate = node as ZoomableViewport;
  if (
    typeof candidate.setZoom === "function"
    && (typeof candidate.toWorld === "function" || candidate.constructor?.name === "Viewport")
  ) {
    return candidate;
  }
  for (const child of candidate.children ?? []) {
    const viewport = findViewport(child);
    if (viewport) return viewport;
  }
  return undefined;
};

const responsiveZoom = () => {
  if (!window.matchMedia("(min-width: 900px) and (min-height: 620px)").matches) return 1;
  return activeMapId === "world" ? 1.5 : 2;
};

const applyWorldZoom = () => {
  activeViewport?.setZoom?.(responsiveZoom(), true);
};

const staticSprite = (id: string, image: string) => ({
  id,
  image,
  scale: [2, 2],
  ...Presets.RMSpritesheet(1, 1, 0),
});

const legacyActorSprite = (id: string, image: string) => ({
  id,
  image,
  scale: [2, 2],
  ...Presets.RMSpritesheet(4, 4, 0),
});

const officialDirectionColumn = (direction: Direction) => ({
  [Direction.Down]: NINJA_ACTOR_DIRECTION_COLUMN.down,
  [Direction.Up]: NINJA_ACTOR_DIRECTION_COLUMN.up,
  [Direction.Left]: NINJA_ACTOR_DIRECTION_COLUMN.left,
  [Direction.Right]: NINJA_ACTOR_DIRECTION_COLUMN.right,
})[direction];

const officialActorSprite = (id: string, image: string) => ({
  id,
  image,
  scale: [2, 2],
  framesWidth: 4,
  framesHeight: 7,
  textures: {
    [Animation.Stand]: {
      animations: ({ direction }: { direction: Direction }) => [[
        { time: 0, frameX: officialDirectionColumn(direction), frameY: NINJA_ACTOR_ROWS.stand },
      ]],
    },
    [Animation.Walk]: {
      animations: ({ direction }: { direction: Direction }) => [[
        ...NINJA_ACTOR_ROWS.walk.map((frameY, index) => ({
          time: index * NINJA_ACTOR_FRAME_TICKS,
          frameX: officialDirectionColumn(direction),
          frameY,
        })),
        { time: NINJA_ACTOR_ROWS.walk.length * NINJA_ACTOR_FRAME_TICKS },
      ]],
    },
    [Animation.Attack]: {
      animations: ({ direction }: { direction: Direction }) => [[
        { time: 0, frameX: officialDirectionColumn(direction), frameY: NINJA_ACTOR_ROWS.attack },
        { time: NINJA_ACTOR_FRAME_TICKS },
      ]],
    },
    [Animation.Defense]: {
      animations: ({ direction }: { direction: Direction }) => [[
        { time: 0, frameX: officialDirectionColumn(direction), frameY: NINJA_ACTOR_ROWS.defense },
      ]],
    },
    [Animation.Skill]: {
      animations: ({ direction }: { direction: Direction }) => [[
        { time: 0, frameX: officialDirectionColumn(direction), frameY: NINJA_ACTOR_ROWS.skill },
      ]],
    },
  },
});

// The reference character scene is two layers: a static shadow at the body
// origin and a 16 px actor sprite offset upward by 6 px. The RPGJS player
// position is the top-left of its 20 x 18 hitbox, so its body origin is the
// bottom-center point at (10, 18) in our doubled world.
const officialPlayerSprite = {
  ...officialActorSprite("ninja-blue", "/assets/ninja-v1/characters/ninja-blue-source.png"),
  anchor: [0.5, 0.5],
  x: 10,
  y: 18 + NINJA_ACTOR_Y_OFFSET,
};

const officialPlayerShadow = {
  id: "ninja-player-shadow",
  image: "/assets/ninja-v1/characters/shadow.png",
  scale: [2, 2],
  anchor: [0.5, 0.5],
  x: 10,
  y: 18,
  ...Presets.RMSpritesheet(1, 1, 0),
};

const pigSprite = {
  id: "pig",
  image: "/assets/ninja-v1/characters/pig.png",
  scale: [2, 2],
  framesWidth: 2,
  framesHeight: 1,
  textures: {
    [Animation.Stand]: { animations: () => [[{ time: 0, frameX: 0, frameY: 0 }]] },
    [Animation.Walk]: {
      animations: () => [[
        { time: 0, frameX: 0, frameY: 0 },
        { time: 12, frameX: 1, frameY: 0 },
        { time: 24 },
      ]],
    },
  },
};

export default {
  providers: [
    provideTiledMap({ basePath: "map" }),
    provideClientGlobalConfig({
      bootstrapCanvasOptions: {
        antialias: false,
        roundPixels: true,
      },
      keyboardControls: {
        up: ["up", "w"],
        down: ["down", "s"],
        left: ["left", "a"],
        right: ["right", "d"],
        action: { bind: ["space", "enter"], action: "action" },
      },
    }),
    provideWorld(),
    provideClientModules([
      {
        engine: {
          onStart(engine) {
            installWorldInputBridge(engine);
          },
          onWindowResize() {
            requestAnimationFrame(applyWorldZoom);
          },
        },
        sceneMap: {
          onAfterLoading(scene) {
            activeMapId = String((scene as unknown as { id?: string }).id || "world");
            const engine = (scene as unknown as { engine?: RpgClientEngine }).engine;
            if (engine) installWorldInputBridge(engine);
            const canvas = engine as unknown as { canvasApp?: { stage?: unknown } } | undefined;
            activeViewport = findViewport(canvas?.canvasApp?.stage);
            applyWorldZoom();
          },
        },
        sounds: [
          {
            id: "/assets/ninja-v1/audio/sfx/slash.wav",
            src: "/assets/ninja-v1/audio/sfx/slash.wav",
          },
          {
            id: "/assets/ninja-v1/audio/sfx/hit.wav",
            src: "/assets/ninja-v1/audio/sfx/hit.wav",
          },
        ],
        spritesheets: [
          officialPlayerShadow,
          officialPlayerSprite,
          officialActorSprite("villager", "/assets/ninja-v1/characters/villager-source.png"),
          officialActorSprite("villager-2", "/assets/ninja-v1/characters/villager-2-source.png"),
          officialActorSprite("old-man", "/assets/ninja-v1/characters/old-man-source.png"),
          officialActorSprite("old-woman", "/assets/ninja-v1/characters/old-woman-source.png"),
          officialActorSprite("inspector", "/assets/ninja-v1/characters/inspector-source.png"),
          officialActorSprite("samurai-green", "/assets/ninja-v1/characters/samurai-green.png"),
          officialActorSprite("samurai-blue", "/assets/ninja-v1/characters/samurai-blue.png"),
          pigSprite,
          legacyActorSprite("shell-red", "/assets/ninja-v1/monsters/shell-red.png"),
          legacyActorSprite("shell-blue", "/assets/ninja-v1/monsters/shell-blue.png"),
          legacyActorSprite("slime", "/assets/ninja-v1/monsters/slime.png"),
          staticSprite("book", "/assets/ninja-v1/items/book.png"),
          staticSprite("scroll", "/assets/ninja-v1/items/scroll.png"),
          staticSprite("pan-flute", "/assets/ninja-v1/items/pan-flute.png"),
          staticSprite("gem-yellow", "/assets/ninja-v1/items/gem-yellow.png"),
          staticSprite("gem-green", "/assets/ninja-v1/items/gem-green.png"),
          staticSprite("gem-purple", "/assets/ninja-v1/items/gem-purple.png"),
          staticSprite("gold-key", "/assets/ninja-v1/items/gold-key.png"),
        ],
      },
    ]),
  ],
};
