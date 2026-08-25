// Kept byte-for-byte and frame-for-frame with Pixel-Boy's reference project:
// https://github.com/pixel-boy/NinjaAdventure/blob/main/system/character/sprite_character.gd
export const NINJA_ACTOR_FRAME_SIZE = 16;
export const NINJA_ACTOR_FPS = 6;
export const NINJA_ACTOR_FRAME_TICKS = 60 / NINJA_ACTOR_FPS;
export const NINJA_WORLD_SCALE = 2;
export const NINJA_ACTOR_SPEED = 100 * NINJA_WORLD_SCALE;
export const NINJA_ACTOR_Y_OFFSET = -6 * NINJA_WORLD_SCALE;

export const NINJA_ACTOR_DIRECTION_COLUMN = {
  down: 0,
  up: 1,
  left: 2,
  right: 3,
} as const;

export const NINJA_ACTOR_ROWS = {
  stand: 0,
  walk: [0, 1, 2, 3],
  attack: 4,
  defense: 5,
  skill: 6,
} as const;

export type NinjaActorDirection = keyof typeof NINJA_ACTOR_DIRECTION_COLUMN;
