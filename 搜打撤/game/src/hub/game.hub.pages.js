/* 基地内页与物资/卡牌特写。动作契约由基地壳绑定；本文件只组织陈列与局部操作。
 * renderHub 经 game.hub.bridge.js 的 slots 调用，避免内页与壳互相依赖。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { warehouseHTML } from './hub.warehouse.js';
import { personnelHTML } from './hub.personnel.js';
import { facilitiesHTML } from './hub.facilities.js';

import { shopV3HTML } from './hub.shop-v3.js';
import { archiveV3HTML } from './hub.archive-v3.js';
import { decorateInventoryZoom } from '../ui/inventory-zoom.js';
import '../../css/base-shop-v3.css';
import '../../css/base-archive-v3.css';
import { esc } from '../core/shared.js';
import { Sfx } from './game.cardslib.js';
import { Random } from '../core/random.js';
import { readBase } from './base.commands.js';
import { convertCollection, stackKeyOf } from './collection.commands.js';
import { homeErrorMessage } from '../home/home.presenter.js';
import { slots as hubBridge, homeRequestId } from './game.hub.bridge.js';   // 别名防局部 slots（收藏槽位等）遮蔽
  // —— 仓库页：卡牌仓库（容量 / 卖出 / 收藏）+ 消耗口袋 + 物资 ——
  // 特殊收藏品：传说卡与桌游珍宝——[[icon:sparkles]]收藏后完成对应成就
  const SPECIAL_COLLECT_IDS = new Set(['tt-gold', 'tt-token-color', 'tt-econpack']);
  const isSpecialCollect = (card) => !!card &&
    (card.rarity === '传说' || SPECIAL_COLLECT_IDS.has(card.id));

  // —— 局外商店（2026-09-16 留言「局外商店提供基础卡牌」）——
  // 用储备币（卖出所得，不进局）购买基础卡，直接入卡牌仓库；初始攻击每局自动携带、
  // 火球为衍生牌不外售，故货架只放可入库的基础招式/装备/资源卡。
  // 2026-09-17 留言「买的木材没到账」：口粮/木材改为直接折入基地物资（老板预期=看物资计数），
  // 卡牌货架只留基础招式/装备
  const HUB_SHOP_GOODS = [
    { id: 'tt3-skewer',  price: 6, tip: '基础招式 · 造成 2 点伤害，无视护甲' },
    { id: 'tt3-staff',   price: 6, tip: '基础装备 · 法伤 +1' },
    { material: 'rations', name: '口粮', price: 4, tip: '基地物资 +1 · 升级宠物' },
    { material: 'wood',    name: '木材', price: 4, tip: '基地物资 +1 · 扩建背包与仓库' },
  ];
  const hubShopGoodsCard = (g) => g.id === 'sha'
    ? { ...SDT.Cards.SHA }
    : (SDT.Cards.all().find(c => c.id === g.id) || null);
  function hubShopHTML() { return shopV3HTML({ base:SDT.Base, cards:SDT.Cards, art:SDT.Art, goods:HUB_SHOP_GOODS }); }
  function hubStashHTML(view = 'cards') { return warehouseHTML(view === 'pocket' ? 'pocket' : 'cards'); }

  // 仓库看卡·操作台（2026-10-06 二次改版，老板反馈「不要回到旧弹窗、要看得清」）：
  // 点卡直接开大卡特写，卖出 / 收藏 / 使用 / 孵化全部在特写页脚完成——卡始终是
  // 大图，没有第二层小卡弹窗。不可回退操作（高价/最后一张/整堆/收藏用掉）改按钮
  // 就地二次确认（变红 2.6s 内再点才执行），不再跳确认页。动作前按卡名重读仓库
  // 按卡名重读堆；收藏后就地刷新页脚，出售统一由交易所负责。
  function openStashCardView(i, { from } = {}) {
    const B = SDT.Base;
    const s = B.data.stash[i];
    if (!s) { hubBridge.renderHub(); return; }
    const card = s.card;
    const mat = B.materialInfo ? B.materialInfo(card) : null;
    const isEgg = card.id === B.PET_EGG_ID;
    const isPack = card.id === 'tt-econpack';
    const special = isSpecialCollect(card);


    // 动作前按卡名重读堆（索引可能因增删移位）；堆没了返回 null（收回特写回仓库）
    const freshStack = () => {
      const idx = B.data.stash.findIndex(x => x.card.name === card.name);
      return idx >= 0 ? B.data.stash[idx] : null;
    };
    const closeZoom = () => {
      const z = document.getElementById('cardZoom');
      const bd = z ? z.querySelector('.cz-backdrop') : null;
      if (bd) bd.click();
    };

    // 页脚 HTML 函数化：动作后重算数量/价格/按钮态，就地替换（特写不重建）
    const footerHTML = () => {
      const cur = freshStack(), n = cur ? cur.count : 0;
      const marked = B.isCollected(card);
      const convertType = !!card.cls && (card.rarity === '职业' || card.type === '能力卡');
      const collectXp = card.type === '能力卡' ? 50 : 10;
      const btns = [];
      if (!mat && !isEgg && !isPack) {
        if (convertType && !marked) {
          btns.push(`<button class="ov-btn ok" data-act="stashCollectOne">收藏 1 张</button>`);
          if (n > 1) btns.push(`<button class="ov-btn" data-act="stashCollectAll">全部收藏 · ${n} 张</button>`);
        } else {
          btns.push(`<button class="ov-btn${marked ? '' : ' ok'}" data-act="stashCollectToggle">${marked ? '取消收藏' : '收藏卡牌'}</button>`);
        }
      }
      const hint = mat || isEgg || isPack ? '补给物品不计入卡牌收藏' : convertType && !marked ? `收藏后转化为 ${collectXp} 点人物经验，消耗对应卡牌` : marked ? '已加入收藏' : '加入收藏，卡牌保留在仓库';
      return `<div class="camp-detail camp-card-actions"><div class="inspect-meta"><span class="inspect-count">持有 <b>${n}</b> 张</span><span class="inspect-collection-state">${marked ? '已收藏' : '仓库卡牌'}</span></div><p class="inspect-collection-hint">${hint}</p>${btns.length ? `<div class="ov-btns">${btns.join('')}</div>` : ''}</div>`;
    };
    const refreshZoom = () => {
      const zoom = document.getElementById('cardZoom');
      if (!zoom) return;
      if (!freshStack()) { closeZoom(); return; }
      const foot = zoom.querySelector('.cz-foot');
      if (foot) foot.innerHTML = footerHTML();
    };

    // 就地二次确认：首点变红「确认？」，2.6s 内再点才执行（页脚刷新会自然解除）
    const armOrRun = (act, run) => {
      const btn = document.querySelector(`#cardZoom .cz-foot [data-act="${act}"]`);
      if (!btn) return;
      if (btn.dataset.arm === '1') { run(); return; }
      btn.dataset.arm = '1';
      btn.dataset.armLabel = btn.textContent;
      btn.textContent = '确认？';
      btn.classList.add('danger');
      setTimeout(() => {
        if (!btn.isConnected || btn.dataset.arm !== '1') return;
        delete btn.dataset.arm;
        btn.textContent = btn.dataset.armLabel;
        btn.classList.remove('danger');
      }, 2600);
    };
    // —— 收藏（普通卡只记录不消耗；职业卡/能力卡收藏即用掉，2026-09-16 Item 15 定版）——
    UI.act('stashCollectToggle', () => {
      const cur = freshStack();
      if (!cur) { closeZoom(); return; }
      const now = B.collectToggle(card);
      if (now === null) { UI.log('基地存档未保存，收藏状态未改变', 'warn'); return; }
      Sfx.ding();
      // 经验结算必须最先：checkUnlocks → syncCollXp 会把已收藏的职业卡回填为
      // 「已结算」，若先于 onCollect 执行，首次收藏的 +10 就被吃掉了
      SDT.Meta.onCollect(card, now);
      // 2026-09-10 留言 #39 定版：收藏只记录 + 转化经验，卡牌保留在仓库
      UI.log(now
        ? `[[icon:sparkles]] 已收藏【<b>${esc(card.name)}</b>】入职业收藏室，转化为人物熟练度经验（卡牌保留在仓库）${special ? '（特殊收藏品）' : ''}`
        : `[[icon:sparkles]] 已取消收藏【<b>${esc(card.name)}</b>】`, now ? 'loot' : 'dim');
      SDT.Meta.checkUnlocks();
      hubBridge.renderHub();
      refreshZoom();
    });
    let converting = false;
    const convertStash = async (n, logText) => {
      if (converting) return;
      const cur = freshStack();
      if (!cur) { closeZoom(); return; }
      const slotId = B.slot, zoom = document.getElementById('cardZoom');
      const first = !B.isCollected(card);
      const read = readBase(slotId);
      if (!read.ok) { UI.log(homeErrorMessage(read), 'warn'); return; }
      converting = true;
      zoom?.querySelectorAll('.cz-foot button').forEach(button => { button.disabled = true; });
      let result;
      try { result = await convertCollection({ slotId, requestId: homeRequestId('stash-collect'), expectedRevision: read.revision }, { stackKey: stackKeyOf(cur), count: n }); }
      catch { result = { ok:false, message:'归档未保存，请重试' }; }
      finally { converting = false; }
      if (B.slot !== slotId || document.getElementById('cardZoom') !== zoom) return;
      if (!result.ok) { UI.log(result.message || '收藏失败，卡牌未消耗', 'warn'); refreshZoom(); return; }
      Sfx.ding();
      UI.log(logText(first), 'loot');
      hubBridge.renderHub();
      refreshZoom();
    };
    UI.act('stashCollectOne', () => {
      armOrRun('stashCollectOne', () => convertStash(1, first =>
        `[[icon:medal]] 已收藏【<b>${esc(card.name)}</b>】并转化为人物经验（卡牌用掉，不再占格${first ? '，收藏进度 +1' : ''}）`));
    });
    UI.act('stashCollectAll', () => {
      armOrRun('stashCollectAll', () => {
        const cur = freshStack();
        const n = cur ? cur.count : 0;
        convertStash(n, () => `[[icon:medal]] 已收藏【<b>${esc(card.name)}</b>】×${n}，全部转化为人物经验（卡牌用掉）`);
      });
    });

    // —— 材料使用（不可卖出，2026-09-08 定版；最后一张/整堆需确认）——
    const useMat = (all) => {
      const cur = freshStack();
      if (!cur) { closeZoom(); return; }
      const r = B.useStashMaterial(card.name, all);
      if (r.ok) { Sfx.ding(); UI.log(r.msg, 'loot'); }
      else if (r && r.msg) UI.log(`[[icon:cross]] ${r.msg}`, 'warn');
      hubBridge.renderHub();
      refreshZoom();
    };
    UI.act('stashUseMat', () => {
      const cur = freshStack();
      if (cur && cur.count === 1) { armOrRun('stashUseMat', () => useMat(false)); return; }
      useMat(false);
    });
    UI.act('stashUseMatAll', () => { armOrRun('stashUseMatAll', () => useMat(true)); });

    // —— 宠物蛋孵化（消耗 1 蛋 + 50 币，随机未拥有宠物）——
    UI.act('stashHatch', () => {
      const cur = freshStack();
      if (!cur) { closeZoom(); return; }
      const r = B.hatchPet();
      if (r.ok) {
        Sfx.ding();
        UI.log(`[[icon:paw]] 孵化成功！获得宠物<b>「${esc(r.pet.name)}」</b>——${esc(r.pet.desc)}（可在仓库页携带 / 升级页升级）`, 'loot');
        SDT.Meta.checkUnlocks();
      } else if (r.why === 'poor') UI.log('[[icon:coin]] 储备币不足 50，无法孵化（卖出仓库卡牌攒币）', 'warn');
      else if (r.why === 'all') UI.log('[[icon:paw]] 已经集齐全部宠物了', 'dim');
      else if (r.why === 'save') UI.log('基地存档未保存，宠物蛋与储备币均未消耗', 'warn');
      else UI.log('[[icon:crystal]] 仓库里没有宠物蛋了', 'warn');
      hubBridge.renderHub();
      if (r.ok) closeZoom();
      else refreshZoom();
    });

    // —— 经济卡包使用（2026-09-09 审计补实装）：获得 5 张随机卡牌，必须入卡牌仓库——
    // 局外没有对局，塞进对局背包（game.ownedCards）会在下次开局被清空（2026-09-19 审计 P1-4）
    const openPack = () => {
      const cur = freshStack();
      if (!cur) { closeZoom(); return; }
      if (B.stashRoom() < 5) { UI.log(`[[icon:archive]] 仓库空位不足 5 格（现 ${B.stashRoom()}）——先卖出或扩建仓库再拆包`, 'warn'); return; }
      const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c));
      if (!pool.length) { UI.log('[[icon:cards]] 卡牌库是空的，没有可获得的卡牌', 'warn'); return; }
      const cards = [];
      for (let k = 0; k < 5; k++) {
        cards.push({ card: { ...pool[Math.floor(Random.random('loot') * pool.length)] }, count: 1 });
      }
      const result = B.openCardPack(card.id, cards);
      if (!result.ok) { UI.log(result.msg || '卡包已变化，请重新打开仓库', 'warn'); return; }
      UI.log('[[icon:cards]] <b>经济卡包</b>：拆开获得 5 张随机卡牌（入卡牌仓库）', 'loot');
      hubBridge.renderHub();
      refreshZoom();
    };
    UI.act('stashOpenPack', () => {
      const cur = freshStack();
      if (cur && cur.count === 1) { armOrRun('stashOpenPack', openPack); return; }
      openPack();
    });

    UI.showCardZoom(card, { presentation:'inventory', footer: footerHTML(), from, returnFocus:from });
    decorateInventoryZoom(card);
  }
  // 基地物资（木材/口粮）：材料不可卖出换币（2026-09-08 定版）——只作展示说明
  function openRawItem(kind, { from } = {}) {
    const card = SDT.Cards.all().find(item => item.id === (kind === 'wood' ? 'tt-wood' : 'tt-rations'));
    if (!card) return;
    const label = kind === 'wood' ? '木材' : '口粮';
    const target = kind === 'wood' ? 'upgrade' : 'classes';
    const footer = `<div class="raw-material-actions"><b>${label}库存 ${SDT.Base.data[kind] || 0}</b><button class="mini-btn ok" data-act="hubTab" data-tab="${target}"${kind === 'wood' ? '' : ' data-group="pets"'}>${kind === 'wood' ? '扩建' : '伙伴培养'} →</button><button class="mini-btn" data-act="hubTab" data-tab="shop">补给 →</button></div>`;
    UI.showCardZoom(card, { presentation:'inventory', footer, from, returnFocus:from });
    decorateInventoryZoom(card, { description:kind === 'wood' ? '用于扩建出征背包与仓库。' : '用于培养远征伙伴，提升安全格。' });
  }

  // —— 升级页：背包扩建 + 仓库扩建 + 宠物升级（保险升级改为宠物升级，需求 #2/#14）——
  function hubUpgradeHTML() { return facilitiesHTML(); }

  function hubClassesHTML(view = 'wu') { return personnelHTML(view); }

  // —— 职业收藏室（2026-09-09：成就系统 → 成就与职业收藏室系统）——
  // 仓库中收藏的职业卡与能力卡陈列于此；进度只计不同的职业卡 + 能力卡，
  // 达成 5/15/30/45/全收集里程碑可各领一次奖励（见 meta.js COLL_MILESTONES）。
  function hubAchHTML(hubCollectionView) { return archiveV3HTML({ base:SDT.Base, meta:SDT.Meta, cards:SDT.Cards, art:SDT.Art, view:hubCollectionView }); }

export { hubShopHTML, hubStashHTML, openStashCardView, openRawItem, hubUpgradeHTML, hubClassesHTML, hubAchHTML, HUB_SHOP_GOODS, hubShopGoodsCard };
