#!/usr/bin/env python3
"""Build normalized Ninja sprites and the Tiled maps used by the RPGJS world."""

from __future__ import annotations

import csv
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw

from ninja_reference import reference_collision_cells, reference_floor_cells, render_main


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets" / "ninja-v1"
RAW = ASSETS / "raw" / "tilesets"
TILED = ROOT / "src" / "world" / "tiled"
TILE = 32


def nearest(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return image.resize(size, Image.Resampling.NEAREST)


def crop_tile(image: Image.Image, x: int, y: int) -> Image.Image:
    return nearest(image.crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16)), (TILE, TILE))


def normalize_actor(source: str, target: str) -> None:
    image = Image.open(ASSETS / "characters" / source).convert("RGBA")
    image.crop((0, 0, 64, 64)).save(ASSETS / "characters" / target, optimize=True)


def paste_sprite(canvas: Image.Image, source: Image.Image, box: tuple[int, int, int, int], tile_x: int, tile_y: int, scale: int = 2) -> tuple[int, int, int, int]:
    sprite = source.crop(box)
    sprite = nearest(sprite, (sprite.width * scale, sprite.height * scale))
    px = tile_x * TILE
    py = tile_y * TILE
    canvas.alpha_composite(sprite, (px, py))
    return (tile_x, tile_y, (sprite.width + TILE - 1) // TILE, (sprite.height + TILE - 1) // TILE)


def write_tileset(path: Path, name: str, image_name: str, count: int, columns: int, collision_id: int) -> None:
    path.write_text(
        f'''<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.10.2" name="{name}" tilewidth="32" tileheight="32" tilecount="{count}" columns="{columns}">
 <image source="{image_name}" width="{columns * TILE}" height="32"/>
 <tile id="{collision_id}"><properties><property name="collision" type="bool" value="true"/></properties></tile>
</tileset>
''',
        encoding="utf-8",
    )


def write_image_tileset(path: Path, name: str, image_name: str, width: int, height: int) -> None:
    path.write_text(
        f'''<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.10.2" name="{name}" tilewidth="32" tileheight="32" tilecount="{width * height}" columns="{width}">
 <image source="{image_name}" width="{width * TILE}" height="{height * TILE}"/>
</tileset>
''',
        encoding="utf-8",
    )


def csv_data(rows: list[list[int]]) -> str:
    # Tiled's CSV encoding is one comma-delimited sequence. Newlines are only
    # formatting whitespace, so each row boundary still needs a comma.
    return ",\n".join(",".join(str(value) for value in row) for row in rows)


def write_map(path: Path, width: int, height: int, tileset: str, ground: list[list[int]], collision: list[list[int]], decor_tileset: str, decor_first_gid: int) -> None:
    decor_image = Image.open(TILED / decor_tileset.replace(".tsx", ".png")).convert("RGBA")
    decor = []
    for row in range(height):
        values = []
        for column in range(width):
            alpha = decor_image.getchannel("A").crop((column * TILE, row * TILE, (column + 1) * TILE, (row + 1) * TILE))
            values.append(decor_first_gid + row * width + column if alpha.getbbox() else 0)
        decor.append(values)
    path.write_text(
        f'''<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="{width}" height="{height}" tilewidth="32" tileheight="32" infinite="0" nextlayerid="4" nextobjectid="1">
 <tileset firstgid="1" source="{escape(tileset)}"/>
 <tileset firstgid="{decor_first_gid}" source="{escape(decor_tileset)}"/>
 <layer id="1" name="Ground" width="{width}" height="{height}">
  <data encoding="csv">{csv_data(ground)}</data>
 </layer>
 <layer id="2" name="Ninja Decorations" width="{width}" height="{height}">
  <data encoding="csv">{csv_data(decor)}</data>
 </layer>
 <layer id="3" name="Collision" width="{width}" height="{height}" opacity="0">
  <data encoding="csv">{csv_data(collision)}</data>
 </layer>
</map>
''',
        encoding="utf-8",
    )


def write_flat_map(
    path: Path,
    width: int,
    height: int,
    flat_tileset: str,
    visible: list[list[int]],
    flat_tile_count: int,
    collision_tileset: str,
    collision: list[list[int]],
    collision_tile_id: int,
) -> None:
    collision_gid = flat_tile_count + 1 + collision_tile_id
    mapped_collision = [[collision_gid if value else 0 for value in row] for row in collision]
    path.write_text(
        f'''<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="{width}" height="{height}" tilewidth="32" tileheight="32" infinite="0" nextlayerid="4" nextobjectid="1">
 <tileset firstgid="1" source="{escape(flat_tileset)}"/>
 <tileset firstgid="{flat_tile_count + 1}" source="{escape(collision_tileset)}"/>
 <layer id="1" name="Ground and Ninja Decorations" width="{width}" height="{height}">
  <data encoding="csv">{csv_data(visible)}</data>
 </layer>
 <objectgroup id="2" name="RPGJS Entities"/>
 <layer id="3" name="Collision" width="{width}" height="{height}" opacity="0" visible="0">
  <data encoding="csv">{csv_data(mapped_collision)}</data>
 </layer>
</map>
''',
        encoding="utf-8",
    )


def write_basic_map(path: Path, width: int, height: int, tileset: str, ground: list[list[int]]) -> None:
    path.write_text(
        f'''<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="{width}" height="{height}" tilewidth="32" tileheight="32" infinite="0" nextlayerid="2" nextobjectid="1">
 <tileset firstgid="1" source="{escape(tileset)}"/>
 <layer id="1" name="Ground" width="{width}" height="{height}">
  <data encoding="csv">{csv_data(ground)}</data>
 </layer>
</map>
''',
        encoding="utf-8",
    )


def flatten_map(
    atlas: Image.Image,
    ground: list[list[int]],
    decor: Image.Image,
    packing_columns: int,
    composed_ground: Image.Image | None = None,
) -> tuple[Image.Image, int, list[list[int]], int]:
    height = len(ground)
    width = len(ground[0])
    if composed_ground is not None:
        composed = composed_ground.copy()
    else:
        composed = Image.new("RGBA", (width * TILE, height * TILE), (0, 0, 0, 255))
        for row, values in enumerate(ground):
            for column, gid in enumerate(values):
                source_x = (gid - 1) * TILE
                tile = atlas.crop((source_x, 0, source_x + TILE, TILE))
                composed.alpha_composite(tile, (column * TILE, row * TILE))
    composed.alpha_composite(decor)
    unique_tiles: list[Image.Image] = []
    tile_lookup: dict[bytes, int] = {}
    for source_x in range(0, atlas.width, TILE):
        base_tile = atlas.crop((source_x, 0, source_x + TILE, TILE))
        key = base_tile.tobytes()
        if key not in tile_lookup:
            tile_lookup[key] = len(unique_tiles)
            unique_tiles.append(base_tile)
    visible: list[list[int]] = []
    for row in range(height):
        visible_row = []
        for column in range(width):
            tile = composed.crop((column * TILE, row * TILE, (column + 1) * TILE, (row + 1) * TILE))
            key = tile.tobytes()
            if key not in tile_lookup:
                tile_lookup[key] = len(unique_tiles)
                unique_tiles.append(tile)
            visible_row.append(tile_lookup[key] + 1)
        visible.append(visible_row)
    packing_rows = (len(unique_tiles) + packing_columns - 1) // packing_columns
    packed_tile_count = packing_columns * packing_rows
    packed = Image.new("RGBA", (packing_columns * TILE, packing_rows * TILE), (0, 0, 0, 255))
    for index, tile in enumerate(unique_tiles):
        packed.alpha_composite(tile, ((index % packing_columns) * TILE, (index // packing_columns) * TILE))
    return packed, packing_rows, visible, packed_tile_count


def rect(grid: list[list[int]], x: int, y: int, width: int, height: int, value: int) -> None:
    for row in range(max(0, y), min(len(grid), y + height)):
        for column in range(max(0, x), min(len(grid[0]), x + width)):
            grid[row][column] = value


def paint_ellipse(
    grid: list[list[int]],
    center_x: float,
    center_y: float,
    radius_x: float,
    radius_y: float,
    value: int,
) -> None:
    """Paint a compact organic area without falling back to hard rectangles."""
    min_x = max(0, int(center_x - radius_x - 1))
    max_x = min(len(grid[0]), int(center_x + radius_x + 2))
    min_y = max(0, int(center_y - radius_y - 1))
    max_y = min(len(grid), int(center_y + radius_y + 2))
    for y in range(min_y, max_y):
        for x in range(min_x, max_x):
            normalized = ((x - center_x) / radius_x) ** 2 + ((y - center_y) / radius_y) ** 2
            if normalized <= 1:
                grid[y][x] = value


def paint_path(
    grid: list[list[int]],
    points: list[tuple[float, float]],
    radius: float,
    value: int,
) -> None:
    """Join waypoints with a soft tile brush so roads bend like the demo map."""
    for start, end in zip(points, points[1:]):
        delta_x = end[0] - start[0]
        delta_y = end[1] - start[1]
        steps = max(1, int(max(abs(delta_x), abs(delta_y)) * 3))
        for step in range(steps + 1):
            progress = step / steps
            paint_ellipse(
                grid,
                start[0] + delta_x * progress,
                start[1] + delta_y * progress,
                radius,
                radius,
                value,
            )


def paint_autotile(
    canvas: Image.Image,
    source: Image.Image,
    mask: list[list[bool]],
    source_row: int,
) -> None:
    """Paint the pack's 3x3 rounded edge set over the existing terrain."""
    height = len(mask)
    width = len(mask[0])

    def filled(x: int, y: int) -> bool:
        # Continue terrain through the map boundary instead of drawing a dark
        # outline around the edge of the world.
        if x < 0 or y < 0 or x >= width or y >= height:
            return True
        return mask[y][x]

    for y in range(height):
        for x in range(width):
            if not mask[y][x]:
                continue
            north = filled(x, y - 1)
            south = filled(x, y + 1)
            west = filled(x - 1, y)
            east = filled(x + 1, y)
            tile_x = 1
            tile_y = 1
            if not north:
                tile_y = 0
            elif not south:
                tile_y = 2
            if not west:
                tile_x = 0
            elif not east:
                tile_x = 2
            tile = crop_tile(source, tile_x, source_row + tile_y)
            canvas.alpha_composite(tile, (x * TILE, y * TILE))


def compose_world_ground(
    field: Image.Image,
    water: Image.Image,
    grass: Image.Image,
    dock: Image.Image,
    ground: list[list[int]],
) -> Image.Image:
    height = len(ground)
    width = len(ground[0])
    canvas = Image.new("RGBA", (width * TILE, height * TILE), (0, 0, 0, 255))

    for y in range(height):
        for x in range(width):
            canvas.alpha_composite(grass, (x * TILE, y * TILE))

    forest_mask = [[ground[y][x] == 2 for x in range(width)] for y in range(height)]
    sea_mask = [[ground[y][x] in (4, 5) for x in range(width)] for y in range(height)]
    # Treat dock cells as part of the sand route while choosing edge tiles.
    # The dock is painted over the result below, so this keeps the road's
    # southern edge open instead of inserting a rounded grass seam between
    # the route and the first dock plank.
    sand_mask = [[ground[y][x] in (3, 5) for x in range(width)] for y in range(height)]
    paint_autotile(canvas, field, forest_mask, 6)
    # The green-edged water set creates an actual Ninja shoreline instead of
    # a hard horizontal grass/blue cut. Dock cells participate in the mask so
    # the water edge continues behind the planks rather than across them.
    paint_autotile(canvas, water, sea_mask, 6)
    paint_autotile(canvas, field, sand_mask, 0)

    for y in range(height):
        for x in range(width):
            if ground[y][x] == 5:
                canvas.alpha_composite(dock, (x * TILE, y * TILE))
    return canvas


def _build_legacy_world() -> None:
    width, height = 40, 72
    field = Image.open(RAW / "field.png").convert("RGBA")
    water = Image.open(RAW / "water.png").convert("RGBA")
    grass = crop_tile(field, 1, 4)
    forest = crop_tile(field, 1, 7)
    sand = crop_tile(field, 1, 1)
    sea = crop_tile(water, 1, 1)
    dock = crop_tile(water, 1, 13)
    transparent = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    atlas = Image.new("RGBA", (TILE * 6, TILE), (0, 0, 0, 0))
    for index, image in enumerate((grass, forest, sand, sea, dock, transparent)):
        atlas.alpha_composite(image, (index * TILE, 0))
    atlas.save(TILED / "world-tiles.png", optimize=True)
    write_tileset(TILED / "world-tiles.tsx", "wayfarer-world", "world-tiles.png", 6, 6, 5)

    ground = [[1 for _ in range(width)] for _ in range(height)]
    collision = [[0 for _ in range(width)] for _ in range(height)]

    # The reference project builds regions as overlapping silhouettes instead
    # of rectangular fills. The northern forest and southern shoreline both
    # vary by column, while one continuous sand route ties every landmark to
    # the harbor.
    forest_edge = (21, 21, 20, 20, 19, 20, 21, 22, 21, 20, 19, 19, 20, 21, 22, 22, 21, 20, 19, 18,
                   18, 19, 20, 21, 22, 22, 21, 20, 19, 19, 20, 21, 22, 21, 20, 19, 20, 21, 21, 20)
    coast_offset = (0, 0, 1, 1, 0, -1, -1, 0, 1, 0, -1, 0, 1, 1, 0, -1, 0, 1, 0, -1,
                    -1, 0, 1, 0, -1, 0, 1, 1, 0, -1, -1, 0, 1, 0, -1, 0, 1, 1, 0, 0)
    for x in range(width):
        for y in range(forest_edge[x]):
            ground[y][x] = 2
        for y in range(64 + coast_offset[x], height):
            ground[y][x] = 4

    # Interest beach, central square, three building approaches and the
    # winding north-hill trail all share the same warm Ninja sand family.
    # The square is intentionally compact: the official demo keeps buildings
    # and props inside one readable camera composition instead of surrounding
    # a nearly empty plaza.
    paint_ellipse(ground, 6.5, 51, 6.5, 9.5, 3)
    paint_ellipse(ground, 20, 39, 6.6, 5.2, 3)
    paint_path(ground, [(20, 64), (20, 60), (19, 56), (21, 52), (19, 48), (20, 44)], 1.55, 3)
    paint_path(ground, [(15, 40), (13, 40), (11, 40)], 1.35, 3)
    paint_path(ground, [(25, 40), (27, 40), (29, 40)], 1.35, 3)
    paint_path(ground, [(15, 42), (12, 45), (9, 48), (7, 51)], 1.45, 3)
    # The north trail bends around the town hall rather than disappearing
    # through it. A short spur reaches the hall door from the main route.
    paint_path(ground, [(22, 36), (25, 32), (25, 28), (23, 24), (20, 21), (19, 16), (21, 11), (20, 5)], 1.5, 3)
    paint_path(ground, [(24, 35), (22, 34), (20, 34)], 1.3, 3)

    # The dock is painted last so it becomes the literal continuation of the
    # route, not an unrelated rectangle floating in the sea.
    rect(ground, 18, 63, 5, 9, 5)

    collision_gid = 6
    rect(collision, 0, 0, width, 1, collision_gid)
    rect(collision, 0, height - 1, width, 1, collision_gid)
    rect(collision, 0, 0, 1, height, collision_gid)
    rect(collision, width - 1, 0, 1, height, collision_gid)
    for y in range(height):
        for x in range(width):
            if ground[y][x] == 4:
                collision[y][x] = collision_gid

    decor = Image.new("RGBA", (width * TILE, height * TILE), (0, 0, 0, 0))
    houses = Image.open(RAW / "houses.png").convert("RGBA")
    nature = Image.open(RAW / "nature.png").convert("RGBA")
    camp = Image.open(RAW / "camp.png").convert("RGBA")
    boat = Image.open(ASSETS / "items" / "boat.png").convert("RGBA")

    # Three compact, fully enterable buildings frame the square. Every visible
    # house is a real destination; there is no decorative false door. Their
    # collision footprint matches the actual four-tile sprite width.
    paste_sprite(decor, houses, (12 * 16, 0, 16 * 16, 4 * 16), 18, 30)
    paste_sprite(decor, houses, (24 * 16, 0, 28 * 16, 4 * 16), 27, 36)
    paste_sprite(decor, houses, (0, 0, 4 * 16, 4 * 16), 9, 36)
    rect(collision, 18, 32, 4, 2, collision_gid)
    rect(collision, 27, 38, 4, 2, collision_gid)
    rect(collision, 9, 38, 4, 2, collision_gid)

    # Cave arch and harbor boat.
    paste_sprite(decor, houses, (29 * 16, 20 * 16, 33 * 16, 23 * 16), 18, 1)
    decor.alpha_composite(nearest(boat, (160, 64)), (16 * TILE, 66 * TILE))

    # Dense, overlapping tree groups create the same readable outer wall used
    # by the official Godot demo. Trees are only placed off the sand route.
    tree_boxes = [
        (0, 0, 32, 32),
        (32, 0, 64, 32),
        (64, 0, 96, 32),
        (96, 0, 128, 32),
    ]
    tree_positions = [
        (0, 2), (3, 0), (6, 4), (9, 1), (12, 5), (15, 2),
        (23, 3), (26, 0), (29, 4), (32, 1), (35, 5), (38, 2),
        (1, 10), (4, 12), (7, 8), (10, 14), (13, 10), (15, 16),
        (24, 12), (27, 15), (30, 10), (34, 14), (37, 9),
        (1, 18), (4, 21), (7, 18), (10, 22), (13, 19),
        (27, 19), (31, 22), (35, 18), (38, 23),
        (3, 27), (6, 29), (10, 27), (13, 31),
        (25, 29), (28, 27), (33, 29), (36, 31),
        (2, 34), (4, 38), (5, 42), (13, 44),
        (25, 45), (33, 43), (35, 39), (37, 35),
        (14, 48), (26, 49), (13, 53), (27, 54),
        (11, 58), (29, 59), (6, 62), (33, 62),
    ]
    for index, (x, y) in enumerate(tree_positions):
        footprint = [ground[row][column] for row in range(y, min(height, y + 2)) for column in range(x, min(width, x + 2))]
        if not footprint or any(tile in (3, 4, 5) for tile in footprint):
            continue
        paste_sprite(decor, nature, tree_boxes[index % len(tree_boxes)], x, y)
        rect(collision, x, y + 1, 2, 1, collision_gid)

    # Small props are grouped around landmarks, leaving deliberate breathing
    # room on the path. They are individual Ninja sprites, not arbitrary atlas
    # chunks, so transparent gaps never read as accidental composition.
    ground_cover_boxes = [
        (0, 160, 16, 176), (16, 160, 32, 176), (32, 160, 48, 176),
        (48, 160, 64, 176), (64, 160, 80, 176), (80, 160, 96, 176),
        (0, 176, 16, 192), (16, 176, 32, 192), (48, 176, 64, 192),
    ]
    ground_cover_positions = [
        (15, 32), (23, 31), (16, 35), (24, 34),
        (7, 36), (13, 37), (8, 42), (13, 42),
        (25, 37), (32, 36), (26, 42), (33, 41),
        (14, 36), (26, 36), (14, 44), (26, 45),
        (2, 45), (10, 47), (2, 54), (9, 56), (5, 60),
        (15, 49), (25, 50), (15, 57), (26, 58),
        (13, 62), (29, 62),
    ]
    for index, (x, y) in enumerate(ground_cover_positions):
        if ground[y][x] == 4:
            continue
        paste_sprite(decor, nature, ground_cover_boxes[index % len(ground_cover_boxes)], x, y)

    # Two stumps and a compact tent establish small story clusters on the long
    # road and at the forest threshold.
    paste_sprite(decor, nature, (0, 128, 32, 160), 12, 57)
    paste_sprite(decor, nature, (32, 128, 64, 160), 27, 52)
    rect(collision, 12, 58, 2, 1, collision_gid)
    rect(collision, 27, 53, 2, 1, collision_gid)
    paste_sprite(decor, camp, (32, 0, 112, 64), 29, 18)
    rect(collision, 29, 21, 5, 1, collision_gid)
    decor.save(TILED / "world-decor.png", optimize=True)
    composed_ground = compose_world_ground(field, water, grass, dock, ground)
    flattened, packed_rows, visible, flat_tile_count = flatten_map(atlas, ground, decor, 16, composed_ground)
    flattened.save(TILED / "world-flat.png", optimize=True)
    write_image_tileset(TILED / "world-flat.tsx", "world-flat", "world-flat.png", 16, packed_rows)
    write_flat_map(TILED / "world.tmx", width, height, "world-flat.tsx", visible, flat_tile_count, "world-tiles.tsx", collision, 5)


def build_world() -> None:
    """Import the official Ninja Adventure village and attach the harbor."""
    width, reference_height, height = 50, 45, 60
    water = Image.open(RAW / "water.png").convert("RGBA")
    official_floor = Image.open(
        ROOT / "scripts" / "reference" / "ninja-adventure" / "map" / "tileset_floor.png"
    ).convert("RGBA")
    grass = nearest(official_floor.crop((0, 12 * 16, 16, 13 * 16)), (TILE, TILE))
    shore = crop_tile(water, 1, 5)
    sea = crop_tile(water, 1, 7)
    dock = crop_tile(water, 1, 13)
    transparent = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))

    # A compact helper atlas remains solely for the invisible collision layer;
    # every visible tile below is flattened from the official rendered map.
    atlas = Image.new("RGBA", (TILE * 6, TILE), (0, 0, 0, 0))
    for index, image in enumerate((grass, shore, sea, dock, transparent, transparent)):
        atlas.alpha_composite(image, (index * TILE, 0))
    atlas.save(TILED / "world-tiles.png", optimize=True)
    write_tileset(TILED / "world-tiles.tsx", "ninja-reference-world", "world-tiles.png", 6, 6, 5)

    composed = Image.new("RGBA", (width * TILE, height * TILE), (0, 0, 0, 255))
    for y in range(height):
        for x in range(width):
            composed.alpha_composite(grass, (x * TILE, y * TILE))

    official_main = nearest(render_main(), (width * TILE, reference_height * TILE))
    composed.alpha_composite(official_main)

    # Continue the official village's southern trail with a repeated slice of
    # its own dirt road, then meet a straight shoreline. The straight edge is
    # deliberate: it avoids inventing new shoreline corners and preserves the
    # pack's correct edge tiles.
    road_slice = official_main.crop((30 * TILE, 32 * TILE, 33 * TILE, 36 * TILE))
    composed.alpha_composite(road_slice, (30 * TILE, 36 * TILE))
    composed.alpha_composite(road_slice, (30 * TILE, 40 * TILE))
    road_tail = road_slice.crop((0, 0, road_slice.width, TILE))
    composed.alpha_composite(road_tail, (30 * TILE, 44 * TILE))

    for x in range(width):
        composed.alpha_composite(shore, (x * TILE, 45 * TILE))
        for y in range(46, height):
            composed.alpha_composite(sea, (x * TILE, y * TILE))
    for x in range(29, 34):
        for y in range(44, height):
            composed.alpha_composite(dock, (x * TILE, y * TILE))

    boat = Image.open(ASSETS / "items" / "boat.png").convert("RGBA")
    composed.alpha_composite(nearest(boat, (160, 64)), (24 * TILE, 52 * TILE))

    collision_gid = 6
    collision = [[0 for _ in range(width)] for _ in range(height)]
    official_floor_cells = reference_floor_cells()
    for y in range(reference_height):
        for x in range(width):
            if (x, y) not in official_floor_cells:
                collision[y][x] = collision_gid
    for x, y in reference_collision_cells():
        collision[y][x] = collision_gid

    # Only the inherited southern trail and the five-plank dock are opened in
    # the custom extension. All other coast and water remains impassable.
    for y in range(36, 45):
        for x in range(30, 33):
            collision[y][x] = 0
    for y in range(44, height):
        for x in range(width):
            collision[y][x] = 0 if 29 <= x <= 33 else collision_gid
    rect(collision, 0, 0, width, 1, collision_gid)
    rect(collision, 0, height - 1, width, 1, collision_gid)
    rect(collision, 0, 0, 1, height, collision_gid)
    rect(collision, width - 1, 0, 1, height, collision_gid)

    ground = [[1 for _ in range(width)] for _ in range(height)]
    decor = Image.new("RGBA", composed.size, (0, 0, 0, 0))
    flattened, packed_rows, visible, flat_tile_count = flatten_map(
        atlas,
        ground,
        decor,
        25,
        composed,
    )
    flattened.save(TILED / "world-flat.png", optimize=True)
    write_image_tileset(TILED / "world-flat.tsx", "ninja-reference-flat", "world-flat.png", 25, packed_rows)
    write_flat_map(
        TILED / "world.tmx",
        width,
        height,
        "world-flat.tsx",
        visible,
        flat_tile_count,
        "world-tiles.tsx",
        collision,
        5,
    )


def build_interior(map_id: str, accent: int) -> None:
    width, height = 20, 15
    floor_source = Image.open(RAW / "interior-floor.png").convert("RGBA")
    floor = crop_tile(floor_source, 1, 1)
    rug = crop_tile(floor_source, 12 + accent, 1)
    transparent = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    atlas = Image.new("RGBA", (TILE * 3, TILE), (0, 0, 0, 0))
    for index, image in enumerate((floor, rug, transparent)):
        atlas.alpha_composite(image, (index * TILE, 0))
    atlas.save(TILED / f"{map_id}-tiles.png", optimize=True)
    write_tileset(TILED / f"{map_id}-tiles.tsx", map_id, f"{map_id}-tiles.png", 3, 3, 2)

    ground = [[1 for _ in range(width)] for _ in range(height)]
    collision = [[0 for _ in range(width)] for _ in range(height)]
    rect(ground, 6, 5, 8, 6, 2)
    collision_gid = 3
    rect(collision, 0, 0, width, 1, collision_gid)
    rect(collision, 0, height - 1, width, 1, collision_gid)
    rect(collision, 0, 0, 1, height, collision_gid)
    rect(collision, width - 1, 0, 1, height, collision_gid)

    decor = Image.new("RGBA", (width * TILE, height * TILE), (0, 0, 0, 0))
    # Use one complete three-by-two Ninja bench/table as the room's anchor and
    # let each map's interactive books, scrolls and NPCs furnish the rest.
    # Multi-tile crops must follow complete objects from the atlas: arbitrary
    # fragments read as broken staircases once enlarged.
    houses = Image.open(RAW / "houses.png").convert("RGBA")
    paste_sprite(decor, houses, (9 * 16, 3 * 16, 12 * 16, 5 * 16), 8, 7)
    rect(collision, 8, 8, 3, 1, collision_gid)
    decor.save(TILED / f"{map_id}-decor.png", optimize=True)
    flattened, packed_rows, visible, flat_tile_count = flatten_map(atlas, ground, decor, width)
    flattened.save(TILED / f"{map_id}-flat.png", optimize=True)
    write_image_tileset(TILED / f"{map_id}-flat.tsx", f"{map_id}-flat", f"{map_id}-flat.png", width, packed_rows)
    write_flat_map(TILED / f"{map_id}.tmx", width, height, f"{map_id}-flat.tsx", visible, flat_tile_count, f"{map_id}-tiles.tsx", collision, 2)


def main() -> None:
    TILED.mkdir(parents=True, exist_ok=True)
    normalize_actor("ninja-blue-source.png", "ninja-blue.png")
    normalize_actor("villager-source.png", "villager.png")
    normalize_actor("villager-2-source.png", "villager-2.png")
    normalize_actor("old-man-source.png", "old-man.png")
    normalize_actor("old-woman-source.png", "old-woman.png")
    normalize_actor("inspector-source.png", "inspector.png")
    build_world()
    build_interior("library", 0)
    build_interior("town-hall", 1)
    build_interior("cottage", 2)


if __name__ == "__main__":
    main()
