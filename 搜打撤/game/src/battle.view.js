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
/* battle.view.js —— 战斗渲染：战场 DOM/手牌/指向施法箭头/拖拽预览 */
  const {
    AFFIX_META, Combat, R, aegisBlocked, curseChips, effCostOf, findCard,
    infuseOf, markDreadShown, pileTip, refillDrawPile,
    takeFloats, takeCardAnims, targetSide, unplayableReason, matchHandSelectKey,
  } = viewApi;
  const play = commands.playCard;
  const cancelInfuse = commands.cancelInfusion;
  const confirmInfuse = commands.confirmInfusion;
  const endTurn = commands.endTurn;
  const flee = commands.flee;
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
      <p class="ov-stats">从背包选 <b>${deckSelection.need}</b> 张<b>非道具</b>卡牌，与 <b>${deckSelection.starterCount}</b> 张初始攻击组成牌库 ·
        开局抽 ${R().battleStartDraw} 张 · 每回合开始抽 ${R().battleTurnDraw} 张 · 每回合固定 ${R().battleEnergy} 费</p>
      ${affix ? `<p class="ov-note">[[icon:question]] <b>${esc(boss.name)}</b> 词缀【${affix.icon} ${affix.name}】${esc(affix.desc)}</p>` : ''}
      <p class="ov-note">[[icon:lock]] 固定编入：初始攻击 ×${deckSelection.starterCount}${deckSelection.starterCount < R().starterSha ? `（初始攻击不足 ${R().starterSha} 张——部分进消耗口袋了）` : ''}
        · [[icon:cross]] 道具 / 资源 / 事件卡与初始攻击不可选入</p>
      <h3 class="set-h">可选卡牌 <span class="bs-count">已选 ${selected.length}/${deckSelection.need}</span></h3>
      <div class="bt-hand">${cardsHTML}</div>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="bossGo" ${ready ? '' : 'disabled'}>${ready ? `[[icon:swords]] 开始战斗（牌库 ${selected.length + deckSelection.starterCount} 张）` : `还需选择 ${need - selected.length} 张…`}</button>
        <button class="ov-btn" data-act="bossCancel">↩ 放弃挑战</button>
      </div>`, true);
    UI.act('bossSel', data => selectDeckCard(data.uid));
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

  // 战斗背包（2026-09-09 老板：战斗中开背包使用道具）：同名堆叠展示，点卡即用
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
    UI.showOverlay(`${snapshot.opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${snapshot.turn} 回合 · [[icon:bag]] 战斗背包`, `
      <p class="ov-stats">点击道具卡直接使用——回复类 / 能源结晶 / 神秘药水 / 口粮木材战斗内生效，其余道具战后回地图再使</p>
      <div class="bt-hand">${cardsHTML}</div>
      <div class="ov-btns"><button class="ov-btn ok" data-act="btBagBack">↩ 返回战斗（B）</button></div>`, true);
    UI.act('btUseItem', (d) => useItemCmd(d.uid));
    UI.act('btBagBack', closeBagCmd);
    UI.refresh(SDT.game);
  }

  // ---------- 渲染 ----------
  function render(snapshot = getSnapshot()) {
    const prevView = captureBattleView();   // 重建前的手牌/牌堆位：供飞行与归位动画取样
    const {
      mode, turn, energy, maxEnergy, busy, phase = 'player', opts, player, pdef, pstat,
      foes, hand, drawPile, discard, grave, infusing, discovering, handSelecting, choosing,
      pendingTarget, pendingHint, viewingGrave, viewingBag, dreadShown, deckSelection,
      potionBar, pendingItem,
    } = snapshot;
    if (aim) cancelAim();   // 重渲染时中止进行中的指向（DOM 将重建）
    if (deckSelection) { renderDeckSelection(snapshot); return; }
    if (viewingGrave) { renderGrave(snapshot); return; }
    if (viewingBag) { renderBattleBag(snapshot); return; }
    if (choosing) {
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
      const optsHTML = discovering.options.map((c, i) => `
        <div class="bt-card" data-act="btDiscover" data-i="${i}" title="点击置入手牌">
          ${SDT.Cards.cardHTML(c, 'sm')}
        </div>`).join('');
      UI.showOverlay(`${opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${turn} 回合 · [[icon:question]] 发现`, `
        <p class="ov-stats">从随机 <b>${discovering.options.length}</b> 张卡牌中选择 <b>1</b> 张置入手牌</p>
        <div class="bt-hand">${optsHTML}</div>
        <p class="ov-note">发现的卡是战斗内临时卡，战后消散、不进背包。</p>`, true);
      UI.act('btDiscover', (d) => pickDiscover(d.i));
      UI.refresh(SDT.game);
      return;
    }
    const cards = hand.map(findCard).filter(Boolean);
    const infusingNow = !!infusing;
    // —— 同名卡堆叠（v0.32 杀戮尖塔式手牌）：同名同描述的卡只占一个位置，显示 ×N ——
    // 注能中：注能主卡单独一块展示，其同名燃料照常成组（点击组 = 消耗组内一张）
    const groups = groupHandCards(cards, infusingNow ? infusing : null);
    const N = groups.length;
    const handHTML = N
      ? groups.map((g, i) => {
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
                    (infuseOf(g.card) > 0 ? ` · 注能(${infuseOf(g.card)})：需先选 ${infuseOf(g.card)} 张手牌消耗` : '');
          const badge = side === 'enemy' ? '<span class="bt-tt">[[icon:swords]]</span>'
            : side === 'self' ? '<span class="bt-tt">[[icon:heart]]</span>'
              : side === 'any' ? '<span class="bt-tt">[[icon:sparkles]]</span>' : '';
          const costBadge = effCost !== g.card.cost ? '<span class="bt-cost1" title="宇宙形态：所有卡牌 1 费">[[icon:bolt]]1</span>' : '';
          const cnt = g.uids.length > 1 ? `<span class="bt-count" title="同名卡 ${g.uids.length} 张堆叠为一叠">×${g.uids.length}</span>` : '';
          // 扇形手牌：槽位挂圆弧位（--fx/--fy/--frot/--fs），hover/瞄准/放大等状态变换叠在内层卡上
          const L = fanLayout(i, N);
          return `<div class="bt-slot" style="--fx:${L.x}px;--fy:${L.y}px;--frot:${L.rot}deg;--fs:${L.scale}">
            <div class="bt-card${cls}${side === 'enemy' || side === 'self' ? ' need-target' : ''}${side === 'any' ? ' free-drop' : ''}" data-act="btPlay" data-uid="${uid}"
              data-aim="${side ? '1' : ''}" data-side="${side || ''}" title="${escAttr(tip)}">
              ${SDT.Cards.cardHTML(g.card, 'sm')}
              ${cnt}
              ${badge}
              ${costBadge}
            </div>
          </div>`;
        }).join('')
      : mode === 'boss'
        ? (drawPile.length + discard.length)
          ? '<p class="ov-empty">手牌打空了……下回合开始会再抽 1 张</p>'
          : '<p class="ov-empty">牌库与弃牌堆都空了——只能结束回合硬抗，或撤退</p>'
        : '<p class="ov-empty">没有能出的卡了……（打出过的卡本场不可再用）</p>';
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
    // —— 道具栏（2026-09-12 老板定向）：战斗界面上方常驻，点击使用 / 拖到敌人身上 ——
    // 2026-09-09 老板 #10：非 BOSS 战一律显示（没有道具时也给空位提示），不可用的道具虚化
    const potions = potionBar || [];
    const showItemBar = potions.length > 0 || mode !== 'boss';
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
    // —— 我方单位（左下站立；治疗/净化/护盾类卡牌的拖放目标） ——
    // 2026-09-09 老板：轻点锁定+「已选卡牌」提示条+取消按钮退役，出牌只认拖拽指向（松手没目标自动回手牌）
    const selfPct = Math.max(0, player.hp / player.maxHp * 100);
    const selfChips = curseChips(pstat.status);   // 只构建一次（原来自条件+输出各调一次）
    // 已穿戴装备（2026-09-09 老板 #9）：名称 + 说明 tooltip；带限定技能的可点击发动
    const equipChips = (snapshot.equipped || []).map(e => e.skill
      ? `<button class="sts-equip has-skill${e.used ? ' used' : ''}" data-act="btEquipSkill" data-uid="${escAttr(e.uid)}"
          title="${escAttr(`【${e.name}】${e.desc}${e.used ? '（限定技能本场已用过）' : '——点击发动限定技能'}`)}">[[icon:tools]] ${esc(e.name)}${e.used ? '' : ' [[icon:bolt]]'}</button>`
      : `<span class="sts-equip" title="${escAttr(`【${e.name}】${e.desc}`)}">[[icon:tools]] ${esc(e.name)}</span>`).join('');
    const selfHTML = `
      <div class="sts-unit sts-me" id="btSelf"
        title="你自己——治疗 / 净化 / 护盾 / 格挡类卡牌拖到这里打出">
        <div class="sts-figure">${player.myClass && SDT.Art.has(player.myClass) ? (SDT.Art.battleArt ? SDT.Art.battleArt(player.myClass) : SDT.Art.classArt(player.myClass)) : SDT.Icons.img('helmet')}</div>
        <div class="sts-nameplate">
          <b>${esc(characterName(player.characterId || player.myClass))}</b><span class="sts-you">你</span>
          <div class="bt-hpwrap sts-hp"><i style="width:${selfPct.toFixed(1)}%"></i><span>${Math.max(0, player.hp)}/${player.maxHp}</span></div>
          <div class="sts-stats">[[icon:swords]] ${player.atk}${pdef.shield ? ' · [[icon:shield]] 盾 ' + pdef.shield : ''}${pdef.armor ? ' · [[icon:plate]] 甲 ' + pdef.armor : ''}${pdef.guard ? ' · 格挡中' : ''}</div>
          ${selfChips ? `<div class="sts-chips">${selfChips}</div>` : ''}
          ${equipChips ? `<div class="sts-equips" title="已穿戴装备——鼠标悬停看说明，带 [[icon:bolt]] 的可点击发动限定技能">${equipChips}</div>` : ''}
        </div>
      </div>`;
    // —— 随从位（Q4 老板定向：征召步兵等——替你承伤、每回合自动攻击） ——
    const allies = snapshot.allies || [];
    const alliesHTML = allies.length ? `
      <div class="sts-allies">${allies.map((a, i) => `
        <div class="sts-unit sts-ally${a.dead ? ' dead' : ''}" data-ally-i="${i}" title="${escAttr('你的随从：优先替你承受伤害，每回合自动攻击敌人')}">
          <div class="sts-figure">${SDT.Icons.img('runner')}</div>
          <div class="sts-nameplate">
            <b>${esc(a.name)}</b>
            <div class="bt-hpwrap sts-hp"><i style="width:${Math.max(0, a.hp / a.maxHp * 100).toFixed(1)}%"></i><span>${Math.max(0, a.hp)}/${a.maxHp}</span></div>
            <div class="sts-stats">[[icon:swords]] ${a.atk}</div>
          </div>
        </div>`).join('')}</div>` : '';
    // —— 敌方单位（右下站立横排；意图气泡在头顶；词缀角标；免伤高亮） ——
    const foesHTML = foes.map((f, idx) => {
      const aff = f.affix && AFFIX_META[f.affix];
      const immune = aegisBlocked(f);
      const chips = curseChips(f.status);   // 只构建一次（原来自条件+输出各调一次）
      const intents = intentViewModel(f.intent);
      return `<div class="sts-unit sts-foe bt-foe${opts.isBoss || f.affix ? ' is-boss' : ''}${f.dead ? ' dead' : ''}${immune ? ' aegis' : ''}${pendingItem && !f.dead ? ' can-target' : ''}" data-foe-id="${escAttr(f.id || f.name)}"
          data-eidx="${idx}" title="${aff ? escAttr(aff.name + '：' + aff.desc) : ''}">
          ${!f.dead && intents.length ? `<div class="sts-intent" title="${escAttr(`下一回合预告：${intentSummary(f.intent)}`)}">${intents.map(intent => `${intent.icon} ${esc(intent.label)}${intent.damage == null ? '' : ` · ${intent.damage}`}`).join(' ')}</div>` : ''}
          <div class="sts-figure">${f.id && SDT.Art.has(f.id) ? SDT.Art.monsterArt(f.id) : SDT.Icons.img('slime')}</div>
          <div class="sts-nameplate">
            <b>${esc(f.name)}</b>${f.dead ? ' <span class="bt-deadmark">[[icon:cross]]</span>' : ''}
            ${aff ? `<span class="bt-affix" title="${escAttr(aff.desc)}">${aff.icon} ${aff.name}</span>` : ''}
            <div class="bt-hpwrap sts-hp"><i style="width:${Math.max(0, f.hp / f.maxHp * 100).toFixed(1)}%"></i><span>${Math.max(0, f.hp)}/${f.maxHp}</span></div>
            <div class="sts-stats">[[icon:swords]] ${f.atk}${f.affix === 'frenzy' ? ' ×2' : ''}${immune ? ' · [[icon:crystal]] 庇幕免伤中' : ''}</div>
            ${chips ? `<div class="sts-chips">${chips}</div>` : ''}
          </div>
        </div>`;
    }).join('');
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
          <button class="ov-btn ghost" data-act="btBag" ${busy || infusingNow ? 'disabled' : ''}>[[icon:bag]] 背包</button>
          <button class="ov-btn ghost" data-act="btFlee" ${busy || infusingNow ? 'disabled' : ''}>[[icon:runner]] 撤退</button>
          <button class="ov-btn ${busy || infusingNow ? '' : 'ok'}" data-act="btEnd" ${busy || infusingNow ? 'disabled' : ''}>[[icon:skip]] 结束回合</button>
        </div>
      </div>
      <div class="sts-arena">
        ${selfHTML}
        ${alliesHTML}
        <div class="sts-foes">${foesHTML}</div>
      </div>
      ${infuseBar}
      ${itemBar}
      <div class="sts-hud">
        <div class="sts-energy-wrap">
          <div class="sts-energy" title="能量：每回合固定 ${maxEnergy} 费">[[icon:bolt]] <b>${energy}</b><span>/${maxEnergy}</span></div>
        </div>
        <div class="bt-hand sts-hand" title="${escAttr(tip)}">${handHTML}</div>
      </div>`, 'battle');
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
    UI.act('btFlee', flee);
    UI.act('btGrave', openGrave);
    UI.act('btBag', openBagCmd);
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
    body.querySelectorAll('.bt-foe[data-eidx]').forEach(el => {
      el.addEventListener('click', () => {
        // 药水栏点选：待使用道具时点敌人直接结算
        if (pendingItem) {
          if (!el.classList.contains('dead')) useItemCmd(pendingItem.uid, el.dataset.eidx);
        }
      });
    });
    body.querySelectorAll('.bt-card[data-aim="1"]').forEach(el => {
      el.addEventListener('pointerdown', (e) => { if (e.button === 0) startAim(e, el); });
    });
    // 人物去纸色背景，像模型一样站在场景里（art.js 内按图缓存，二次渲染零成本）
    if (SDT.Art.cutoutFigures) SDT.Art.cutoutFigures(body);
    // 牌局动画：离场飞行 / 新牌飞入 / 幸存者归位 / 手牌区显隐 / 能量脉冲
    const anim = animateBattleTransition(prevView, body);
    // BOSS 登场演出：竖线阴影压过场景 2.4s（每场一次）
    if (opts.isBoss && !dreadShown) {
      markDreadShown();
      const st = body.querySelector('.battle-stage');
      if (st) { st.classList.add('fx-dread'); setTimeout(() => st.classList.remove('fx-dread'), 2500); }
    }
    spawnFloats(body, anim.flightMs ? Math.min(340, anim.flightMs * 0.8) : 0);
    UI.refresh(SDT.game);
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
  function animateBattleTransition(prev, body) {
    const events = takeCardAnims();
    let flightMs = 0;
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
    events.forEach(ev => {
      if (ev.kind === 'draw') drawn.add(ev.uid);
      else played.add(ev.uid);
    });
    drawn.forEach(u => played.delete(u));   // 打出又回手（不朽斩）：同帧两事件抵消不演
    const slotOf = new Map();
    body.querySelectorAll('.sts-hand .bt-slot').forEach(slot => {
      const card = slot.querySelector('.bt-card[data-uid]');
      if (card) slotOf.set(card.dataset.uid, slot);
    });
    // —— 离场：克隆体沿上弓弧线飞向去处 ——
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
    // —— 入场：新牌从牌堆（普通战斗从画面右下）错峰飞入扇形位 ——
    let drawIdx = 0;
    events.forEach(ev => {
      if (!drawn.has(ev.uid)) return;
      const slot = slotOf.get(ev.uid);
      if (!slot || !slot.animate) return;
      const src = (prev && prev.drawPile) || { left: ovR.width - 150, top: ovR.height - 110, width: 56, height: 80 };
      const r = slot.getBoundingClientRect();
      const dx = src.left + src.width / 2 - (r.left + r.width / 2);
      const dy = src.top + src.height / 2 - (r.top + r.height / 2);
      animateSafe(slot, [
        { transform: `translate(${dx}px,${dy}px) rotate(9deg) scale(.72)`, opacity: 0 },
        { transform: 'translate(0px,0px) rotate(0deg) scale(1)', opacity: 1 },
      ], { duration: 340, delay: drawIdx++ * 70, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards', composite: 'add' });
    });
    // —— 幸存者归位：打出/抽牌后其余牌滑到新扇形位 ——
    if (prev) {
      slotOf.forEach((slot, uid) => {
        if (drawn.has(uid) || played.has(uid) || !slot.animate) return;
        const old = prev.cards[uid];
        if (!old) return;
        const r = slot.getBoundingClientRect();
        const dx = old.rect.left + old.rect.width / 2 - (r.left + r.width / 2);
        const dy = old.rect.top + old.rect.height / 2 - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) < 2) return;
        animateSafe(slot, [
          { transform: `translate(${dx}px,${dy}px)` },
          { transform: 'translate(0px,0px)' },
        ], { duration: 210, easing: 'cubic-bezier(.22,.9,.3,1)', composite: 'add' });
      });
    }
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
    // 松手没指向目标就回手牌，不再停在锁定态）。此前轻点锁定过的才需要清目标+提示条
    // （会触发一次重渲染）；直接拖空的常见路径不动 DOM，落回动画保持完整。
    // 轻点（位移<6px）仍走 click → play() 的锁定流程
    if (a.snap && a.snap.pendingTarget) cancelPendingTarget();
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
      const r = Combat.previewDamage({ atk: snapshot.player.atk, spellPower: snapshot.player.spellPower }, snap, amount, type);
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

  window.SDT = window.SDT || {};
  window.SDT.Battle = Object.freeze({ ...BattleSession, _test: Object.freeze({ refillDrawPile }) });

configureBattleRenderer(render);

export { render };
