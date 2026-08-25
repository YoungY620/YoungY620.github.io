import { Direction } from "@rpgjs/common";
import { message, readLocale, type Locale, type LocalizedText, type MessageKey } from "../i18n";

type Track = {
  id: string;
  titleKey: MessageKey;
  file: string;
  authorKey: MessageKey;
  source: string;
  sourceKey: MessageKey;
  licenseKey: MessageKey;
  loop: boolean;
};
type AudioSettings = { trackId: string; volume: number; muted: boolean; loop: boolean };
type DialogAction = { label: LocalizedText; url: string; external?: boolean };
type DialogDetail = { kicker: LocalizedText; title: LocalizedText; copy: LocalizedText; actions?: DialogAction[] };
type WorldInputEngine = {
  processInput: ({ input }: { input: Direction }) => void | Promise<void>;
  processAction: (action: string) => void;
  getCurrentPlayer?: () => { x?: () => number; y?: () => number } | undefined;
};
type WorldWindow = Window & {
  __wayfarerKeyboardBridge?: { engine: WorldInputEngine };
};

const AUDIO_KEY = "wayfarer-town-audio-v1";
const LOCALE_KEY = "wayfarer-locale-v1";
const DEFAULT_AUDIO: AudioSettings = { trackId: "bad-apple-jpop", volume: 0.55, muted: false, loop: true };

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const loadingScreen = byId<HTMLDivElement>("loading-screen");
const loadingBar = byId<HTMLSpanElement>("loading-progress-bar");
const loadingStatus = byId<HTMLParagraphElement>("loading-status");
const enterButton = byId<HTMLButtonElement>("enter-town");
const placeName = byId<HTMLElement>("place-name");
const helpButton = byId<HTMLButtonElement>("help-toggle");
const musicButton = byId<HTMLButtonElement>("music-toggle");
const helpPanel = byId<HTMLElement>("help-panel");
const musicPanel = byId<HTMLElement>("music-panel");
const dialog = byId<HTMLElement>("link-dialog");
const dialogKicker = byId<HTMLElement>("link-dialog-kicker");
const dialogTitle = byId<HTMLElement>("link-dialog-title");
const dialogCopy = byId<HTMLElement>("link-dialog-copy");
const dialogActions = byId<HTMLElement>("link-dialog-actions");
const dialogClose = byId<HTMLButtonElement>("close-link-dialog");
const toast = byId<HTMLElement>("toast");
const audio = byId<HTMLAudioElement>("town-audio");
const trackTitle = byId<HTMLElement>("track-title");
const trackCredit = byId<HTMLElement>("track-credit");
const trackList = byId<HTMLOListElement>("track-list");
const prevTrack = byId<HTMLButtonElement>("prev-track");
const playTrack = byId<HTMLButtonElement>("play-track");
const nextTrack = byId<HTMLButtonElement>("next-track");
const muteTrack = byId<HTMLButtonElement>("mute-track");
const loopTrack = byId<HTMLButtonElement>("loop-track");
const resetTrack = byId<HTMLButtonElement>("reset-track");
const volume = byId<HTMLInputElement>("music-volume");

let locale = readLocale();
let currentPlace: LocalizedText | null = null;
let currentDialog: DialogDetail | null = null;
let tracks: Track[] = [];
let tracksPromise: Promise<Track[]> | null = null;
let toastTimer = 0;
let resumeAfterVisibility = false;
let preloadStage = 0;
let preloadReady = false;

function warmSecondaryRoutes() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  const schedule = "requestIdleCallback" in window
    ? (callback: () => void) => window.requestIdleCallback(callback, { timeout: 4000 })
    : (callback: () => void) => window.setTimeout(callback, 1800);
  schedule(() => {
    ["/pages/about/", "/pages/library/resume/", "/games/dungeon-one/"].forEach((href) => {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = href;
      document.head.append(link);
    });
  });
}

