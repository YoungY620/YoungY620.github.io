import { message, readLocale, type Locale, type MessageKey } from "../../src/i18n/index.ts";
import {
  NINJA_ACTOR_DIRECTION_COLUMN,
  NINJA_ACTOR_FPS,
  NINJA_ACTOR_FRAME_SIZE,
  NINJA_ACTOR_ROWS,
  type NinjaActorDirection,
} from "../../src/shared/ninja-animations.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#dungeon")!;
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
ctx.imageSmoothingEnabled = false;

const SAVE_KEY = "wayfarer-dungeon-one-save-v1";
const LOCALE_KEY = "wayfarer-locale-v1";
const AUDIO_KEY = "wayfarer-dungeon-audio-v1";
const W = canvas.width;
const H = canvas.height;
const bounds = { left: 52, right: W - 52, top: 92, bottom: H - 48 };

type Vec = { x: number; y: number };
type EnemyKind = "slime" | "bat" | "spider" | "skeleton" | "boss";
type Enemy = Vec & {
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  cooldown: number;
  flash: number;
  elite?: boolean;
  phase?: number;
  attackTime: number;
};
type Projectile = Vec & { vx: number; vy: number; radius: number; life: number; damage: number };
type HitParticle = Vec & { vx: number; vy: number; life: number; color: string };
type SaveData = {
  version: 1;
  checkpoint: number;
  checkpointShards: number;
  checkpointRoute: "observe" | "courage" | null;
  checkpointElapsed: number;
  bestMs: number | null;
  clears: number;
};
type RoomRuntime = {
  cleared: boolean;
  stage: number;
  puzzleStep: number;
  puzzleSolved: boolean;
  puzzleRound: number;
  puzzleLit: number[];
  route: "observe" | "courage" | null;
  wave: number;
  nextWaveAt: number;
  waveEndsAt: number;
  stageEndsAt: number;
  nextSpawnAt: number;
  shardGranted: boolean;
  signRead: boolean;
  chestReady: boolean;
  lanternHp: number;
  lanternMaxHp: number;
  bossShielded: boolean;
  bossBreaks: number;
};

const player = {
  x: 112, y: 270, hp: 100, maxHp: 100, stamina: 100, maxStamina: 100,
  facingX: 1, facingY: 0, attackTime: 0, attackCooldown: 0, dashTime: 0,
  dashCooldown: 0, invulnerable: 0, flash: 0, moving: false,
};

const roomNames: MessageKey[] = [
  "dungeon.room0", "dungeon.room1", "dungeon.room2", "dungeon.room3",
  "dungeon.room4", "dungeon.room5", "dungeon.room6",
];
const roomHints: MessageKey[] = [
  "dungeon.room0Hint", "dungeon.room1Hint", "dungeon.room2Hint", "dungeon.room3Hint",
  "dungeon.room4Hint", "dungeon.room5Hint", "dungeon.room6Hint",
];
const assets: Record<string, HTMLImageElement> = {};
const assetPaths: Record<string, string> = {
  player: "/assets/ninja-v1/characters/ninja-blue-source.png",
  slime: "/assets/ninja-v1/monsters/slime.png",
  bat: "/assets/ninja-v1/monsters/blue-bat.png",
  spider: "/assets/ninja-v1/monsters/spider-red.png",
  skeleton: "/assets/ninja-v1/monsters/skeleton.png",
  boss: "/assets/ninja-v1/bosses/samurai-walk.png",
  bossAttack: "/assets/ninja-v1/bosses/samurai-attack.png",
  shard: "/assets/ninja-v1/items/gem-yellow.png",
  heart: "/assets/ninja-v1/items/heart.png",
  chest: "/assets/ninja-v1/items/chest.png",
  scroll: "/assets/ninja-v1/items/scroll.png",
  dungeon: "/assets/ninja-v1/raw/tilesets/dungeon.png",
};

let locale: Locale = readLocale();
let roomIndex = 0;
let shards = 0;
let route: "observe" | "courage" | null = null;
let enemies: Enemy[] = [];
let projectiles: Projectile[] = [];
let particles: HitParticle[] = [];
let runtime: RoomRuntime = freshRuntime();
let mode: "menu" | "playing" | "paused" | "defeat" | "victory" = "menu";
let lastFrame = performance.now();
let elapsedMs = 0;
let gameClock = 0;
let toastTimer = 0;
let autoPaused = false;
let animationFrame = 0;
let screenShake = 0;
let muted = localStorage.getItem(AUDIO_KEY) === "muted";
let qaRun = false;
const keys = new Set<string>();

function freshRuntime(): RoomRuntime {
  return {
    cleared: false,
    stage: 0,
    puzzleStep: 0,
    puzzleSolved: false,
    puzzleRound: 0,
    puzzleLit: [],
    route: null,
    wave: 0,
    nextWaveAt: 0,
    waveEndsAt: 0,
    stageEndsAt: 0,
    nextSpawnAt: 0,
    shardGranted: false,
    signRead: false,
    chestReady: false,
    lanternHp: 100,
    lanternMaxHp: 100,
    bossShielded: false,
    bossBreaks: 0,
  };
}
function t(key: MessageKey): string { return message(locale, key); }
function distance(a: Vec, b: Vec): number { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(value: number, low: number, high: number): number { return Math.max(low, Math.min(high, value)); }
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}
function readSave(): SaveData {
  try {
    const value = JSON.parse(localStorage.getItem(SAVE_KEY) || "null") as Partial<SaveData> | null;
    return {
      version: 1,
      checkpoint: clamp(Number(value?.checkpoint) || 0, 0, 6),
      checkpointShards: clamp(Number(value?.checkpointShards) || 0, 0, 3),
      checkpointRoute: value?.checkpointRoute === "observe" || value?.checkpointRoute === "courage" ? value.checkpointRoute : null,
      checkpointElapsed: Math.max(0, Number(value?.checkpointElapsed) || 0),
      bestMs: typeof value?.bestMs === "number" ? value.bestMs : null,
      clears: Math.max(0, Number(value?.clears) || 0),
    };
  } catch {
    return { version: 1, checkpoint: 0, checkpointShards: 0, checkpointRoute: null, checkpointElapsed: 0, bestMs: null, clears: 0 };
  }
}
function writeSave(update: Partial<SaveData>) {
  const current = readSave();
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...current, ...update, version: 1 }));
}

function loadAssets(): Promise<void> {
  return Promise.all(Object.entries(assetPaths).map(([name, src]) => new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = image.onerror = () => resolve();
    image.src = src;
    assets[name] = image;
  }))).then(() => undefined);
}

