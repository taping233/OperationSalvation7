import { ROOM_SPEC } from "./home.catalog.js";

const freeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
};

const asset = (
  id,
  file,
  runtimeUrl,
  width,
  height,
  pivot,
  layer,
  extra = {},
) => ({
  id,
  path: `home-prototype/${file}`,
  width,
  height,
  alpha: true,
  url: runtimeUrl,
  pivot,
  layer,
  status: "prototype",
  provenance: "M04-a original geometric SVG placeholder",
  ...extra,
});

export const HOME_VISUAL_IDS = freeze({
  "display-cabinet": "home-furniture-display-cabinet-proto",
  "work-table": "home-furniture-work-table-proto",
  chair: "home-furniture-chair-proto",
  "table-lamp": "home-furniture-table-lamp-proto",
  "woven-rug": "home-furniture-woven-rug-proto",
  "wall-decoration": "home-furniture-wall-decoration-proto",
});

const LOGICAL_ROOM = {
  id: ROOM_SPEC.id,
  width: ROOM_SPEC.width,
  height: ROOM_SPEC.height,
  zones: ROOM_SPEC.zones.map((zone) => ({ ...zone })),
};

export const M04_VISUAL_PACK = freeze({
  version: "r1b-room-candidate-1",
  status: "candidate-room-and-prototype-furniture",
  roomSpec: {
    ...LOGICAL_ROOM,
    floorCalibration: {
      image: { width: 1216, height: 832 },
      origin: { x: 628, y: 330 },
      column: { x: 53.5, y: 23 },
      row: { x: -70.7, y: 29.7 },
      source: "NovelAI V5 direction sample, seed 731942861, 28 steps",
    },
    projection: {
      type: "dimetric",
      referenceViewport: { width: 1920, height: 1080 },
      origin: { x: 960, y: 252 },
      cell: { width: 112, height: 56 },
      formula: {
        x: "origin.x + (gridX - gridY) * cell.width / 2",
        y: "origin.y + (gridX + gridY) * cell.height / 2",
      },
    },
    layers: [
      "room-back",
      "wall-decor",
      "floor-underlay",
      "floor-object",
      "actor",
      "foreground",
      "hotspot-ui",
    ],
    pivotRules: {
      furniture: "feet-center",
      actor: "feet-center",
      rug: "tile-center",
      wall: "bottom-center",
    },
    hotspotSafeInset: 24,
    actorAnchor: { grid: { x: 4.2, y: 3.1 }, pivot: "feet-center" },
    displayAnchors: [
      { id: "display-left", grid: { x: 0.4, y: 4.8 } },
      { id: "display-right", grid: { x: 7.3, y: 0.4 } },
    ],
    hotspots: [
      {
        id: "collection",
        label: "收藏陈列",
        grid: { x: 1, y: 1 },
        minHitSize: 44,
      },
      {
        id: "preparation",
        label: "出征整备",
        grid: { x: 4, y: 4 },
        minHitSize: 44,
      },
      {
        id: "characters",
        label: "人物成长",
        grid: { x: 6, y: 2 },
        minHitSize: 44,
      },
      {
        id: "furniture",
        label: "家具布置",
        grid: { x: 3, y: 2 },
        minHitSize: 44,
      },
      {
        id: "expedition",
        label: "开始远征",
        grid: { x: 7, y: 4 },
        minHitSize: 44,
      },
    ],
    entryAnchors: [
      { id: "deploy", label: "出征", edge: "bottom", order: 0 },
      { id: "stash", label: "仓库", edge: "bottom", order: 1 },
      { id: "shop", label: "商店", edge: "bottom", order: 2 },
      { id: "upgrade", label: "升级", edge: "bottom", order: 3 },
      { id: "classes", label: "人物", edge: "bottom", order: 4 },
      { id: "ach", label: "成就·收藏室", edge: "bottom", order: 5 },
      { id: "back", label: "返回主菜单", edge: "top-left", order: 0 },
      { id: "help", label: "帮助", edge: "top-right", order: 0 },
    ],
  },
  assets: [
    {
      id: "home-room-candidate",
      path: "home-prototype/room-direction-candidate.png",
      url: new URL(
        "../assets/home-prototype/room-direction-candidate.png",
        import.meta.url,
      ).href,
      width: 1216,
      height: 832,
      alpha: false,
      pivot: { x: 0.5, y: 0.5 },
      layer: "room-back",
      status: "candidate",
      provenance:
        "NovelAI V5 direction sample, seed 731942861, original pixels preserved",
    },
    asset(
      "home-room-back-proto",
      "room-back.svg",
      new URL("../assets/home-prototype/room-back.svg", import.meta.url).href,
      1920,
      1080,
      { x: 0.5, y: 1 },
      "room-back",
    ),
    asset(
      "home-room-foreground-proto",
      "room-foreground.svg",
      new URL("../assets/home-prototype/room-foreground.svg", import.meta.url)
        .href,
      1920,
      1080,
      { x: 0.5, y: 1 },
      "foreground",
    ),
    asset(
      HOME_VISUAL_IDS["display-cabinet"],
      "display-cabinet-clean.svg",
      new URL(
        "../assets/home-prototype/display-cabinet-clean.svg",
        import.meta.url,
      ).href,
      320,
      300,
      { x: 0.5, y: 0.96 },
      "floor-object",
      { furnitureId: "display-cabinet", footprint: { width: 2, height: 1 } },
    ),
    asset(
      HOME_VISUAL_IDS["work-table"],
      "work-table-clean.svg",
      new URL("../assets/home-prototype/work-table-clean.svg", import.meta.url)
        .href,
      320,
      220,
      { x: 0.5, y: 0.95 },
      "floor-object",
      { furnitureId: "work-table", footprint: { width: 2, height: 1 } },
    ),
    asset(
      HOME_VISUAL_IDS.chair,
      "chair-clean.svg",
      new URL("../assets/home-prototype/chair-clean.svg", import.meta.url).href,
      180,
      210,
      { x: 0.5, y: 0.967 },
      "floor-object",
      { furnitureId: "chair", footprint: { width: 1, height: 1 } },
    ),
    asset(
      HOME_VISUAL_IDS["table-lamp"],
      "table-lamp-clean.svg",
      new URL("../assets/home-prototype/table-lamp-clean.svg", import.meta.url)
        .href,
      120,
      170,
      { x: 0.5, y: 0.959 },
      "floor-object",
      {
        furnitureId: "table-lamp",
        footprint: { width: 1, height: 1 },
        support: "table",
      },
    ),
    asset(
      HOME_VISUAL_IDS["woven-rug"],
      "woven-rug-clean.svg",
      new URL("../assets/home-prototype/woven-rug-clean.svg", import.meta.url)
        .href,
      430,
      220,
      { x: 0.5, y: 0.5 },
      "floor-underlay",
      { furnitureId: "woven-rug", footprint: { width: 3, height: 2 } },
    ),
    asset(
      HOME_VISUAL_IDS["wall-decoration"],
      "wall-decoration-clean.svg",
      new URL(
        "../assets/home-prototype/wall-decoration-clean.svg",
        import.meta.url,
      ).href,
      260,
      180,
      { x: 0.5, y: 0.844 },
      "wall-decor",
      { furnitureId: "wall-decoration", footprint: { width: 2, height: 1 } },
    ),
    ...[
      [
        "wu",
        new URL("../assets/portraits/battle/wu.webp", import.meta.url).href,
      ],
      [
        "changwuyu",
        new URL("../assets/portraits/battle/changwuyu.webp", import.meta.url)
          .href,
      ],
      [
        "baita",
        new URL("../assets/portraits/battle/baita.webp", import.meta.url).href,
      ],
      [
        "heixiang",
        new URL("../assets/portraits/battle/heixiang.webp", import.meta.url)
          .href,
      ],
      [
        "xingyue",
        new URL("../assets/portraits/battle/xingyue.webp", import.meta.url)
          .href,
      ],
    ].map(([characterId, url]) => ({
      id: `home-actor-${characterId}`,
      path: `portraits/battle/${characterId}.webp`,
      url,
      width: 832,
      height: 1216,
      alpha: true,
      pivot: { x: 0.5, y: 0.98 },
      layer: "actor",
      status: "existing-formal",
      provenance: "Existing transparent battle portrait",
      characterId,
    })),
  ],
  uiTokens: {
    color: {
      ink: "#ece3cf",
      muted: "#a99b86",
      night: "#10161b",
      panel: "#17232a",
      brass: "#c89a4a",
      ember: "#d96d4a",
      success: "#75a98a",
      danger: "#c85d58",
    },
    radius: { panel: 18, control: 10, card: 14 },
    space: { xs: 6, sm: 10, md: 16, lg: 24, xl: 36 },
    type: { bodyMin: 16, label: 14, title: 32 },
    focus: { width: 3, color: "#f1c76b", offset: 3 },
  },
  componentStates: [
    "default",
    "hover",
    "focus",
    "disabled",
    "loading",
    "error",
    "empty",
  ],
  previewPaths: [
    "docs/previews/m04/base.html",
    "docs/previews/m04/collection.html",
    "docs/previews/m04/loadout.html",
    "docs/previews/m04/combat-tip.html",
  ],
  sourcePaths: [
    "game/src/home.visuals.js",
    "game/assets/home-prototype/manifest.json",
  ],
});

export function projectHomeCell(gridX, gridY, pack = M04_VISUAL_PACK) {
  const { origin, cell } = pack.roomSpec.projection;
  return Object.freeze({
    x: origin.x + ((gridX - gridY) * cell.width) / 2,
    y: origin.y + ((gridX + gridY) * cell.height) / 2,
  });
}

export function getM04VisualPack() {
  return M04_VISUAL_PACK;
}
