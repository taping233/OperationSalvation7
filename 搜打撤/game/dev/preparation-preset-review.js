// 仅复核预设容量、人物与宠物的接入；所有存储和基地操作均限本页内存。
import '../src/main.js';
import { game, MAP, _set_active_slot } from '../src/run/game.session.js';
import { CHARACTERS } from '../src/core/characters.js';
import { createBaseState } from '../src/hub/base-state.js';
import { createHubPreparationFeature } from '../src/hub/game.hub.preparation.js';
import { setDeployPick, openDepartPrep } from '../src/hub/game.hub.depart.js';
import { slots as hubBridge } from '../src/hub/game.hub.bridge.js';
import { markReviewReady } from './review-readiness.js';
import petsData from '../data/pets.json';
import '../css/preparation.css';

function startReview() {
  const SDT = window.SDT, UI = SDT.UI;
  const equipment = SDT.Cards.all().find(card => card.id === 'tt3-grass-armor');
  if (!equipment) throw new Error('隔离夹具缺少 tt3-grass-armor');
  let capacity = 5, revision = 0, request = 0, feature;
  const base = {
    slot: 1,
    data: null,
    PETS: petsData.list,
    PET_LEVEL_MAX: petsData.levelMax,
    bagCap: () => capacity,
    petById: id => petsData.list.find(pet => pet.id === id) || null,
    petLevel: id => base.data.pets[id]?.lv || 1,
    ownedPets: () => Object.keys(base.data.pets),
    carriedPet: () => base.petById(base.data.petSel),
    safeCap: () => MAP.rules.safeStart + (base.carriedPet()?.effect?.safeBonus || 0),
    setPet(id) {
      if (!base.data.pets[id] || !base.petById(id)) return false;
      base.data.petSel = id;
      revision++;
      return true;
    },
    markAmmoTaught() { base.data.ammoTaught = true; return true; },
  };
  const controls = document.createElement('nav');
  controls.setAttribute('aria-label', '出征预设隔离验收控制');
  controls.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:1000000;display:flex;align-items:center;gap:8px;padding:10px;background:#17232bed;color:#fff;font:14px sans-serif;border:1px solid #8ba0b8';
  controls.innerHTML = '<span data-review-status></span><button type="button" data-review="expand">容量改为6格</button><button type="button" data-review="reset">重置夹具</button>';
  const status = message => { controls.querySelector('[data-review-status]').textContent = message; };
  function showPreparation() {
    feature.dispose();
    setDeployPick(null);
    game.state = 'modal';
    feature.open();
    status(`内存夹具 · 基地 ${capacity} 格 · 预设需 6 格`);
    markReviewReady(UI.el.ovBody);
  }
  function reset() {
    feature?.dispose();
    capacity = 5;
    revision++;
    base.data = {
      ...createBaseState(),
      characters: Object.fromEntries(CHARACTERS.map(character => [character.id, { lv: 1, xp: 0 }])),
      pets: { dog: { lv: 1 }, robot: { lv: 1 } },
      petSel: 'dog',
      stash: [{ card: { ...equipment }, count: 3 }],
      goals: { tracked: [], presets: { 'preset-1': { id: 'preset-1', name: '白塔 · 机器人 · 三件装备', characterId: 'baita', petId: 'robot', picks: [{ card: { cardId: equipment.id }, count: 3 }] } } },
    };
    showPreparation();
  }
  SDT.Base = base;
  _set_active_slot(null);
  game.runActive = false;
  game.battleActive = false;
  game.nestActive = false;
  SDT.Sound.setMuted?.(true);
  document.getElementById('title').hidden = true;
  feature = createHubPreparationFeature({
    data: {
      slotId: () => base.slot,
      readBase: slot => slot === base.slot ? { ok: true, value: structuredClone(base.data), revision } : { ok: false, message: '夹具档位无效' },
      readBaseReceipt: async () => ({ ok: true, value: null }),
      commitBase: async (context, command) => {
        if (context.slotId !== base.slot || command.beforeRevision !== revision) return { ok: false, message: '夹具版本已变化，请重试' };
        base.data.goals = structuredClone(command.afterState.goals);
        return { ok: true, revision: ++revision };
      },
      cardCatalog: () => SDT.Cards.all(),
      characters: () => CHARACTERS,
      pets: () => base.PETS,
      bagCapacity: () => capacity,
      starterCount: () => MAP.rules.starterSha,
      starterCard: () => SDT.Cards.SHA,
    },
    view: {
      openPanel: () => {
        UI.showOverlay('', '<div class="preparation-shell camp-detail"><div id="preparationRoot"></div></div>', 'page');
        return document.getElementById('preparationRoot');
      },
    },
    navigation: {
      applyPicks: setDeployPick,
      openDeparture: () => {
        status(`内存夹具 · 基地 ${capacity} 格 · 已应用白塔 / ${base.carriedPet()?.name}`);
        return openDepartPrep();
      },
      returnToBase: showPreparation,
    },
    reportError: message => status(message),
    formatError: result => result.message || result.code,
    requestId: prefix => `${prefix}-memory-${++request}`,
  });
  hubBridge.renderHub = showPreparation;
  // 禁止夹具正式开局；保留真实选角与整备页面的其余交互。
  window.addEventListener('click', event => {
    if (!event.target.closest?.('[data-act="confirmDeploy"]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    status('内存夹具仅验预设与整备；正式出发已拦截');
  }, true);
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showPreparation();
  }, true);
  controls.addEventListener('click', event => {
    const action = event.target.closest('[data-review]')?.dataset.review;
    if (action === 'reset') reset();
    if (action === 'expand') { capacity = 6; showPreparation(); }
  });
  // 放进实际 overlay，避免真实页面的背景 inert 隔离验收按钮。
  UI.el.overlay.append(controls);
  reset();
}

const bootReady = () => window.SDT.UI.el.overlay?.isConnected
  && window.SDT.UI.el.ovBody?.isConnected
  && document.body.dataset.state
  && window.SDT.Cards.all().some(card => card.id === 'tt3-grass-armor');
// main 的现行 boot 在 DOMContentLoaded 内同步完成 UI.init 与 ensureTabletop。
// 动态装入入口时沿现有内存夹具交付启动事件；boot 监听器本身为 once。
// 同步完成初始化后再交回动画帧，避免 UI.el 尚为空时主循环先运行。
if (!bootReady()) document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
if (!bootReady()) throw new Error('现行游戏 boot 尚未交付 UI、卡库与页面状态，隔离夹具未启动');
startReview();