function renderLocale() {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  document.title = t("dungeon.title");
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n as MessageKey);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAria as MessageKey));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.locale === locale));
  });
  const muteButton = document.querySelector<HTMLButtonElement>("#mute-button");
  if (muteButton) muteButton.textContent = t(muted ? "dungeon.unmute" : "dungeon.mute");
  updateRoomMessage();
}
function objectiveStatus(): string {
  const countdown = runtime.stageEndsAt > gameClock
    ? " · " + formatTime((runtime.stageEndsAt - gameClock) * 1000)
    : "";
  if (runtime.cleared) return t("dungeon.open");
  if (roomIndex === 0) {
    return runtime.signRead
      ? t("dungeon.stage") + " " + String(Math.min(2, runtime.stage)) + " / 2" + countdown
      : t("dungeon.readSign");
  }
  if (roomIndex === 1) return t("dungeon.round") + " " + String(runtime.puzzleRound + 1) + " / 3" + countdown;
  if (roomIndex === 2) return runtime.route
      ? t("dungeon.stage") + " " + String(runtime.stage) + " / 3" + countdown
    : t("dungeon.chooseRoute");
  if (roomIndex === 3) return t("dungeon.stage") + " " + String(Math.min(4, runtime.stage + 1)) + " / 4" + countdown;
  if (roomIndex === 4) return runtime.chestReady
    ? t("dungeon.openChest")
    : t("dungeon.stage") + " " + String(Math.min(3, runtime.stage)) + " / 3" + countdown;
  if (roomIndex === 5) {
    const seconds = Math.max(0, Math.ceil(runtime.waveEndsAt - gameClock));
    return t("dungeon.wave") + " " + String(runtime.wave) + " / 3 · "
      + t("dungeon.lantern") + " " + String(Math.ceil(runtime.lanternHp)) + "% · "
      + formatTime(seconds * 1000);
  }
  if (roomIndex === 6 && runtime.bossShielded) return t("dungeon.bossShield") + countdown;
  return t("dungeon.stage") + " " + String(Math.min(3, runtime.bossBreaks + 1)) + " / 3";
}
function updateRoomMessage() {
  document.querySelector("#room-kicker")!.textContent = t("dungeon.room") + " " + String(roomIndex + 1) + " / 7";
  document.querySelector("#room-title")!.textContent = t(roomNames[roomIndex]);
  document.querySelector("#room-hint")!.textContent = t(roomHints[roomIndex]);
  document.querySelector("#room-label")!.textContent = t(roomNames[roomIndex]) + " · " + objectiveStatus();
}
function showToast(key: MessageKey | string, duration = 2300) {
  window.clearTimeout(toastTimer);
  const node = document.querySelector<HTMLElement>("#toast")!;
  node.textContent = key.startsWith("dungeon.") ? t(key as MessageKey) : key;
  node.hidden = false;
  toastTimer = window.setTimeout(() => { node.hidden = true; }, duration);
}
function hideToast() {
  window.clearTimeout(toastTimer);
  document.querySelector<HTMLElement>("#toast")!.hidden = true;
}

function enemy(kind: EnemyKind, x: number, y: number, elite = false): Enemy {
  const stats: Record<EnemyKind, [number, number, number, number]> = {
    slime: [44, 48, 10, 15], bat: [34, 78, 9, 13], spider: [54, 62, 12, 15],
    skeleton: [94, 52, 15, 16], boss: [920, 44, 18, 28],
  };
  const [baseHp, speed, damage, radius] = stats[kind];
  return {
    kind, x, y, hp: elite ? baseHp * 2.2 : baseHp, maxHp: elite ? baseHp * 2.2 : baseHp,
    speed: elite ? speed * 1.12 : speed, damage: elite ? damage + 5 : damage,
    radius: elite ? radius + 5 : radius, cooldown: Math.random(), flash: 0, elite, phase: 1, attackTime: 0,
  };
}
function spawn(kind: EnemyKind, positions: Vec[], elite = false) {
  positions.forEach((position) => enemies.push(enemy(kind, position.x, position.y, elite)));
}
function spawnWave(wave: number) {
  runtime.wave = wave;
  runtime.waveEndsAt = gameClock + [0, 34, 40, 46][wave];
  runtime.nextWaveAt = gameClock + 7;
  if (wave === 1) {
    spawn("slime", [{ x: 650, y: 180 }, { x: 720, y: 350 }, { x: 560, y: 350 }, { x: 790, y: 250 }]);
  } else if (wave === 2) {
    spawn("bat", [{ x: 600, y: 160 }, { x: 720, y: 220 }, { x: 690, y: 390 }, { x: 520, y: 340 }]);
    spawn("spider", [{ x: 760, y: 300 }, { x: 620, y: 280 }]);
  } else {
    spawn("skeleton", [{ x: 690, y: 190 }, { x: 690, y: 370 }, { x: 790, y: 270 }]);
    spawn("bat", [{ x: 560, y: 170 }, { x: 560, y: 370 }, { x: 820, y: 150 }]);
  }
  showToast(t("dungeon.wave") + " " + String(wave) + " / 3");
}

function restorePlayer(amount: number) {
  if (player.hp >= player.maxHp) return;
  player.hp = Math.min(player.maxHp, player.hp + amount);
  showToast("dungeon.restored", 1500);
}

function beginTimedStage(seconds: number, firstReinforcement = 9) {
  runtime.stageEndsAt = gameClock + seconds;
  runtime.nextSpawnAt = gameClock + firstReinforcement;
}

function setupRoom(index: number) {
  roomIndex = index;
  runtime = freshRuntime();
  enemies = [];
  projectiles = [];
  particles = [];
  player.x = 112;
  player.y = 270;
  restorePlayer(28);
  player.stamina = player.maxStamina;
  if (index === 4) {
    runtime.stage = 1;
    beginTimedStage(60);
    spawn("bat", [{ x: 610, y: 150 }, { x: 610, y: 390 }, { x: 780, y: 170 }, { x: 780, y: 370 }]);
    spawn("spider", [{ x: 700, y: 270 }, { x: 840, y: 270 }]);
  } else if (index === 5) {
    spawnWave(1);
  } else if (index === 6) {
    if (shards >= 3) spawn("boss", [{ x: 710, y: 270 }]);
  }
  updateRoomMessage();
  const panel = document.querySelector("#message-panel")!;
  panel.classList.remove("is-quiet");
  window.setTimeout(() => panel.classList.add("is-quiet"), 9000);
}

async function startGame(fromCheckpoint: boolean) {
  await loadAssets();
  const saved = readSave();
  roomIndex = fromCheckpoint ? saved.checkpoint : 0;
  shards = fromCheckpoint ? saved.checkpointShards : 0;
  route = fromCheckpoint ? saved.checkpointRoute : null;
  elapsedMs = fromCheckpoint ? saved.checkpointElapsed : 0;
  gameClock = 0;
  player.hp = player.maxHp;
  setupRoom(roomIndex);
  mode = "playing";
  document.querySelector<HTMLElement>("#start-screen")!.hidden = true;
  canvas.focus();
  const music = document.querySelector<HTMLAudioElement>("#dungeon-music")!;
  music.volume = 0.42;
  music.muted = muted;
  void music.play().catch(() => undefined);
  void navigator.storage?.persist?.().catch(() => false);
  lastFrame = performance.now();
}

function checkpoint(nextRoom: number) {
  if (!qaRun) {
    writeSave({
      checkpoint: nextRoom,
      checkpointShards: shards,
      checkpointRoute: route,
      checkpointElapsed: elapsedMs,
    });
  }
  showToast("dungeon.checkpoint", 2800);
}
function grantShard() {
  if (runtime.shardGranted) return;
  runtime.shardGranted = true;
  shards = Math.min(3, shards + 1);
  showToast("dungeon.fragment", 2800);
  playSfx("/assets/ninja-v1/audio/sfx/coin.wav", 0.35);
}
function completeRoom() {
  if (runtime.cleared) return;
  runtime.cleared = true;
  if (roomIndex === 1 || roomIndex === 4 || roomIndex === 5) grantShard();
  if (roomIndex === 3) checkpoint(4);
  if (roomIndex === 5) checkpoint(6);
  showToast("dungeon.open");
}
function enterNextRoom() {
  if (!runtime.cleared) {
    showToast("dungeon.locked");
    return;
  }
  if (roomIndex < 6) {
    setupRoom(roomIndex + 1);
    playSfx("/assets/ninja-v1/audio/sfx/accept.wav", 0.25);
  }
}

