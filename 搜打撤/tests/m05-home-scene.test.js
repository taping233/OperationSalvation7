import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ticker = { start: vi.fn(), stop: vi.fn() };
const destroy = vi.fn();
vi.mock("pixi.js", () => {
  class Node {
    constructor() {
      this.position = { set: vi.fn() };
      this.scale = { set: vi.fn() };
      this.anchor = { set: vi.fn() };
      this.children = [];
    }
    addChild(...children) {
      this.children.push(...children);
    }
    addChildAt(child) {
      this.children.unshift(child);
    }
    removeChildren() {
      const children = [...this.children];
      this.children = [];
      return children;
    }
    setChildIndex() {}
  }
  return {
    Application: class {
      constructor() {
        this.view = document.createElement("canvas");
        this.stage = new Node();
        this.ticker = ticker;
      }
      destroy(...args) {
        destroy(...args);
      }
    },
    Container: Node,
    Graphics: class extends Node {
      beginFill() {
        return this;
      }
      lineStyle() {
        return this;
      }
      drawPolygon() {
        return this;
      }
      drawRect() {
        return this;
      }
      endFill() {
        return this;
      }
    },
    Sprite: class extends Node {
      destroy() {}
    },
    Texture: { from: vi.fn(() => ({})) },
    Text: class extends Node {},
  };
});

import {
  createHomeProjection,
  mountHome,
  projectHomePoint,
  unprojectHomePoint,
} from "../game/src/home.scene.js";

const view = () => ({
  revision: 2,
  resources: { coins: 10, wood: 1, rations: 2 },
  character: null,
  collectionDisplays: [{ card: { cardId: "card-a" }, label: "卡 A" }],
  home: {
    owned: { chair: ["chair-1"] },
    placements: [],
    displays: [
      { slotId: "display-left", ref: null },
      { slotId: "display-right", ref: null },
    ],
    catalog: [
      {
        id: "chair",
        name: "座椅",
        priceCoins: 3,
        surface: "floor",
        footprint: { width: 1, height: 1 },
        allowedRotations: [0],
        allowsOverlap: [],
        supports: [],
      },
    ],
    room: {
      id: "base-room-01",
      width: 8,
      height: 6,
      zones: [
        { id: "room-floor", surface: "floor", x: 0, y: 1, width: 8, height: 5 },
      ],
    },
  },
});

