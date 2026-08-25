import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function attributes(source) {
  return Object.fromEntries([...source.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}

function loadMap(name) {
  const xml = readFileSync(resolve(root, "src/world/tiled", `${name}.tmx`), "utf8");
  const mapTag = xml.match(/<map\b([^>]*)>/)?.[1];
  if (!mapTag) throw new Error(`${name}: missing map element`);
  const mapAttributes = attributes(mapTag);
  const width = Number(mapAttributes.width);
  const height = Number(mapAttributes.height);
  if (!width || !height) throw new Error(`${name}: invalid dimensions`);
  if (!/<objectgroup\b[^>]*name="RPGJS Entities"/.test(xml)) {
    throw new Error(`${name}: missing RPGJS Entities layer`);
  }

  const layers = [...xml.matchAll(/<layer\b([^>]*)>([\s\S]*?)<\/layer>/g)];
  if (!layers.length) throw new Error(`${name}: no tile layers`);
  let collision = null;
  for (const [, tag, body] of layers) {
    const layerAttributes = attributes(tag);
    const csv = body.match(/<data\b[^>]*encoding="csv"[^>]*>([\s\S]*?)<\/data>/)?.[1];
    if (!csv) throw new Error(`${name}/${layerAttributes.name || "unnamed"}: missing CSV data`);
    const values = csv.split(/[\s,]+/).filter(Boolean).map(Number);
    if (values.length !== width * height) {
      throw new Error(`${name}/${layerAttributes.name}: expected ${width * height} cells, found ${values.length}`);
    }
    if (layerAttributes.name === "Collision") collision = values.map(Boolean);
  }
  if (!collision) throw new Error(`${name}: missing Collision layer`);
  return { name, width, height, collision };
}

const key = (x, y) => `${x},${y}`;

function verifyReachability(map, start, targets, blockingEvents) {
  const blocked = new Set(blockingEvents.map(([x, y]) => key(x, y)));
  const isOpen = (x, y) => (
    x >= 0 && y >= 0 && x < map.width && y < map.height
    && !map.collision[y * map.width + x]
    && !blocked.has(key(x, y))
  );
  if (!isOpen(...start)) throw new Error(`${map.name}: start ${key(...start)} is blocked`);

  const reached = new Set([key(...start)]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const [x, y] = queue[index];
    for (const [nextX, nextY] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const nextKey = key(nextX, nextY);
      if (isOpen(nextX, nextY) && !reached.has(nextKey)) {
        reached.add(nextKey);
        queue.push([nextX, nextY]);
      }
    }
  }

  for (const { name, at: [x, y] } of targets) {
    const approach = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1], [x, y]];
    if (!approach.some(([nextX, nextY]) => reached.has(key(nextX, nextY)))) {
      throw new Error(`${map.name}: ${name} at ${key(x, y)} cannot be approached from ${key(...start)}`);
    }
  }
  return reached.size;
}

const worldTargets = [
  ["about marker", 23, 16], ["contact marker", 25, 16], ["social marker", 27, 16],
  ["radio", 25, 18], ["captain", 29, 50], ["dock routes", 33, 53],
  ["library", 35, 6], ["town hall", 31, 6], ["cottage", 24, 6],
  ["forest NPC", 24, 9], ["village pig", 30, 18],
  ["green samurai", 29, 15], ["blue samurai", 24, 8], ["adventure cave", 32, 7],
  ["travel shell", 42, 10], ["games shell", 44, 12], ["anime shell", 46, 14],
  ["music shell", 42, 16], ["life shell", 45, 18],
].map(([name, x, y]) => ({ name, at: [x, y] }));

const world = loadMap("world");
const worldReachable = verifyReachability(
  world,
  [31, 56],
  worldTargets,
  worldTargets.map(({ at }) => at),
);

const interiors = [
  {
    name: "library",
    targets: [["exit", 10, 13], ["résumé", 3, 4], ["experience", 7, 4], ["articles", 11, 4], ["learning", 15, 4]],
  },
  { name: "town-hall", targets: [["exit", 10, 13], ["credits", 10, 5], ["clerk", 7, 8]] },
  { name: "cottage", targets: [["exit", 10, 13], ["innkeeper", 10, 6]] },
];

for (const interior of interiors) {
  const map = loadMap(interior.name);
  const targets = interior.targets.map(([name, x, y]) => ({ name, at: [x, y] }));
  verifyReachability(map, [10, 12], targets, targets.map(({ at }) => at));
}

console.log(`Verified four maps; ${worldReachable} world cells are connected to every required interaction.`);