function playSfx(src: string, volume: number) {
  if (muted) return;
  const sound = new Audio(src);
  sound.volume = volume;
  void sound.play().catch(() => undefined);
}
function attack() {
  if (mode !== "playing" || player.attackCooldown > 0) return;
  player.attackTime = 0.18;
  player.attackCooldown = 0.34;
  const center = { x: player.x + player.facingX * 36, y: player.y + player.facingY * 36 };
  enemies.forEach((target) => {
    if (distance(center, target) < target.radius + 38) {
      if (target.kind === "boss" && runtime.bossShielded) {
        target.flash = 0.08;
        return;
      }
      target.hp -= target.kind === "boss" ? 22 : 28;
      target.flash = 0.13;
      target.x += player.facingX * 18;
      target.y += player.facingY * 18;
      screenShake = Math.max(screenShake, target.kind === "boss" ? 7 : 4);
      for (let index = 0; index < 7; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
          x: center.x,
          y: center.y,
          vx: Math.cos(angle) * (40 + Math.random() * 90),
          vy: Math.sin(angle) * (40 + Math.random() * 90),
          life: 0.28 + Math.random() * 0.18,
          color: target.kind === "boss" ? "#e76f51" : "#f3bd6a",
        });
      }
    }
  });
  playSfx("/assets/ninja-v1/audio/sfx/slash.wav", 0.18);
}
function dash() {
  if (mode !== "playing" || player.dashCooldown > 0 || player.stamina < 34) return;
  player.dashTime = 0.18;
  player.dashCooldown = 0.7;
  player.invulnerable = 0.24;
  player.stamina -= 34;
}

const lampSequences = [
  [0, 1, 2],
  [2, 0, 1, 2],
  [1, 2, 0, 2, 1],
] as const;

function spawnEchoAmbush(round: number) {
  if (round === 0) {
    spawn("bat", [{ x: 430, y: 150 }, { x: 590, y: 150 }, { x: 720, y: 180 }, { x: 620, y: 390 }]);
  } else if (round === 1) {
    spawn("bat", [{ x: 410, y: 140 }, { x: 560, y: 140 }, { x: 720, y: 160 }, { x: 780, y: 360 }]);
    spawn("spider", [{ x: 520, y: 390 }, { x: 680, y: 330 }]);
  } else {
    spawn("skeleton", [{ x: 650, y: 180 }, { x: 730, y: 350 }]);
    spawn("bat", [{ x: 420, y: 160 }, { x: 520, y: 380 }, { x: 790, y: 180 }, { x: 810, y: 390 }]);
  }
}

function spawnRouteStage(choice: "observe" | "courage", stage: number) {
  if (choice === "observe") {
    if (stage === 1) spawn("spider", [{ x: 610, y: 150 }, { x: 740, y: 220 }, { x: 620, y: 350 }, { x: 790, y: 380 }]);
    if (stage === 2) {
      spawn("spider", [{ x: 570, y: 150 }, { x: 680, y: 210 }, { x: 790, y: 150 }, { x: 630, y: 390 }]);
      spawn("bat", [{ x: 820, y: 330 }, { x: 520, y: 300 }]);
    }
    if (stage === 3) {
      spawn("spider", [{ x: 700, y: 270 }], true);
      spawn("bat", [{ x: 540, y: 150 }, { x: 540, y: 390 }, { x: 820, y: 170 }, { x: 820, y: 370 }]);
    }
  } else {
    if (stage === 1) {
      spawn("skeleton", [{ x: 650, y: 210 }, { x: 740, y: 330 }]);
      spawn("slime", [{ x: 580, y: 360 }, { x: 800, y: 170 }]);
    }
    if (stage === 2) {
      spawn("skeleton", [{ x: 610, y: 170 }, { x: 720, y: 270 }, { x: 820, y: 380 }]);
      spawn("slime", [{ x: 790, y: 150 }, { x: 590, y: 390 }]);
    }
    if (stage === 3) {
      spawn("skeleton", [{ x: 700, y: 270 }], true);
      spawn("skeleton", [{ x: 580, y: 160 }, { x: 580, y: 380 }, { x: 820, y: 180 }, { x: 820, y: 360 }]);
    }
  }
}

function interact() {
  if (mode !== "playing") return;
  if (player.x > bounds.right - 56) {
    enterNextRoom();
    return;
  }
  if (roomIndex === 0 && distance(player, { x: 200, y: 170 }) < 74) {
    if (!runtime.signRead) {
      runtime.signRead = true;
      runtime.stage = 1;
      beginTimedStage(45, 8);
      spawn("slime", [{ x: 480, y: 180 }, { x: 650, y: 280 }, { x: 500, y: 390 }, { x: 780, y: 210 }]);
    }
    showToast("dungeon.controls", 4200);
  } else if (roomIndex === 1 && !runtime.puzzleSolved) {
    const lanterns = [{ x: 350, y: 260 }, { x: 510, y: 260 }, { x: 670, y: 260 }];
    const selected = lanterns.findIndex((lantern) => distance(player, lantern) < 64);
    if (selected >= 0) {
      const sequence = lampSequences[runtime.puzzleRound];
      if (selected === sequence[runtime.puzzleStep]) {
        runtime.puzzleLit.push(selected);
        runtime.puzzleStep += 1;
        playSfx("/assets/ninja-v1/audio/sfx/coin.wav", 0.2);
        if (runtime.puzzleStep === sequence.length) {
          runtime.puzzleSolved = true;
          beginTimedStage([55, 60, 65][runtime.puzzleRound], 9);
          spawnEchoAmbush(runtime.puzzleRound);
        }
      } else {
        runtime.puzzleStep = 0;
        runtime.puzzleLit = [];
        showToast("dungeon.wrong");
      }
    } else {
      showToast("dungeon.sequence", 3600);
    }
  } else if (roomIndex === 2 && !runtime.route) {
    if (distance(player, { x: 430, y: 175 }) < 95) chooseRoute("observe");
    else if (distance(player, { x: 430, y: 365 }) < 95) chooseRoute("courage");
  } else if (roomIndex === 4 && runtime.chestReady && distance(player, { x: 770, y: 270 }) < 82) {
    completeRoom();
  } else if (roomIndex === 6 && shards < 3) {
    showToast("dungeon.bossNeeds");
  }
}
function chooseRoute(choice: "observe" | "courage") {
  runtime.route = choice;
  route = choice;
  runtime.stage = 1;
  beginTimedStage(60, 10);
  spawnRouteStage(choice, runtime.stage);
  showToast(choice === "observe" ? "dungeon.routeObserve" : "dungeon.routeCourage");
}

function hitPlayer(damage: number, source: Vec) {
  if (player.invulnerable > 0) return;
  player.hp = Math.max(0, player.hp - damage);
  player.invulnerable = 0.78;
  player.flash = 0.2;
  const dx = player.x - source.x;
  const dy = player.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  player.x += dx / length * 22;
  player.y += dy / length * 22;
  screenShake = Math.max(screenShake, 8);
  showToast("dungeon.hurt", 900);
  playSfx("/assets/ninja-v1/audio/sfx/hit.wav", 0.22);
  if (player.hp <= 0) defeat();
}
function defeat() {
  mode = "defeat";
  hideToast();
  document.querySelector<HTMLElement>("#defeat-screen")!.hidden = false;
  document.querySelector<HTMLAudioElement>("#dungeon-music")!.pause();
}

function updatePlayer(dt: number) {
  let dx = Number(keys.has("ArrowRight") || keys.has("KeyD")) - Number(keys.has("ArrowLeft") || keys.has("KeyA"));
  let dy = Number(keys.has("ArrowDown") || keys.has("KeyS")) - Number(keys.has("ArrowUp") || keys.has("KeyW"));
  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    dx /= length; dy /= length;
    player.facingX = dx; player.facingY = dy;
    const speed = player.dashTime > 0 ? 510 : 178;
    player.x = clamp(player.x + dx * speed * dt, bounds.left, bounds.right);
    player.y = clamp(player.y + dy * speed * dt, bounds.top, bounds.bottom);
  }
  player.moving = Boolean(dx || dy);
  player.attackTime = Math.max(0, player.attackTime - dt);
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.dashTime = Math.max(0, player.dashTime - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.flash = Math.max(0, player.flash - dt);
  player.stamina = Math.min(player.maxStamina, player.stamina + 18 * dt);
}

