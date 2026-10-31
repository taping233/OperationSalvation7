/* 基地内页与物资/卡牌特写。动作契约由基地壳绑定；本文件只组织陈列与局部操作。
 * renderHub 经 game.hub.bridge.js 的 slots 调用，避免内页与壳互相依赖。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { warehouseHTML } from './hub.warehouse.js';
import { personnelHTML } from './hub.personnel.js';
import { facilitiesHTML } from './hub.facilities.js';

import { archiveV3HTML } from './hub.archive-v3.js';
import { decorateInventoryZoom } from '../ui/inventory-zoom.js';
import { createOperationNotice } from '../ui/operation-notice.js';
import { syncViewChildren } from '../ui/view-children-sync.js';
import { lockRoomButtons } from '../ui/room-footer.js';
import '../../css/base-archive-v3.css';
import { esc } from '../core/shared.js';
import { Sfx } from './game.cardslib.js';
import { Random } from '../core/random.js';
import { readBase } from './base.commands.js';
import { convertCollection, stackKeyOf } from './collection.commands.js';
import { previewCollectionConversion } from './collection-conversion.js';
import { collectionConversionHTML, conversionSignature } from './collection-conversion-view.js';
import { isCollectionProtected } from './collection-protection.js';
import { homeErrorMessage } from './command-errors.js';
import { slots as hubBridge, homeRequestId } from './game.hub.bridge.js';   // 别名防局部 slots（收藏槽位等）遮蔽
  // —— 仓库页：卡牌仓库（容量 / 卖出 / 收藏）+ 消耗区 + 物资 ——
  // 特殊收藏品：传说卡与桌游珍宝——[[icon:sparkles]]收藏后完成对应成就
  const SPECIAL_COLLECT_IDS = new Set(['tt-gold', 'tt-token-color', 'tt-econpack']);
  const isSpecialCollect = (card) => !!card &&
    (card.rarity === '传说' || SPECIAL_COLLECT_IDS.has(card.id));

  // —— 局外商店（2026-09-16 留言「局外商店提供基础卡牌」）——
  // 用储备币（卖出所得，不进局）购买基础卡，直接入卡牌仓库；初始攻击每局自动携带、
  // 火球为衍生牌不外售，故货架只放可入库的基础招式/装备/资源卡。
  // 2026-09-17 留言「买的木材没到账」：口粮/木材改为直接折入基地物资（老板预期=看物资计数），
  // 卡牌货架只留基础招式/装备
  /** @type {{id?:string, price:number, tip:string, material?:import('./base-economy.js').BaseEconomyMaterial, name?:string}[]} */
  const HUB_SHOP_GOODS = [
    { id: 'tt3-skewer',  price: 6, tip: '基础招式 · 造成 2 点伤害，无视护甲' },
    { id: 'tt3-staff',   price: 6, tip: '基础装备 · 法伤 +1' },
    { material: 'rations', name: '口粮', price: 4, tip: '基地物资 +1 · 升级宠物' },
    { material: 'wood',    name: '木材', price: 4, tip: '基地物资 +1 · 扩建背包与仓库' },
  ];
  function hubStashHTML(view = 'cards') { return warehouseHTML(view === 'pocket' ? 'pocket' : 'cards'); }

  // 仓库看卡·操作台（2026-10-06 二次改版，老板反馈「不要回到旧弹窗、要看得清」）：
  // 点卡直接开大卡特写，保护 / 转化 / 使用 / 孵化在特写页脚完成。
  // 最后一张、整堆与转化消费通过按钮
  // 就地二次确认（变红 2.6s 内再点才执行），不再跳确认页。动作前按稳定库存引用重读仓库
  // 按稳定库存引用重读堆；收藏后就地刷新页脚，出售统一由交易所负责。
  /** @param {number} i @param {{from?: HTMLElement, refreshInventory?:(focus?:boolean)=>boolean, notify?:(text:string,tone?:string)=>void, browse?:Pick<import('../ui/ui.dom.types.js').CardZoomOptions,'getItems'|'getIndex'|'index'|'onBrowse'>}} [options] */
  function openStashCardView(i, { from, refreshInventory, notify = () => {}, browse } = {}) {
    const B = SDT.Base;
    const s = B.data.stash[i];
    if (!s) { hubBridge.renderHub(); return; }
    const card = s.card;
    const slotId = B.slot, selectionGeneration = B._selectionGeneration, stackKey = stackKeyOf(s);
    const host = document.getElementById('hubMain');
    const viewKey = /** @type {HTMLElement} */ (host?.querySelector('.hub-page'))?.dataset.view;
    let zoom;
    const detailNotice = createOperationNotice();
    const currentSource = () => SDT.Base === B && B.slot === slotId && B._selectionGeneration === selectionGeneration &&
      (!host || document.getElementById('hubMain') === host && /** @type {HTMLElement} */ (host.querySelector('.hub-page'))?.dataset.view === viewKey);
    const currentDetail = () => currentSource() && !!zoom && document.getElementById('cardZoom') === zoom && !zoom.classList.contains('cz-out');
    const refreshBrowse = () => {
      if (currentDetail()) /** @type {import('../ui/ui.dom.types.js').CardZoomElement} */ (zoom)._refreshCardZoomBrowse?.();
    };
    let detailWriting = false;
    const detailAct = (name, action) => UI.act(name, async (...args) => {
      if (!currentDetail() || detailWriting) return false;
      detailWriting = true;
      try { return await action(...args); }
      catch {
        if (currentDetail()) { detailNotice.set('基地操作未完成，请重试。', 'warn'); UI.log('基地操作未完成，请重试。', 'warn'); }
        return false;
      }
      finally { detailWriting = false; refreshBrowse(); }
    });
    const mat = B.materialInfo ? B.materialInfo(card) : null;
    const isEgg = card.id === B.PET_EGG_ID;
    const isPack = card.id === 'tt-econpack';
    const special = isSpecialCollect(card);


    // 索引/卡名都可能重用；同 ID 的不同 variant 也必须指向原来预览的唯一堆。
    const freshStack = () => {
      const matches = B.data.stash.filter(stack => stackKeyOf(stack) === stackKey && stack.card.id === card.id);
      return matches.length === 1 ? matches[0] : null;
    };
    const closeZoom = () => {
      if (currentDetail()) zoom.querySelector('.cz-backdrop')?.click();
    };
    const specialUseBlock = () => {
      if (!isEgg && !isPack) return '';
      if (!freshStack()) return '该物品已不在仓库，请重新选择。';
      if (B.data.stash.filter(stack => stack.card.id === card.id).length !== 1) return '库存引用不唯一，请刷新仓库。';
      if (isEgg) return [B.data.coins < B.HATCH_COST ? `还需 ${B.HATCH_COST - B.data.coins} 储备币` : '',
        B.PETS.some(pet => !B.data.pets[pet.id]) ? '' : '已集齐全部伙伴'].filter(Boolean).join(' · ');
      return [B.stashRoom() + 1 < 5 ? `拆包需要 4 格空位，现有 ${B.stashRoom()} 格，还需 ${4 - B.stashRoom()} 格` : '',
        SDT.Cards.all().some(item => SDT.Cards.isRandomObtainable(item)) ? '' : '当前没有可获得的卡牌'].filter(Boolean).join(' · ');
    };

    // 动作后重算数量/价格/按钮态，保留仍存在的页脚控件与阅读容器。
    const footerHTML = () => {
      const cur = freshStack(), n = cur ? cur.count : 0;
      const marked = B.isCollected(card);
      const convertType = !!card.cls && (card.rarity === '职业' || card.type === '能力卡');
      const protectedCard = isCollectionProtected(B.data, card);
      const conversion = convertType ? previewCollectionConversion({ baseSnapshot: B.data, card, availableCount: n }) : null;
      const useBlock = specialUseBlock();
      const useDisabled = useBlock ? ' disabled aria-describedby="stash-special-use-reason"' : '';
      const btns = [];
      if (mat) {
        const amount = B.materialAmount?.(card);
        const gain = Number.isFinite(amount) && amount > 0 && mat.label ? `${esc(mat.label)} +${amount}` : '折入基地材料';
        btns.push(`<button class="ov-btn ok" data-act="stashUseMat">使用 1 张 → ${gain}</button>`);
        if (n > 1) btns.push(`<button class="ov-btn" data-act="stashUseMatAll">使用整堆 · ${n} 张</button>`);
      } else if (isEgg) {
        btns.push(`<button class="ov-btn ok" data-act="stashHatch"${useDisabled}>孵化 1 枚 · 消耗 ${B.HATCH_COST} 储备币</button>`);
      } else if (isPack) {
        btns.push(`<button class="ov-btn ok" data-act="stashOpenPack"${useDisabled}>拆开 1 包 · 获得 5 张随机卡牌</button>`);
      } else {
        if (convertType) {
          btns.push(`<button class="ov-btn ok" data-act="stashCollectOne"${conversion.canConvert ? '' : ' disabled'}>${conversion.registrationOnly ? '仅收录图鉴 · 消耗 1 张' : conversion.code === 'CHARACTER_MAXED' ? '转化经验 · 已满级' : '转化经验 · 1 张'}</button>`);
          if (conversion.maxCount > 1) btns.push(`<button class="ov-btn" data-act="stashCollectAll"${conversion.protected ? ' disabled' : ''}>批量转化 · ${conversion.maxCount} 张</button>`);
          if (marked) btns.push(`<button class="ov-btn" data-act="stashCollectToggle">${protectedCard ? '取消保护' : '保护卡牌'}</button>`);
        } else btns.push(`<button class="ov-btn${protectedCard ? '' : ' ok'}" data-act="stashCollectToggle">${protectedCard ? '取消保护' : '保护卡牌'}</button>`);
      }
      const hint = mat ? '使用资源卡后折入基地材料。'
        : isEgg ? '随机孵化未拥有的伙伴。'
        : isPack ? '随机卡牌存入后勤仓库，拆包释放 1 格，需至少 4 格空位。'
        : convertType ? conversion.registrationOnly ? '人物熟练度已满，首次收录图鉴只消耗 1 张，不再增加经验。'
          : conversion.code === 'CHARACTER_MAXED' ? '人物熟练度已满且图鉴已收录，已停止经验转化，卡牌保留。'
          : `${marked ? '图鉴已收录；重复卡仍可转化经验。' : '首次转化会同时收录图鉴。'}${n > conversion.maxCount && conversion.maxCount > 0 ? `批量最多消耗 ${conversion.maxCount} 张，余下 ${n - conversion.maxCount} 张保留。` : ''}`
        : protectedCard ? '取消保护不影响图鉴收录。' : '保护不消耗卡牌，不增加经验。';
      return `<div class="camp-detail camp-card-actions"><div class="inspect-meta"><span class="inspect-count">持有 <b>${n}</b> 张</span><span class="inspect-collection-state">${marked ? '图鉴已收录' : '尚未收录'}${protectedCard ? ' · 已保护' : ''}</span></div><p class="inspect-collection-hint">${hint}</p>${useBlock ? `<p class="inspect-collection-hint" id="stash-special-use-reason" role="status">${esc(useBlock)}</p>` : ''}${conversion ? `<p class="inspect-collection-hint" data-conversion-preview role="status">${collectionConversionHTML(conversion)}</p>` : ''}${btns.length ? `<div class="ov-btns">${btns.join('')}</div>` : ''}${detailNotice.html({ keepEmpty:true })}</div>`;
    };
    const refreshZoom = () => {
      if (!currentDetail()) return;
      if (!freshStack()) { closeZoom(); return; }
      const foot = zoom.querySelector('.cz-foot');
      if (foot) {
        const active = document.activeElement;
        const hadFooterFocus = active instanceof HTMLElement && foot.contains(active);
        const action = hadFooterFocus ? active.dataset.act : '';
        const next = document.createElement('template');
        next.innerHTML = footerHTML();
        // The fresh footer also clears the old confirmation label, token and danger state.
        syncViewChildren(foot, next.content);
        if (hadFooterFocus) /** @type {HTMLElement} */ ((action && foot.querySelector(`[data-act="${action}"]:not(:disabled)`))
          || foot.querySelector('button:not(:disabled)') || zoom.querySelector('.cz-close:not(:disabled)'))?.focus({ preventScroll:true });
      }
      refreshBrowse();
    };
    const warnDetail = message => {
      detailNotice.set(message, 'warn'); UI.log(message, 'warn'); return false;
    };
    const writeDetail = async (message, write) => {
      const focused = document.activeElement;
      const buttons = [...zoom.querySelectorAll('.cz-foot button, .cz-list-nav button')].map(button => ({ button, busy:button.getAttribute('aria-busy') }));
      const release = lockRoomButtons(buttons.map(({ button }) => button));
      buttons.forEach(({ button }) => { button.setAttribute('aria-busy', 'true'); });
      detailNotice.set(message);
      try { return await write(); }
      finally {
        release();
        if (currentDetail()) {
          buttons.forEach(({ button, busy }) => {
            if (button.isConnected) {
              if (busy === null) button.removeAttribute('aria-busy'); else button.setAttribute('aria-busy', busy);
            }
          });
          const restore = buttons.find(({ button }) => button === focused && !button.disabled && button.isConnected);
          if (restore && document.activeElement === document.body) restore.button.focus({ preventScroll:true });
          refreshBrowse();
        } else if (currentSource()) refreshInventory?.();
      }
    };
    const refreshConsumedDetail = () => {
      const exhausted = !freshStack();
      if (exhausted) {
        const close = /** @type {HTMLElement & {_closeCardZoom?: (immediate?:boolean)=>void}} */ (zoom)._closeCardZoom;
        if (close) close(true); else closeZoom();
      }
      const updated = refreshInventory?.(exhausted);
      if (!updated) hubBridge.renderHub();
      if (!exhausted) refreshZoom();
      return true;
    };
    const checkDetailUnlocks = async message => {
      try { await SDT.Meta.checkUnlocks(); }
      catch { if (currentDetail()) warnDetail(message); }
    };

    // 就地二次确认：首点变红「确认？」，2.6s 内再点才执行（页脚刷新会自然解除）
    let armSequence = 0;
    const armOrRun = (act, run, extraSignature = '') => {
      if (!currentDetail()) return;
      let btn = zoom.querySelector(`.cz-foot [data-act="${act}"]`);
      const cur = freshStack();
      if (!btn || btn.disabled || !cur) return;
      const signature = `${stackKey}:${cur.count}:${extraSignature}`;
      if (btn.dataset.arm === '1' && btn.dataset.armSignature === signature) return run();
      if (btn.dataset.arm === '1') {
        UI.log('库存数量已变化，请重新确认', 'warn');
        refreshZoom();
        btn = zoom.querySelector(`.cz-foot [data-act="${act}"]`);
        if (!btn) return;
      }
      const armToken = String(++armSequence);
      btn.dataset.arm = '1';
      btn.dataset.armToken = armToken;
      btn.dataset.armSignature = signature;
      if (!btn.dataset.armLabel) btn.dataset.armLabel = btn.textContent;
      btn.textContent = '确认？';
      btn.classList.add('danger');
      setTimeout(() => {
        if (!currentDetail() || !btn.isConnected || btn.dataset.arm !== '1' || btn.dataset.armToken !== armToken) return;
        delete btn.dataset.arm;
        delete btn.dataset.armSignature;
        btn.textContent = btn.dataset.armLabel;
        btn.classList.remove('danger');
      }, 2600);
    };
    // 保护操作保留图鉴；职业卡/能力卡首次收录仍由下方消耗卡牌的转换完成。
    detailAct('stashCollectToggle', async () => {
      const cur = freshStack();
      if (!cur) { closeZoom(); return; }
      if (!B.isCollected(card) && card.cls && (card.rarity === '职业' || card.type === '能力卡')) {
        UI.log('职业卡或能力卡需通过消耗卡牌转化后首次收录', 'warn'); return;
      }
      const now = await writeDetail('保护状态保存中…', () => B.collectToggle(card));
      if (!currentDetail()) return false;
      if (now === null) return warnDetail('基地存档未保存，保护状态未改变');
      const message = `${now ? '已保护' : '已取消保护'} · ${card.name} · 卡牌保留`;
      detailNotice.set(message); notify(message);
      Sfx.ding();
      UI.log(now
        ? `[[icon:sparkles]] 已保护【<b>${esc(card.name)}</b>】（卡牌保留，不获得人物经验）${special ? '（特殊收藏品）' : ''}`
        : `[[icon:sparkles]] 已取消【<b>${esc(card.name)}</b>】的保护，图鉴收录保留`, now ? 'loot' : 'dim');
      refreshConsumedDetail();
      await checkDetailUnlocks('保护状态已保存，成就状态稍后刷新。');
      return true;
    });
    let converting = false;
    const convertStash = async (preview) => {
      if (!currentDetail() || converting) return;
      const cur = freshStack();
      if (!cur) { closeZoom(); return; }
      const read = readBase(slotId);
      if (!read.ok) { UI.log(homeErrorMessage(read), 'warn'); return; }
      const stored = read.value.stash.find(stack => stackKeyOf(stack) === stackKey);
      const latest = previewCollectionConversion({ baseSnapshot: read.value, card, availableCount: stored?.count || 0, count: preview.count });
      if (!latest.canConvert || conversionSignature(latest) !== conversionSignature(preview)) {
        UI.log(latest.canConvert ? '人物进度或保护状态已变化，请重新确认转化预览' : latest.message, 'warn'); refreshZoom(); return;
      }
      converting = true;
      let result;
      try { result = await writeDetail('卡牌转化中…', () => convertCollection({ slotId, requestId: homeRequestId('stash-collect'), expectedRevision: read.revision }, { stackKey: stackKeyOf(cur), count: preview.count })); }
      catch { result = { ok:false, message:'归档未保存，请重试' }; }
      finally { converting = false; }
      if (!currentDetail()) return;
      if (!result.ok) { warnDetail(result.message || '转化失败，卡牌未消耗'); refreshZoom(); return false; }
      Sfx.ding();
      const actual = result.value?.conversion || latest;
      const message = `转化成功 · ${card.name} ×${actual.count} · ${actual.registrationOnly ? '仅收录图鉴，经验 +0' : `实际经验 +${actual.actualXp}`}`;
      detailNotice.set(message); notify(message);
      UI.log(`[[icon:medal]] ${esc(actual.characterName)}：消耗【<b>${esc(card.name)}</b>】×${actual.count}，${actual.registrationOnly ? '仅收录图鉴，经验 +0' : `实际经验 +${actual.actualXp}`}${actual.overflowXp ? `（末张溢出 ${actual.overflowXp}）` : ''} · Lv.${actual.before.lv} / ${actual.before.xp} XP → Lv.${actual.after.lv} / ${actual.after.xp} XP`, 'loot');
      refreshConsumedDetail();
      await checkDetailUnlocks('卡牌已转化，成就状态稍后刷新。');
      return true;
    };
    const conversionPreview = (batch = false) => {
      const cur = freshStack();
      if (!cur) { closeZoom(); return null; }
      const first = previewCollectionConversion({ baseSnapshot: B.data, card, availableCount: cur.count });
      const preview = batch && first.maxCount > 1 ? previewCollectionConversion({ baseSnapshot: B.data, card, availableCount: cur.count, count: first.maxCount }) : first;
      if (!preview.canConvert) { UI.log(preview.message, 'warn'); refreshZoom(); return null; }
      const target = zoom.querySelector('[data-conversion-preview]');
      if (target) target.innerHTML = collectionConversionHTML(preview);
      return preview;
    };
    detailAct('stashCollectOne', () => {
      const preview = conversionPreview();
      if (preview) return armOrRun('stashCollectOne', () => convertStash(preview), conversionSignature(preview));
    });
    detailAct('stashCollectAll', () => {
      const preview = conversionPreview(true);
      if (preview) return armOrRun('stashCollectAll', () => convertStash(preview), conversionSignature(preview));
    });

    // —— 材料使用（不可卖出，2026-09-08 定版；最后一张/整堆需确认）——
    const useMat = async (all) => {
      const cur = freshStack();
      if (!cur) { closeZoom(); return; }
      // 旧材料命令以名字定位，名字重叠时不能让另一个堆承担消费。
      if (B.data.stash.filter(stack => stack.card.name === card.name).length !== 1) {
        detailNotice.set('库存引用不唯一，请刷新仓库', 'warn'); UI.log('库存引用不唯一，请刷新仓库', 'warn'); return;
      }
      let r;
      try { r = await writeDetail('材料使用中…', () => B.useStashMaterial(card.name, all)); }
      catch { r = { ok:false, msg:'材料未保存，未消耗，请重试。' }; }
      if (!currentDetail()) return false;
      if (r.ok === true) {
        const message = `使用${card.name} ×${r.qty} · ${r.label} +${r.total}`;
        detailNotice.set(message); notify(message); Sfx.ding(); UI.log(r.msg, 'loot');
        return refreshConsumedDetail();
      } else {
        const message = r.msg || '材料未使用，请重试。';
        detailNotice.set(message, 'warn'); UI.log(`[[icon:cross]] ${message}`, 'warn'); refreshZoom();
      }
    };
    detailAct('stashUseMat', () => {
      const cur = freshStack();
      if (cur && cur.count === 1) return armOrRun('stashUseMat', () => useMat(false));
      return useMat(false);
    });
    detailAct('stashUseMatAll', () => armOrRun('stashUseMatAll', () => useMat(true)));

    // 孵化成本沿Base配置，成功后可继续消费剩余蛋。
    detailAct('stashHatch', () => armOrRun('stashHatch', async () => {
      const cur = freshStack();
      if (!cur) { closeZoom(); return; }
      const blocked = specialUseBlock();
      if (blocked) { warnDetail(blocked); refreshZoom(); return false; }
      const r = await writeDetail('伙伴孵化中…', () => B.hatchPet());
      if (!currentDetail()) return false;
      if (r.ok === true) {
        const message = `孵化成功 · 获得${r.pet.name} · 储备币 −${B.HATCH_COST}`;
        detailNotice.set(message); notify(message);
        Sfx.ding();
        UI.log(`[[icon:paw]] 孵化成功！获得伙伴<b>「${esc(r.pet.name)}」</b>——${esc(r.pet.desc)}（可在人物页的伙伴栏携带与培养）`, 'loot');
        refreshConsumedDetail();
        await checkDetailUnlocks('伙伴已获得，成就状态稍后刷新。');
        return true;
      }
      const message = r.why === 'poor' ? `孵化需要 ${B.HATCH_COST} 储备币，现有 ${B.data.coins}。`
        : r.why === 'all' ? '已集齐全部伙伴。'
        : r.why === 'save' ? '孵化未保存，请重试。'
        : '仓库中没有宠物蛋了。';
      return warnDetail(message);
    }));

    // —— 经济卡包使用（2026-09-09 审计补实装）：获得 5 张随机卡牌，必须入卡牌仓库——
    // 局外没有对局，塞进对局背包（game.ownedCards）会在下次开局被清空（2026-09-19 审计 P1-4）
    const openPack = async () => {
      const cur = freshStack();
      if (!cur) { closeZoom(); return; }
      const blocked = specialUseBlock();
      if (blocked) { warnDetail(blocked); refreshZoom(); return false; }
      const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c));
      if (!pool.length) return warnDetail('当前没有可获得的卡牌。');
      const cards = [];
      for (let k = 0; k < 5; k++) {
        cards.push({ card: { ...pool[Math.floor(Random.random('loot', 'reward') * pool.length)] }, count: 1 });
      }
      const result = await writeDetail('卡包打开中…', () => B.openCardPack(card.id, cards));
      if (!currentDetail()) return false;
      if (!result.ok) {
        const failure = /** @type {Extract<typeof result, {ok:false}>} */ (result);
        return warnDetail(failure.msg || (failure.why === 'full' ? '仓库空位不足，请整理后重试。' : '卡包已变化，请重新选择。'));
      }
      const names = cards.map(entry => entry.card.name || entry.card.id).join('、');
      detailNotice.set(`拆包成功 · ${names}`); notify(`拆包成功 · ${cards.length} 张卡牌已入仓库`);
      Sfx.ding();
      UI.log(`[[icon:cards]] <b>经济卡包</b>：获得 ${cards.length} 张卡牌——${esc(names)}（已入仓库）`, 'loot');
      return refreshConsumedDetail();
    };
    detailAct('stashOpenPack', () => {
      const cur = freshStack();
      if (cur && cur.count === 1) return armOrRun('stashOpenPack', openPack);
      return openPack();
    });

    UI.showCardZoom(card, { presentation:'inventory', footer: footerHTML(), from, returnFocus:from,
      canNavigate:() => currentDetail() && !detailWriting,
      onReopen:() => {
        if (!currentSource()) return false;
        const current = freshStack();
        if (!current) return false;
        const index = B.data.stash.indexOf(current);
        if (index < 0) return false;
        openStashCardView(index, { from, browse, refreshInventory, notify });
        return true;
      },
      ...(browse ? { getItems:browse.getItems, getIndex:browse.getIndex, index:browse.index,
        onBrowse:(nextCard, nextIndex) => {
          if (currentDetail() && !detailWriting) browse.onBrowse?.(nextCard, nextIndex);
        },
      } : {}),
    });
    zoom = document.getElementById('cardZoom');
    decorateInventoryZoom(card);
    refreshBrowse();
  }
  // 基地物资（木材/口粮）：材料不可卖出换币（2026-09-08 定版）——只作展示说明
  /** @param {string} kind @param {{from?: HTMLElement}} [options] */
  function openRawItem(kind, { from } = {}) {
    if (!['wood', 'rations'].includes(kind)) return;
    const label = kind === 'wood' ? '木材' : '口粮';
    const card = SDT.Cards.all().find(item => item.id === (kind === 'wood' ? 'tt-wood' : 'tt-rations'))
      || SDT.Cards.all().find(item => SDT.Base.materialInfo?.(item)?.kind === kind)
      || { id: `base-material-${kind}`, name: label, type: '基地材料', rarity: '初始', cost: 0, desc: kind === 'wood' ? '用于扩建出征背包与仓库。' : '用于培养远征伙伴，提升安全格。' };
    const target = kind === 'wood' ? 'upgrade' : 'classes';
    const footer = `<div class="raw-material-actions"><b>基地${label}库存 ${SDT.Base.data[kind] || 0} 份</b><p>不含未使用的资源卡；在仓库使用后计入。</p><button class="mini-btn ok" data-act="hubTab" data-tab="${target}"${kind === 'wood' ? '' : ' data-group="pets"'}>${kind === 'wood' ? '扩建' : '伙伴培养'} →</button><button class="mini-btn" data-act="hubTab" data-tab="shop">补给 →</button></div>`;
    UI.showCardZoom(card, { presentation:'inventory', footer, from, returnFocus:from });
    decorateInventoryZoom(card, { description:kind === 'wood' ? '用于扩建出征背包与仓库。' : '用于培养远征伙伴，提升安全格。' });
  }

  // —— 升级页：背包扩建 + 仓库扩建 + 宠物升级（保险升级改为宠物升级，需求 #2/#14）——
  function hubUpgradeHTML() { return facilitiesHTML(); }

  function hubClassesHTML(view = 'wu') { return personnelHTML(view); }

  // —— 职业收藏室（2026-09-09：成就系统 → 成就与职业收藏室系统）——
  // 仓库中收藏的职业卡与能力卡陈列于此；进度只计不同的职业卡 + 能力卡，
  // 达成 5/15/30/45/全收集里程碑可各领一次奖励（见 meta.js COLL_MILESTONES）。
  function hubAchHTML(hubCollectionView) { return /** @type {(options: Parameters<typeof archiveV3HTML>[0] & {art?:unknown}) => ReturnType<typeof archiveV3HTML>} */ (archiveV3HTML)({ base:SDT.Base, meta:SDT.Meta, cards:SDT.Cards, art:SDT.Art, view:hubCollectionView }); }

export { hubStashHTML, openStashCardView, openRawItem, hubUpgradeHTML, hubClassesHTML, hubAchHTML, HUB_SHOP_GOODS };