describe("M05 home scene", () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="host"></main>';
    vi.clearAllMocks();
  });

  it("五热点和旧入口发同一 openPanel 意图，遮罩内点击不冒泡", async () => {
    const intents = [];
    const host = document.getElementById("host");
    let bubbled = 0;
    document.body.addEventListener("click", () => bubbled++, { once: true });
    const controller = mountHome({
      host,
      view: view(),
      onIntent: async (intent) => {
        intents.push(intent);
        return { ok: true };
      },
    });
    host.querySelector(".home-hotspot--deploy").click();
    host.querySelector('.home-scene__quick [data-home-panel="deploy"]').click();
    await Promise.resolve();
    expect(
      intents.filter((i) => i.type === "openPanel" && i.panel === "deploy"),
    ).toHaveLength(2);
    expect(host.querySelectorAll(".home-hotspot")).toHaveLength(5);
    expect(
      host.querySelectorAll(".home-scene__quick [data-home-panel]"),
    ).toHaveLength(7);
    expect(bubbled).toBe(0);
    controller.dispose();
  });

  it("驻留人物和永久收藏展位进入场景，家具热点直接打开布置界面", async () => {
    const intents = [];
    const model = view();
    model.character = { characterId: "wu" };
    model.home.displays[0].ref = { kind: "collection", refId: "card-a" };
    const host = document.getElementById("host");
    const controller = mountHome({
      host,
      view: model,
      assets: {
        characterHTML: () => '<img alt="正式角色立绘">',
        cardHTML: () =>
          '<article class="hs-card tp0 rv6 cf1 sm"><h3>卡 A</h3><div>完整卡面</div></article>',
      },
      onIntent: async (intent) => {
        intents.push(intent);
        return { ok: true };
      },
    });
    expect(host.querySelector(".home-resident__art img")?.alt).toBe(
      "正式角色立绘",
    );
    expect(host.querySelector(".home-display--left").textContent).toContain(
      "卡 A",
    );
    expect(
      host.querySelector(".home-display__card > .hs-card.tp0.rv6.cf1.sm"),
    ).not.toBeNull();
    const homeCss = fs.readFileSync(
      path.resolve(import.meta.dirname, "../game/css/home-scene.css"),
      "utf8",
    );
    expect(homeCss).toContain(".home-display__card>.hs-card");
    expect(homeCss).toContain("scale(.60)");
    host.querySelector(".home-hotspot--furniture").click();
    expect(
      host.querySelector("[data-home-editor]").classList.contains("open"),
    ).toBe(true);
    expect(
      intents.some(
        (intent) => intent.type === "openPanel" && intent.panel === "shop",
      ),
    ).toBe(false);
    controller.dispose();
  });

  it("透明战斗角色资产走场景层，正常界面不泄漏内部展位与原型标签", () => {
    const model = view();
    model.character = { characterId: "wu" };
    const host = document.getElementById("host");
    const controller = mountHome({
      host,
      view: model,
      assets: {
        roomSpec: {
          projection: {
            origin: { x: 960, y: 252 },
            cell: { width: 112, height: 56 },
            referenceViewport: { width: 1920, height: 1080 },
          },
          actorAnchor: { grid: { x: 4, y: 3 } },
          hotspots: [],
        },
        assets: [
          {
            id: "home-actor-wu",
            characterId: "wu",
            url: "/wu.webp",
            width: 832,
            height: 1216,
            pivot: { x: 0.5, y: 0.98 },
          },
        ],
        characterLabel: () => "无",
      },
      onIntent: vi.fn(),
    });
    expect(host.querySelector(".home-resident-name")?.textContent).toBe("无");
    expect(host.textContent).not.toContain("display-left");
    expect(host.textContent).not.toContain("PROTO");
    controller.dispose();
  });

  it("编辑模式说明选中与未保存状态，取消恢复且不提交", () => {
    const intents = [];
    const host = document.getElementById("host");
    const controller = mountHome({
      host,
      view: view(),
      onIntent: (intent) => {
        intents.push(intent);
        return { ok: true };
      },
    });
    host.querySelector("[data-home-edit]").click();
    expect(host.querySelector("[data-home-grid]").hasAttribute("hidden")).toBe(
      false,
    );
    expect(
      [...host.querySelectorAll(".home-grid-cell")].every((cell) =>
        cell
          .getAttribute("aria-label")
          ?.startsWith(cell.dataset.gridY === "0" ? "墙面" : "地面"),
      ),
    ).toBe(true);
    host.querySelector('[data-home-pick="chair-1"]').click();
    expect(host.querySelector(".home-editor__state").textContent).toContain(
      "已选中",
    );
    host.querySelector('[data-grid-x="3"][data-grid-y="3"]').click();
    expect(host.querySelector(".home-editor__state").textContent).toContain(
      "未保存",
    );
    host.querySelector("[data-home-cancel]").click();
    expect(intents.some((intent) => intent.type === "submitLayout")).toBe(
      false,
    );
    expect(host.querySelector(".home-editor__state").textContent).toContain(
      "存档一致",
    );
    host.querySelector("[data-home-editor-close]").click();
    expect(host.querySelector("[data-home-grid]").hasAttribute("hidden")).toBe(
      true,
    );
    expect(host.querySelector("[data-home-grid]").hasAttribute("inert")).toBe(
      true,
    );
    expect(
      host.querySelector("[data-home-editor]").hasAttribute("hidden"),
    ).toBe(true);
    controller.dispose();
  });

  it("取消不发保存，失败不显示已保存成功", async () => {
    const intents = [];
    const host = document.getElementById("host");
    const controller = mountHome({
      host,
      view: view(),
      onIntent: async (intent) => {
        intents.push(intent);
        return intent.type === "submitLayout"
          ? { ok: false, message: "磁盘写入失败" }
          : { ok: true };
      },
    });
    host.querySelector("[data-home-edit]").click();
    host.querySelector("[data-home-cancel]").click();
    expect(intents.some((i) => i.type === "submitLayout")).toBe(false);
    host.querySelector("[data-home-save]").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host.querySelector("[data-home-notice]").textContent).toBe(
      "磁盘写入失败",
    );
    expect(host.querySelector("[data-home-notice]").textContent).not.toContain(
      "已保存",
    );
    controller.dispose();
  });

  it("隐藏暂停 ticker，dispose 解绑并销毁画布", () => {
    const host = document.getElementById("host");
    const controller = mountHome({ host, view: view(), onIntent: vi.fn() });
    controller.setActive(false);
    expect(ticker.stop).toHaveBeenCalledTimes(1);
    controller.setActive(true);
    expect(ticker.start).toHaveBeenCalledTimes(1);
    controller.dispose();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(host.innerHTML).toBe("");
    controller.dispose();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("页面隐藏停 ticker，重新显示自动恢复入口交互", async () => {
    const intents = [],
      host = document.getElementById("host");
    const controller = mountHome({
      host,
      view: view(),
      onIntent: async (intent) => {
        intents.push(intent);
        return { ok: true };
      },
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(ticker.stop).toHaveBeenCalled();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(ticker.start).toHaveBeenCalled();
    host.querySelector(".home-hotspot--deploy").click();
    await Promise.resolve();
    expect(intents.some((i) => i.type === "openPanel")).toBe(true);
    controller.dispose();
  });

  it("候选背景异步加载失败时显示原型地面并保持入口可操作", async () => {
    const intents = [];
    const host = document.getElementById("host");
    const controller = mountHome({
      host,
      view: view(),
      assets: {
        roomSpec: {
          floorCalibration: {
            image: { width: 1216, height: 832 },
            origin: { x: 628, y: 330 },
            column: { x: 53.5, y: 23 },
            row: { x: -70.7, y: 29.7 },
          },
        },
        assets: [
          {
            id: "home-room-candidate",
            url: "/missing-room.png",
            width: 1216,
            height: 832,
            pivot: { x: 0.5, y: 0.5 },
          },
        ],
      },
      onIntent: async (intent) => {
        intents.push(intent);
        return { ok: true };
      },
    });
    host
      .querySelector("[data-home-backdrop]")
      .dispatchEvent(new Event("error"));
    expect(host.querySelector("[data-home-fallback-surface]").hidden).toBe(
      false,
    );
    expect(host.querySelector("[data-home-notice]").textContent).toContain(
      "背景加载失败",
    );
    host.querySelector(".home-hotspot--deploy").click();
    await Promise.resolve();
    expect(intents.some((intent) => intent.type === "openPanel")).toBe(true);
    controller.dispose();
  });

  it("动态投影的格中心往返稳定，编辑侧栏只改变 contain 区域", () => {
    for (const size of [
      [1280, 720],
      [1920, 1080],
    ]) {
      const p = createHomeProjection(...size, true);
      for (const logicalPoint of [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 0, y: 6 },
        { x: 8, y: 6 },
        { x: 3.5, y: 3.5 },
      ]) {
        const screen = projectHomePoint(logicalPoint, p);
        const logical = unprojectHomePoint(screen, p);
        expect(logical.x).toBeCloseTo(logicalPoint.x);
        expect(logical.y).toBeCloseTo(logicalPoint.y);
        expect(screen.x).toBeGreaterThanOrEqual(p.imageRect.x);
        expect(screen.x).toBeLessThanOrEqual(p.imageRect.x + p.imageRect.width);
        expect(screen.y).toBeGreaterThanOrEqual(p.imageRect.y);
        expect(screen.y).toBeLessThanOrEqual(
          p.imageRect.y + p.imageRect.height,
        );
      }
    }
  });

  it("购买触发同步 update 时保留草稿，保存同步 update 后采用提交快照", async () => {
    const host = document.getElementById("host");
    let controller;
    controller = mountHome({
      host,
      view: view(),
      onIntent: async (intent) => {
        if (intent.type === "buyFurniture") {
          const next = view();
          next.revision = 3;
          next.home.owned.chair.push("chair-2");
          controller.update(next);
          return { ok: true };
        }
        if (intent.type === "submitLayout") {
          const next = view();
          next.revision = 4;
          next.home.placements = structuredClone(intent.placements);
          controller.update(next);
          return { ok: true };
        }
        return { ok: true };
      },
    });
    host.querySelector("[data-home-edit]").click();
    host.querySelector('[data-home-pick="chair-1"]').click();
    host.querySelector('[data-grid-x="3"][data-grid-y="3"]').click();
    host.querySelector('[data-home-buy="chair"]').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(host.querySelector(".home-editor__state").textContent).toContain(
      "未保存",
    );
    host.querySelector("[data-home-save]").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(host.querySelector(".home-editor__state").textContent).toContain(
      "存档一致",
    );
    controller.dispose();
  });

  it("连续进入退出十次无残留 canvas 或监听器宿主", () => {
    const host = document.getElementById("host");
    for (let i = 0; i < 10; i++)
      mountHome({ host, view: view(), onIntent: vi.fn() }).dispose();
    expect(host.querySelectorAll("canvas")).toHaveLength(0);
    expect(destroy).toHaveBeenCalledTimes(10);
  });
});
