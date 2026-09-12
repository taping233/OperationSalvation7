import { sdtDefine } from './sdt-facade.js';
import { characterName } from './characters.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from './shared.js';
import { escAttr } from './shared.js';
import { Random } from './random.js';
import { BattleSession, commands, configureBattleRenderer, getSnapshot, viewApi } from './battle.core.js';
import { groupHandCards, fanLayout } from './battle.hand.js';
import { intentSummary, intentViewModel } from './battle.intents.js';
import { FEEDBACK_DELTA_MS, feedbackClass, feedbackDelay } from './battle.feedback.js';
import { renderCombatPiles } from './battle.piles.view.js';

  // 状态角标：祝福（绿）+ 诅咒（红）——2026-09-11 架构批次 1 自 battle.core 外迁（纯视图函数）
  function statusChips(status) {
    const buffs = Combat.BUFFS
      .filter(k => (status[k] || 0) > 0)
      .map(k => {
        const m = Combat.BUFF_META[k];
        const v = m.timed ? ` ${status[k]}回合` : (m.flag ? '' : ` ${status[k]}`);
        return `<span class="bt-buff b-${k}" title="${escAttr('祝福：' + m.desc)}">${m.icon} ${m.name}${v}</span>`;
      });
    const curses = Combat.CURSES
      .filter(k => (status[k] || 0) > 0)
      .map(k => {
        const m = Combat.CURSE_META[k];
        const txt = m.stack ? `${m.name} ${status[k]}` : `${m.name} ${status[k]}回合`;
        return `<span class="bt-curse c-${k}" title="${escAttr(m.desc)}">${m.icon} ${txt}</span>`;
      });
    return buffs.concat(curses).join(' ');
  }
  const curseChips = statusChips;   // 兼容旧调用名