function bossProjectiles(target: Enemy) {
  const count = target.phase === 3 ? 12 : target.phase === 2 ? 8 : 6;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + gameClock * 0.2;
    const speed = target.phase === 3 ? 165 : target.phase === 2 ? 140 : 120;
    projectiles.push({ x: target.x, y: target.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 7, life: 4, damage: 10 });
  }
  if ((target.phase ?? 1) >= 2) {
    const aimed = Math.atan2(player.y - target.y, player.x - target.x);
    for (const spread of [-0.18, 0, 0.18]) {
      projectiles.push({
        x: target.x,
        y: target.y,
        vx: Math.cos(aimed + spread) * 190,
        vy: Math.sin(aimed + spread) * 190,
        radius: 6,
        life: 4,
        damage: 9,
      });
    }
  }
  target.attackTime = 0.28;
}
function updateEnemies(dt: number) {
  enemies.forEach((target) => {
    target.cooldown -= dt;
    target.flash = Math.max(0, target.flash - dt);
    target.attackTime = Math.max(0, target.attackTime - dt);
    const defendTarget = roomIndex === 5 ? { x: 480, y: 270 } : player;
    const dx = defendTarget.x - target.x;
    const dy = defendTarget.y - target.y;
    const length = Math.hypot(dx, dy) || 1;
    const wobble = target.kind === "bat" ? Math.sin(gameClock * 5 + target.x) * 0.65 : 0;
    const speedScale = target.kind === "boss" ? 1 + (target.phase! - 1) * 0.22 : 1;
    const shieldScale = target.kind === "boss" && runtime.bossShielded ? 0.22 : 1;
    target.x = clamp(target.x + (dx / length - dy / length * wobble) * target.speed * speedScale * shieldScale * dt, bounds.left, bounds.right);
    target.y = clamp(target.y + (dy / length + dx / length * wobble) * target.speed * speedScale * shieldScale * dt, bounds.top, bounds.bottom);
    if (target.kind === "boss") {
      target.phase = Math.min(3, runtime.bossBreaks + 1);
      if (target.cooldown <= 0) {
        bossProjectiles(target);
        target.cooldown = target.phase === 3 ? 1.25 : target.phase === 2 ? 1.65 : 2.1;
      }
    }
    if (roomIndex === 5 && target.kind !== "boss" && distance(target, defendTarget) < target.radius + 38 && target.cooldown <= 0) {
      runtime.lanternHp = Math.max(0, runtime.lanternHp - target.damage * 0.55);
      target.cooldown = 1.1;
      target.attackTime = 0.2;
      screenShake = Math.max(screenShake, 3);
      if (runtime.lanternHp <= 0) {
        showToast("dungeon.lanternOut", 2200);
        defeat();
      }
      return;
    }
    if (distance(player, target) < playerRadius() + target.radius && target.cooldown <= 0) {
      hitPlayer(target.damage, target);
      target.cooldown = target.kind === "boss" ? 0.75 : 1.05;
      target.attackTime = 0.2;
    }
  });
  enemies = enemies.filter((target) => target.hp > 0);
}
function updateProjectiles(dt: number) {
  projectiles.forEach((shot) => {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    if (distance(player, shot) < playerRadius() + shot.radius) {
      hitPlayer(shot.damage, shot);
      shot.life = 0;
    }
  });
  projectiles = projectiles.filter((shot) => shot.life > 0 && shot.x > 0 && shot.x < W && shot.y > 0 && shot.y < H);
}
function updateParticles(dt: number) {
  particles.forEach((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.92;
    particle.vy *= 0.92;
    particle.life -= dt;
  });
  particles = particles.filter((particle) => particle.life > 0);
  screenShake = Math.max(0, screenShake - 34 * dt);
}
function playerRadius() { return 14; }

const workshopPlates = [
  { x: 280, y: 360 },
  { x: 430, y: 165 },
  { x: 610, y: 360 },
  { x: 770, y: 170 },
];
const workshopSequences = [[0, 1, 2, 3], [2, 0, 3, 1]] as const;

function spawnDefenseBatch(wave: number) {
  const edge = Math.random() > 0.5 ? 820 : 720;
  if (wave === 1) spawn("slime", [{ x: edge, y: 150 }, { x: 840, y: 380 }]);
  if (wave === 2) {
    spawn("bat", [{ x: edge, y: 150 }, { x: 820, y: 390 }]);
    spawn("spider", [{ x: 760, y: 270 }]);
  }
  if (wave === 3) {
    spawn("skeleton", [{ x: edge, y: 160 }, { x: 820, y: 370 }]);
    spawn("bat", [{ x: 760, y: 270 }]);
  }
}

