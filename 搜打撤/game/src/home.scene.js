import { Application, Container, Sprite, Texture } from "pixi.js";
import { validateLayout } from "./home.commands.js";
import "../css/home-scene.css";

const PANELS = {
  deploy: "出征",
  stash: "仓库",
  shop: "商店",
  upgrade: "升级",
  characters: "人物",
  collection: "收藏",
  pets: "宠物",
};
const HOT = [
  ["collection", "收藏展柜", "collection"],
  ["deploy", "整备台", "deploy"],
  ["characters", "驻留人物", "characters"],
  ["furniture", "家具工坊", "edit"],
  ["expedition", "出征出口", "deploy"],
];
const DEFAULT_FLOOR_CALIBRATION = Object.freeze({
  image: { width: 1216, height: 832 },
  origin: { x: 628, y: 330 },
  column: { x: 53.5, y: 23 },
  row: { x: -70.7, y: 29.7 },
});
const clone = (v) => structuredClone(v),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

export function createHomeProjection(
  width,
  height,
  editing = false,
  calibration = DEFAULT_FLOOR_CALIBRATION,
) {
  // Every Pixi object, DOM overlay, editor cell and hit target shares this contain transform.
  const usableWidth = Math.max(
    320,
    width - (editing ? Math.min(390, width * 0.34) : 0),
  );
  const scale = Math.min(
    usableWidth / calibration.image.width,
    height / calibration.image.height,
  );
  const imageRect = {
    x: (usableWidth - calibration.image.width * scale) / 2,
    y: (height - calibration.image.height * scale) / 2,
    width: calibration.image.width * scale,
    height: calibration.image.height * scale,
  };
  const mapVector = (vector) => ({ x: vector.x * scale, y: vector.y * scale });
  const column = mapVector(calibration.column);
  const row = mapVector(calibration.row);
  return {
    width,
    height,
    usableWidth,
    imageRect,
    column,
    row,
    cellWidth: Math.abs(column.x - row.x),
    cellHeight: Math.abs(column.y + row.y),
    origin: {
      x: imageRect.x + calibration.origin.x * scale,
      y: imageRect.y + calibration.origin.y * scale,
    },
  };
}
export function projectHomePoint(g, p) {
  return {
    x: p.origin.x + g.x * p.column.x + g.y * p.row.x,
    y: p.origin.y + g.x * p.column.y + g.y * p.row.y,
  };
}
export function unprojectHomePoint(s, p) {
  const sx = s.x - p.origin.x;
  const sy = s.y - p.origin.y;
  const determinant = p.column.x * p.row.y - p.column.y * p.row.x;
  return {
    x: (sx * p.row.y - sy * p.row.x) / determinant,
    y: (sy * p.column.x - sx * p.column.y) / determinant,
  };
}
function markup(v) {
  const hotspots = HOT.map(
    ([id, label, panel]) =>
      `<button class="home-hotspot home-hotspot--${id}" ${panel === "edit" ? "data-home-edit" : `data-home-panel="${panel}"`}>${label}</button>`,
  ).join("");
  const quickLinks = Object.entries(PANELS)
    .map(([id, label]) => `<button data-home-panel="${id}">${label}</button>`)
    .join("");
  return `<section class="home-scene">
    <header class="home-scene__head">
      <div><small>BASE ROOM · 01</small><h2>远征基地</h2></div>
      <div class="home-scene__resources"><span>储备币 <b data-home-coins>${v.resources.coins}</b></span><span>木材 <b>${v.resources.wood}</b></span><span>口粮 <b>${v.resources.rations}</b></span></div>
      <button data-home-close>返回</button>
    </header>
    <div class="home-scene__stage" data-home-stage>
      <div class="home-scene__fallback-surface" data-home-fallback-surface hidden aria-hidden="true"></div>
      <div class="home-scene__canvas" data-home-canvas></div>
      <img class="home-scene__fallback-backdrop" data-home-backdrop alt="" hidden>
      <div data-home-residents></div><div data-home-displays></div>
      <div class="home-scene__hotspots">${hotspots}</div>
      <div class="home-scene__grid" data-home-grid hidden inert></div>
      <aside class="home-scene__editor" data-home-editor hidden inert></aside>
      <div class="home-scene__notice" data-home-notice role="status"></div>
    </div>
    <nav class="home-scene__quick">${quickLinks}<button data-home-edit>布置房间</button></nav>
  </section>`;
}