const resolveText = (value: LocalizedText): string => value[locale] || value.zh;
const textFor = (key: string): string => message(locale, ("shell." + key) as MessageKey);
const setText = (id: string, key: string) => { byId(id).textContent = textFor(key); };

function readAudioSettings(): AudioSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(AUDIO_KEY) || "null") as Partial<AudioSettings> | null;
    return {
      trackId: saved?.trackId || DEFAULT_AUDIO.trackId,
      volume: typeof saved?.volume === "number" ? saved.volume : DEFAULT_AUDIO.volume,
      muted: typeof saved?.muted === "boolean" ? saved.muted : DEFAULT_AUDIO.muted,
      loop: typeof saved?.loop === "boolean" ? saved.loop : DEFAULT_AUDIO.loop,
    };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}
let settings = readAudioSettings();
function saveAudioSettings() { localStorage.setItem(AUDIO_KEY, JSON.stringify(settings)); }
function selectedTrack() { return tracks.find((track) => track.id === settings.trackId) || tracks[0]; }

function updateTrackMeta() {
  const track = selectedTrack();
  if (!track) {
    trackTitle.textContent = textFor("none");
    return;
  }
  settings.trackId = track.id;
  trackTitle.textContent = message(locale, track.titleKey);
  trackCredit.replaceChildren();
  trackCredit.append(message(locale, track.authorKey) + " · " + message(locale, track.licenseKey) + " · ");
  const source = document.createElement("a");
  source.href = track.source;
  source.target = "_blank";
  source.rel = "noreferrer";
  source.textContent = message(locale, track.sourceKey) + " · " + textFor("source");
  trackCredit.append(source);
  trackList.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-current", button.dataset.trackId === track.id ? "true" : "false");
  });
}

function renderTrackList() {
  trackList.replaceChildren();
  tracks.forEach((track) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.trackId = track.id;
    button.textContent = message(locale, track.titleKey);
    button.addEventListener("click", () => prepareTrack(track, true));
    item.append(button);
    trackList.append(item);
  });
}

async function loadTracks(): Promise<Track[]> {
  if (!tracksPromise) {
    tracksPromise = fetch("/assets/town-audio/tracks.json")
      .then((response) => {
        if (!response.ok) throw new Error("Track manifest returned " + response.status);
        return response.json() as Promise<Track[]>;
      })
      .then((manifest) => {
        tracks = manifest;
        renderTrackList();
        updateTrackMeta();
        return tracks;
      })
      .catch((error) => {
        tracksPromise = null;
        showToast(textFor("manifestFail"), 3600);
        console.error(error);
        return [];
      });
  }
  return tracksPromise;
}

function prepareTrack(track: Track, shouldPlay = false) {
  settings.trackId = track.id;
  if (audio.dataset.trackId !== track.id) {
    audio.src = track.file;
    audio.dataset.trackId = track.id;
  }
  audio.loop = settings.loop && track.loop;
  updateTrackMeta();
  saveAudioSettings();
  if (shouldPlay) void audio.play().catch(() => showToast(textFor("autoplayFail")));
}
async function stepTrack(direction: number) {
  const list = await loadTracks();
  if (!list.length) return;
  const current = Math.max(0, list.findIndex((track) => track.id === settings.trackId));
  prepareTrack(list[(current + direction + list.length) % list.length], !audio.paused);
}
function syncAudioControls() {
  audio.volume = settings.volume;
  audio.muted = settings.muted;
  audio.loop = settings.loop;
  volume.value = String(settings.volume);
  muteTrack.textContent = settings.muted ? textFor("unmute") : textFor("mute");
  loopTrack.textContent = textFor("loop") + "：" + (settings.loop ? textFor("on") : textFor("off"));
  loopTrack.setAttribute("aria-pressed", String(settings.loop));
  playTrack.textContent = audio.paused ? textFor("play") : textFor("pause");
}