function updatePuzzle(dt: number) {
  if (roomIndex === 0 && runtime.signRead && !runtime.cleared) {
    if (gameClock < runtime.stageEndsAt && gameClock >= runtime.nextSpawnAt && enemies.length < 9) {
      if (runtime.stage === 1) {
        spawn("slime", [{ x: 650, y: 160 }, { x: 780, y: 270 }, { x: 650, y: 380 }]);
      } else {
        spawn("bat", [{ x: 620, y: 150 }, { x: 760, y: 350 }]);
        spawn("spider", [{ x: 820, y: 240 }]);
      }
      runtime.nextSpawnAt = gameClock + 10;
    }
    if (gameClock >= runtime.stageEndsAt && enemies.length === 0 && runtime.stage === 1) {
      runtime.stage = 2;
      restorePlayer(12);
      beginTimedStage(60, 8);
      spawn("bat", [{ x: 520, y: 150 }, { x: 710, y: 170 }, { x: 620, y: 390 }]);
      spawn("spider", [{ x: 780, y: 330 }, { x: 560, y: 270 }]);
      showToast("dungeon.trainingSecond");
    } else if (gameClock >= runtime.stageEndsAt && enemies.length === 0 && runtime.stage === 2) completeRoom();
  }

  if (roomIndex === 1 && runtime.puzzleSolved && !runtime.cleared) {
    if (gameClock < runtime.stageEndsAt && gameClock >= runtime.nextSpawnAt && enemies.length < 10) {
      spawnEchoAmbush(runtime.puzzleRound);
      runtime.nextSpawnAt = gameClock + 12;
    }
    if (gameClock >= runtime.stageEndsAt && enemies.length === 0 && runtime.puzzleRound < 2) {
      runtime.puzzleRound += 1;
      runtime.puzzleStep = 0;
      runtime.puzzleLit = [];
      runtime.puzzleSolved = false;
      runtime.stageEndsAt = 0;
      restorePlayer(10);
      showToast("dungeon.echoAgain");
    } else if (gameClock >= runtime.stageEndsAt && enemies.length === 0 && runtime.puzzleRound === 2) completeRoom();
  }

  if (roomIndex === 2 && runtime.route && !runtime.cleared) {
    if (gameClock < runtime.stageEndsAt && gameClock >= runtime.nextSpawnAt && enemies.length < 10) {
      spawnRouteStage(runtime.route, runtime.stage);
      runtime.nextSpawnAt = gameClock + 14;
    }
    if (gameClock >= runtime.stageEndsAt && enemies.length === 0 && runtime.stage < 3) {
      runtime.stage += 1;
      restorePlayer(8);
      beginTimedStage(60, 10);
      spawnRouteStage(runtime.route, runtime.stage);
    } else if (gameClock >= runtime.stageEndsAt && enemies.length === 0 && runtime.stage === 3) completeRoom();
  }

  if (roomIndex === 3 && !runtime.cleared) {
    if (runtime.stage === 0 || runtime.stage === 2) {
      const sequence = workshopSequences[runtime.stage === 0 ? 0 : 1];
      const expected = workshopPlates[sequence[runtime.puzzleStep]];
      if (expected && distance(player, expected) < 30) {
        runtime.puzzleStep += 1;
        playSfx("/assets/ninja-v1/audio/sfx/coin.wav", 0.15);
        if (runtime.puzzleStep === sequence.length) {
          runtime.puzzleStep = 0;
          runtime.stage += 1;
          if (runtime.stage === 1) {
            beginTimedStage(60, 10);
            spawn("slime", [{ x: 560, y: 150 }, { x: 700, y: 200 }, { x: 640, y: 390 }, { x: 810, y: 350 }]);
            spawn("bat", [{ x: 790, y: 150 }, { x: 520, y: 350 }]);
          } else {
            beginTimedStage(75, 10);
            spawn("skeleton", [{ x: 700, y: 270 }], true);
            spawn("bat", [{ x: 540, y: 150 }, { x: 540, y: 390 }, { x: 820, y: 170 }, { x: 820, y: 370 }]);
          }
        }
      }
    } else {
      if (gameClock < runtime.stageEndsAt && gameClock >= runtime.nextSpawnAt && enemies.length < 10) {
        if (runtime.stage === 1) {
          spawn("slime", [{ x: 610, y: 150 }, { x: 760, y: 350 }, { x: 820, y: 180 }]);
          spawn("bat", [{ x: 690, y: 390 }]);
        } else {
          spawn("skeleton", [{ x: 700, y: 270 }]);
          spawn("bat", [{ x: 580, y: 150 }, { x: 580, y: 390 }, { x: 820, y: 270 }]);
        }
        runtime.nextSpawnAt = gameClock + 13;
      }
      if (gameClock >= runtime.stageEndsAt && enemies.length === 0 && runtime.stage === 1) {
        runtime.stage = 2;
        runtime.stageEndsAt = 0;
        restorePlayer(12);
        showToast("dungeon.tideReverse");
      } else if (gameClock >= runtime.stageEndsAt && enemies.length === 0 && runtime.stage === 3) completeRoom();
    }
    const tideCycle = gameClock % 3.6;
    if (tideCycle > 2.55 && Math.abs(player.y - 270) < 20) hitPlayer(8, { x: player.x - 1, y: 270 });
    if (runtime.stage >= 2 && tideCycle > 1.25 && tideCycle < 1.75 && Math.abs(player.x - 520) < 20) {
      hitPlayer(8, { x: 520, y: player.y - 1 });
    }
  }

  if (roomIndex === 4 && !runtime.cleared && !runtime.chestReady) {
    if (gameClock < runtime.stageEndsAt && gameClock >= runtime.nextSpawnAt && enemies.length < 10) {
      if (runtime.stage === 1) {
        spawn("bat", [{ x: 610, y: 150 }, { x: 610, y: 390 }, { x: 820, y: 270 }]);
        spawn("spider", [{ x: 760, y: 180 }]);
      } else if (runtime.stage === 2) {
        spawn("skeleton", [{ x: 700, y: 270 }]);
        spawn("bat", [{ x: 560, y: 160 }, { x: 820, y: 370 }]);
      } else {
        spawn("skeleton", [{ x: 650, y: 170 }, { x: 790, y: 350 }]);
        spawn("spider", [{ x: 820, y: 180 }, { x: 590, y: 380 }]);
      }
      runtime.nextSpawnAt = gameClock + 14;
    }
    if (gameClock >= runtime.stageEndsAt && enemies.length === 0 && runtime.stage === 1) {
      runtime.stage = 2;
      restorePlayer(12);
      beginTimedStage(75, 10);
      spawn("skeleton", [{ x: 700, y: 270 }], true);
      spawn("bat", [{ x: 570, y: 150 }, { x: 570, y: 390 }, { x: 820, y: 170 }, { x: 820, y: 370 }]);
      showToast("dungeon.watcherArrives");
    } else if (gameClock >= runtime.stageEndsAt && enemies.length === 0 && runtime.stage === 2) {
      runtime.stage = 3;
      restorePlayer(12);
      beginTimedStage(90, 10);
      spawn("skeleton", [{ x: 700, y: 270 }], true);
      spawn("spider", [{ x: 560, y: 160 }, { x: 560, y: 380 }, { x: 820, y: 180 }, { x: 820, y: 360 }]);
      showToast("dungeon.watcherLastStand");
    } else if (gameClock >= runtime.stageEndsAt && enemies.length === 0 && runtime.stage === 3) {
      runtime.chestReady = true;
      showToast("dungeon.openChest", 3600);
    }
  }

  if (roomIndex === 5 && !runtime.cleared) {
    if (gameClock < runtime.waveEndsAt && gameClock >= runtime.nextWaveAt && enemies.length < 13) {
      spawnDefenseBatch(runtime.wave);
      runtime.nextWaveAt = gameClock + Math.max(5.5, 8.5 - runtime.wave);
    }
    if (gameClock >= runtime.waveEndsAt && enemies.length === 0) {
      if (runtime.wave < 3) {
        restorePlayer(16);
        runtime.lanternHp = Math.min(runtime.lanternMaxHp, runtime.lanternHp + 24);
        spawnWave(runtime.wave + 1);
      } else completeRoom();
    }
  }

  if (roomIndex === 6 && shards >= 3) {
    const boss = enemies.find((target) => target.kind === "boss");
    if (boss && !runtime.bossShielded) {
      const threshold = runtime.bossBreaks === 0 ? 0.7 : runtime.bossBreaks === 1 ? 0.35 : -1;
      if (threshold > 0 && boss.hp <= boss.maxHp * threshold) {
        runtime.bossBreaks += 1;
        runtime.bossShielded = true;
        projectiles = [];
        beginTimedStage(runtime.bossBreaks === 1 ? 60 : 75, 10);
        if (runtime.bossBreaks === 1) {
          spawn("skeleton", [{ x: 520, y: 160 }, { x: 520, y: 380 }, { x: 820, y: 270 }]);
          spawn("bat", [{ x: 650, y: 140 }, { x: 650, y: 400 }]);
        } else {
          spawn("skeleton", [{ x: 540, y: 160 }, { x: 540, y: 380 }], true);
          spawn("spider", [{ x: 760, y: 150 }, { x: 820, y: 270 }, { x: 760, y: 390 }]);
        }
        showToast("dungeon.bossShield", 3400);
      }
    }
    if (runtime.bossShielded && gameClock < runtime.stageEndsAt && gameClock >= runtime.nextSpawnAt && enemies.length < 10) {
      if (runtime.bossBreaks === 1) {
        spawn("skeleton", [{ x: 540, y: 170 }, { x: 810, y: 350 }]);
        spawn("bat", [{ x: 650, y: 390 }]);
      } else {
        spawn("skeleton", [{ x: 560, y: 160 }, { x: 560, y: 380 }]);
        spawn("spider", [{ x: 790, y: 180 }, { x: 820, y: 360 }]);
      }
      runtime.nextSpawnAt = gameClock + 13;
    }
    if (runtime.bossShielded && gameClock >= runtime.stageEndsAt && enemies.every((target) => target.kind === "boss")) {
      runtime.bossShielded = false;
      runtime.stageEndsAt = 0;
      restorePlayer(18);
      showToast("dungeon.bossShieldBroken", 2600);
    }
    if (!boss) victory();
  }
  if (player.x > bounds.right - 4 && runtime.cleared && roomIndex < 6) enterNextRoom();
  updateRoomMessage();
  void dt;
}

