#!/usr/bin/env python3
"""Render the official Ninja Adventure Godot village into a flat PNG.

This is a deterministic import step, not a hand-authored approximation. It
decodes the TileMap cell triples stored in the reference project's `.tscn` and
uses the original reference atlases one tile at a time.
"""

from __future__ import annotations

import re
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "scripts" / "reference" / "ninja-adventure"
MAP = REFERENCE / "map"
TILE = 16
MAIN_BOUNDS = (-30, -16, 19, 28)


def signed_16(value: int) -> int:
    return value - 65536 if value >= 32768 else value


def transform_tile(tile: Image.Image, flags: int) -> Image.Image:
    if flags & 4:
        tile = tile.transpose(Image.Transpose.TRANSPOSE)
    if flags & 1:
        tile = tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if flags & 2:
        tile = tile.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    return tile


def parse_layers() -> list[list[tuple[int, int, int, int, int, int]]]:
    source = (MAP / "map_village.tscn").read_text(encoding="utf-8")
    layers = []
    for match in re.finditer(r"layer_(\d+)/tile_data = PackedInt32Array\(([^)]*)\)", source):
        values = [int(value) for value in match.group(2).split(", ")]
        cells = []
        for packed_position, packed_atlas, packed_tile in zip(values[0::3], values[1::3], values[2::3]):
            position = packed_position & 0xFFFFFFFF
            x = signed_16(position & 0xFFFF)
            y = signed_16((position >> 16) & 0xFFFF)
            source_id = packed_atlas & 0xFFFF
            atlas_x = (packed_atlas >> 16) & 0xFFFF
            atlas_y = packed_tile & 0xFFFF
            flags = (packed_tile >> 16) & 0xFFFF
            cells.append((x, y, source_id, atlas_x, atlas_y, flags))
        layers.append(cells)
    return layers


def parse_collision_tiles() -> dict[int, set[tuple[int, int]]]:
    """Read full-tile collision ownership from the official Godot TileSet."""
    source = (MAP / "tileset.tres").read_text(encoding="utf-8")
    source_ids = {
        "TileSetAtlasSource_j5tek": 0,
        "TileSetAtlasSource_x17xn": 1,
        "TileSetAtlasSource_bvx6d": 3,
        "TileSetAtlasSource_tilta": 4,
    }
    result = {source_id: set() for source_id in source_ids.values()}
    sections = list(re.finditer(r'^\[sub_resource type="TileSetAtlasSource" id="([^"]+)"\]$', source, re.MULTILINE))
    for index, match in enumerate(sections):
        source_id = source_ids.get(match.group(1))
        if source_id is None:
            continue
        end = sections[index + 1].start() if index + 1 < len(sections) else len(source)
        section = source[match.end():end]
        result[source_id].update(
            (int(tile.group(1)), int(tile.group(2)))
            for tile in re.finditer(
                r"^(\d+):(\d+)/0/physics_layer_0/polygon_0/points = ",
                section,
                re.MULTILINE,
            )
        )
    return result


def reference_collision_cells() -> set[tuple[int, int]]:
    min_x, min_y, max_x, max_y = MAIN_BOUNDS
    collision_tiles = parse_collision_tiles()
    blocked: set[tuple[int, int]] = set()
    for cells in parse_layers():
        for x, y, source_id, atlas_x, atlas_y, _flags in cells:
            if x < min_x or x > max_x or y < min_y or y > max_y:
                continue
            if source_id == 5 or (atlas_x, atlas_y) in collision_tiles.get(source_id, set()):
                blocked.add((x - min_x, y - min_y))
    return blocked


def reference_floor_cells() -> set[tuple[int, int]]:
    min_x, min_y, max_x, max_y = MAIN_BOUNDS
    return {
        (x - min_x, y - min_y)
        for x, y, *_rest in parse_layers()[3]
        if min_x <= x <= max_x and min_y <= y <= max_y
    }


def render_main() -> Image.Image:
    min_x, min_y, max_x, max_y = MAIN_BOUNDS
    width = max_x - min_x + 1
    height = max_y - min_y + 1
    canvas = Image.new("RGBA", (width * TILE, height * TILE), (0, 0, 0, 0))
    atlases = {
        0: Image.open(MAP / "tileset_village_abandoned.png").convert("RGBA"),
        1: Image.open(MAP / "tileset_floor.png").convert("RGBA"),
        4: Image.open(MAP / "tileset_wall_simple.png").convert("RGBA"),
    }
    scenes = {
        1: Image.open(REFERENCE / "destroyable" / "crate.png").convert("RGBA"),
        2: Image.open(REFERENCE / "destroyable" / "grass.png").convert("RGBA"),
        3: Image.open(REFERENCE / "destroyable" / "pot.png").convert("RGBA"),
    }

    # Godot assigns Floor=-2, FloorDetail=-1, then the two y-sorted wall
    # layers. The serialized indices therefore render in this explicit order.
    layers = parse_layers()
    for layer_index in (3, 2, 0, 1):
        cells = layers[layer_index]
        for x, y, source_id, atlas_x, atlas_y, flags in cells:
            if x < min_x or x > max_x or y < min_y or y > max_y:
                continue
            if source_id == 5:
                tile = scenes.get(flags)
                if tile is None:
                    continue
            else:
                atlas = atlases.get(source_id)
                if atlas is None:
                    continue
                tile = atlas.crop((atlas_x * TILE, atlas_y * TILE, (atlas_x + 1) * TILE, (atlas_y + 1) * TILE))
                tile = transform_tile(tile, flags)
            canvas.alpha_composite(tile, ((x - min_x) * TILE, (y - min_y) * TILE))
    return canvas


def main() -> None:
    output = Path("/tmp/ninja-reference-main.png")
    preview = render_main().resize((1600, 1440), Image.Resampling.NEAREST)
    preview.save(output)
    grid = preview.copy()
    draw = ImageDraw.Draw(grid)
    for x in range(0, 51, 5):
        px = x * 32
        draw.line((px, 0, px, grid.height), fill=(18, 31, 43, 150), width=2)
        draw.text((px + 3, 3), str(x), fill=(255, 255, 255, 255), stroke_width=2, stroke_fill=(18, 31, 43, 255))
    for y in range(0, 46, 5):
        py = y * 32
        draw.line((0, py, grid.width, py), fill=(18, 31, 43, 150), width=2)
        draw.text((3, py + 3), str(y), fill=(255, 255, 255, 255), stroke_width=2, stroke_fill=(18, 31, 43, 255))
    grid.save("/tmp/ninja-reference-grid.png")
    print(output)


if __name__ == "__main__":
    main()