function renderDialog(detail: DialogDetail) {
  dialogKicker.textContent = resolveText(detail.kicker);
  dialogTitle.textContent = resolveText(detail.title);
  dialogCopy.textContent = resolveText(detail.copy);
  dialogActions.replaceChildren();
  for (const action of detail.actions || []) {
    const link = document.createElement("a");
    link.className = "pixel-button dialog-button";
    link.href = action.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = resolveText(action.label) + " ↗";
    dialogActions.append(link);
  }
}

function renderLocale() {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  document.title = textFor("pageTitle");
  document.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.locale === locale));
  });
  const ids: Array<[string, string]> = [
    ["loading-eyebrow", "loadingEyebrow"], ["loading-title", "loadingTitle"], ["loading-subtitle", "loadingSubtitle"],
    ["route-dock", "dock"], ["route-town", "town"], ["route-cave", "cave"], ["enter-town", "enter"],
    ["loading-hint", "loadingHint"], ["loading-credits-kicker", "creditsKicker"], ["loading-credits-title", "creditsTitle"],
    ["loading-credit-ninja", "creditsNinja"], ["loading-credit-jacquard", "creditsJacquard"], ["loading-credit-full", "creditsFull"],
    ["credits-link", "credits"], ["help-toggle", "help"], ["music-toggle", "radio"], ["help-title", "helpTitle"],
    ["help-move", "move"], ["help-move-key", "moveKey"], ["help-action", "action"], ["help-action-key", "actionKey"],
    ["help-attack", "attack"], ["help-copy", "helpCopy"], ["music-kicker", "radioKicker"], ["music-title", "radioTitle"],
    ["volume-label", "volume"], ["reset-track", "reset"], ["close-link-dialog", "stay"],
  ];
  ids.forEach(([id, key]) => setText(id, key));
  loadingStatus.textContent = preloadReady ? textFor("ready") : textFor("loading" + Math.max(1, preloadStage));
  placeName.textContent = currentPlace ? resolveText(currentPlace) : textFor("defaultPlace");
  document.querySelector<HTMLAnchorElement>(".skip-link")!.textContent = textFor("skip");
  document.querySelector<HTMLElement>(".loading-progress")!.setAttribute("aria-label", textFor("loadingProgress"));
  byId("world-shell").setAttribute("aria-label", textFor("world"));
  document.querySelector<HTMLElement>(".world-hud")!.setAttribute("aria-label", textFor("status"));
  byId("help-panel").querySelector<HTMLButtonElement>(".panel-close")!.setAttribute("aria-label", textFor("closeHelp"));
  byId("music-panel").querySelector<HTMLButtonElement>(".panel-close")!.setAttribute("aria-label", textFor("closeRadio"));
  prevTrack.setAttribute("aria-label", textFor("previous"));
  nextTrack.setAttribute("aria-label", textFor("next"));
  const touch = document.querySelector<HTMLElement>(".touch-controls")!;
  touch.setAttribute("aria-label", textFor("touch"));
  (["up", "left", "down", "right"] as const).forEach((key, index) => {
    touch.querySelectorAll("button")[index].setAttribute("aria-label", textFor(key));
  });
  touch.querySelectorAll("button")[4].setAttribute("aria-label", textFor("swing"));
  touch.querySelectorAll("button")[5].setAttribute("aria-label", textFor("interact"));
  renderTrackList();
  updateTrackMeta();
  syncAudioControls();
  if (currentDialog) renderDialog(currentDialog);
}
function setLocale(next: Locale) {
  locale = next;
  localStorage.setItem(LOCALE_KEY, locale);
  renderLocale();
  window.dispatchEvent(new CustomEvent("wayfarer:locale", { detail: locale }));
}