function victory() {
  if (mode === "victory") return;
  mode = "victory";
  const save = readSave();
  const bestMs = qaRun ? elapsedMs : save.bestMs === null ? elapsedMs : Math.min(save.bestMs, elapsedMs);
  const clearCount = qaRun ? save.clears : save.clears + 1;
  if (!qaRun) {
    writeSave({ checkpoint: 0, checkpointShards: 0, checkpointRoute: null, checkpointElapsed: 0, bestMs, clears: clearCount });
  }
  hideToast();
  document.querySelector("#best-time")!.textContent = formatTime(bestMs);
  document.querySelector("#clear-count")!.textContent = String(clearCount);
  document.querySelector<HTMLElement>("#victory-screen")!.hidden = false;
  document.querySelector<HTMLAudioElement>("#dungeon-music")!.pause();
}

function update(dt: number) {
  gameClock += dt;
  elapsedMs += dt * 1000;
  updatePlayer(dt);
  updateEnemies(dt);
  if (mode !== "playing") return;
  updateProjectiles(dt);
  if (mode !== "playing") return;
  updateParticles(dt);
  updatePuzzle(dt);
  document.querySelector<HTMLElement>("#hp-bar")!.style.width = String(player.hp / player.maxHp * 100) + "%";
  document.querySelector<HTMLElement>("#stamina-bar")!.style.width = String(player.stamina / player.maxStamina * 100) + "%";
  document.querySelector("#shard-count")!.textContent = String(shards) + " / 3";
}

function drawFloor() {
  ctx.fillStyle = roomIndex === 6 ? "#2b2428" : roomIndex === 5 ? "#233443" : "#1b2a32";
  ctx.fillRect(0, 0, W, H);
  for (let y = 80; y < H; y += 32) {
    for (let x = 32; x < W; x += 32) {
      const alternate = ((x / 32 + y / 32) & 1) === 0;
      ctx.fillStyle = alternate ? "rgba(82,105,101,.11)" : "rgba(0,0,0,.07)";
      ctx.fillRect(x, y, 30, 30);
    }
  }
  ctx.fillStyle = "#0b1118";
  ctx.fillRect(0, 70, W, 22);
  ctx.fillRect(0, H - 48, W, 48);
  ctx.fillRect(0, 70, 52, H - 70);
  ctx.fillRect(W - 52, 70, 52, H - 70);
  ctx.strokeStyle = "#8e6444";
  ctx.lineWidth = 4;
  ctx.strokeRect(52, 92, W - 104, H - 140);
  for (let x = 70; x < W - 70; x += 96) {
    drawDungeonTile(x, 82, 80, 32);
  }
  ctx.fillStyle = runtime.cleared ? "#a8cf45" : "#7c4338";
  ctx.fillRect(W - 54, 230, 10, 82);
  ctx.fillStyle = runtime.cleared ? "rgba(168,207,69,.18)" : "rgba(231,111,81,.12)";
  ctx.fillRect(W - 84, 220, 34, 102);
}
function drawDungeonTile(x: number, y: number, sx: number, sy: number) {
  const image = assets.dungeon;
  if (image?.complete && image.naturalWidth) ctx.drawImage(image, sx, sy, 16, 16, x, y, 32, 32);
}
function drawSprite(name: string, position: Vec, size = 48, row = 0, alpha = 1) {
  const image = assets[name];
  if (!image?.complete || !image.naturalWidth) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (name === "boss" || name === "bossAttack") {
    const frame = Math.floor(gameClock * 7) % Math.max(1, Math.floor(image.naturalWidth / 48));
    ctx.drawImage(image, frame * 48, 0, 48, 48, position.x - size / 2, position.y - size / 2, size, size);
  } else {
    const frameSize = 16;
    const columns = Math.max(1, Math.floor(image.naturalWidth / frameSize));
    const frame = Math.floor(gameClock * 6) % columns;
    const safeRow = Math.min(row, Math.max(0, Math.floor(image.naturalHeight / frameSize) - 1));
    ctx.drawImage(image, frame * frameSize, safeRow * frameSize, frameSize, frameSize, position.x - size / 2, position.y - size / 2, size, size);
  }
  ctx.restore();
}

