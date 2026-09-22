import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG, ROOM_SPEC } from "../game/src/home.catalog.js";
import {
  getM04VisualPack,
  HOME_VISUAL_IDS,
  projectHomeCell,
} from "../game/src/home.visuals.js";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("M04 VisualPack contract", () => {
  it("keeps M03 room and maps six furniture assets", () => {
    const pack = getM04VisualPack();
    expect([
      pack.roomSpec.id,
      pack.roomSpec.width,
      pack.roomSpec.height,
    ]).toEqual([ROOM_SPEC.id, 8, 6]);
    expect(pack.roomSpec.zones).toEqual(ROOM_SPEC.zones);
    expect(Object.keys(HOME_VISUAL_IDS).sort()).toEqual(
      FURNITURE_CATALOG.map((item) => item.id).sort(),
    );
    for (const item of FURNITURE_CATALOG) {
      const spec = pack.assets.find(
        (entry) => entry.id === HOME_VISUAL_IDS[item.id],
      );
      expect(spec?.furnitureId).toBe(item.id);
      expect(spec?.footprint).toEqual(item.footprint);
      expect(spec?.status).toBe("prototype");
      expect(spec?.path).toMatch(/-clean\.svg$/);
      expect(
        fs.readFileSync(
          path.join(projectRoot, "game/assets", spec.path),
          "utf8",
        ),
      ).not.toMatch(/<text\b/i);
    }
  });

  it("has valid paths, pivots, layers and safe hotspots", () => {
    const pack = getM04VisualPack();
    for (const spec of pack.assets) {
      expect(
        fs.existsSync(path.join(projectRoot, "game/assets", spec.path)),
      ).toBe(true);
      expect(spec.width).toBeGreaterThan(0);
      expect(spec.height).toBeGreaterThan(0);
      expect(spec.pivot.x).toBeGreaterThanOrEqual(0);
      expect(spec.pivot.x).toBeLessThanOrEqual(1);
      expect(spec.pivot.y).toBeGreaterThanOrEqual(0);
      expect(spec.pivot.y).toBeLessThanOrEqual(1);
      expect(pack.roomSpec.layers).toContain(spec.layer);
    }
    expect(pack.roomSpec.hotspots).toHaveLength(5);
    expect(pack.roomSpec.hotspots.every((item) => item.minHitSize >= 44)).toBe(
      true,
    );
    expect(pack.roomSpec.entryAnchors.map((item) => item.id)).toEqual([
      "deploy",
      "stash",
      "shop",
      "upgrade",
      "classes",
      "ach",
      "back",
      "help",
    ]);
    expect(projectHomeCell(0, 0)).toEqual({ x: 960, y: 252 });
    expect(projectHomeCell(1, 0)).toEqual({ x: 1016, y: 280 });
    expect(pack.assets.filter((item) => item.characterId)).toHaveLength(5);
    const room = pack.assets.find((item) => item.id === "home-room-candidate");
    expect(room?.status).toBe("candidate");
    expect([room?.width, room?.height]).toEqual([1216, 832]);
    expect(pack.roomSpec.floorCalibration).toMatchObject({
      origin: { x: 628, y: 330 },
      column: { x: 53.5, y: 23 },
      row: { x: -70.7, y: 29.7 },
    });
  });
});