function openPanel(panel: HTMLElement, button: HTMLButtonElement) {
  [helpPanel, musicPanel].forEach((candidate) => { if (candidate !== panel) candidate.hidden = true; });
  const opening = panel.hidden;
  panel.hidden = !opening;
  helpButton.setAttribute("aria-expanded", String(helpPanel === panel && opening));
  musicButton.setAttribute("aria-expanded", String(musicPanel === panel && opening));
  if (opening) panel.querySelector<HTMLElement>("button, [href]")?.focus();
}
function closePanel(panel: HTMLElement) {
  panel.hidden = true;
  if (panel === helpPanel) helpButton.setAttribute("aria-expanded", "false");
  if (panel === musicPanel) musicButton.setAttribute("aria-expanded", "false");
}
function showDialog(detail: DialogDetail) {
  stopAllHeldDirections();
  helpPanel.hidden = true;
  musicPanel.hidden = true;
  currentDialog = detail;
  renderDialog(detail);
  dialog.hidden = false;
  dialogActions.querySelector<HTMLElement>("a, button")?.focus() || dialogClose.focus();
}
function closeDialog() {
  dialog.hidden = true;
  currentDialog = null;
  byId<HTMLElement>("rpg").focus();
}
function showToast(message: string | LocalizedText, duration = 2800) {
  window.clearTimeout(toastTimer);
  toast.textContent = typeof message === "string" ? message : resolveText(message);
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, duration);
}

async function preloadBirthArea() {
  const essentials = ["/assets/ninja-v1/characters/ninja-blue-source.png", "/map/world-flat.png", "/assets/ninja-v1/ui/panel.png"];
  let loaded = 0;
  await Promise.all(essentials.map((url, index) => new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = image.onerror = () => {
      loaded += 1;
      preloadStage = index + 1;
      loadingBar.style.width = String(Math.round((loaded / essentials.length) * 100)) + "%";
      loadingStatus.textContent = textFor("loading" + preloadStage);
      resolve();
    };
    image.src = url;
  })));
  const started = performance.now();
  while (!document.querySelector("#rpg canvas") && performance.now() - started < 8000) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  preloadReady = true;
  loadingBar.style.width = "100%";
  loadingStatus.textContent = textFor("ready");
  enterButton.disabled = false;
}

const directionByCode: Partial<Record<string, Direction>> = {
  ArrowUp: Direction.Up,
  ArrowDown: Direction.Down,
  ArrowLeft: Direction.Left,
  ArrowRight: Direction.Right,
};
const heldDirections = new Map<string, Direction>();
const nativeMovementKeys = new Set<string>();
let heldDirectionTimer = 0;
let movementCheckpointTimer = 0;

function worldEngine() {
  return (window as WorldWindow).__wayfarerKeyboardBridge?.engine;
}

function latestHeldDirection() {
  return Array.from(heldDirections.values()).at(-1);
}

function sendHeldDirection() {
  const direction = latestHeldDirection();
  const engine = worldEngine();
  if (direction === undefined || !engine || !document.body.classList.contains("town-entered")) return;
  void engine.processInput({ input: direction });
}

function requestWorldCheckpoint() {
  if (!document.body.classList.contains("town-entered")) return;
  worldEngine()?.processAction("world:checkpoint");
}

function beginMovementCheckpointing() {
  if (!movementCheckpointTimer) movementCheckpointTimer = window.setInterval(requestWorldCheckpoint, 2500);
}

function endMovementCheckpointing() {
  if (heldDirections.size || nativeMovementKeys.size) return;
  window.clearInterval(movementCheckpointTimer);
  movementCheckpointTimer = 0;
  requestWorldCheckpoint();
}

function holdDirection(source: string, direction: Direction) {
  heldDirections.delete(source);
  heldDirections.set(source, direction);
  sendHeldDirection();
  if (!heldDirectionTimer) heldDirectionTimer = window.setInterval(sendHeldDirection, 50);
  beginMovementCheckpointing();
}

function releaseHeldDirection(source: string) {
  heldDirections.delete(source);
  if (heldDirections.size) {
    sendHeldDirection();
    return;
  }
  window.clearInterval(heldDirectionTimer);
  heldDirectionTimer = 0;
  endMovementCheckpointing();
}