function drawRoomObjects() {
  ctx.font = "12px NinjaAdventure, monospace";
  ctx.textAlign = "center";
  if (roomIndex === 0) {
    drawSprite("scroll", { x: 200, y: 170 }, 34);
    ctx.fillStyle = "#f3bd6a"; ctx.fillText("SPACE", 200, 215);
  } else if (roomIndex === 1) {
    const lanterns = [
      { x: 350, y: 260, color: "#f3bd6a" },
      { x: 510, y: 260, color: "#a978c1" },
      { x: 670, y: 260, color: "#75ae57" },
    ];
    lanterns.forEach((lamp, index) => {
      ctx.fillStyle = runtime.puzzleLit.includes(index) ? lamp.color : "#28333a";
      ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 24, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = lamp.color; ctx.lineWidth = 3; ctx.stroke();
    });
    drawSprite("scroll", { x: 210, y: 270 }, 34);
  } else if (roomIndex === 2) {
    ctx.fillStyle = runtime.route === "observe" ? "#a8cf45" : "#35485a";
    ctx.fillRect(330, 135, 200, 78);
    ctx.fillStyle = runtime.route === "courage" ? "#e76f51" : "#4d3b3a";
    ctx.fillRect(330, 327, 200, 78);
    ctx.fillStyle = "#fff4d6";
    ctx.fillText(t("dungeon.routeObserve"), 430, 179);
    ctx.fillText(t("dungeon.routeCourage"), 430, 371);
  } else if (roomIndex === 3) {
    const sequence = workshopSequences[runtime.stage >= 2 ? 1 : 0];
    const litOrder: readonly number[] = sequence;
    workshopPlates.forEach((plate, index) => {
      const lit = litOrder.slice(0, runtime.puzzleStep).includes(index);
      ctx.fillStyle = lit ? "#a8cf45" : "#40525c";
      ctx.fillRect(plate.x - 28, plate.y - 18, 56, 36);
      ctx.strokeStyle = "#d4c08a"; ctx.strokeRect(plate.x - 28, plate.y - 18, 56, 36);
    });
    const tideCycle = gameClock % 3.6;
    if (tideCycle > 2.55) {
      ctx.fillStyle = "rgba(72,169,197,.74)";
      ctx.fillRect(bounds.left, 256, bounds.right - bounds.left, 28);
    }
    if (runtime.stage >= 2 && tideCycle > 1.25 && tideCycle < 1.75) {
      ctx.fillStyle = "rgba(72,169,197,.74)";
      ctx.fillRect(506, bounds.top, 28, bounds.bottom - bounds.top);
    }
  } else if (roomIndex === 4) {
    drawSprite("chest", { x: 770, y: 270 }, runtime.chestReady ? 64 : 48, runtime.chestReady ? 1 : 0);
  } else if (roomIndex === 5) {
    const lanternRatio = runtime.lanternHp / runtime.lanternMaxHp;
    ctx.fillStyle = lanternRatio > 0.5 ? "#f3bd6a" : lanternRatio > 0.25 ? "#e7a651" : "#e76f51";
    ctx.beginPath(); ctx.arc(480, 270, 34 + Math.sin(gameClock * 4) * 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(243,189,106,.16)";
    ctx.beginPath(); ctx.arc(480, 270, 84, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff4d6";
    ctx.fillText(t("dungeon.wave") + " " + String(runtime.wave) + " / 3", 480, 335);
  } else if (roomIndex === 6) {
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < shards ? "#f3bd6a" : "#2c3439";
      ctx.beginPath(); ctx.arc(360 + i * 120, 130, 18, 0, Math.PI * 2); ctx.fill();
    }
    if (runtime.bossShielded) {
      const boss = enemies.find((target) => target.kind === "boss");
      if (boss) {
        ctx.strokeStyle = "#75b8ce";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, boss.radius + 22 + Math.sin(gameClock * 6) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}
function drawEnemies() {
  enemies.forEach((target) => {
    const alpha = target.flash > 0 ? 0.35 : 1;
    const spriteName = target.kind === "boss" && target.attackTime > 0 ? "bossAttack" : target.kind;
    drawSprite(spriteName, target, target.kind === "boss" ? 96 : target.elite ? 64 : 48, 0, alpha);
    if (target.elite || target.kind === "boss") {
      const width = target.kind === "boss" ? 160 : 76;
      ctx.fillStyle = "#0a0e13"; ctx.fillRect(target.x - width / 2, target.y - target.radius - 32, width, 8);
      ctx.fillStyle = target.kind === "boss" ? "#e76f51" : "#a8cf45";
      ctx.fillRect(target.x - width / 2 + 2, target.y - target.radius - 30, (width - 4) * target.hp / target.maxHp, 4);
    }
  });
  projectiles.forEach((shot) => {
    ctx.fillStyle = "#e76f51";
    ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffd48d"; ctx.stroke();
  });
  particles.forEach((particle) => {
    ctx.globalAlpha = clamp(particle.life * 3, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(Math.round(particle.x) - 2, Math.round(particle.y) - 2, 4, 4);
  });
  ctx.globalAlpha = 1;
}
function drawPlayer() {
  const direction: NinjaActorDirection = Math.abs(player.facingX) > Math.abs(player.facingY)
    ? (player.facingX > 0 ? "right" : "left")
    : (player.facingY < 0 ? "up" : "down");
  const frameY = player.attackTime > 0
    ? NINJA_ACTOR_ROWS.attack
    : player.moving
      ? NINJA_ACTOR_ROWS.walk[Math.floor(gameClock * NINJA_ACTOR_FPS) % NINJA_ACTOR_ROWS.walk.length]
      : NINJA_ACTOR_ROWS.stand;
  const image = assets.player;
  if (image?.complete && image.naturalWidth) {
    // The source frame is 16 px. Preserve an integer scale so individual
    // pixels stay equally sized while the character moves between frames.
    const size = NINJA_ACTOR_FRAME_SIZE * 3;
    ctx.save();
    ctx.globalAlpha = player.flash > 0 ? 0.35 : 1;
    ctx.drawImage(
      image,
      NINJA_ACTOR_DIRECTION_COLUMN[direction] * NINJA_ACTOR_FRAME_SIZE,
      frameY * NINJA_ACTOR_FRAME_SIZE,
      NINJA_ACTOR_FRAME_SIZE,
      NINJA_ACTOR_FRAME_SIZE,
      Math.round(player.x - size / 2),
      Math.round(player.y - size / 2),
      size,
      size,
    );
    ctx.restore();
  }
  if (player.attackTime > 0) {
    ctx.save();
    ctx.translate(player.x + player.facingX * 34, player.y + player.facingY * 34);
    ctx.rotate(Math.atan2(player.facingY, player.facingX));
    ctx.fillStyle = "rgba(255,244,214,.78)";
    ctx.fillRect(-3, -26, 48, 8);
    ctx.restore();
  }
}
function render() {
  ctx.save();
  if (screenShake > 0) {
    ctx.translate(
      Math.round((Math.random() - 0.5) * screenShake),
      Math.round((Math.random() - 0.5) * screenShake),
    );
  }
  drawFloor();
  drawRoomObjects();
  drawEnemies();
  drawPlayer();
  ctx.restore();
  if (mode === "paused") {
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.fillRect(0, 0, W, H);
  }
}

function loop(now: number) {
  const dt = Math.min(0.035, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (mode === "playing") update(dt);
  render();
  animationFrame = requestAnimationFrame(loop);
}
function setPaused(paused: boolean) {
  if (paused && mode === "playing") {
    mode = "paused";
    document.querySelector<HTMLElement>("#pause-screen")!.hidden = false;
    document.querySelector<HTMLAudioElement>("#dungeon-music")!.pause();
  } else if (!paused && mode === "paused") {
    mode = "playing";
    document.querySelector<HTMLElement>("#pause-screen")!.hidden = true;
    lastFrame = performance.now();
    void document.querySelector<HTMLAudioElement>("#dungeon-music")!.play().catch(() => undefined);
    canvas.focus();
  }
}

function restartFromCheckpoint() {
  document.querySelector<HTMLElement>("#pause-screen")!.hidden = true;
  document.querySelector<HTMLElement>("#defeat-screen")!.hidden = true;
  const saved = readSave();
  shards = saved.checkpointShards;
  route = saved.checkpointRoute;
  elapsedMs = saved.checkpointElapsed;
  gameClock = 0;
  player.hp = player.maxHp;
  setupRoom(saved.checkpoint);
  mode = "playing";
  const music = document.querySelector<HTMLAudioElement>("#dungeon-music")!;
  music.muted = muted;
  void music.play().catch(() => undefined);
  canvas.focus();
}

type DungeonQaBridge = {
  state: () => {
    room: number;
    mode: string;
    player: { x: number; y: number; hp: number };
    enemies: number;
    shards: number;
    elapsedMs: number;
    runtime: RoomRuntime;
  };
  teleport: (x: number, y: number) => void;
  interact: () => void;
  attack: () => void;
  clearEnemies: () => void;
  enterRoom: (index: number, shardCount?: number) => void;
  damageBoss: (amount: number) => void;
  advance: (seconds: number) => void;
  survive: (seconds: number) => void;
  autoplay: (choice: "observe" | "courage") => void;
};

function installLocalQaBridge() {
  const localHost = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  if (!localHost || !new URLSearchParams(location.search).has("qa")) return;
  player.invulnerable = 60 * 60;
  const simulateWalk = (x: number, y: number, maxSeconds = 20) => {
    const frames = Math.ceil(maxSeconds * 60);
    for (let frame = 0; frame < frames && mode === "playing"; frame += 1) {
      player.invulnerable = 60 * 60;
      const dx = x - player.x;
      const dy = y - player.y;
      if (Math.hypot(dx, dy) < 13) break;
      keys.clear();
      if (dx > 7) keys.add("ArrowRight");
      if (dx < -7) keys.add("ArrowLeft");
      if (dy > 7) keys.add("ArrowDown");
      if (dy < -7) keys.add("ArrowUp");
      update(1 / 60);
    }
    keys.clear();
  };
  const simulateFightUntil = (finished: () => boolean, maxSeconds: number) => {
    const frames = Math.ceil(maxSeconds * 60);
    for (let frame = 0; frame < frames && mode === "playing" && !finished(); frame += 1) {
      player.invulnerable = 60 * 60;
      const viable = runtime.bossShielded
        ? enemies.filter((target) => target.kind !== "boss")
        : enemies;
      const target = viable.slice().sort((a, b) => distance(player, a) - distance(player, b))[0];
      keys.clear();
      if (target) {
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const length = Math.hypot(dx, dy) || 1;
        if (length > 67) {
          if (dx > 5) keys.add("ArrowRight");
          if (dx < -5) keys.add("ArrowLeft");
          if (dy > 5) keys.add("ArrowDown");
          if (dy < -5) keys.add("ArrowUp");
        } else {
          player.facingX = dx / length;
          player.facingY = dy / length;
          attack();
        }
      }
      update(1 / 60);
    }
    keys.clear();
  };
  const simulateDoor = () => {
    simulateWalk(bounds.right - 22, 270);
    interact();
  };
  const autoplay = (choice: "observe" | "courage") => {
    qaRun = true;
    elapsedMs = 0;
    gameClock = 0;
    shards = 0;
    route = null;
    player.hp = player.maxHp;
    setupRoom(0);
    mode = "playing";

    simulateWalk(200, 170);
    interact();
    simulateFightUntil(() => runtime.cleared, 180);
    simulateDoor();

    for (const sequence of lampSequences) {
      for (const index of sequence) {
        const lamp = [{ x: 350, y: 260 }, { x: 510, y: 260 }, { x: 670, y: 260 }][index];
        simulateWalk(lamp.x, lamp.y);
        interact();
      }
      simulateFightUntil(() => runtime.cleared || !runtime.puzzleSolved, 180);
    }
    simulateDoor();

    simulateWalk(430, choice === "observe" ? 175 : 365);
    interact();
    simulateFightUntil(() => runtime.cleared, 240);
    simulateDoor();

    for (const index of workshopSequences[0]) simulateWalk(workshopPlates[index].x, workshopPlates[index].y);
    simulateFightUntil(() => runtime.stage >= 2, 180);
    for (const index of workshopSequences[1]) simulateWalk(workshopPlates[index].x, workshopPlates[index].y);
    simulateFightUntil(() => runtime.cleared, 180);
    simulateDoor();

    simulateFightUntil(() => runtime.chestReady, 240);
    simulateWalk(770, 270);
    interact();
    simulateDoor();

    simulateFightUntil(() => runtime.cleared, 300);
    simulateDoor();
    simulateFightUntil(() => mode === "victory", 300);
    qaRun = false;
    render();
  };
  const qaWindow = window as Window & { __wayfarerDungeonQa?: DungeonQaBridge };
  const bridge: DungeonQaBridge = {
    state: () => ({
      room: roomIndex,
      mode,
      player: { x: player.x, y: player.y, hp: player.hp },
      enemies: enemies.length,
      shards,
      elapsedMs,
      runtime: structuredClone(runtime),
    }),
    teleport: (x, y) => {
      player.x = clamp(x, bounds.left, bounds.right);
      player.y = clamp(y, bounds.top, bounds.bottom);
    },
    interact,
    attack,
    clearEnemies: () => {
      enemies = roomIndex === 6 && runtime.bossShielded
        ? enemies.filter((target) => target.kind === "boss")
        : [];
    },
    enterRoom: (index, shardCount = shards) => {
      shards = clamp(shardCount, 0, 3);
      setupRoom(clamp(index, 0, 6));
      mode = "playing";
    },
    damageBoss: (amount) => {
      const boss = enemies.find((target) => target.kind === "boss");
      if (boss && !runtime.bossShielded) boss.hp = Math.max(0, boss.hp - Math.max(0, amount));
    },
    advance: (seconds) => {
      const frames = Math.min(60 * 300, Math.ceil(Math.max(0, seconds) * 60));
      for (let frame = 0; frame < frames && mode === "playing"; frame += 1) update(1 / 60);
      render();
    },
    survive: (seconds) => {
      const frames = Math.min(60 * 300, Math.ceil(Math.max(0, seconds) * 60));
      for (let frame = 0; frame < frames && mode === "playing"; frame += 1) {
        if (frame % 90 === 0) {
          enemies = [];
          player.hp = player.maxHp;
          runtime.lanternHp = runtime.lanternMaxHp;
        }
        update(1 / 60);
      }
      render();
    },
    autoplay,
  };
  qaWindow.__wayfarerDungeonQa = bridge;

  const command = document.createElement("input");
  command.type = "text";
  command.dataset.testid = "qa-command";
  command.tabIndex = -1;
  Object.assign(command.style, {
    position: "fixed",
    left: "0",
    top: "28px",
    width: "220px",
    height: "24px",
    opacity: "0.9",
    zIndex: "9999",
  });
  document.body.append(command);
  const readCommand = () => {
    try { return JSON.parse(command.value || "{}") as Record<string, unknown>; }
    catch { return {}; }
  };

  const syncState = () => {
    canvas.dataset.qaState = JSON.stringify(bridge.state());
  };
  let qaButtonIndex = 0;
  const qaButton = (name: string, action: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.testid = "qa-" + name;
    button.textContent = name;
    button.tabIndex = -1;
    Object.assign(button.style, {
      position: "fixed",
      left: String(qaButtonIndex * 56) + "px",
      top: "0",
      width: "54px",
      height: "26px",
      opacity: "0.9",
      zIndex: "9999",
    });
    button.addEventListener("click", () => {
      action();
      syncState();
    });
    document.body.append(button);
    qaButtonIndex += 1;
  };
  qaButton("state", syncState);
  qaButton("teleport", () => {
    const value = readCommand();
    bridge.teleport(Number(value.x), Number(value.y));
  });
  qaButton("interact", bridge.interact);
  qaButton("attack", bridge.attack);
  qaButton("clear", bridge.clearEnemies);
  qaButton("room", () => {
    const value = readCommand();
    bridge.enterRoom(Number(value.room), Number(value.shards));
  });
  qaButton("boss", () => bridge.damageBoss(Number(readCommand().damage)));
  qaButton("advance", () => bridge.advance(Number(readCommand().seconds)));
  qaButton("survive", () => bridge.survive(Number(readCommand().seconds)));
  qaButton("autoplay", () => bridge.autoplay(readCommand().route === "courage" ? "courage" : "observe"));
  syncState();
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === "KeyX") attack();
  if (event.code === "KeyC") dash();
  if (event.code === "Space" || event.code === "Enter") interact();
  if (event.code === "Escape" && (mode === "playing" || mode === "paused")) setPaused(mode === "playing");
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => keys.clear());

document.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((button) => {
  button.addEventListener("click", () => {
    locale = button.dataset.locale as Locale;
    localStorage.setItem(LOCALE_KEY, locale);
    renderLocale();
  });
});
document.querySelector("#new-game")!.addEventListener("click", () => void startGame(false));
document.querySelector("#continue-game")!.addEventListener("click", () => void startGame(true));
document.querySelector("#pause-button")!.addEventListener("click", () => setPaused(true));
document.querySelector("#mute-button")!.addEventListener("click", () => {
  muted = !muted;
  localStorage.setItem(AUDIO_KEY, muted ? "muted" : "audible");
  document.querySelector<HTMLAudioElement>("#dungeon-music")!.muted = muted;
  renderLocale();
});
document.querySelector("#resume-game")!.addEventListener("click", () => setPaused(false));
document.querySelector("#restart-game")!.addEventListener("click", restartFromCheckpoint);
document.querySelector("#retry-game")!.addEventListener("click", restartFromCheckpoint);
document.querySelector("#play-again")!.addEventListener("click", () => {
  document.querySelector<HTMLElement>("#victory-screen")!.hidden = true;
  void startGame(false);
});

document.querySelectorAll<HTMLButtonElement>("[data-key]").forEach((button) => {
  const code = button.dataset.key!;
  const press = (event: Event) => {
    event.preventDefault();
    keys.add(code);
    button.classList.add("is-pressed");
    if (code === "KeyX") attack();
    if (code === "KeyC") dash();
    if (code === "Space") interact();
  };
  const release = (event: Event) => {
    event.preventDefault();
    keys.delete(code);
    button.classList.remove("is-pressed");
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && mode === "playing") {
    autoPaused = true;
    setPaused(true);
  } else if (!document.hidden && autoPaused) {
    autoPaused = false;
  }
});

const saved = readSave();
document.querySelector<HTMLElement>("#continue-game")!.hidden = saved.checkpoint === 0;
renderLocale();
setupRoom(0);
installLocalQaBridge();
render();
animationFrame = requestAnimationFrame(loop);
window.addEventListener("beforeunload", () => cancelAnimationFrame(animationFrame));