function drawScene(host, view, assets) {
  const app = new Application({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
    }),
    atmosphere = new Container(),
    room = new Container(),
    under = new Container(),
    wall = new Container(),
    objects = new Container();
  app.stage.addChild(atmosphere, room, under, wall, objects);
  const backSpec = assets?.assets?.find((a) => a.id === "home-room-candidate"),
    back = backSpec
      ? new Sprite(Texture.from(backSpec.url || `assets/${backSpec.path}`))
      : null;
  if (back) {
    back.anchor.set(0.5, 0.5);
    atmosphere.addChild(back);
  }
  const sprite = (parent, spec, point, scale) => {
    const s = new Sprite(Texture.from(spec.url || `assets/${spec.path}`));
    s.anchor.set(spec.pivot?.x ?? 0.5, spec.pivot?.y ?? 1);
    s.position.set(point.x, point.y);
    s.scale.set(scale);
    parent.addChild(s);
    return s;
  };
  app.redrawHome = (
    next,
    placements = next.home.placements || [],
    editing = false,
  ) => {
    [room, under, wall, objects].forEach((l) =>
      l.removeChildren().forEach((c) => c.destroy?.()),
    );
    const w = Math.max(1, host.clientWidth),
      h = Math.max(1, host.clientHeight),
      p = createHomeProjection(
        w,
        h,
        editing,
        assets?.roomSpec?.floorCalibration,
      );
    if (back) {
      back.position.set(
        p.imageRect.x + p.imageRect.width / 2,
        p.imageRect.y + p.imageRect.height / 2,
      );
      back.width = p.imageRect.width;
      back.height = p.imageRect.height;
      back.alpha = 1;
    }
    for (const pl of placements) {
      const spec = assets?.assets?.find(
        (a) => a.furnitureId === pl.furnitureId,
      );
      if (!spec) continue;
      const point = projectHomePoint({ x: pl.x + 0.5, y: pl.y + 0.5 }, p),
        parent =
          spec.layer === "floor-underlay"
            ? under
            : spec.layer === "wall-decor"
              ? wall
              : objects,
        item = sprite(parent, spec, point, Math.max(0.32, p.cellWidth / 128));
      item.__depth = point.y;
    }
    const actor = assets?.assets?.find(
      (a) => a.characterId === next.character?.characterId,
    );
    if (actor) {
      const point = projectHomePoint(
          assets?.roomSpec?.actorAnchor?.grid || { x: 4.2, y: 3.1 },
          p,
        ),
        item = sprite(
          objects,
          actor,
          point,
          Math.min(0.4, (p.cellWidth * 2) / actor.width),
        );
      item.__depth = point.y;
    }
    objects.children.sort((a, b) => (a.__depth || 0) - (b.__depth || 0));
    app.homeProjection = p;
  };
  app.redrawHome(view);
  host.appendChild(app.view);
  return app;
}