function stopAllHeldDirections() {
  heldDirections.clear();
  nativeMovementKeys.clear();
  window.clearInterval(heldDirectionTimer);
  heldDirectionTimer = 0;
  endMovementCheckpointing();
  document.querySelectorAll(".touch-controls .is-pressed").forEach((button) => button.classList.remove("is-pressed"));
}

window.addEventListener("keydown", (event) => {
  const movementKey = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code);
  if (
    movementKey
    && !(event.target as HTMLElement | null)?.matches("input, textarea, select, [contenteditable='true']")
    && document.body.classList.contains("town-entered")
  ) {
    nativeMovementKeys.add(event.code);
    beginMovementCheckpointing();
  }
  if (
    !event.repeat
    && !event.defaultPrevented
    && event.key.toLowerCase() === "x"
    && !(event.target as HTMLElement | null)?.matches("input, textarea, select, [contenteditable='true']")
    && document.body.classList.contains("town-entered")
  ) {
    worldEngine()?.processAction("attack");
  }
  if (event.code === "Escape") {
    stopAllHeldDirections();
    if (!dialog.hidden) closeDialog();
    closePanel(helpPanel);
    closePanel(musicPanel);
  }
});
window.addEventListener("keyup", (event) => {
  if (!nativeMovementKeys.delete(event.code)) return;
  endMovementCheckpointing();
});
window.addEventListener("blur", stopAllHeldDirections);

document.querySelectorAll<HTMLButtonElement>("[data-key]").forEach((button) => {
  const code = button.dataset.key || "Space";
  const direction = directionByCode[code];
  const source = `touch:${code}`;
  const press = (event: PointerEvent) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    button.classList.add("is-pressed");
    if (direction !== undefined) holdDirection(source, direction);
    else worldEngine()?.processAction(code === "KeyX" ? "attack" : "action");
  };
  const release = (event: PointerEvent) => {
    event.preventDefault();
    button.classList.remove("is-pressed");
    if (direction !== undefined) releaseHeldDirection(source);
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", (event) => {
    if (button.classList.contains("is-pressed")) release(event);
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((button) => {
  button.addEventListener("click", () => setLocale(button.dataset.locale as Locale));
});

enterButton.addEventListener("click", async () => {
  loadingScreen.classList.add("is-leaving");
  document.body.classList.add("town-entered");
  window.setTimeout(() => { loadingScreen.hidden = true; byId<HTMLElement>("rpg").focus(); }, 760);
  const waves = new Audio("/assets/ninja-v1/audio/sfx/waves.ogg");
  waves.volume = 0.18;
  void waves.play().catch(() => undefined);
  const list = await loadTracks();
  if (list.length) prepareTrack(selectedTrack() || list[0], true);
  void navigator.storage?.persist?.().catch(() => false);
  warmSecondaryRoutes();
});
helpButton.addEventListener("click", () => openPanel(helpPanel, helpButton));
musicButton.addEventListener("click", () => { void loadTracks(); openPanel(musicPanel, musicButton); });
document.querySelectorAll<HTMLButtonElement>("[data-close-panel]").forEach((button) => {
  button.addEventListener("click", () => closePanel(byId(button.dataset.closePanel || "")));
});
dialogClose.addEventListener("click", closeDialog);
dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });
prevTrack.addEventListener("click", () => void stepTrack(-1));
nextTrack.addEventListener("click", () => void stepTrack(1));
playTrack.addEventListener("click", async () => {
  const list = await loadTracks();
  if (!list.length) return;
  if (!audio.src) prepareTrack(selectedTrack() || list[0]);
  if (audio.paused) await audio.play().catch(() => showToast(textFor("playFail")));
  else audio.pause();
  syncAudioControls();
});
muteTrack.addEventListener("click", () => { settings.muted = !settings.muted; saveAudioSettings(); syncAudioControls(); });
loopTrack.addEventListener("click", () => { settings.loop = !settings.loop; saveAudioSettings(); syncAudioControls(); });
resetTrack.addEventListener("click", async () => {
  settings = { ...DEFAULT_AUDIO };
  saveAudioSettings();
  syncAudioControls();
  const list = await loadTracks();
  const defaultTrack = list.find((track) => track.id === DEFAULT_AUDIO.trackId) || list[0];
  if (defaultTrack) prepareTrack(defaultTrack, !audio.paused);
});
volume.addEventListener("input", () => { settings.volume = Number(volume.value); saveAudioSettings(); syncAudioControls(); });
audio.addEventListener("play", syncAudioControls);
audio.addEventListener("pause", syncAudioControls);
audio.addEventListener("ended", () => { if (!settings.loop) void stepTrack(1); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { resumeAfterVisibility = !audio.paused; audio.pause(); }
  else if (resumeAfterVisibility) { void audio.play().catch(() => undefined); resumeAfterVisibility = false; }
});