/* battle.view.js —— 战斗渲染：战场 DOM/手牌/指向施法箭头/拖拽预览 */
  const {
    AFFIX_META, Combat, R, aegisBlocked, effCostOf, findCard,
    infuseOf, markDreadShown, pileTip, refillDrawPile,
    takeFloats, takeCardAnims, targetSide, unplayableReason, matchHandSelectKey,
    handCurseSpecs,
  } = viewApi;
  const play = commands.playCard;
  const cancelInfuse = commands.cancelInfusion;
  const confirmInfuse = commands.confirmInfusion;
  const beginInfuse = commands.beginInfusion;   // 需求 #15：卡面「注能」角标入口
  const bagSlam = commands.bagSlam;             // 需求 #9：背包砸击
  const resolveSlam = commands.resolveSlam;
  const endTurn = commands.endTurn;
  const flee = commands.flee;
  const surrender = commands.surrender;   // 玩法定版：主动撤离视为本局失败
  const openGrave = commands.openGrave;
  const closeBagCmd = commands.closeBag;
  const openBagCmd = commands.openBag;
  const useItemCmd = commands.useItem;
  const cancelPendingTarget = commands.cancelPendingTarget;
  const pickDiscover = commands.pickDiscover;
  const pickChoice = commands.pickChoice;
  const toggleInfusePick = commands.selectInfusion;
  const closeGrave = commands.closeGrave;
  const selectDeckCard = commands.selectDeckCard;
  const pickHandSelect = commands.pickHandSelect;
  const skipHandSelect = commands.skipHandSelect;
  const usePotion = commands.usePotion;
  const useEquipSkill = commands.useEquipSkill;
  // 双击放大（2026-09-06 #12）：事件委托，双击手牌卡放大/还原
  document.addEventListener('dblclick', (e) => {
    const el = e.target && e.target.closest && e.target.closest('.sts-hand .bt-card');
    if (!el) return;
    const was = el.classList.contains('zoomed');
    document.querySelectorAll('.sts-hand .bt-card.zoomed').forEach(x => x.classList.remove('zoomed'));
    if (!was) el.classList.add('zoomed');
  });
  const confirmDeck = commands.confirmDeck;
  const cancelDeck = commands.cancelDeck;

  function renderDeckSelection(snapshot) {
    const { deckSelection, opts } = snapshot;
    const selected = deckSelection.selected;
    const need = Math.min(deckSelection.need, deckSelection.cards.length);
    const cardsHTML = deckSelection.cards.length
      ? deckSelection.cards.map(entry => `
          <div class="bt-card${selected.includes(entry.uid) ? ' sel' : ''}" data-act="bossSel" data-uid="${entry.uid}" title="点击 编入/移出 牌库">
            ${SDT.Cards.cardHTML(entry.card, 'sm')}
          </div>`).join('')
      : '<p class="ov-empty">背包里没有可编入的非道具卡牌……</p>';
    const boss = deckSelection.boss;
    const affix = boss && boss.affix ? AFFIX_META[boss.affix] : null;
    const ready = selected.length >= need;
    UI.showOverlay('[[icon:demon]] BOSS战 · 编组牌库', `
      <p class="ov-stats">本局首脑：<b>${esc(boss && boss.name || '???')}</b>（${boss ? `${boss.atk}-${boss.maxHp || boss.hp}` : '?-?'}）——从背包选 <b>${deckSelection.need}</b> 张<b>招式 / 装备 / 能力卡</b>，与 <b>${deckSelection.starterCount}</b> 张初始攻击组成牌库 ·
        开局抽 ${R().battleStartDraw} 张 · 每回合开始抽 ${R().battleTurnDraw} 张 · 每回合固定 ${R().battleEnergy} 费</p>
      ${affix ? `<p class="ov-note">[[icon:question]] <b>${esc(boss.name)}</b> 词缀【${affix.icon} ${affix.name}】${esc(affix.desc)}</p>` : ''}
      ${deckSelection.max > R().bossDeckSize ? '<p class="ov-note">[[icon:eye]] 混沌之眼：牌库上限 +5——勾选后可在 15 张基础上多选，最多编 ' + deckSelection.max + ' 张</p>' : ''}
      <p class="ov-note">[[icon:lock]] 固定编入：初始攻击 ×${deckSelection.starterCount}${deckSelection.starterCount < R().starterSha ? `（初始攻击不足 ${R().starterSha} 张——部分进消耗口袋了）` : ''}
        · [[icon:cross]] 道具 / 资源 / 事件卡与初始攻击不可选入</p>
      ${deckSelection.equips && deckSelection.equips.length ? `
        <h3 class="set-h">开战装备（「对战开始时」生效，不占牌库） <span class="bs-count">已勾选 ${deckSelection.equipsSelected.length}/${deckSelection.equips.length} · 不勾选则本场不生效</span></h3>
        <div class="bt-hand deck-equip-hand">${deckSelection.equips.map(entry => `
          <div class="bt-card${deckSelection.equipsSelected.includes(entry.uid) ? ' sel' : ''}" data-act="bossSelEquip" data-uid="${entry.uid}"
            title="点击 勾选/取消——只有勾选的装备才会在这场 BOSS 战开始时自动生效">
            ${SDT.Cards.cardHTML(entry.card, 'sm')}
            <span class="bt-count">${deckSelection.equipsSelected.includes(entry.uid) ? '[[icon:check]] 已勾选' : '[[icon:cross]] 未勾选'}</span>
          </div>`).join('')}
        </div>` : ''}
      <h3 class="set-h">可选卡牌 <span class="bs-count">已选 ${selected.length} 张（至少 ${deckSelection.need}${deckSelection.max > deckSelection.need ? ' · 至多 ' + deckSelection.max : ''}）</span></h3>
      <div class="bt-hand">${cardsHTML}</div>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="bossGo" ${ready ? '' : 'disabled'}>${ready ? `[[icon:swords]] 开始战斗（牌库 ${selected.length + deckSelection.starterCount} 张）` : `还需选择 ${need - selected.length} 张…`}</button>
        <button class="ov-btn" data-act="bossCancel">↩ 放弃挑战</button>
      </div>`, true);
    UI.act('bossSel', data => selectDeckCard(data.uid));
    UI.act('bossSelEquip', data => commands.selectDeckEquip(data.uid));
    UI.act('bossGo', confirmDeck);
    UI.act('bossCancel', cancelDeck);
    UI.refresh(SDT.game);
  }

  function renderGrave(snapshot) {
    const cards = snapshot.grave.map(findCard).filter(Boolean);
    const byType = {};
    cards.forEach(entry => { byType[entry.card.type] = (byType[entry.card.type] || 0) + 1; });
    const statLine = Object.keys(byType).length
      ? Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => `${esc(type)} <b>${count}</b>`).join(' · ')
      : '（墓地还是空的——注能等效果消耗的牌会进入这里）';
    const byName = {};
    cards.forEach(entry => {
      if (!byName[entry.card.name]) byName[entry.card.name] = { card: entry.card, count: 0 };
      byName[entry.card.name].count++;
    });
    const listHTML = Object.values(byName).map(stack => `
      <div class="bt-gy-row" title="${escAttr(stack.card.desc || '')}">
        <span>[[icon:cards]] <b>${esc(stack.card.name)}</b>${stack.count > 1 ? ` ×${stack.count}` : ''}</span>
        <span class="bt-gy-meta">${esc(stack.card.type)} · ${stack.card.cost}费 · ${esc(stack.card.rarity || '')}</span>
      </div>`).join('');
    UI.showOverlay(`${snapshot.opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${snapshot.turn} 回合 · [[icon:skull]] 墓地`, `
      <p class="ov-stats">被消耗的牌共 <b>${cards.length}</b> 张 —— ${statLine}</p>
      <div class="bt-gy-list">${listHTML}</div>
      <p class="ov-note">墓地中的牌<b>不会在牌库空后洗回</b>；打出的牌进弃牌堆（会洗回循环）。战胜 BOSS 后可在「整理背包」环节把这些牌放回背包或丢弃。</p>
      <div class="ov-btns"><button class="ov-btn ok" data-act="btGraveBack">↩ 返回战斗</button></div>`, true);
    UI.act('btGraveBack', closeGrave);
    UI.refresh(SDT.game);
  }

  // 战斗背包（2026-09-09 老板：战斗中开背包使用道具；2026-09-09 玩法定版：
  // 新增「存入安全格」——撤离判负前把卡牌转移进安全格，失败抢运时才保得住）
  function renderBattleBag(snapshot) {
    const byName = {};
    (SDT.game.ownedCards || []).forEach(o => {
      if (!o.card || o.card.type !== '道具' || o.safe) return;
      if (!byName[o.card.name]) byName[o.card.name] = { card: o.card, uids: [] };
      byName[o.card.name].uids.push(o.uid);
    });
    const stacks = Object.values(byName);
    const cardsHTML = stacks.length
      ? stacks.map(st => `
          <div class="bt-card" data-act="btUseItem" data-uid="${st.uids[0]}"
            title="${escAttr(st.card.desc || st.card.name)}——点击使用">
            ${SDT.Cards.cardHTML(st.card, 'sm')}
            ${st.uids.length > 1 ? `<span class="bt-count" title="同名道具 ${st.uids.length} 件">×${st.uids.length}</span>` : ''}
          </div>`).join('')
      : '<p class="ov-empty">背包里没有道具卡……（道具卡可从宝箱 / 商店获得）</p>';
    // —— 安全格转移（同名堆叠整组存入；容量在基地用口粮升级）——
    const cap = (SDT.game.safeCap && SDT.game.safeCap()) || 0;
    const used = (SDT.game.safeUsed && SDT.game.safeUsed()) || 0;
    const bySafe = {};
    (SDT.game.ownedCards || []).forEach(o => {
      if (!o.card || o.safe || o.stored || o.card.name === '初始攻击') return;   // 珍珠盒存放中的卡不在此列出（2026-09-10 #29）
      if (!bySafe[o.card.name]) bySafe[o.card.name] = { card: o.card, uids: [] };
      bySafe[o.card.name].uids.push(o.uid);
    });
    const safeStacks = Object.values(bySafe);
    const room = Math.max(0, cap - used);
    const safeHTML = safeStacks.length
      ? safeStacks.map(st => {
          const fits = st.uids.length <= room;
          return `<div class="bt-card${fits ? '' : ' off'}" data-act="btSafeMove" data-name="${escAttr(st.card.name)}"
            title="${escAttr(`将「${st.card.name}」×${st.uids.length} 整组存入安全格（撤离失败时安全运回）${fits ? '' : '——安全格空位不足'}`)}">
            ${SDT.Cards.cardHTML(st.card, 'sm')}
            ${st.uids.length > 1 ? `<span class="bt-count">×${st.uids.length}</span>` : ''}
            <span class="bt-count" style="top:auto;bottom:3px">[[icon:lock]] 存入</span>
          </div>`;
        }).join('')
      : '<p class="ov-empty">背包里没有可存入的卡牌。</p>';
    UI.showOverlay(`${snapshot.opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${snapshot.turn} 回合 · [[icon:bag]] 战斗背包`, `
      <p class="ov-stats">点击道具卡直接使用——回复类 / 能源结晶 / 神秘药水 / 口粮木材战斗内生效，其余道具战后回地图再使</p>
      <div class="bt-hand">${cardsHTML}</div>
      <p class="ov-stats">[[icon:lock]] 安全格 <b>${used}/${cap}</b>（空位 ${room}）——点击卡牌把整组存入，撤离失败时只有安全格里的卡牌会抢运回基地</p>
      <div class="bt-hand">${safeHTML}</div>
      <div class="ov-btns"><button class="ov-btn ok" data-act="btBagBack">↩ 返回战斗（B）</button></div>`, true);
    UI.act('btUseItem', (d) => useItemCmd(d.uid));
    UI.act('btSafeMove', (d) => {
      const g = SDT.game;
      const group = (g.ownedCards || []).filter(o => o.card && !o.safe && o.card.name === d.name);
      if (!group.length) return;
      const free = Math.max(0, ((g.safeCap && g.safeCap()) || 0) - ((g.safeUsed && g.safeUsed()) || 0));
      if (group.length > free) { UI.log(`[[icon:lock]] 安全格空位不足（${free} 格）——存不进「${esc(d.name)}」×${group.length}`, 'warn'); SDT.Sound.sfx('deny'); return; }
      group.forEach(o => { o.safe = true; });
      UI.log(`[[icon:lock]] 【${esc(d.name)}】×${group.length} 已存入安全格（撤离失败时安全运回）`, 'sys');
      if (g.saveGame) g.saveGame();
      renderBattleBag(getSnapshot());
    });
    UI.act('btBagBack', closeBagCmd);
    UI.refresh(SDT.game);
  }

  // ---------- 渲染 ----------
  // 手牌分栏（2026-09-10 留言 #27）：一栏最多 12 叠，放不下的进第二栏，用按钮切换
  let handPage = 0;
  const HAND_PAGE_SIZE = 12;
  // 发现选卡的飞入起点（2026-09-10 留言 #36）：发现浮层会整块替换战斗视图，抽卡动画取样不到
  // 旧手牌位——点中候选卡的瞬间记下它的屏幕矩形，让新卡从「被选中的那张卡」飞回手牌
  let discoverSrcRect = null;

  function render(snapshot = getSnapshot()) {
    const prevView = captureBattleView();   // 重建前的手牌/牌堆位：供飞行与归位动画取样
    const {
      mode, turn, energy, maxEnergy, busy, phase = 'player', opts, player, pdef, pstat,
      foes, hand, drawPile, discard, grave, infusing, discovering, handSelecting, choosing,
      pendingTarget, pendingHint, viewingGrave, viewingBag, dreadShown, deckSelection,
      potionBar, pendingItem, slamPending,
    } = snapshot;
    if (aim) cancelAim();   // 重渲染时中止进行中的指向（DOM 将重建）
    if (deckSelection) { handSuspended = false; renderDeckSelection(snapshot); return; }   // 战前编组：允许下次挂载时重置手牌层
    if (viewingGrave) { handSuspended = true; renderGrave(snapshot); return; }
    if (viewingBag) { handSuspended = true; renderBattleBag(snapshot); return; }
    if (choosing) {
      handSuspended = true;   // 抉择/选牌/发现都是战斗中弹层：手牌层摘下挂起，回来继续用
      // 2026-09-08 抉择面板：人工 N 选一（复用发现面板的弹层交互）
      const choiceHTML = choosing.options.map((text, i) => `
        <button class="ov-btn choice-opt" data-act="btChoicePick" data-i="${i}">
          [[icon:question]] ${esc(text)}
        </button>`).join('');
      UI.showOverlay(`${opts && opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${turn} 回合 · [[icon:question]] 抉择`, `
        <p class="ov-stats">【${esc(choosing.cardName)}】——从 <b>${choosing.options.length}</b> 个选项中选择 <b>1</b> 项，只有选中的效果会结算</p>
        <div class="ov-btns choice-list">${choiceHTML}</div>
        <p class="ov-note">抉择必须做出，无法跳过。</p>`, true);
      UI.act('btChoicePick', (d) => pickChoice(d.i));
      UI.refresh(SDT.game);
      return;
    }
    if (handSelecting) {
      handSuspended = true;
      // 2026-09-06 #24/#25：从手牌选择卡牌施放/消耗的通用弹层
      const pool = hand.map(findCard).filter(o => o && matchHandSelectKey(o.card, handSelecting.type));
      const optsHTML = pool.map(o => `
        <div class="bt-card" data-act="btPickHand" data-uid="${o.uid}" title="点击选择">
          ${SDT.Cards.cardHTML(o.card, 'sm')}
        </div>`).join('');
      UI.showOverlay(`${opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${turn} 回合 · [[icon:cards]] 选择手牌`, `
        <p class="ov-stats">从手牌中选择 <b>${handSelecting.n}</b> 张${handSelecting.type ? `<b>${handSelecting.type}</b>` : '卡牌'}${handSelecting.act === 'play' ? '打出（不扣费）' : '消耗'}</p>
        <div class="bt-hand">${optsHTML || '<p class="ov-empty">手牌中没有符合条件的卡牌</p>'}</div>
        <p class="ov-note"><button class="ov-btn ghost" data-act="btPickHandSkip">跳过该效果</button></p>`, true);
      UI.act('btPickHand', (d) => pickHandSelect(d.uid));
      UI.act('btPickHandSkip', () => skipHandSelect());
      UI.refresh(SDT.game);
      return;
    }
    if (discovering) {
      handSuspended = true;
      const optsHTML = discovering.options.map((c, i) => `
        <div class="bt-card" data-act="btDiscover" data-i="${i}" title="点击置入手牌">
          ${SDT.Cards.cardHTML(c, 'sm')}
        </div>`).join('');
      UI.showOverlay(`${opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${turn} 回合 · [[icon:question]] 发现`, `
        <p class="ov-stats">从随机 <b>${discovering.options.length}</b> 张卡牌中选择 <b>1</b> 张置入手牌</p>
        <div class="bt-hand">${optsHTML}</div>
        <p class="ov-note">发现的卡是战斗内临时卡，战后消散、不进背包。</p>`, 'discover');
      UI.act('btDiscover', (d) => {
        const el = document.querySelector(`.bt-card[data-act="btDiscover"][data-i="${d.i}"]`);
        if (el) { const r = el.getBoundingClientRect(); discoverSrcRect = { left: r.left, top: r.top, width: r.width, height: r.height }; }
        pickDiscover(d.i);
      });
      UI.refresh(SDT.game);
      return;
    }
    const cards = hand.map(findCard).filter(Boolean);
    const infusingNow = !!infusing;
    // —— 法伤加成同步（2026-09-09 需求）：有法伤加成时，造成法术伤害的招式卡面
    // 数值实时显示为「卡面值 + 法伤加成」，数字略微放大（口径同 combat.dealDamage）
    const spellBonus = (player.spellPower || 0) + ((pstat.status && pstat.status.spellUp) || 0);
    // —— 同名卡堆叠（v0.32 杀戮尖塔式手牌）：同名同描述的卡只占一个位置，显示 ×N ——
    // 注能中：注能主卡单独一块展示，其同名燃料照常成组（点击组 = 消耗组内一张）
    const groups = groupHandCards(cards, infusingNow ? infusing : null);
    const N = groups.length;
    // 分栏切页：只渲染当前栏的 12 叠，扇形布局按本栏实际张数计算
    const handPages = Math.max(1, Math.ceil(N / HAND_PAGE_SIZE));
    if (handPage >= handPages) handPage = handPages - 1;
    if (handPage < 0) handPage = 0;
    const pageGroups = groups.slice(handPage * HAND_PAGE_SIZE, handPage * HAND_PAGE_SIZE + HAND_PAGE_SIZE);
    // 手牌 DOM 由常驻层差分维护（见 mountHandLayer / updateHand）：这里只算分组与目标扇形位，
    // 不再拼整段手牌 HTML（批次A 架构对齐：手牌区不随整屏重渲染重建）
    const pileView = renderCombatPiles({
      mode,
      drawCount: drawPile,
      discardCount: discard,
      graveCount: grave,
      pileTip,
      cardBackHTML: SDT.Cards.cardBackHTML(),
      escAttr,
    });
    const drawPileHTML = pileView.draw;
    const pilesHTML = pileView.rest;
    const tip = mode === 'boss'
      ? `开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 弃牌堆抽空后自动洗回 · 墓地（被消耗的牌）不洗回`
      : '普通战斗无需抽牌 ·「抽 N 张牌」效果改为获得 N 张初始攻击 · 指向卡须拖到目标身上（[[icon:swords]]敌人 · [[icon:heart]]自己）；无对敌效果的招式拖到敌我中间空地即可';
    const infuseBar = infusingNow ? `
      <div class="bt-infuse">
        [[icon:flask]] <b>注能(${infusing.need})</b>：选择 <b>${infusing.need}</b> 张手牌消耗，才能打出【${esc(infusing.card.name)}】
        （已选 <b>${infusing.picked.length}/${infusing.need}</b> · 同名堆叠每点一次消耗一张 · 被消耗的牌战后进消耗口袋，可在火堆复原）
        <button class="mini-btn ok" data-act="btInfuseGo" ${infusing.picked.length !== infusing.need ? 'disabled' : ''}>[[icon:swords]] 发动</button>
        <button class="mini-btn" data-act="btInfuseCancel">[[icon:cross]] 取消</button>
      </div>` : '';
    // 药水栏点选提示条（点敌人使用 / 取消）
    const itemBar = pendingItem ? `
      <div class="bt-infuse bt-pick">
        [[icon:flask]] 已选【<b>${esc(pendingItem.card.name)}</b>】——<b>点击一名敌人</b>使用（或直接拖到敌人身上）
        <button class="mini-btn" data-act="btPickCancel">[[icon:cross]] 取消</button>
      </div>` : '';
    // 背包砸击点选提示条（需求 #9：2 费 · 4 点固定伤害 · 不消耗卡牌）
    const slamBar = slamPending ? `
      <div class="bt-infuse bt-pick">
        [[icon:bag]] <b>背包砸击</b>——<b>点击一名敌人</b>砸下（2 费 · 4 点固定伤害）
        <button class="mini-btn" data-act="btSlamCancel">[[icon:cross]] 取消</button>
      </div>` : '';
    // —— 道具栏（2026-09-12 老板定向）：战斗界面上方常驻，点击使用 / 拖到敌人身上 ——
    // 2026-09-09 玩法定版：BOSS 战没有道具栏（背包里的道具无法使用）
    const potions = potionBar || [];
    const showItemBar = mode !== 'boss';
    const potionsHTML = showItemBar ? `
      <div class="bt-potions">
        <span class="bt-potions-label">[[icon:flask]] 道具</span>
        ${potions.length ? potions.map(p => p.usable === false
          ? `<div class="bt-potion off" title="${escAttr(`${p.name} ×${p.count}：${p.desc}（不可使用——${p.why}）`)}">
              ${SDT.Icons.img('flask')}<b>${esc(p.name)}</b>${p.count > 1 ? `<span class="bt-potion-n">×${p.count}</span>` : ''}
            </div>`
          : `<div class="bt-potion${p.aim === 'enemy' ? ' need-target' : ''}" data-act="btPotion" data-uid="${p.uid}"
              ${p.aim === 'enemy' ? 'data-potion-aim="1"' : ''}
              title="${escAttr(`${p.name} ×${p.count}：${p.desc}${p.aim === 'enemy' ? '（点击后选择敌人，或直接拖到敌人身上）' : '（点击直接使用）'}`)}">
              ${SDT.Icons.img('flask')}<b>${esc(p.name)}</b>${p.count > 1 ? `<span class="bt-potion-n">×${p.count}</span>` : ''}
            </div>`).join('')
          : '<span class="bt-potions-empty">背包里没有道具</span>'}
      </div>` : '';
    const battleAssetKey = opts.isBoss
      ? ({ boss_general: 'battle-boss-general', boss_orc: 'battle-boss-orc', boss_elem: 'battle-boss-element' }[foes[0] && foes[0].id] || 'battle-boss-general')
      : 'battle-normal';
    UI.showOverlay(`${opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${turn} 回合`, `
      <div class="battle-stage sts phase-${escAttr(phase)}" data-phase="${escAttr(phase)}" data-asset-key="${battleAssetKey}">
      <div class="battle-stage-shade"></div>
      ${potionsHTML}
      <div class="sts-topbar">
        <div class="sts-hud-l">
          ${drawPileHTML}
        </div>
        <div class="sts-hud-r">
          ${pilesHTML}
          <button class="ov-btn ghost${slamPending ? ' ok' : ''}" data-act="btSlam" ${busy || infusingNow || energy < 2 ? 'disabled' : ''}
            title="背包砸击：不消耗卡牌，2 费造成 4 点固定伤害（点击后再点一名敌人）">[[icon:bag]] 砸击 2</button>
          ${mode === 'boss' ? '' : `<button class="ov-btn ghost" data-act="btBag" ${busy || infusingNow ? 'disabled' : ''}>[[icon:bag]] 背包</button>
          <button class="ov-btn ghost" data-act="btFlee" ${busy || infusingNow ? 'disabled' : ''}
            title="撤离将视为本局失败（安全格中的卡牌会抢运回基地，其余丢失）">[[icon:runner]] 撤离（判负）</button>`}
          <button class="ov-btn ${busy || infusingNow ? '' : 'ok'}" data-act="btEnd" ${busy || infusingNow ? 'disabled' : ''}>[[icon:skip]] 结束回合</button>
        </div>
      </div>
      <div class="sts-arena">
        <div data-unit-mount="self"></div>
        <div class="sts-allies" data-unit-mount="allies"></div>
        <div class="sts-foes" data-unit-mount="foes"></div>
      </div>
      ${infuseBar}
      ${itemBar}
      ${slamBar}
      <div class="sts-hud">
        <div class="sts-energy-wrap">
          <div class="sts-energy" title="能量：每回合固定 ${maxEnergy} 费">[[icon:bolt]] <b>${energy}</b><span>/${maxEnergy}</span></div>
        </div>
        ${handPages > 1 ? `<button class="bt-hand-page" data-act="btHandPage"
          title="手牌分栏：每栏最多 ${HAND_PAGE_SIZE} 叠，放不下的进第二栏——点击切换第一栏/第二栏">[[icon:cards]] 第 ${handPage + 1}/${handPages} 栏</button>` : ''}
        <div class="bt-hand sts-hand"></div>
      </div>`, 'battle');
    // 手牌分栏切换（2026-09-10 留言 #27）
    UI.act('btHandPage', () => { handPage = (handPage + 1) % handPages; render(); });
    // sts-note 底部说明行已删（留言 2026-09-06：把下面的文字都去掉）
    UI.act('btPlay', (d) => {
      if (Date.now() - aimPlayedAt < 300) return;   // 指向松手刚打出，忽略残留 click
      if (infusingNow) return toggleInfusePick(d.uid);
      const el = document.querySelector(`.sts-hand .bt-card[data-uid="${CSS.escape(d.uid)}"]`);
      // 指向性卡只认拖拽指向：轻点不锁定（2026-09-09 老板），松手没目标自动回手牌；
      // side 'any'（无对敌效果）轻点即打出（2026-09-09 老板 #7）
      if (el && el.dataset.aim && el.dataset.side !== 'any') return;
      play(d.uid);
    });
    UI.act('btEnd', endTurn);
    UI.act('btFlee', surrender);   // 玩法定版：主动撤离=本局失败（烟雾弹走 fleeBattle 豁免）
    UI.act('btGrave', openGrave);
    UI.act('btBag', openBagCmd);
    UI.act('btSlam', bagSlam);          // 需求 #9：背包砸击
    UI.act('btSlamCancel', () => bagSlam());   // 再点一次 = 取消
    UI.act('btInfuseStart', (d) => beginInfuse(d.uid));   // 需求 #15：卡面注能角标
    UI.act('btInfuseGo', confirmInfuse);
    UI.act('btInfuseCancel', cancelInfuse);
    UI.act('btPickCancel', cancelPendingTarget);
    UI.act('btEquipSkill', (d) => useEquipSkill(d.uid));   // 已穿戴装备的限定技能（老板 #9）
    // —— 药水栏（2026-09-12 老板定向）：点击使用；敌方指向药水按住可拖到敌人身上 ——
    UI.act('btPotion', (d) => {
      if (Date.now() - aimPlayedAt < 300) return;   // 拖拽刚松手，忽略残留 click
      usePotion(d.uid);
    });
    const body = UI.el.ovBody;
    body.querySelectorAll('.bt-potion[data-potion-aim="1"]').forEach(el => {
      el.addEventListener('pointerdown', (e) => { if (e.button === 0) startAim(e, el, 'potion'); });
    });
    // —— 指向施法（炉石/杀戮尖塔式）：按住指向卡轻微拎起，弯曲箭头跟随指针 ——
    //    指向敌人 = 红色箭头，指向自己（立绘）= 绿色箭头；松手在目标身上即打出，
    //    松手没目标自动取消回手牌（轻点锁定流程已退役）。
    // 敌人点选（砸击/药水点选）已改在单位常驻层创建槽位时绑一次（见 mountUnitLayer），
    // 不再随渲染重复挂——点击时读 getSnapshot() 实时态，避免闭包过期
    // 指向拖拽的 pointerdown 已在常驻槽位创建时绑定（见 updateHand），不再随渲染重复挂
    // 人物去纸色背景，像模型一样站在场景里（art.js 内按图缓存，二次渲染零成本）
    if (SDT.Art.cutoutFigures) SDT.Art.cutoutFigures(body);
    // 手牌常驻层挂载 + 差分更新（批次A）：出牌动画事件只取一次，常驻层与克隆飞行共用
    const animEvents = takeCardAnims();
    // 单位区常驻层挂载 + 差分更新（批次B）：玩家/随从/敌人节点跨渲染复用（须在手牌层之前，
    // 复用其 handSuspended 判定「战斗中弹层挂起 vs 战斗已收尾」）
    const unitMounts = mountUnitLayer(body, snapshot.battleToken);
    if (unitMounts) updateUnits(unitMounts, snapshot, { isBoss: opts.isBoss, pendingItem, slamPending });
    mountHandLayer(body, tip, snapshot.battleToken);
    const handAnim = updateHand(snapshot, prevView, pageGroups, animEvents, { spellBonus, mode });
    // 牌局动画：离场克隆飞行 / 手牌区随回合显隐 / 能量与牌堆脉冲
    const anim = animateBattleTransition(prevView, body, animEvents, handAnim.flightMs);
    // BOSS 登场演出：竖线阴影压过场景 2.4s（每场一次）+ 开始动画（暗幕+立绘+名号亮相，约 1.5s）
    if (opts.isBoss && !dreadShown) {
      markDreadShown();
      const st = body.querySelector('.battle-stage');
      if (st) { st.classList.add('fx-dread'); setTimeout(() => st.classList.remove('fx-dread'), 2500); }
      const bossFoe = foes[0];
      const bossName = (bossFoe && bossFoe.name) || '???';
      const art = bossFoe && bossFoe.id && SDT.Art.has(bossFoe.id)
        ? SDT.Art.monsterArt(bossFoe.id)
        : SDT.Icons.img('demon');
      const intro = document.createElement('div');
      intro.className = 'boss-intro';
      intro.innerHTML = `
        <div class="boss-intro-inner">
          <div class="boss-intro-tag">BOSS战</div>
          <div class="boss-intro-art">${art}</div>
          <div class="boss-intro-title">${esc(bossName)}</div>
        </div>`;
      const ovEl = UI.el.overlay;
      if (ovEl) {
        ovEl.appendChild(intro);
        setTimeout(() => intro.remove(), 1800);   // 动画 1.6s + 缓冲后移除
      }
    }
    spawnFloats(body, anim.flightMs ? Math.min(340, anim.flightMs * 0.8) : 0);
    UI.refresh(SDT.game);
  }

  // ---------- 手牌常驻层（架构批次A：手牌区不随整屏重渲染重建） ----------
  // ovBody 每次渲染整块重建，但 .sts-hand 由本模块持有、跨渲染复用（showOverlay 之后
  // replaceWith 挂回新舞台）。每叠同名卡一个常驻槽位节点：
  //   - 扇形位 = CSS 变量目标值（--fx/--fy/--frot/--fs），位置变化用可取消 WAAPI 补间，
  //     对齐 STS2 NHandCardHolder「SetTargetPosition + 可取消动画 + 误差吸附」结构；
  //   - hover / 指向拎起 / 双击放大只碰类名，不触发重建；
  //   - 卡面内容按序列化签名 diff，内容没变不重写 innerHTML（图片不重载、悬停态不闪）。
  let handLayer = null;
  const handSlots = new Map();   // key -> { slot, card, sig, rect, isNew }
  let handSuspended = false;     // 墓地/背包/发现等战斗中弹层接管期间 = true（手牌被摘下但战斗未结束）
  let battleToken = null;        // 战斗实例令牌（snapshot.battleToken）：换场重置常驻层的唯一依据

  function handSlotKey(g) {
    return (g.self ? 'self|' : '') + g.card.name + '|' + (g.card.desc || '');
  }
  function setSlotVars(slot, L) {
    slot.style.setProperty('--fx', L.x + 'px');
    slot.style.setProperty('--fy', L.y + 'px');
    slot.style.setProperty('--frot', L.rot + 'deg');
    slot.style.setProperty('--fs', L.scale);
  }
  // 单叠手牌的即时视图状态：side/类名/提示语/卡面内容一次算全（原 render 内联计算外提）
  function handGroupState(g, ctx) {
    const { infusingNow, infusing, pendingTarget, energy, busy, spellBonus } = ctx;
    const uid = g.uids[0];
    const isSelf = infusingNow && g.self;
    const pickedN = infusingNow ? g.uids.filter(u => infusing.picked.includes(u)).length : 0;
    const targeted = !infusingNow && pendingTarget && pendingTarget.uid === uid;
    const effCost = effCostOf(g.card, uid);
    const blocked = infusingNow ? null : unplayableReason(g.card);   // 无法使用的卡：虚化禁用
    const rawSide = (!infusingNow && !blocked) ? targetSide(g.card) : null;
    // 2026-09-09 老板 #7：招式若无对敌方施加的效果，拖到敌我中间空地即可打出（side 'any'）
    const side = rawSide || (blocked || infusingNow ? null : 'any');
    let cls = '';
    if (infusingNow) cls = isSelf ? ' infuse-self' : (pickedN ? ' sel' : '');
    else if (blocked) cls = ' off';
    else if (targeted) cls = ' targeting';
    else if ((effCost > energy || busy)) cls = ' off';
    const costTip = effCost !== g.card.cost
      ? (effCost === 0 ? `（[[icon:bolt]] 当前按 0 费打出）` : `（[[icon:sparkles]] 费用变化：按 ${effCost} 费打出）`)
      : '';
    const tip = infusingNow
      ? (isSelf ? '正在注能的卡牌' : `点击选择消耗（注能）${g.uids.length > 1 ? `· 本叠还有 ${g.uids.length} 张` : ''}`)
      : blocked
        ? `[[icon:cross]] 无法打出：${blocked}`
        : side === 'enemy'
        ? `费用 ${effCost}${costTip} · 拖到敌人身上打出`
        : side === 'self'
          ? `费用 ${effCost}${costTip} · 拖到左侧「你」的立绘上（治疗 / 净化 / 护盾）`
          : side === 'any'
            ? `费用 ${effCost}${costTip} · 拖到敌我中间的空地即可打出（没有对敌效果，无需指定目标）`
            : `费用 ${effCost}${costTip} · 点击出牌` +
              (infuseOf(g.card) > 0 ? ` · 点卡面「注能」角标可消耗 ${infuseOf(g.card)} 张手牌强化效果（不点则直接打出弱效果）` : '');
    const badge = side === 'enemy' ? '<span class="bt-tt">[[icon:swords]]</span>'
      : side === 'self' ? '<span class="bt-tt">[[icon:heart]]</span>'
        : side === 'any' ? '<span class="bt-tt">[[icon:sparkles]]</span>' : '';
    // 需求 #16：费用变动显示在卡牌左上角费用处——降低 = 绿字，提高 = 红字
    // （天狼长弓等「变为0费」的临时卡带 _baseCost：按原费用对比显示绿色 0）
    const baseCost = (g.card._baseCost != null) ? g.card._baseCost : g.card.cost;
    const costDiff = effCost !== baseCost;
    const costBadge = costDiff ? `<span class="bt-cost1 cost-mod ${effCost < baseCost ? 'mod-down' : 'mod-up'}" title="费用变化：按 ${effCost} 费打出（原 ${baseCost} 费）">[[icon:bolt]]${effCost}</span>` : '';
    // 需求 #15：注能卡可直接打出，也可点「注能」角标进入注能流程（强化效果）
    const infN = infuseOf(g.card);
    const infChip = (!infusingNow && !blocked && infN > 0)
      ? `<button class="bt-infchip" data-act="btInfuseStart" data-uid="${uid}"
          title="注能(${infN})：选择 ${infN} 张手牌消耗，强化本牌效果（直接打出则用弱效果）">[[icon:crystal]] 注能${infN}</button>`
      : '';
    const cnt = g.uids.length > 1 ? `<span class="bt-count" title="同名卡 ${g.uids.length} 张堆叠为一叠">×${g.uids.length}</span>` : '';
    // 诅咒之刃（2026-09-10 需求）：卡面实时显示手牌招式（武术+法术）提供的全部诅咒
    const curseChip = (g.card.id === 'cc-cursed-blade' && typeof handCurseSpecs === 'function')
      ? (() => {
          const specs = handCurseSpecs();
          if (!specs.length) {
            return `<div class="bt-cursechips empty" title="手牌中的招式当前没有可附加的诅咒"><span class="bt-cursechip-i none">无诅咒</span></div>`;
          }
          const items = specs.map(s => {
            const meta = Combat.CURSE_META[s.key] || { name: s.key, icon: '', stack: false, desc: '' };
            return `<span class="bt-cursechip-i" title="${escAttr(meta.desc)}">${meta.icon}${meta.name}${meta.stack ? '×' + s.n : ''}</span>`;
          }).join('');
          return `<div class="bt-cursechips" title="手牌招式提供的诅咒（实时）">${items}</div>`;
        })()
      : '';
    const inner = SDT.Cards.cardHTML(g.card, 'sm', {
        ...(costDiff ? { costOverride: { v: effCost, base: baseCost } } : {}),
        ...(spellBonus > 0 && g.card.dmgType === 'spell' && +(g.card.dmg || 0) > 0
          ? { dmgOverride: { bonus: spellBonus } } : {}),
      })
      + cnt + badge + costBadge + infChip + curseChip;
    return { g, uid, side, cls, tip, inner };
  }
  // 挂载：把手牌常驻层接回刚重建的舞台（占位节点 → 常驻节点）。
  // 战斗实例令牌变了 = 上一场战斗已收尾/新战斗开打：清掉旧槽位再开新局。
  // （不能用 isConnected 判定——showOverlay 整块重建 ovBody，常驻层每次挂载前都脱离文档）
  function mountHandLayer(body, tip, token) {
    const mount = body.querySelector('.sts-hud .sts-hand');
    if (!mount) return null;
    if (!handLayer) handLayer = document.createElement('div');
    handLayer.className = 'bt-hand sts-hand';
    if (token !== battleToken) {
      handSlots.forEach(rec => rec.slot.remove());
      handSlots.clear();
    }
    battleToken = token;
    handSuspended = false;
    handLayer.title = tip;   // 等价旧模板 title="${escAttr(tip)}"（DOM 属性自动转义）
    mount.replaceWith(handLayer);
    return handLayer;
  }
  // 差分更新：新建/保留/移除槽位 + 目标扇形位补间 + 新牌飞入。返回动画时长供飘字延迟取用。
  function updateHand(snapshot, prev, pageGroups, events, extra) {
    if (!handLayer) return { flightMs: 0 };
    const evs = events || [];
    const drawn = new Set(), played = new Set();
    evs.forEach(ev => { if (ev.kind === 'draw') drawn.add(ev.uid); else if (ev.kind !== 'shuffle') played.add(ev.uid); });
    drawn.forEach(u => played.delete(u));   // 打出又回手（不朽斩）：同帧两事件抵消不演
    const ctx = {
      infusingNow: !!snapshot.infusing, infusing: snapshot.infusing,
      pendingTarget: snapshot.pendingTarget, energy: snapshot.energy, busy: snapshot.busy,
      spellBonus: (extra && extra.spellBonus) || 0,
    };
    // 旧槽位现矩形一次量完：目标值更新引发的位移以此为准做补间
    handSlots.forEach(rec => { rec.rect = rec.slot.isConnected ? rec.slot.getBoundingClientRect() : null; });
    // —— 第一遍：算状态 / 更新目标值与内容 / 建缺失槽位 ——
    const ordered = [];
    pageGroups.forEach((g, i) => {
      const key = handSlotKey(g);
      const st = handGroupState(g, ctx);
      const L = fanLayout(i, pageGroups.length);
      let rec = handSlots.get(key);
      if (!(rec && rec.slot.isConnected)) {
        rec = { slot: document.createElement('div'), card: document.createElement('div'), sig: '', rect: null, isNew: true };
        rec.slot.className = 'bt-slot';
        rec.card.addEventListener('pointerdown', (e) => {
          // 放大态只允许「再点一下还原」，不做拖拽指向（2026-09-10 留言 #20）；
          // 注能角标是按钮，点击走 ovBody 委托，不进指向（需求 #15）
          if (rec.card.classList.contains('zoomed')) return;
          if (e.target.closest && e.target.closest('.bt-infchip')) return;
          if (e.button === 0 && rec.card.dataset.aim === '1') startAim(e, rec.card);
        });
        rec.slot.appendChild(rec.card);
        handSlots.set(key, rec);
      }
      setSlotVars(rec.slot, L);
      const zoomed = rec.card.classList.contains('zoomed');   // 双击放大态跨渲染保留
      rec.card.className = 'bt-card' + st.cls
        + (st.side === 'enemy' || st.side === 'self' ? ' need-target' : '')
        + (st.side === 'any' ? ' free-drop' : '');
      if (zoomed) rec.card.classList.add('zoomed');
      rec.card.dataset.uid = st.uid;
      rec.card.dataset.act = 'btPlay';
      rec.card.dataset.aim = st.side ? '1' : '';
      rec.card.dataset.side = st.side || '';
      rec.card.setAttribute('title', st.tip);
      if (rec.sig !== st.inner) { rec.card.innerHTML = st.inner; rec.sig = st.inner; }
      ordered.push(rec);
    });
    // —— 顺序校正（DOM 序 = 扇形叠放序）：失序才搬节点 ——
    const current = [...handLayer.querySelectorAll('.bt-slot')];
    if (current.length !== ordered.length || current.some((el, i) => el !== ordered[i].slot)) {
      ordered.forEach(rec => handLayer.appendChild(rec.slot));
    }
    // —— 空手牌提示（原模板 N=0 分支的等价物） ——
    const emptyHint = handLayer.querySelector('.ov-empty');
    if (!ordered.length) {
      const msg = extra.mode === 'boss'
        ? ((snapshot.drawPile.length + snapshot.discard.length) ? '手牌打空了……下回合开始会再抽 1 张' : '牌库与弃牌堆都空了——只能结束回合硬抗，或撤退')
        : '没有能出的卡了……（打出过的卡本场不可再用）';
      const hint = emptyHint || handLayer.appendChild(Object.assign(document.createElement('p'), { className: 'ov-empty' }));
      if (hint.dataset.k !== msg) { hint.dataset.k = msg; hint.textContent = msg; }
    } else if (emptyHint) emptyHint.remove();
    // —— 第二遍：量新矩形，幸存者归位补间 + 新牌错峰飞入 ——
    const ov = UI.el.overlay;
    const ovR = ov.getBoundingClientRect();
    let flightMs = 0;
    let drawIdx = 0;
    ordered.forEach(rec => {
      const r = rec.slot.getBoundingClientRect();
      if (rec.isNew) {
        rec.isNew = false;
        if (drawn.has(rec.card.dataset.uid)) {
          const src = (prev && prev.drawPile) || discoverSrcRect
            || { left: ovR.width - 150, top: ovR.height - 110, width: 56, height: 80 };
          discoverSrcRect = null;
          const dx = src.left + src.width / 2 - (r.left + r.width / 2);
          const dy = src.top + src.height / 2 - (r.top + r.height / 2);
          animateSafe(rec.slot, [
            { transform: `translate(${dx}px,${dy}px) rotate(9deg) scale(.72)`, opacity: 0 },
            { transform: `translate(${dx * 0.18}px,${dy * 0.18}px) rotate(3deg) scale(1.04)`, opacity: 1, offset: 0.72 },
            { transform: 'translate(0px,0px) rotate(0deg) scale(1)', opacity: 1 },
          ], { duration: 900, delay: drawIdx++ * 300, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards', composite: 'add' });
          flightMs = Math.max(flightMs, 900 + drawIdx * 300);
        }
      } else if (rec.rect) {
        const dx = rec.rect.left + rec.rect.width / 2 - (r.left + r.width / 2);
        const dy = rec.rect.top + rec.rect.height / 2 - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) >= 2) {
          animateSafe(rec.slot, [
            { transform: `translate(${dx}px,${dy}px)` },
            { transform: 'translate(0px,0px)' },
          ], { duration: 210, easing: 'cubic-bezier(.22,.9,.3,1)', composite: 'add' });
        }
      }
      rec.rect = r;
    });
    // —— 移除：本轮不在手牌里的槽位离场（打出/弃置交给克隆飞行，其余下沉淡出） ——
    const keptKeys = new Set(pageGroups.map(handSlotKey));
    handSlots.forEach((rec, key) => {
      if (keptKeys.has(key)) return;
      handSlots.delete(key);
      if (played.has(rec.card.dataset.uid) || !rec.slot.isConnected) { rec.slot.remove(); return; }
      animateSafe(rec.slot, [
        { transform: 'translate(0px,0px)', opacity: 1 },
        { transform: 'translateY(46px)', opacity: 0 },
      ], { duration: 200, easing: 'ease-in', fill: 'forwards' });
      setTimeout(() => rec.slot.remove(), 240);
    });
    return { flightMs };
  }

  // ---------- 单位区常驻层（架构批次B：玩家/随从/敌人节点不随整屏重渲染重建） ----------
  // 模式照抄手牌常驻层：ovBody 每次渲染整块重建，单位节点由本模块持有、showOverlay
  // 之后 replaceWith/appendChild 挂回新舞台。立绘、血条、意图、状态角标都是常驻节点
  // 内的局部差分更新（按序列化签名 diff，内容没变不重写 innerHTML，图片不重载），
  // 受击抖动/死亡演出（CSS fx-die）/血条宽度过渡因此只播一次、不被重渲染腰斩。
  let selfUnit = null, selfParts = null, selfSig = null;
  const allySlots = new Map();   // key -> { slot, parts, sig }
  const foeSlots = new Map();    // key -> { slot, parts, sig }

  function mountUnitLayer(body, token) {
    const selfMount = body.querySelector('[data-unit-mount="self"]');
    const alliesMount = body.querySelector('[data-unit-mount="allies"]');
    const foesMount = body.querySelector('[data-unit-mount="foes"]');
    if (!selfMount || !alliesMount || !foesMount) return null;
    // 战斗实例令牌变了 = 上一场战斗已收尾：清掉旧槽位再开新局（口径同手牌层；
    // 不能用 isConnected 判定——ovBody 每次渲染整块重建，挂载前常驻节点必然脱离文档）
    if (selfUnit && token !== battleToken) {
      allySlots.forEach(rec => rec.slot.remove());
      foeSlots.forEach(rec => rec.slot.remove());
      allySlots.clear(); foeSlots.clear();
      selfUnit = null; selfParts = null; selfSig = null;
    }
    battleToken = token;
    if (!selfUnit) {
      selfUnit = document.createElement('div');
      selfUnit.className = 'sts-unit sts-me';
      selfUnit.id = 'btSelf';
      selfUnit.title = '你自己——治疗 / 净化 / 护盾 / 格挡类卡牌拖到这里打出';
      selfParts = makeUnitSkeleton(selfUnit, { equips: true });
      selfSig = {};
    }
    selfMount.replaceWith(selfUnit);
    return { alliesMount, foesMount };
  }
  // 单位节点固定骨架：意图(敌) + 立绘 + 名牌(名号/血条/属性/状态角标/装备)，各段按签名差分
  function makeUnitSkeleton(slot, opts = {}) {
    const parts = {};
    if (opts.intent) {
      parts.intent = document.createElement('div');
      parts.intent.className = 'sts-intent';
      parts.intent.style.display = 'none';
      slot.appendChild(parts.intent);
    }
    parts.fig = document.createElement('div');
    parts.fig.className = 'sts-figure';
    slot.appendChild(parts.fig);
    const np = document.createElement('div');
    np.className = 'sts-nameplate';
    parts.head = document.createElement('div');
    parts.hp = document.createElement('div');
    parts.hp.className = 'bt-hpwrap sts-hp';
    parts.hpBar = document.createElement('i');
    parts.hpTxt = document.createElement('span');
    parts.hp.appendChild(parts.hpBar);
    parts.hp.appendChild(parts.hpTxt);
    parts.stats = document.createElement('div');
    parts.stats.className = 'sts-stats';
    parts.chips = document.createElement('div');
    parts.chips.className = 'sts-chips';
    np.appendChild(parts.head); np.appendChild(parts.hp); np.appendChild(parts.stats); np.appendChild(parts.chips);
    if (opts.equips) {
      parts.equips = document.createElement('div');
      parts.equips.className = 'sts-equips';
      parts.equips.style.display = 'none';
      np.appendChild(parts.equips);
    }
    slot.appendChild(np);
    return parts;
  }
  // 差分工具：html 变了才重写 innerHTML
  function setSection(el, sig, key, html) {
    if (sig[key] === html) return;
    sig[key] = html;
    el.innerHTML = html;
  }
  // 血条局部更新：宽度过渡只在常驻节点上生效（重建结构下每次都是瞬时跳变）
  function setUnitHP(parts, sig, hp, maxHp, instant) {
    const pct = Math.max(0, hp / maxHp * 100).toFixed(1) + '%';
    const txt = Math.max(0, hp) + '/' + maxHp;
    if (sig.hpPct !== pct) {
      sig.hpPct = pct;
      if (instant) {   // 新节点首次填充：禁用过渡，避免从空/满状态滑到位
        parts.hpBar.style.transition = 'none';
        parts.hpBar.style.width = pct;
        void parts.hpBar.offsetWidth;
        parts.hpBar.style.transition = '';
      } else parts.hpBar.style.width = pct;
    }
    if (sig.hpTxt !== txt) { sig.hpTxt = txt; parts.hpTxt.textContent = txt; }
  }
  function updateUnits(mounts, snapshot, ctx) {
    updateSelfUnit(snapshot);
    updateAllies(mounts.alliesMount, snapshot.allies || []);
    updateFoes(mounts.foesMount, snapshot.foes || [], ctx);
  }
  function updateSelfUnit(snapshot) {
    const { player, pdef, pstat, equipped } = snapshot;
    const sig = selfSig;
    setSection(selfParts.fig, sig, 'fig',
      player.myClass && SDT.Art.has(player.myClass) ? (SDT.Art.battleArt ? SDT.Art.battleArt(player.myClass) : SDT.Art.classArt(player.myClass)) : SDT.Icons.img('helmet'));
    setSection(selfParts.head, sig, 'head',
      `<b>${esc(characterName(player.characterId || player.myClass))}</b><span class="sts-you">你</span>`);
    setUnitHP(selfParts, sig, player.hp, player.maxHp, !sig.init);
    // 攻击力/法伤含加成显示（2026-09-09 留言 #2：人物图标下要能看到攻/法伤的变化）
    const atkBuff = pstat.status.atkUp || 0, spBuff = pstat.status.spellUp || 0;
    const atkShow = (player.atk || 0) + atkBuff;
    const atkTag = atkBuff ? `<span title="含攻击强化 +${atkBuff}">（含+${atkBuff}）</span>` : '';
    const spShow = (player.spellPower || 0) + spBuff;
    const spTag = spShow > 0
      ? ` · [[icon:crystal]] 法伤 ${spShow}${spBuff ? `<span title="含法术强化 +${spBuff}">（含+${spBuff}）</span>` : ''}` : '';
    setSection(selfParts.stats, sig, 'stats',
      `[[icon:swords]] ${atkShow}${atkTag}${spTag}${pdef.shield ? ' · [[icon:shield]] 盾 ' + pdef.shield : ''}${pdef.armor ? ' · [[icon:plate]] 甲 ' + pdef.armor : ''}${pdef.guard ? ' · 格挡中' : ''}`);
    setSection(selfParts.chips, sig, 'chips', curseChips(pstat.status));
    // 已穿戴装备（2026-09-09 老板 #9）：名称 + 说明 tooltip；带限定技能的可点击发动
    const equipsHTML = (equipped || []).map(e => e.skill
      ? `<button class="sts-equip has-skill${e.used ? ' used' : ''}" data-act="btEquipSkill" data-uid="${escAttr(e.uid)}"
          title="${escAttr(`【${e.name}】${e.desc}${e.used ? '（限定技能本场已用过）' : '——点击发动限定技能'}`)}">[[icon:tools]] ${esc(e.name)}${e.used ? '' : ' [[icon:bolt]]'}</button>`
      : `<span class="sts-equip" title="${escAttr(`【${e.name}】${e.desc}`)}">[[icon:tools]] ${esc(e.name)}</span>`).join('');
    setSection(selfParts.equips, sig, 'equips', equipsHTML);
    selfParts.equips.style.display = equipsHTML ? '' : 'none';
    sig.init = true;
  }
  // 随从位（Q4 老板定向：征召步兵等——替你承伤、每回合自动攻击）
  function updateAllies(mount, allies) {
    mount.style.display = allies.length ? '' : 'none';
    const ordered = [];
    const seen = {};
    allies.forEach((a, i) => {
      const base = a.name || ('ally' + i);
      seen[base] = (seen[base] || 0) + 1;
      const key = base + '#' + seen[base];
      let rec = allySlots.get(key);
      if (!rec) {   // 断连的旧槽位直接复用（末尾 appendChild 挂回），弹层返回后仍是同一节点
        const slot = document.createElement('div');
        slot.className = 'sts-unit sts-ally';
        slot.title = '你的随从：优先替你承受伤害，每回合自动攻击敌人';
        rec = { slot, parts: makeUnitSkeleton(slot), sig: {}, key };
        allySlots.set(key, rec);
      }
      rec.slot.classList.toggle('dead', !!a.dead);
      rec.slot.dataset.allyI = i;
      setSection(rec.parts.fig, rec.sig, 'fig', SDT.Icons.img('runner'));
      setSection(rec.parts.head, rec.sig, 'head', `<b>${esc(a.name)}</b>`);
      setUnitHP(rec.parts, rec.sig, a.hp, a.maxHp, !rec.sig.init);
      setSection(rec.parts.stats, rec.sig, 'stats', `[[icon:swords]] ${a.atk}`);
      setSection(rec.parts.chips, rec.sig, 'chips', '');
      rec.sig.init = true;
      ordered.push(rec);
    });
    // 移除消失的随从 + 按数组序重排（appendChild 已连接节点只是搬移，不重建）
    const kept = new Set(ordered.map(r => r.key));
    allySlots.forEach((rec, key) => {
      if (!kept.has(key)) { rec.slot.remove(); allySlots.delete(key); }
    });
    ordered.forEach(rec => mount.appendChild(rec.slot));
  }
  // 敌方单位（右下站立横排；意图气泡在头顶；词缀角标；免伤高亮）
  function updateFoes(mount, foes, ctx) {
    const ordered = [];
    const seen = {};
    foes.forEach((f, idx) => {
      const base = f.id || f.name || ('foe' + idx);
      seen[base] = (seen[base] || 0) + 1;
      const key = base + '#' + seen[base];
      let rec = foeSlots.get(key);
      if (!rec) {   // 断连的旧槽位直接复用（末尾 appendChild 挂回），弹层返回后仍是同一节点
        const slot = document.createElement('div');
        slot.className = 'sts-unit sts-foe bt-foe';
        rec = { slot, parts: makeUnitSkeleton(slot, { intent: true }), sig: {}, key };
        // 常驻节点只绑一次点击：砸击/药水点选（需求 #9 / 药水栏）——点击时读实时快照防闭包过期
        slot.addEventListener('click', () => {
          const snap = getSnapshot();
          if (snap.slamPending) {
            if (!slot.classList.contains('dead')) resolveSlam(slot.dataset.eidx);
            return;
          }
          if (snap.pendingItem && !slot.classList.contains('dead')) useItemCmd(snap.pendingItem.uid, slot.dataset.eidx);
        });
        foeSlots.set(key, rec);
      }
      const slot = rec.slot, parts = rec.parts, sig = rec.sig;
      const aff = f.affix && AFFIX_META[f.affix];
      const immune = aegisBlocked(f);
      slot.classList.toggle('is-boss', !!(ctx.isBoss || f.affix));
      slot.classList.toggle('dead', !!f.dead);
      slot.classList.toggle('aegis', !!immune);
      slot.classList.toggle('can-target', !!(ctx.pendingItem || ctx.slamPending) && !f.dead);
      slot.dataset.foeId = f.id || f.name;
      slot.dataset.eidx = idx;
      slot.title = aff ? aff.name + '：' + aff.desc : '';
      // 残留的指向预览气泡清掉（常驻节点上它不会随重建消失）
      const fp = slot.querySelector('.bt-fpreview');
      if (fp) fp.remove();
      // 冰冻敌人显示专用意图图标（2026-09-09 玩法定版）：冰冻中无法行动，
      // 用冰晶图标替换原攻击/蓄力预告，解冻后恢复正常意图显示
      const frozen = !f.dead && f.status && (f.status.freeze || 0) > 0;
      const intents = frozen
        ? [{ icon: '[[icon:crystal]]', label: '冰冻·无法行动', damage: null, kind: 'frozen' }]
        : intentViewModel(f.intent);
      const intentTip = frozen ? '冰冻中——本回合无法行动' : `下一回合预告：${intentSummary(f.intent)}`;
      if (!f.dead && intents.length) {
        setSection(parts.intent, sig, 'intent',
          intents.map(intent => `${intent.icon} ${esc(intent.label)}${intent.damage == null ? '' : ` · ${intent.damage}`}`).join(' '));
        if (sig.intentTip !== intentTip) { sig.intentTip = intentTip; parts.intent.title = intentTip; }
        parts.intent.style.display = '';
      } else parts.intent.style.display = 'none';
      setSection(parts.fig, sig, 'fig', f.id && SDT.Art.has(f.id) ? SDT.Art.monsterArt(f.id) : SDT.Icons.img('slime'));
      setSection(parts.head, sig, 'head',
        `<b>${esc(f.name)}</b>${f.dead ? ' <span class="bt-deadmark">[[icon:cross]]</span>' : ''}` +
        (aff ? `<span class="bt-affix" title="${escAttr(aff.desc)}">${aff.icon} ${aff.name}</span>` : ''));
      setUnitHP(parts, sig, f.hp, f.maxHp, !sig.init);
      setSection(parts.stats, sig, 'stats',
        `[[icon:swords]] ${f.atk}${f.affix === 'frenzy' ? ' ×2' : ''}${immune ? ' · [[icon:crystal]] 庇幕免伤中' : ''}`);
      setSection(parts.chips, sig, 'chips', curseChips(f.status));
      sig.init = true;
      ordered.push(rec);
    });
    // 移除消失的敌人 + 按数组序重排
    const kept = new Set(ordered.map(r => r.key));
    foeSlots.forEach((rec, key) => {
      if (!kept.has(key)) { rec.slot.remove(); foeSlots.delete(key); }
    });
    ordered.forEach(rec => mount.appendChild(rec.slot));
  }

  // ---------- 战斗特效（v0.32.2）：伤害/受击飘字 + 受击抖动 + 红闪 ----------
  // 飘字挂在 #overlay 层而不是 ovBody——ovBody 每次渲染整块重建，飘字动画会被腰斩
  // baseDelay：等出牌飞行落点后再结算（杀戮尖塔式：牌到手伤害才跳）
  function spawnFloats(body, baseDelay = 0) {
    const list = takeFloats();
    if (!list.length) return;
    const ov = UI.el.overlay;
    const ovR = ov.getBoundingClientRect();
    const perUnit = {};   // #19：同单位多段伤害错峰呈现
    list.forEach((f, listIdx) => {
      const fire = () => {
      const isSelf = f.unit === 'self';
      const figEl = isSelf
        ? body.querySelector('#btSelf .sts-figure')
        : body.querySelector(`.sts-foe[data-eidx="${f.unit}"] .sts-figure`);
      if (!figEl) return;
      // 受击反馈：单位抖动；自己掉血再叠一层全屏红闪
      const motionHandled = SDT.Motion && SDT.Motion.hit(figEl, isSelf);
      if (!motionHandled) {
        figEl.classList.add(isSelf ? 'fx-hit-self' : 'fx-hit');
        setTimeout(() => figEl.classList.remove(isSelf ? 'fx-hit-self' : 'fx-hit'), 480);
      }
      if (SDT.VisualFX) SDT.VisualFX.burstAtElement(figEl, {
        color: f.warm ? 0x61d69b : (isSelf ? 0xff6659 : 0xffb34d),
        count: f.warm ? 10 : 14,
      });
      if (isSelf) hurtFlash(ov);
      if (f.warm) {   // 治疗暖色滤镜（表情反馈·零美术）
        figEl.classList.add('fx-warm');
        setTimeout(() => figEl.classList.remove('fx-warm'), 950);
      }
      const stk = (f.cls || '').includes('stk');   // 表情贴纸：挂在头顶而非胸前
      const r = figEl.getBoundingClientRect();
      // 命中特效贴图：格挡/免伤=护盾碎裂，治疗不出，其余伤害=斩击（黑底图走 screen 混合）
      const impactCls = (f.cls || '').includes('block') ? 'fx-block'
        : (f.warm || stk) ? null : 'fx-slash';
      if (impactCls) {
        const imp = document.createElement('div');
        imp.className = 'sts-impact ' + impactCls;
        imp.style.left = (r.left - ovR.left + r.width / 2) + 'px';
        imp.style.top = (r.top - ovR.top + r.height * 0.4) + 'px';
        imp.style.setProperty('--imp-rot', Math.floor(Random.random('fx') * 360) + 'deg');
        ov.appendChild(imp);
        imp.addEventListener('animationend', () => imp.remove(), { once: true });
        setTimeout(() => imp.remove(), 900);
      }
      const span = document.createElement('span');
      span.className = 'sts-float ' + feedbackClass(f);
      span.textContent = f.text;
      span.style.left = (r.left - ovR.left + r.width / 2) + 'px';
      span.style.top = (r.top - ovR.top + r.height * (stk ? 0.02 : 0.32)) + 'px';
      ov.appendChild(span);
      span.addEventListener('animationend', () => span.remove(), { once: true });
      setTimeout(() => span.remove(), 1400);   // 兜底：animationend 偶尔不触发时清掉不可见残骸
      };
      const delay = baseDelay + feedbackDelay(f.unit, perUnit, FEEDBACK_DELTA_MS);   // 同单位每多一段 +320ms
      if (delay) setTimeout(fire, delay); else fire();
    });
  }
  // 全屏受击红闪（径向暗角，600ms 淡出）
  function hurtFlash(ov) {
    if (ov.querySelector('.sts-hurtflash')) return;   // 连续受击不叠层
    const div = document.createElement('div');
    div.className = 'sts-hurtflash';
    ov.appendChild(div);
    div.addEventListener('animationend', () => div.remove(), { once: true });
    setTimeout(() => div.remove(), 1000);   // 兜底清理
  }

  // ---------- 牌局动画（2026-09-09）：离场克隆飞行 / 新牌飞入 / 幸存者归位 / 手牌区显隐 ----------
  // 渲染是整块重建，跨渲染的位移全部走 WAAPI：离场牌在 overlay 常驻层放克隆体飞行，
  // 入场/归位用 composite:'add' 加法合成——不破坏槽位自身的扇形 transform。
  function captureBattleView() {
    const ov = UI.el.overlay;
    if (!ov || ov.hidden) return null;
    const handEl = ov.querySelector('.sts-hand');
    if (!handEl) return null;
    const ovR = ov.getBoundingClientRect();
    const stage = handEl.closest('.battle-stage');
    const cards = {};
    handEl.querySelectorAll('.bt-card[data-uid]').forEach(el => {
      const r = el.getBoundingClientRect();
      cards[el.dataset.uid] = {
        html: el.outerHTML,
        name: ((el.querySelector('.hsc-name') || {}).textContent || '').trim(),
        rect: { left: r.left - ovR.left, top: r.top - ovR.top, width: r.width, height: r.height },
      };
    });
    const rectOf = (sel) => {
      const el = ov.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left - ovR.left, top: r.top - ovR.top, width: r.width, height: r.height };
    };
    const energyEl = stage ? stage.querySelector('.sts-energy b') : null;
    return {
      cards,
      phase: stage ? stage.dataset.phase : null,
      energy: energyEl ? parseInt(energyEl.textContent, 10) : null,
      drawPile: rectOf('.sts-hud-l .bt-pile'),
    };
  }
  // 离场去处：指向敌人/自己 → 单位立绘中心；常规打出/倾倒 → 弃牌堆徽标；注能牺牲品 → 原地碎化上飘
  function exitSinkFor(ev, rect, body, ovR) {
    const centerOf = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - ovR.left + r.width / 2, y: r.top - ovR.top + r.height / 2 };
    };
    if (ev.kind === 'play') {
      if (ev.side === 'enemy' && ev.target != null) {
        const foe = body.querySelector(`.sts-foe[data-eidx="${ev.target}"] .sts-figure`);
        if (foe) return { ...centerOf(foe), scale: 0.42, dur: 400, fade: 0.08 };
      }
      if (ev.side === 'self') {
        const me = body.querySelector('#btSelf .sts-figure');
        if (me) return { ...centerOf(me), scale: 0.42, dur: 400, fade: 0.08 };
      }
      const disc = document.querySelector('.sts-hud-r .bt-pile');
      if (disc) return { ...centerOf(disc), scale: 0.3, dur: 380, fade: 0.25 };
    }
    if (ev.kind === 'dump') {
      const disc = document.querySelector('.sts-hud-r .bt-pile');
      if (disc) return { ...centerOf(disc), scale: 0.3, dur: 380, fade: 0.25 };
    }
    return { x: rect.left + rect.width / 2, y: rect.top - 80, scale: 0.5, dur: 460, fade: 0, burn: true };
  }
  // WAAPI 防冻保护：遮挡/后台 webview 里文档时间线可能被冻结（currentTime 恒 0），
  // 动画会永远停在第一帧（例如把手牌钉在敌方阶段的 0.08 透明度）——起跑失败就取消，
  // 让声明式 CSS 的两端状态兜底。健康环境下 currentTime 正常推进，永不触发。
  function animateSafe(el, keyframes, options) {
    if (!el.animate) return null;
    const anim = el.animate(keyframes, options);
    const delay = (options && options.delay) || 0;
    setTimeout(() => {
      if (anim.playState === 'running' && (anim.currentTime == null || anim.currentTime < delay + 30)) {
        try { anim.cancel(); } catch (e) { /* 已被移除的元素上取消会抛，忽略 */ }
      }
    }, delay + 300);
    return anim;
  }
  function animateBattleTransition(prev, body, events = [], extraFlightMs = 0) {
    let flightMs = extraFlightMs;
    const handEl = body.querySelector('.sts-hand');
    const stage = body.querySelector('.battle-stage');
    // —— 手牌区随回合显隐：玩家→敌人 下沉退场；敌人→玩家 升回 ——
    if (handEl && stage && prev && prev.phase != null && handEl.animate) {
      const ph = stage.dataset.phase;
      if (ph === 'enemy' && prev.phase !== 'enemy') {
        animateSafe(handEl,
          [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(72%)', opacity: 0.08 }],
          { duration: 300, easing: 'ease-in', fill: 'forwards' });
      } else if (ph && ph !== 'enemy' && prev.phase === 'enemy') {
        animateSafe(handEl,
          [{ transform: 'translateY(72%)', opacity: 0.08 }, { transform: 'translateY(0)', opacity: 1 }],
          { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)' });
      }
    }
    // —— 能量变化脉冲（花费/回复都闪一下）——
    if (stage && prev && prev.energy != null) {
      const energyEl = stage.querySelector('.sts-energy b');
      const now = energyEl ? parseInt(energyEl.textContent, 10) : NaN;
      const orb = stage.querySelector('.sts-energy');
      if (!isNaN(now) && now !== prev.energy && orb && orb.animate) {
        orb.animate(
          [{ filter: 'brightness(1)' }, { filter: 'brightness(1.9) saturate(1.3)' }, { filter: 'brightness(1)' }],
          { duration: 380, easing: 'ease-out' });
      }
    }
    if (!handEl || !events.length) return { flightMs };
    const ov = UI.el.overlay;
    const ovR = ov.getBoundingClientRect();
    const played = new Set(), drawn = new Set();
    const shuffles = [];   // 洗入牌动画事件（addDeckCard：「将 X 洗入牌库」）
    events.forEach(ev => {
      if (ev.kind === 'draw') drawn.add(ev.uid);
      else if (ev.kind === 'shuffle') shuffles.push(ev);
      else played.add(ev.uid);
    });
    drawn.forEach(u => played.delete(u));   // 打出又回手（不朽斩）：同帧两事件抵消不演
    // —— 牌库图标动画（2026-09-11 需求，约 1.5s）：抽牌脉冲 / 洗入旋光 ——
    const pileEl = body.querySelector('.sts-hud-l .bt-pile');
    if (pileEl) {
      if (drawn.size) { pileEl.classList.add('pile-pulse'); setTimeout(() => pileEl.classList.remove('pile-pulse'), 1600); }
      if (shuffles.length) {
        pileEl.classList.add('pile-shuffle');
        setTimeout(() => pileEl.classList.remove('pile-shuffle'), 1600 + shuffles.length * 250);
        // 洗入牌动画：卡背从手牌区中央飞向牌库图标，旋入消失
        const pileR = pileEl.getBoundingClientRect();
        shuffles.forEach((ev, i) => {
          const fly = document.createElement('div');
          fly.className = 'sts-cardfly pile-fly';
          const startX = ovR.width / 2 - 55, startY = ovR.height * 0.72;
          fly.style.cssText = `left:${startX}px;top:${startY}px;width:110px;height:150px`;
          ov.appendChild(fly);
          const dx = (pileR.left + pileR.width / 2) - (startX + 55);
          const dy = (pileR.top + pileR.height / 2) - (startY + 75);
          const anim = fly.animate([
            { transform: 'translate(0,0) rotate(-14deg) scale(1)', opacity: 0.25 },
            { transform: `translate(${dx * 0.55}px,${dy * 0.55 - 70}px) rotate(160deg) scale(0.82)`, opacity: 1, offset: 0.55 },
            { transform: `translate(${dx}px,${dy}px) rotate(346deg) scale(0.35)`, opacity: 0.05 },
          ], { duration: 1200, delay: i * 250, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
          anim.onfinish = () => fly.remove();
          setTimeout(() => fly.remove(), 1600 + i * 250);
          flightMs = Math.max(flightMs, 1200 + i * 250);
        });
      }
    }
    // —— 离场：克隆体沿上弓弧线飞向去处（原卡节点由手牌常驻层差分移除，飞行由克隆体接管） ——
    events.forEach(ev => {
      if (!played.has(ev.uid)) return;
      const old = prev && (prev.cards[ev.uid] || Object.values(prev.cards).find(c => c.name === ev.name));
      if (!old) return;
      const sink = exitSinkFor(ev, old.rect, body, ovR);
      const clone = document.createElement('div');
      clone.className = 'sts-cardfly';
      clone.style.cssText = `left:${old.rect.left}px;top:${old.rect.top}px;width:${old.rect.width}px;height:${old.rect.height}px`;
      clone.innerHTML = old.html;
      ov.appendChild(clone);
      const dx = sink.x - (old.rect.left + old.rect.width / 2);
      const dy = sink.y - (old.rect.top + old.rect.height / 2);
      const bow = -Math.min(130, Math.hypot(dx, dy) * 0.28);   // 弓背朝上
      const fly = clone.animate([
        { transform: 'translate(0px,0px) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px,${dy * 0.5 + bow}px) scale(${((1 + sink.scale) / 2).toFixed(2)})`, opacity: 0.96, offset: 0.55 },
        { transform: `translate(${dx}px,${dy}px) scale(${sink.scale})`, opacity: sink.fade },
      ], { duration: sink.dur, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
      fly.onfinish = () => clone.remove();
      setTimeout(() => clone.remove(), sink.dur + 300);   // 兜底清理
      flightMs = Math.max(flightMs, sink.dur);
    });
    // 新牌飞入 / 幸存者归位已改在手牌常驻层的差分更新里做（updateHand）——
    // 常驻节点不销毁，位移直接从旧目标值补间到新目标值，不再依赖重建前取样。
    return { flightMs };
  }

  // ---------- 指向施法：拎起 + 弯曲箭头 ----------
  const AIM_COLOR = { enemy: '#e0523c', self: '#4ecf8e', any: '#d9c07a' };
  let aim = null;            // {uid, card, side, el, ax, ay, sx, sy, moved, hover}
  let aimPlayedAt = 0;       // 指向松手刚打出成功的时间戳（抑制随后误触发的 click 锁定）

  function aimCanvasEnsure() {
    let canvas = document.getElementById('aimArrow');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'aimArrow';
      UI.el.overlay.appendChild(canvas);
    }
    return canvas;
  }
  function aimArrowRemove() {
    const s = document.getElementById('aimArrow');
    if (s) s.remove();
  }
  // 更新弯曲箭头：Canvas 绘制二次贝塞尔上弓与箭头，避免矢量 DOM 资源。
  // vr 可传入调用方缓存的 overlay rect（拖拽高频路径避免每次 pointermove 强制读布局）
  function aimArrowUpdate(x1, y1, x2, y2, color, vr) {
    const canvas = aimCanvasEnsure();
    vr = vr || UI.el.overlay.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(vr.width));
    const height = Math.max(1, Math.round(vr.height));
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    let px = -dy / len, py = dx / len;
    if (py > 0) { px = -px; py = -py; }               // 弓背朝上
    const bow = Math.min(90, len * 0.3);
    const cx = mx + px * bow, cy = my + py * bow;
    const tx = x2 - cx, ty = y2 - cy, tl = Math.hypot(tx, ty) || 1;
    const ux = tx / tl, uy = ty / tl, wx = -uy, wy = ux;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = .2;
    ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
    ctx.globalAlpha = .95;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2 - ux * 9, y2 - uy * 9); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#080b0e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * 17 + wx * 8, y2 - uy * 17 + wy * 8);
    ctx.lineTo(x2 - ux * 17 - wx * 8, y2 - uy * 17 - wy * 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x1, y1, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // 指针处的有效目标（enemy 卡找活着的敌人 / self 卡找自己的立绘）
  // side 显式传入：endAim 时全局 aim 已清空，不能再依赖它
  // snap 可传入指向开始时缓存的快照（见 startAim）——拖拽 pointermove 高频路径
  // 每次都重建整棵冻结快照是纯浪费；指向期间战斗状态不会变（重渲染会 cancelAim）
  function aimHoverAt(x, y, side, snap) {
    const elAt = document.elementFromPoint(x, y);
    if (!elAt || !side) return null;
    if (side === 'any') {
      // 无对敌效果的招式（2026-09-09 老板 #7）：敌我中间的空地即可落牌——
      // 落在战场内、且不在手牌区/顶部按钮/药水栏上就算有效
      if (!elAt.closest('.battle-stage')) return null;
      if (elAt.closest('.sts-hud') || elAt.closest('.sts-topbar') || elAt.closest('.bt-potions')) return null;
      return { kind: 'any', el: elAt.closest('.battle-stage') };
    }
    if (side === 'enemy') {
      const foeEl = elAt.closest('.bt-foe[data-eidx]');
      if (foeEl) {
        const idx = +foeEl.dataset.eidx;
        const foe = (snap || getSnapshot()).foes[idx];
        if (foe && !foe.dead) return { kind: 'enemy', idx, el: foeEl };
      }
      return null;
    }
    const selfEl = elAt.closest('#btSelf');
    return selfEl ? { kind: 'self', el: selfEl } : null;
  }
  function aimClearHover() {
    if (!aim || !aim.hover) return;
    aim.hover.el.classList.remove('drag-over', 'drop-here', 'drop-any');
    if (aim.hover.kind === 'enemy') clearFoePreview(aim.hover.el);
    aim.hover = null;
  }
  function aimCleanup(a) {
    if (a) {
      a.el.classList.remove('aim-lift');
      if (a.hover) {
        a.hover.el.classList.remove('drag-over', 'drop-here', 'drop-any');
        if (a.hover.kind === 'enemy') clearFoePreview(a.hover.el);
      }
    }
    aimArrowRemove();
  }
  function startAim(e, el, kind) {
    const snap = getSnapshot();
    const { busy, infusing, discovering, energy, choosing } = snap;
    if (busy || infusing || discovering || choosing || aim) return;
    const uid = el.dataset.uid;
    const entry = findCard(uid);
    if (!entry) return;
    const side = kind === 'potion' ? 'enemy' : (targetSide(entry.card) || 'any');   // null = 无目标招式：拖到中间空地即可
    if (kind !== 'potion' && effCostOf(entry.card) > energy) return;   // 能量不足：不进入指向（点击会有提示）；药水不耗能量
    const vr = UI.el.overlay.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    aim = {
      uid, card: entry.card, side, el, kind: kind || 'card',
      ax: r.left + r.width / 2 - vr.left, ay: r.top - vr.top + 6,
      sx: e.clientX, sy: e.clientY, moved: false, hover: null,
      snap, vr,   // 指向期间的快照/overlay rect 缓存：期间战斗状态不会变（重渲染会 cancelAim），pointermove 高频路径直接复用
    };
    el.classList.add('aim-lift');
    SDT.Sound.sfx('hover');
    if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) {} }
    window.addEventListener('pointermove', moveAim, true);
    window.addEventListener('pointerup', endAim, true);
    window.addEventListener('pointercancel', cancelAim, true);
  }
  function moveAim(e) {
    if (!aim) return;
    if (!aim.moved && Math.hypot(e.clientX - aim.sx, e.clientY - aim.sy) < 6) return;
    aim.moved = true;
    const vr = aim.vr;   // 指向期间 overlay 尺寸不变（重渲染会 cancelAim），缓存省去每次 move 的布局读取
    const hit = aimHoverAt(e.clientX, e.clientY, aim.side, aim.snap);
    if (aim.hover && (!hit || hit.el !== aim.hover.el)) aimClearHover();
    let tx = e.clientX - vr.left, ty = e.clientY - vr.top;
    if (hit && hit.kind === 'any') {
      // 无目标招式：箭头跟指针走，落点就是松手处（不吸附到元素中心）
      hit.el.classList.add('drop-any');
      aim.hover = hit;
    } else if (hit) {
      const hr = hit.el.getBoundingClientRect();
      tx = hr.left + hr.width / 2 - vr.left;
      ty = hr.top + hr.height / 2 - vr.top;
      if (hit.kind === 'enemy') { hit.el.classList.add('drag-over'); showFoePreview(hit.el, hit.idx, aim.card, aim.snap); }
      else hit.el.classList.add('drop-here');
      aim.hover = hit;
    }
    aimArrowUpdate(aim.ax, aim.ay, tx, ty, AIM_COLOR[hit ? hit.kind : aim.side], vr);
  }
  function endAim(e) {
    window.removeEventListener('pointermove', moveAim, true);
    window.removeEventListener('pointerup', endAim, true);
    window.removeEventListener('pointercancel', cancelAim, true);
    const a = aim;
    aim = null;
    if (!a) return;
    const wasMoved = a.moved;
    a.moved = false;
    const hit = wasMoved ? aimHoverAt(e.clientX, e.clientY, a.side, a.snap) : null;
    aimCleanup(a);
    if (wasMoved && hit) {
      aimPlayedAt = Date.now();
      if (a.kind === 'potion') {
        if (hit.kind === 'enemy') useItemCmd(a.uid, hit.idx);   // 药水拖到敌人身上：直接使用
        return;
      }
      if (hit.kind === 'enemy') play(a.uid, hit.idx);
      else if (hit.kind === 'self') play(a.uid, 'self');
      else play(a.uid);   // kind 'any'：无目标招式，直接打出
      return;
    }
    // 拖了但没拖到目标 = 取消：卡牌沿弹性过渡自动落回手牌（2026-09-09 老板：
    // 松手没指向目标就回手牌，不再停在锁定态）。cancelInteraction 幂等（批次C）：
    // 无进行中交互（普通卡拖空）时是 no-op，不动 DOM，落回动画保持完整。
    // 轻点（位移<6px）仍走 click → play() 的锁定流程
    cancelPendingTarget();
  }
  function cancelAim() {
    window.removeEventListener('pointermove', moveAim, true);
    window.removeEventListener('pointerup', endAim, true);
    window.removeEventListener('pointercancel', cancelAim, true);
    const a = aim;
    aim = null;
    aimCleanup(a);
  }

  // ---------- 指向悬停效果预览（松手前暗示打出结果；card = 指向中的卡） ----------
  // snap 可传入指向期间缓存的快照（见 startAim），避免拖拽路径反复重建快照
  function showFoePreview(el, idx, card, snap) {
    if (el.querySelector('.bt-fpreview')) return;   // 已显示则不重建（move 连续触发）
    const snapshot = snap || getSnapshot();
    const foe = snapshot.foes[idx];
    const useCard = card || (snapshot.pendingTarget && snapshot.pendingTarget.card) || null;
    if (!foe || foe.dead || !useCard) return;
    const desc = String(useCard.desc || '');
    const tm = desc.match(/(?:攻击|命中)\s*(\d+)\s*次/) || desc.match(/(\d+)\s*段/);
    const times = tm ? Math.max(1, +tm[1]) : 1;
    let main, sub = '';
    if (aegisBlocked(foe)) {
      main = '[[icon:crystal]] 将被元素庇幕完全减免';
      sub = '先挂「破甲」再打才能造成伤害';
    } else {
      const type = SDT.Cards.DMG_TYPE_META[useCard.dmgType] ? useCard.dmgType : Combat.TYPES.FIXED;
      const amount = +useCard.dmg || 0;
      // 预览结算（克隆快照，不改动真实状态）
      const snap = { hp: foe.hp, status: Object.assign({}, foe.status),
        defense: { shield: foe.defense.shield, armor: foe.defense.armor, guard: foe.defense.guard } };
      const r = Combat.previewDamage({
        atk: snapshot.player.atk,
        spellPower: snapshot.player.spellPower,
        // 法术强化祝福计入预览（口径同 dealDamage：spellPower + status.spellUp）
        status: (snapshot.pstat && snapshot.pstat.status) || undefined,
      }, snap, amount, type);
      if (r.stealthed) {
        main = `[[icon:runner]] <b>${esc(foe.name)}</b> 潜行中——伤害无法命中`;
        sub = '等潜行结束，或先用非伤害卡过渡';
      } else {
        const total = r.dealt * times;
        main = `[[icon:bolt]] 预计造成 <b>${total}</b> 点${Combat.TYPE_NAME[type]}` + (times > 1 ? `（${r.dealt} × ${times} 段）` : '');
        sub = r.log.length ? r.log.join(' · ') : '无加成';
        if (foe.hp - total <= 0) { main = `[[icon:skull]] 预计击倒 ${esc(foe.name)}！`; }
      }
    }
    const div = document.createElement('div');
    div.className = 'bt-fpreview';
    div.innerHTML = `<b>${main}</b><span>${sub}</span><span class="bt-fpreview-tip">—— 松手打出 ——</span>`;
    el.appendChild(div);
    SDT.Sound.sfx('hover');
  }
  function clearFoePreview(el) {
    const p = el.querySelector('.bt-fpreview');
    if (p) p.remove();
  }

  sdtDefine('Battle', Object.freeze({ ...BattleSession, _test: Object.freeze({ refillDrawPile }) }));

configureBattleRenderer(render);

export { render };