export function mountHome({ host, view, assets = null, onIntent }) {
  if (!host || typeof onIntent !== "function")
    throw new TypeError("host 与 onIntent 必填");
  let current = view,
    saved = clone(view.home.placements || []),
    draft = clone(saved),
    selected = null,
    routeActive = true,
    disposed = false,
    pixi = null,
    pendingSubmit = null;
  const clean = [];
  host.innerHTML = markup(view);
  const scene = host.querySelector(".home-scene"),
    stage = host.querySelector("[data-home-stage]"),
    canvas = host.querySelector("[data-home-canvas]"),
    editor = host.querySelector("[data-home-editor]"),
    grid = host.querySelector("[data-home-grid]"),
    notice = host.querySelector("[data-home-notice]"),
    residents = host.querySelector("[data-home-residents]"),
    displays = host.querySelector("[data-home-displays]"),
    backdrop = host.querySelector("[data-home-backdrop]"),
    fallbackSurface = host.querySelector("[data-home-fallback-surface]");
  try {
    pixi = drawScene(canvas, view, assets);
  } catch {
    scene.classList.add("home-scene--dom");
  }
  const editing = () => editor.classList.contains("open"),
    proj = () =>
      createHomeProjection(
        Math.max(1, stage.clientWidth),
        Math.max(1, stage.clientHeight),
        editing(),
        assets?.roomSpec?.floorCalibration,
      ),
    position = (el, p) => {
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
    };
  const dirty = () => JSON.stringify(draft) !== JSON.stringify(saved),
    valid = () =>
      validateLayout({
        placements: draft,
        roomSpec: current.home.room,
        ownedFurniture: current.home.owned,
        furnitureCatalog: current.home.catalog,
      });
  const say = (m, k = "") => {
      notice.textContent = m || "";
      notice.dataset.kind = k;
    },
    emit = async (i) => {
      if (!routeActive || disposed) return null;
      try {
        return await onIntent(i);
      } catch (e) {
        return { ok: false, message: e?.message || "操作失败" };
      }
    };
  const roomAsset = assets?.assets?.find(
    (item) => item.id === "home-room-candidate",
  );
  const showBackgroundFallback = () => {
    fallbackSurface.hidden = false;
    scene.classList.add("home-scene--background-fallback");
    say("候选房间背景加载失败，已切换为可操作的原型地面。", "error");
  };
  if (roomAsset) {
    backdrop.src = roomAsset.url || `assets/${roomAsset.path}`;
    backdrop.addEventListener("error", showBackgroundFallback);
    clean.push(() =>
      backdrop.removeEventListener("error", showBackgroundFallback),
    );
  } else {
    showBackgroundFallback();
  }
  const violation = (c) =>
    ({
      PLACEMENT_OUT_OF_BOUNDS: "家具超出可用空间",
      PLACEMENT_OVERLAP: "家具与现有物件重叠",
      INVALID_SURFACE: "该家具不能放在这个表面",
      INVALID_ROTATION: "当前旋转不可用",
      MISSING_SUPPORT: "桌面摆件需要工作桌支撑",
      UNOWNED_INSTANCE: "家具库存已变化，请刷新",
    })[c] || "当前位置不可用";
  const renderContents = () => {
    const p = proj(),
      id = current.character?.characterId,
      a = assets?.assets?.find((x) => x.characterId === id),
      html = id && assets?.characterHTML?.(id),
      label = assets?.characterLabel?.(id) || id;
    if (!pixi && roomAsset) {
      backdrop.hidden = false;
      backdrop.style.left = `${p.imageRect.x}px`;
      backdrop.style.top = `${p.imageRect.y}px`;
      backdrop.style.width = `${p.imageRect.width}px`;
      backdrop.style.height = `${p.imageRect.height}px`;
    }
    residents.innerHTML = a
      ? `<figure class="home-resident home-resident--asset"><img src="${esc(a.url || `assets/${a.path}`)}" alt="${esc(label)}"><figcaption class="home-resident-name">${esc(label)}</figcaption></figure>`
      : html
        ? `<figure class="home-resident"><div class="home-resident__art">${html}</div><figcaption class="home-resident-name">${esc(label)}</figcaption></figure>`
        : '<div class="home-resident home-resident--fallback">驻留人物素材暂缺</div>';
    if (residents.firstElementChild)
      position(
        residents.firstElementChild,
        projectHomePoint(
          assets?.roomSpec?.actorAnchor?.grid || { x: 4.2, y: 3.1 },
          p,
        ),
      );
    displays.innerHTML = (current.home.displays || [])
      .map((s, i) => {
        const c =
            s.ref &&
            (current.collectionDisplays || []).find(
              (x) => x.card.cardId === s.ref.refId,
            ),
          label2 = c?.label || s.ref?.refId || "待陈列收藏",
          card = c && assets?.cardHTML?.(c.card.cardId);
        return `<figure class="home-display home-display--${i ? "right" : "left"} ${c ? "has-card" : "empty"}"><div class="home-display__card">${card || `<span>${esc(label2)}</span>`}</div><figcaption>${esc(label2)}</figcaption></figure>`;
      })
      .join("");
    [...displays.children].forEach((el, i) =>
      position(
        el,
        projectHomePoint(
          assets?.roomSpec?.displayAnchors?.[i]?.grid ||
            (i ? { x: 7, y: 0.2 } : { x: 0.2, y: 5 }),
          p,
        ),
      ),
    );
  };
  const redraw = () => {
    pixi?.redrawHome?.(current, draft, editing());
    renderContents();
  };
  const renderEditor = () => {
    const p = proj(),
      name = (id) =>
        current.home.catalog.find((s) => s.id === id)?.name || "家具";
    grid.innerHTML = "";
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 8; x++) {
        const point = projectHomePoint({ x: x + 0.5, y: y + 0.5 }, p),
          placed = draft.find((a) => a.x === x && a.y === y),
          b = document.createElement("button");
        b.className = `home-grid-cell ${y ? "floor" : "wall"} ${placed ? "occupied" : ""}`;
        b.dataset.gridX = x;
        b.dataset.gridY = y;
        if (placed) b.dataset.instance = placed.instanceId;
        b.title = placed ? name(placed.furnitureId) : "";
        b.setAttribute(
          "aria-label",
          `${y === 0 ? "墙面" : "地面"}第 ${x + 1} 列第 ${y + 1} 行${placed ? `，已有${name(placed.furnitureId)}` : "，空格"}`,
        );
        b.style.cssText = `left:${point.x}px;top:${point.y}px;width:${p.cellWidth}px;height:${p.cellHeight}px`;
        grid.appendChild(b);
      }
    const owned = current.home.catalog
        .flatMap((spec) =>
          (current.home.owned[spec.id] || []).map((instanceId) => ({
            spec,
            instanceId,
          })),
        )
        .filter((x) => !draft.some((y) => y.instanceId === x.instanceId)),
      v = valid(),
      chosen = owned.find((x) => x.instanceId === selected),
      state = !v.valid
        ? violation(v.violations[0]?.code)
        : chosen
          ? `已选中：${chosen.spec.name}，请选择高亮格`
          : dirty()
            ? "布局有未保存改动"
            : "布局与存档一致";
    const catalogButtons = current.home.catalog
      .map(
        (s) =>
          `<button data-home-buy="${s.id}">${esc(s.name)}<small>${s.priceCoins} 币</small></button>`,
      )
      .join("");
    const ownedButtons = owned.length
      ? owned
          .map(
            (x) =>
              `<button class="${selected === x.instanceId ? "on" : ""}" data-home-pick="${x.instanceId}">${esc(x.spec.name)}</button>`,
          )
          .join("")
      : "<span>没有待摆家具</span>";
    const displayFields = current.home.displays
      .map((slot, index) => {
        const options = (current.collectionDisplays || [])
          .map(
            (collection) =>
              `<option value="${collection.card.cardId}" ${slot.ref?.refId === collection.card.cardId ? "selected" : ""}>${esc(collection.label)}</option>`,
          )
          .join("");
        return `<label>收藏展位${index + 1}<select data-home-display="${slot.slotId}"><option value="">清空</option>${options}</select></label>`;
      })
      .join("");
    editor.innerHTML = `<div class="home-editor__bar">
      <b>布置房间</b><div><button data-home-cancel>取消</button><button data-home-save ${v.valid ? "" : "disabled"}>保存</button><button data-home-editor-close>收起</button></div>
    </div>
    <p>选择家具，再点击房间格。墙饰只能放后墙。</p>
    <p class="home-editor__state ${!v.valid ? "invalid" : dirty() ? "dirty" : ""}">${esc(state)}</p>
    <div class="home-editor__catalog">${catalogButtons}</div>
    <div class="home-editor__owned">${ownedButtons}</div>
    <div class="home-editor__displays">${displayFields}</div>`;
    redraw();
  };
  const open = () => {
      editor.removeAttribute("hidden");
      editor.removeAttribute("inert");
      grid.removeAttribute("hidden");
      grid.removeAttribute("inert");
      editor.classList.add("open");
      grid.classList.add("open");
      scene.classList.add("is-editing");
      renderEditor();
    },
    close = () => {
      editor.classList.remove("open");
      grid.classList.remove("open");
      scene.classList.remove("is-editing");
      selected = null;
      editor.setAttribute("hidden", "");
      editor.setAttribute("inert", "");
      grid.setAttribute("hidden", "");
      grid.setAttribute("inert", "");
      redraw();
    };
  const click = async (e) => {
    e.stopPropagation();
    const b = e.target.closest("button");
    if (!b) return;
    if (b.matches("[data-home-panel]"))
      return void (await emit({
        type: "openPanel",
        panel: b.dataset.homePanel,
      }));
    if (b.matches("[data-home-close]"))
      return void (await emit({ type: "close" }));
    if (b.matches("[data-home-edit]")) return open();
    if (b.matches("[data-home-editor-close]")) return close();
    if (b.matches("[data-home-pick]")) {
      selected = b.dataset.homePick;
      return renderEditor();
    }
    if (b.matches("[data-home-buy]")) {
      const r = await emit({
        type: "buyFurniture",
        furnitureId: b.dataset.homeBuy,
        quantity: 1,
        expectedRevision: current.revision,
      });
      return say(
        r?.ok ? "家具已购入；当前布局草稿已保留。" : r?.message || "购买失败",
        r?.ok ? "success" : "error",
      );
    }
    if (b.matches("[data-home-cancel]")) {
      draft = clone(saved);
      selected = null;
      renderEditor();
      return say("已取消预览，保存布局未改变。");
    }
    if (b.matches("[data-home-save]")) {
      const submitted = clone(draft);
      // The hub may synchronously call controller.update before onIntent resolves.
      pendingSubmit = submitted;
      const r = await emit({
        type: "submitLayout",
        placements: submitted,
        expectedRevision: current.revision,
      });
      pendingSubmit = null;
      if (!r?.ok) return say(r?.message || "保存失败，原布局仍保留。", "error");
      saved = clone(submitted);
      draft = clone(submitted);
      renderEditor();
      return say("布局已保存。", "success");
    }
    if (b.matches("[data-grid-x]")) {
      const x = +b.dataset.gridX,
        y = +b.dataset.gridY;
      if (!selected && b.dataset.instance) {
        selected = b.dataset.instance;
        draft = draft.filter((a) => a.instanceId !== selected);
        renderEditor();
        return say("已拿起家具；取消可恢复。");
      }
      if (!selected) return;
      const spec = current.home.catalog.find((s) =>
        (current.home.owned[s.id] || []).includes(selected),
      );
      if (!spec) return;
      if ((spec.surface === "wall") !== (y === 0))
        return say(
          spec.surface === "wall"
            ? "墙饰只能放在后墙格。"
            : "地面家具不能放在后墙。",
          "error",
        );
      const placement = {
        instanceId: selected,
        furnitureId: spec.id,
        zoneId: spec.surface === "wall" ? "back-wall" : "room-floor",
        x,
        y,
        rotation: 0,
      };
      draft = draft.filter((a) => a.instanceId !== selected).concat(placement);
      renderEditor();
      await emit({ type: "previewPlacement", placement });
      const v = valid();
      if (v.valid) selected = null;
      else say(violation(v.violations[0]?.code), "error");
      return renderEditor();
    }
  };
  const outside = (e) => {
    if (
      selected &&
      editing() &&
      !e.target.closest("[data-grid-x], [data-home-editor]")
    )
      say("请点击房间菱形格；地面外不会自动吸附。", "error");
  };
  const change = async (e) => {
    const s = e.target.closest("[data-home-display]");
    if (!s) return;
    const wasDirty = dirty(),
      ref = s.value ? { kind: "collection", refId: s.value } : null,
      r = await emit({
        type: "selectDisplay",
        displaySlotId: s.dataset.homeDisplay,
        ref,
        expectedRevision: current.revision,
      });
    say(
      r?.ok
        ? wasDirty
          ? "展位已更新；家具布局草稿已保留。"
          : "展位已更新。"
        : r?.message || "展位更新失败。",
      r?.ok ? "success" : "error",
    );
  };
  host.addEventListener("click", click);
  stage.addEventListener("click", outside);
  editor.addEventListener("change", change);
  clean.push(
    () => host.removeEventListener("click", click),
    () => stage.removeEventListener("click", outside),
    () => editor.removeEventListener("change", change),
  );
  const sync = () => {
    // Route activity and document visibility are independent; returning to the tab resumes the ticker.
    const run = routeActive && !document.hidden;
    if (pixi?.ticker) pixi.ticker[run ? "start" : "stop"]();
    scene.classList.toggle("is-inactive", !run);
  };
  document.addEventListener("visibilitychange", sync);
  clean.push(() => document.removeEventListener("visibilitychange", sync));
  if (typeof ResizeObserver === "function") {
    const o = new ResizeObserver(() => (editing() ? renderEditor() : redraw()));
    o.observe(stage);
    clean.push(() => o.disconnect());
  }
  renderContents();
  return {
    update(next) {
      if (disposed) return;
      // Preserve dirty edits across purchase/display updates; pending submits use their exact snapshot.
      const keep = dirty() || !!pendingSubmit,
        currentDraft = clone(draft);
      current = next;
      saved = clone(pendingSubmit || next.home.placements || []);
      draft = keep ? currentDraft : clone(saved);
      const c = host.querySelector("[data-home-coins]");
      if (c) c.textContent = next.resources.coins;
      if (editing()) renderEditor();
      else redraw();
      if (keep && !pendingSubmit) say("数据已更新；未保存的家具草稿仍保留。");
    },
    setActive(v) {
      routeActive = !!v;
      sync();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clean.splice(0).forEach((f) => f());
      pixi?.destroy(true, { children: true });
      pixi = null;
      host.innerHTML = "";
    },
  };
}