window.addEventListener("wayfarer:dialog", (event) => showDialog((event as CustomEvent<DialogDetail>).detail));
window.addEventListener("wayfarer:music", () => { void loadTracks(); openPanel(musicPanel, musicButton); });
window.addEventListener("wayfarer:place", (event) => {
  currentPlace = (event as CustomEvent<LocalizedText>).detail;
  placeName.textContent = resolveText(currentPlace);
});
window.addEventListener("wayfarer:toast", (event) => showToast((event as CustomEvent<string | LocalizedText>).detail));
window.addEventListener("wayfarer:slash", () => {
  document.body.classList.remove("slash-flash");
  requestAnimationFrame(() => document.body.classList.add("slash-flash"));
  window.setTimeout(() => document.body.classList.remove("slash-flash"), 260);
});

function installLocalQaControls() {
  const localHost = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  if (!localHost || !new URLSearchParams(location.search).has("qa")) return;
  const command = document.createElement("input");
  command.type = "text";
  command.dataset.testid = "qa-world-command";
  command.value = JSON.stringify({ code: "ArrowUp", duration: 1000 });
  Object.assign(command.style, { position: "fixed", zIndex: "9999", top: "0", left: "0", width: "230px", height: "28px" });
  const hold = document.createElement("button");
  hold.type = "button";
  hold.dataset.testid = "qa-world-hold";
  hold.textContent = "hold";
  Object.assign(hold.style, { position: "fixed", zIndex: "9999", top: "0", left: "232px", width: "60px", height: "28px" });
  hold.addEventListener("click", () => {
    let value: { code?: string; duration?: number } = {};
    try { value = JSON.parse(command.value || "{}"); } catch { value = {}; }
    const code = value.code || "ArrowUp";
    if (code === "State") {
      const player = worldEngine()?.getCurrentPlayer?.();
      command.value = JSON.stringify({
        x: Math.round(player?.x?.() ?? Number.NaN),
        y: Math.round(player?.y?.() ?? Number.NaN),
      });
      return;
    }
    if (code === "Space" || code === "Enter" || code === "KeyX") {
      worldEngine()?.processAction(code === "KeyX" ? "attack" : "action");
      return;
    }
    const duration = clampQaDuration(value.duration);
    const direction = directionByCode[code];
    if (direction === undefined) return;
    holdDirection("qa", direction);
    window.setTimeout(() => releaseHeldDirection("qa"), duration);
  });
  document.body.append(command, hold);
}

function clampQaDuration(value: number | undefined) {
  return Math.max(30, Math.min(15000, Number(value) || 1000));
}

function connectWorldEngine(attempt = 0) {
  if (worldEngine() || attempt >= 80) return;
  window.setTimeout(() => connectWorldEngine(attempt + 1), 100);
}

renderLocale();
installLocalQaControls();
connectWorldEngine();
void preloadBirthArea();
