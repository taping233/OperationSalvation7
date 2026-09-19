import { characterName } from './characters.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from './shared.js';
import { MAP } from './game.session.js';
import { escAttr } from './shared.js';
import { MODES, game, getActiveSlot, newRun, requestClassChoice, setLobby, showTitle } from './game.session.js';
import { Sfx, configureCardNavigation, _set_cardPageOpen } from './game.cardslib.js';
import { Random } from './random.js';

// 基地当前页签（原为隐式全局，ESM 严格模式下必须显式声明）
let hubTab = 'deploy';
  function openBaseHub(tab) {
    game.state = 'modal';
    _set_cardPageOpen(true);
    setLobby(true);           // 基地也属于非对局界面：隐藏左侧栏
    hubTab = tab || 'deploy';
    SDT.Sound.music('base');   // 基地氛围
    SDT.Meta.checkUnlocks();   // 进基地时补播新解锁的成就
    renderHub();
  }

  function renderHub() {
    const B = SDT.Base;
    const M = SDT.Meta;
    _set_cardPageOpen(true);      // Hub 页面：Esc / 点击背景可关闭
    const pending = M.pendingAch().length + M.pendingColl().length;
    // 页签切换时才播放入场动画（页内操作重渲染不闪）
    const tabChanged = renderHub._lastTab !== hubTab;
    renderHub._lastTab = hubTab;
    // v0.22 图标页签：大图标为主 + 小字注记（仓库=木房子）
    const TABS = [
      { id: 'deploy', icon: 'flag', name: '出发' },
      { id: 'stash', icon: 'home', name: '仓库' },
      { id: 'shop', icon: 'coin', name: '商店' },
      { id: 'upgrade', icon: 'tools', name: '升级' },
      { id: 'classes', icon: 'medal', name: '人物' },
      { id: 'ach', icon: 'trophy', name: '成就·收藏室' },
    ];
    const body = hubTab === 'deploy' ? hubDeployHTML()
      : hubTab === 'stash' ? hubStashHTML()
      : hubTab === 'shop' ? hubShopHTML()
      : hubTab === 'upgrade' ? hubUpgradeHTML()
      : hubTab === 'classes' ? hubClassesHTML()
      : hubAchHTML();
    registerHubHelp(hubTab);
    UI.showOverlay('', `
      <div class="pg hub hub-${hubTab}" id="hubMain">
       <header class="hub-head hub-head-min">
          <h2>远征基地</h2><span class="hub-slot-label">${getActiveSlot() ? `档位 0${getActiveSlot()}` : '未选档'}</span>
         <button class="hub-back" data-act="closeBase" title="返回主菜单（Esc）">← 返回</button>
          ${UI.helpBtn('hub-' + hubTab)}
          <span class="pg-spacer"></span>
          <span class="hub-res">
            <span class="res-chip">[[icon:wood]] 木材 <b>${B.data.wood}</b></span>
            <span class="res-chip">[[icon:bread]] 口粮 <b>${B.data.rations}</b></span>
            <span class="res-chip" title="真实钥匙储备 + 仓库钥匙卡（宝藏大门计数）">[[icon:key]] 钥匙 <b>${B.keyCount ? B.keyCount() : 0}</b></span>
            <span class="res-chip" title="卖出仓库物品所得 · 不进局，用于孵蛋与基地建设">[[icon:coin]] 储备 <b>${B.data.coins}</b> 币</span>
          </span>
        </header>
        <div class="hub-body">
          <nav class="hub-tabs">${TABS.map(t =>
            `<button class="hub-tab${hubTab === t.id ? ' on' : ''}" data-act="hubTab" data-tab="${t.id}">` +
            `<span class="tab-ico">${SDT.Icons.img(t.icon)}</span>` +
            `<span class="tab-txt">${t.name}</span>` +
            `${t.id === 'ach' && pending ? '<span class="dot"></span>' : ''}</button>`).join('')}
          </nav>
          <div class="hub-page${tabChanged ? ' page-in' : ''}">${body}</div>
        </div>
      </div>`, 'page');
    // 局外商店购买（2026-09-16 留言「局外商店提供基础卡牌」）：储备币直购，货入卡牌仓库
    UI.act('shopBuy', (d) => {
      const g = HUB_SHOP_GOODS[+d.i];
      if (!g) return;
      const B = SDT.Base;
      if (B.data.coins < g.price) { UI.log('[[icon:coin]] 储备币不足，无法购买', 'warn'); return; }
      B.data.coins -= g.price;
      if (g.material) {
        B.data[g.material] = (B.data[g.material] || 0) + 1;
        B.save();
        Sfx.ding();
        UI.log(`[[icon:coin]] 购入<b>${esc(g.name)}</b> ×1 → 基地物资（${esc(g.name)} ${B.data[g.material]} · 储备余 ${B.data.coins} 币）`, 'loot');
        renderHub();
        return;
      }
      const card = hubShopGoodsCard(g);
      if (!card) { B.data.coins += g.price; return; }
      if (B.stashRoom() <= 0) { B.data.coins += g.price; UI.log('[[icon:archive]] 仓库已满，无法入库', 'warn'); return; }
      B.depositCards([{ card: { ...card }, count: 1 }]);
      Sfx.ding();
      UI.log(`[[icon:coin]] 购入【<b>${esc(card.name)}</b>】×1 → 卡牌仓库（储备余 ${B.data.coins} 币）`, 'loot');
      renderHub();
    });
    UI.act('hubTab', (d) => { hubTab = d.tab; renderHub(); });
    UI.act('selMode', (d) => { B.data.selMode = d.mode; B.save(); renderHub(); });
    UI.act('nestDeploy', () => { SDT.Nest.openNestPrep(); });
    UI.act('deploy', () => { openDepartPrep(); });
    UI.act('gateInfo', () => {
      const n = B.keyCount ? B.keyCount() : 0;
      if (n >= (B.KEY_NEEDED || 10)) {
        Sfx.ding();
        UI.log('[[icon:door]] 宝藏大门已在酝酿——特殊关卡制作中，敬请期待', 'sys');
      } else {
        UI.log(`[[icon:key]] 钥匙不足（${n}/${B.KEY_NEEDED || 10}）——在棋盘的钥匙格收集更多钥匙吧`, 'dim');
      }
    });
    UI.act('upBag', () => {
      if (!B.upgradeBag()) return;
      Sfx.ding();
      UI.log(`[[icon:bag]] 背包扩建完成：容量 <b>${B.bagCap()}</b> 格（- [[icon:wood]]×${MAP.rules.bagUpgradeWood}）`, 'ok');
      SDT.Meta.checkUnlocks();
      renderHub();
    });
    UI.act('upSafe', () => { renderHub(); });   // 保险升级已改为宠物升级（见 upgrade 页每只宠物的按钮）
    UI.act('upPet', (d) => {
      const pet = SDT.Base.petById(d.id);
      if (!SDT.Base.upgradePet(d.id)) return;
      Sfx.ding();
      UI.log(`[[icon:paw]] <b>「${esc(pet.name)}」</b>升级到 <b>Lv.${SDT.Base.petLevel(d.id)}</b>：保护格 <b>${B.safeCap()}</b> 格`, 'ok');
      SDT.Meta.checkUnlocks();
      renderHub();
    });
    UI.act('selPet', (d) => {
      if (!SDT.Base.setPet(d.id)) return;
      const pet = SDT.Base.petById(d.id);
      Sfx.ding();
      UI.log(`[[icon:paw]] 已携带宠物<b>「${esc(pet.name)}」</b>：${esc(pet.desc)} · 保护格 <b>${SDT.Base.safeCap()}</b> 格`, 'ok');
      renderHub();
    });
    UI.act('upStash', () => {
      if (!B.upgradeStash()) return;
      Sfx.ding();
      UI.log(`[[icon:archive]] 仓库扩建完成：容量 <b>${B.stashCap()}</b> 张（- [[icon:wood]]×${MAP.rules.stashUpgradeWood}）`, 'ok');
      renderHub();
    });
    UI.act('stashItem', (d) => openStashItem(+d.i));
    UI.act('rawItem', (d) => openRawItem(d.kind));
    UI.act('restoreCard', (d) => {
      const stack = B.data.pocket[+d.i];
      const r = B.restore(+d.i);
      if (r === true) { Sfx.ding(); UI.log(`[[icon:key]] 消耗 <b>${B.pocketKeyCost(stack)}</b> 把钥匙，卡牌已复原，回到卡牌仓库`, 'ok'); }
      else if (r === 'sha') UI.log('[[icon:cards]] 初始牌「初始攻击」无需入库——每局自动携带，已直接消耗', 'dim');
      else if (r === 'full') UI.log(`[[icon:archive]] 仓库容量不足（${B.stashUsed()}/${B.stashCap()} 张），先卖出或升级仓库`, 'warn');
      else if (r && r.why === 'nokey') UI.log(`[[icon:key]] 钥匙不足：复原这堆卡牌需要 <b>${r.cost}</b> 把钥匙（现有 ${B.keyCount ? B.keyCount() : 0}）——可在仓库把钥匙材料卡「使用」折入储备`, 'warn');
      if (r) renderHub();
    });
    UI.act('claimAch', (d) => {
      const r = M.claim(d.id);
      if (r.ok) { Sfx.ding(); renderHub(); }
    });
    UI.act('selBack', (d) => {
      const B2 = SDT.Base;
      if (!B2.isBackUnlocked(d.id)) {
        const bd = (SDT.Cards.CARD_BACKS || []).find(b => b.id === d.id);
        UI.log(`[[icon:lock]] 卡背未解锁：${bd ? bd.from : d.id}`, 'warn');
        return;
      }
      if (B2.backSel() === d.id) return;
      B2.setBack(d.id);
      const bd = (SDT.Cards.CARD_BACKS || []).find(b => b.id === d.id);
      Sfx.ding();
      UI.log(`[[icon:cards]] 已装备卡背【<b>${bd ? bd.name : d.id}</b>】——背包翻面与牌库堆即刻生效`, 'ok');
      renderHub();
    });
    UI.act('claimColl', (d) => {
      const r = M.claimColl(d.id);
      if (r.ok) { Sfx.ding(); renderHub(); }
      else if (r && r.why === 'full') UI.log(`[[icon:archive]] ${r.msg}`, 'warn');
    });
    UI.act('collZoom', (d) => {
      const card = M.collectPool().find(c => c.id === d.id);
      if (card) UI.showCardZoom(card);
    });
    UI.act('closeBase', closeBase);
  }

  // —— 基地各页签的 ? 帮助主题（说明文字统一收进二级界面，不在页面直铺） ——
  function registerHubHelp(tab) {
    const R = MAP.rules;
    const T = {
      deploy: { title: '出发说明', items: [
        ['玩法选择', '出发后会随机空降到外圈入口，并从全部人物中自由选择 1 个本局人物（熟练度提供常驻加成）。'],
        ['出征预报', '点击「出发」后会打开出征整备：选择要从仓库携带的卡牌——只有带上的卡才能在战斗中使用。撤离成功后也会出现整理界面，让你把背包战利品放回仓库。'],
        ['宝藏大门', '在棋盘的钥匙格收集钥匙，集齐 ' + (SDT.Base.KEY_NEEDED || 10) + ' 把可开启特殊关卡（关卡制作中）。'],
      ] },
      shop: { title: '商店说明', items: [
        ['基础卡牌', '用储备币购买基础招式 / 装备 / 资源卡，买下直接放入卡牌仓库，出发前勾选带入。'],
        ['储备币', '卖出仓库物品所得；不进局、不随对局增减，只用于基地消费（孵蛋、商店）。'],
      ] },
      stash: { title: '仓库说明', items: [
        ['卡牌仓库', '点击物品可卖出换储备币，或收藏进图鉴（收藏职业卡 +10、能力卡 +50 对应人物熟练度经验，重复收藏重复获得经验（进度只记首次）；收藏即用掉这张卡，不再占仓库格；收藏进度可在「成就·收藏室」领一次性奖励。传说卡与桌游珍宝是特殊收藏品，收藏期间不可卖出）。出发时自选携带（职业卡带出后无法带入）。'],
        ['材料卡 / 宠物蛋', '木材/口粮/钥匙材料卡可直接「使用」折入真实物资；宠物蛋 + 50 币可孵化随机宠物（宝箱 0.7% 起掉落：每开箱未出 +3%、每打赢一场战斗再 +0.2%）。'],
        ['消耗口袋', '战斗中消耗的卡牌有 1/3 概率随撤离回到这里（职业卡与初始牌除外）；用钥匙按稀有度复原：古朴1 / 稀有2 / 史诗3 / 传说4。下一次出发后口袋清空。'],
        ['宠物', '初始宠物「汪汪狗」自动获得，携带 1 只出战（出发页可切换）；其余用宠物蛋孵化。宠物在「升级」页用口粮升级（2-3-4-5）。'],
        ['物资', '木材/口粮/钥匙是基地建设材料（木材扩建背包与仓库、口粮升级宠物、钥匙复原口袋与开启宝藏大门），不可卖出换币。储备币只留在基地消费，不随对局带走。'],
      ] },
      upgrade: { title: '升级说明', items: [
        ['背包扩建', '每消耗木材 ×' + R.bagUpgradeWood + ' 扩建 1 格，上限 ' + R.bagMax + ' 格。'],
        ['仓库扩建', '每消耗木材 ×' + R.stashUpgradeWood + ' 扩建 ' + R.stashUpgradeSlots + ' 张容量，上限 ' + R.stashMax + ' 张。'],
        ['宠物升级', '每只宠物独立升级，口粮消耗递增 2-3-4-5，上限 Lv.5；Lv.1 起每级 +1 保护格。携带不同宠物保护格数量不同（小企鹅咕嘎 4-8 格）。'],
      ] },
      classes: { title: '人物说明', items: [
        ['熟练度', '每局出发时从全部角色中自由选择 1 个；击败敌人、撤离成功都会累积所选角色的熟练度经验，升级获得常驻加成（下一局出征生效）。'],
      ] },
      ach: { title: '成就与职业收藏室', items: [
        ['卡背图鉴', '牌库堆 / 背包翻面使用的卡背；领取对应成就奖励解锁，点击即可装备。'],
        ['成就', '达成条件后自动解锁（页内显示奖励内容），回基地点击「领取」获得物资与卡背奖励。'],
        ['职业收藏室', '仓库中收藏的职业卡与能力卡会陈列在此：每次收藏都转化为人物熟练度经验（职业卡 +10、能力卡 +50，重复收藏重复获得），卡牌收藏即用掉、不再占仓库格。收藏不同的职业卡与能力卡推进进度，5 / 15 / 30 / 45 / 全收集各有一次奖励，达成后点击「领取」。'],
      ] },
    };
    const t = T[tab];
    if (!t) return;
    UI.registerHelp('hub-' + tab, {
      title: t.title,
      html: t.items.map(([k, v]) => `<p class="help-item"><b>${k}</b>${v}</p>`).join(''),
      back: () => renderHub(),
    });
  }

  // —— 出发页：选择玩法 + 出征预报 + 宝藏大门 ——
  function hubDeployHTML() {
    const B = SDT.Base;
    const curMode = MODES[B.data.selMode] ? B.data.selMode : 'standard';
    const m = MODES[curMode];
    const keys = B.keyCount ? B.keyCount() : 0;
    const gateReady = keys >= (B.KEY_NEEDED || 10);
    const pet = B.carriedPet ? B.carriedPet() : null;
    return `
      <div class="deploy-brief">
        <section class="deploy-mission">
          <div class="deploy-mission-shade"></div>
          <div class="deploy-mission-copy">
            <span class="eyebrow">WINTER EXPEDITION / OUTSKIRTS</span>
            <h3>[[icon:flag]] 外圈远征简报</h3>
            <p class="deploy-mission-lead">从边缘街区切入，搜集资源、识别风险，并把能带回来的东西带回基地。</p>
            <div class="deploy-mission-target"><span>本局目标</span><b>${esc(m.name)}</b><small>${esc(m.ckpt)}</small></div>
            <button id="btnDeploy" class="deploy-primary" data-act="deploy">[[icon:exit]] 出发整备 <span>→</span></button>
            <button id="btnNest" class="deploy-primary" data-act="nestDeploy" style="margin-top:10px;background:linear-gradient(160deg,#2a1c33,#151020)"
              title="${SDT.Base.data.nestUnlocked ? '第二地图：直捣龙巢，夺取符文与龙宝' : '首次击败一图首脑并成功撤离后解锁'}">${SDT.Base.data.nestUnlocked ? '[[icon:skull]] 龙巢远征 <span>→</span>' : '[[icon:lock]] 龙巢（未解锁）'}</button>
          </div>
          <div class="deploy-mode-dock">
            <span class="dock-label">选择行动模式</span>
            <div class="mode-list">${Object.values(MODES).map(md => `
              <button class="mode-card${md.id === curMode ? ' on' : ''}" data-act="selMode" data-mode="${md.id}" aria-pressed="${md.id === curMode ? 'true' : 'false'}">
                <span class="mode-ico">${md.icon}</span>
                <span class="mode-info"><b>${md.name}</b><span>${md.desc}</span></span>
                <span class="mode-ckpt">${md.ckpt}</span>
              </button>`).join('')}
            </div>
          </div>
        </section>
        <aside class="deploy-readiness-panel">
          <div class="readiness-head"><span class="eyebrow">MISSION BRIEF</span><b>出发前准备</b><span class="brief-status">可整备</span></div>
          <div class="brief-mode"><span>当前模式</span><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></div>
          <div class="readiness-list">
            <div class="readiness-item ready"><i>01</i><span>基础参考（角色出发后选择）</span><b>${MAP.rules.playerMaxHp + (pet?.effect?.maxHp || 0)} 生命 · ${MAP.rules.playerAtk} 攻击</b></div>
            <div class="readiness-item"><i>02</i><span>携带容量</span><b>${B.bagCap()} 格背包 · 仓库 ${B.stashUsed()}/${B.stashCap()}</b></div>
            <div class="readiness-item"><i>03</i><span>保护与回收</span><b>${B.safeCap()} 格可用</b></div>
            <div class="readiness-item"><i>04</i><span>随身储备</span><b>开局 ${m.startCoins || 0} 币（储备币不进局） · ${B.data.rations} 口粮</b></div>
          </div>
          <div class="brief-pet">
            <span class="brief-pet-icon">[[icon:paw]]</span><span><small>随队宠物</small><b>${pet ? esc(pet.name) : '未携带'}</b></span>
            <em>${pet ? esc(pet.desc) : '可在整备页选择已拥有的宠物'}</em>
          </div>
          <p class="deploy-tip">[[icon:map]] 进入整备后，可从仓库拖入本局携带卡牌；只有装入背包的卡牌才能在远征中使用。</p>
        </aside>
      </div>
      <section class="hub-card gate-strip${gateReady ? ' gate-ready' : ' gate-locked'}" data-act="gateInfo"
        title="${gateReady ? '钥匙已集齐——宝藏大门虚位以待' : '集齐 10 把钥匙开启宝藏大门（特殊关卡）'}">
        <div class="gate-ico">${SDT.Art.gateIcon(gateReady)}</div>
        <div class="gate-txt">
          <b>宝藏大门</b>
          <span>[[icon:key]] 钥匙 <b class="${gateReady ? 'gate-ok' : ''}">${keys}/${B.KEY_NEEDED || 10}</b> ·
            ${gateReady ? '钥匙已集齐——特殊关卡制作中，敬请期待' : '集齐钥匙开启特殊关卡（关卡制作中）'}</span>
        </div>
        <span class="gate-state">${gateReady ? '[[icon:sparkles]]' : '[[icon:lock]]'}</span>
      </section>`;
  }

  // ---------- 出征整备（点击「出发」后）：选择从仓库携带的卡牌 ----------
  // 带入背包的卡牌才能在战斗中使用；「初始攻击」固定携带、不入库也不会出现在这里。
  let deployPick = null;    // 卡名 => 携带张数（出发准备页的暂存选择）
  let deployHint = '';      // 页内提示（容量不足等）
  let deployJustOpened = false;   // 出发准备页刚打开（只播一次入场动画）

  function openDepartPrep() {
    const B = SDT.Base;
    game.state = 'modal';
    deployHint = '';
    deployPick = {};
    deployJustOpened = true;   // 页面初次打开时播放入场动画
    // 2026-09-07 留言：仓库卡牌不再自动塞进背包——全部留在左侧，由玩家自己拖
    renderDepartPrep();
  }

  function deployPickRowsHTML() {
    const B = SDT.Base;
    if (!B.data.stash.length) {
      return '<p class="ov-empty" style="margin:6px 0 0">仓库里还没有卡牌——撤离成功后在整理界面把战利品放回仓库，下次出征就能带上了。</p>';
    }
    // 2026-09-07 留言：不再自动塞进背包，全部由玩家从左往右拖；
    // 卡面上的「仓 ×N」实时显示剩余可带数量，拖一张少一张。
    // 需求 #6：职业卡带出后无法带入——不显示在可带列表里
    return B.data.stash.filter(s => s.card.rarity !== '职业').map(s => {
      const n = deployPick[s.card.name] || 0;
      const left = Math.max(0, s.count - n);
      return `<div class="dep-card${n > 0 ? ' picked' : ''}${left <= 0 ? ' drained' : ''}" draggable="true" role="button" tabindex="0" aria-pressed="${n > 0 ? 'true' : 'false'}"
          data-act="pickAdd" data-name="${escAttr(s.card.name)}"
          aria-label="带入${escAttr(s.card.name)}，还可带 ${left} 张"
          title="${escAttr(s.card.name)} · 点击或拖到右侧背包带入（还可带 ${left}）">
        ${SDT.Cards.cardHTML(s.card, 'sm')}
        <span class="dep-own">仓 ×${left}</span>
        ${n > 0 ? `<b class="dep-n" title="已选带入 ${n} 张">${n}</b>` : ''}
      </div>`;
    }).join('') +
      (B.data.stash.some(s => s.card.rarity === '职业')
        ? '<p class="ov-empty" style="margin:4px 0 0">（职业卡带出后无法带入对局——留在仓库收藏或出售）</p>'
        : '');
  }

  function renderDepartPrep() {
    const B = SDT.Base;
    const m = MODES[B.data.selMode] ? B.data.selMode : 'standard';
    const slots = deploySlotsUsed();
    const full = slots >= B.bagCap();
    game.state = 'modal';
    _set_cardPageOpen(true);
    UI.registerHelp('deploy-prep', {
      title: '出征整备说明',
      html: `
        <p class="help-item"><b>携带规则</b>仓库卡牌留在左侧，点击卡面或拖到右侧背包才会带入；点击背包卡面可放大查看，拖回左侧即移除。</p>
        <p class="help-item"><b>初始攻击</b>「初始攻击」×${MAP.rules.starterSha} 默认在背包（固定携带，不可移除，不入库）。</p>
        <p class="help-item"><b>格数</b>背包格数 = 卡牌种类数 + 初始攻击；背包容量可在基地「升级」页用木材扩建。</p>`,
      back: () => renderDepartPrep(),
    });
    // 右侧背包格：第 1 格固定「初始攻击」（默认在背包、不可移除），其余按已选卡牌顺序落格；
    // 点击背包卡面 = 放大特写（2026-09-07 留言），移除靠拖回左侧卡牌区
    const pickedNames = Object.keys(deployPick).filter(k => deployPick[k] > 0);
    let bagCells = `<div class="bag-cell fixed" role="button" tabindex="0" data-act="bagZoom" data-name="${escAttr(SDT.Cards.SHA.name)}"
      aria-label="初始攻击 ×${MAP.rules.starterSha}，固定携带，点击查看详情" title="初始攻击 ×${MAP.rules.starterSha} · 默认在背包，固定携带 · 点击查看详情">
      ${SDT.Cards.cardHTML(SDT.Cards.SHA, 'sm')}<b class="dep-n on">×${MAP.rules.starterSha}</b></div>`;
    for (let i = 1; i < B.bagCap(); i++) {
      const name = pickedNames[i - 1];
      const stack = name ? B.data.stash.find(s => s.card.name === name) : null;
      bagCells += stack
         ? `<div class="bag-cell filled" draggable="true" role="button" tabindex="0" data-act="bagZoom" data-name="${escAttr(name)}"
             aria-label="${escAttr(name)} ×${deployPick[name]}，点击查看，拖回左侧移除" title="${escAttr(name)} ×${deployPick[name]} · 点击查看大卡，拖回左侧移除">
            ${SDT.Cards.cardHTML(stack.card, 'sm')}<b class="dep-n on">${deployPick[name]}</b></div>`
        : '<div class="bag-cell empty" aria-hidden="true"></div>';
    }
    // —— 宠物携带选择（需求 #4：出发界面增加选择宠物携带的功能）——
    const petStrip = B.PETS.filter(p => B.ownedPets().includes(p.id)).map(p => {
      const on = B.carriedPet() && B.carriedPet().id === p.id;
      return `<button class="pet-chip${on ? ' on' : ''}" data-act="depPet" data-id="${p.id}"
          title="${escAttr(p.desc)}（点击携带出战）">
        [[icon:${p.icon}]] <b>${esc(p.name)}</b><span class="pet-chip-lv">Lv.${B.petLevel(p.id)}</span>
      </button>`;
    }).join('');
    UI.showOverlay('', `
      <div class="pg hub" id="depMain">
        <!-- 2026-09-07 留言：右上「返回基地」叉号删掉，返回走左下「← 返回」按钮 -->
        <header class="hub-head">
          <h2>[[icon:bag]] 出征整备</h2>
          ${UI.helpBtn('deploy-prep')}
          <span class="sub">玩法【${MODES[m].name}】 · 点卡面或拖拽带入背包</span>
          <span class="pg-spacer"></span>
          <span class="hub-res">
            <span class="res-chip">[[icon:bag]] 背包 <b class="${full ? 'fulled' : ''}">${slots}/${B.bagCap()}</b> 格</span>
            <span class="res-chip" title="储备币留在基地消费，不进对局；开局只带当前模式的赠送币">[[icon:coin]] 开局 <b>${MODES[m].startCoins || 0}</b> 币</span>
          </span>
        </header>
        <div class="dep-body${deployJustOpened ? ' page-in' : ''}">
          <section class="hub-card">
            <h3>[[icon:archive]] 携带卡牌</h3>
            <div class="dep-cards" id="depPool">${deployPickRowsHTML()}</div>
          </section>
          <section class="hub-card">
            <h3>[[icon:bag]] 背包预览 <span class="set-tip">拖入卡牌即可携带</span></h3>
            ${petStrip ? `<div class="pet-strip"><span class="pet-strip-label">[[icon:paw]] 携带宠物</span>${petStrip}</div>` : ''}
            <div class="bag-grid${full ? ' full' : ''}" id="depBag">${bagCells}</div>
            ${deployHint ? `<p class="hint warn-hint">${deployHint}</p>` : ''}
            <div class="dep-foot">
              <button class="dep-back" data-act="depBack">← 返回</button>
              <button id="btnDeploy" data-act="confirmDeploy">[[icon:exit]] 确认出发</button>
            </div>
          </section>
        </div>
      </div>`, 'page');
    const addPick = (name) => {
      const B2 = SDT.Base;
      const stack = B2.data.stash.find(x => x.card.name === name);
      if (!stack) return;
      if (stack.card.rarity === '职业') {
        deployHint = '[[icon:cross]] 职业卡带出后无法带入对局——留在仓库收藏或出售。';
        renderDepartPrep();
        return;
      }
      const cur = deployPick[name] || 0;
      if (cur >= stack.count) return;
      // 局内同名叠放上限（初始攻击/火球 5，其余 3，见 game.session stackCapOf）——
      // 带 4 张会占 2 格，整备页按「种类数」预览会失真，来源上直接按局内口径封顶（2026-09-19 审计）
      const stackCap = game.stackCapOf ? game.stackCapOf(stack.card) : 3;
      if (cur >= stackCap) {
        deployHint = `[[icon:cross]] 同名卡牌最多携带 ${stackCap} 张（局内叠放上限）——想多带就分摊到不同卡牌上。`;
        renderDepartPrep();
        return;
      }
      if (cur === 0 && deploySlotsUsed() >= B2.bagCap()) {
        deployHint = `[[icon:bag]] 背包格数已满（${B2.bagCap()} 格）——先移出其他卡牌，或回基地用木材扩建背包。`;
        renderDepartPrep();
        return;
      }
      deployHint = '';
      deployPick[name] = cur + 1;
      renderDepartPrep();
    };
    const subPick = (name) => {
      const cur = deployPick[name] || 0;
      if (cur <= 0) return;
      deployPick[name] = cur - 1;
      deployHint = '';
      renderDepartPrep();
    };
    UI.act('pickAdd', (d) => addPick(d.name));
    UI.act('pickSub', (d) => subPick(d.name));
    // 需求 #4：出发时携带的宠物（即时保存，出发后生效）
    UI.act('depPet', (d) => {
      if (!SDT.Base.setPet(d.id)) return;
      Sfx.tick();
      const pet = SDT.Base.petById(d.id);
      UI.log(`[[icon:paw]] 本局携带宠物<b>「${esc(pet.name)}」</b>：${esc(pet.desc)}`, 'ok');
      renderDepartPrep();
    });
    // 背包卡面点击：放大特写；特写里保留「移出背包」兜底，拖回左侧也可移除
    UI.act('bagZoom', (d) => {
      const isSha = SDT.Cards.SHA.name === d.name;
      const n = isSha ? MAP.rules.starterSha : (deployPick[d.name] || 0);
      if (n <= 0) return;
      const stack = isSha ? { card: SDT.Cards.SHA } : B.data.stash.find(s => s.card.name === d.name);
      if (!stack) return;
      UI.showCardZoom(stack.card, {
        // 初始攻击固定携带：详情只读，不给「移出背包」按钮（2026-09-07 留言：初始攻击也要能点击详情）
        footer: isSha
          ? `<span class="dep-n on">×${n} · 初始攻击默认在背包，固定携带不可移除</span>`
          : `<button class="ov-btn" data-act="bagZoomRemove" data-name="${escAttr(d.name)}">移出背包（-1）</button>`,
      });
      UI.act('bagZoomRemove', (d2) => {
        document.getElementById('cardZoom')?.querySelector('.cz-backdrop')?.click();
        subPick(d2.name);
      });
    });
    // 拖拽：仓库卡面 → 背包格带入；背包卡面拖回仓库区移除
    const pool = document.getElementById('depPool');
    const bag = document.getElementById('depBag');
    if (pool && bag) {
      const activateOnKey = (e) => {
        const target = e.target.closest?.('[role="button"][data-act]');
        if (!target || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        target.click();
      };
      pool.addEventListener('keydown', activateOnKey);
      bag.addEventListener('keydown', activateOnKey);
      [pool, bag].forEach(el => el.addEventListener('dragstart', (e) => {
        const card = e.target.closest && e.target.closest('[data-name][draggable]');
        if (!card) return;
        e.dataTransfer.setData('text/plain', card.dataset.name);
        e.dataTransfer.effectAllowed = 'copyMove';
      }));
      bag.addEventListener('dragover', (e) => { e.preventDefault(); bag.classList.add('drop-here'); });
      bag.addEventListener('dragleave', () => bag.classList.remove('drop-here'));
      bag.addEventListener('drop', (e) => {
        e.preventDefault();
        bag.classList.remove('drop-here');
        const name = e.dataTransfer.getData('text/plain');
        if (name) addPick(name);   // addPick 内部校验仓库中是否存在
      });
      pool.addEventListener('dragover', (e) => { e.preventDefault(); });
      pool.addEventListener('drop', (e) => {
        e.preventDefault();
        const name = e.dataTransfer.getData('text/plain');
        if (name) subPick(name);
      });
    }
    UI.act('confirmDeploy', () => {
      // 先选角色，确认角色后才真正创建新局；取消选角可以无损回到整备页，
      // deployPick 仍保留在内存中，因此不会丢失刚才的带入配置。
      const picks = { ...(deployPick || {}) };
      const mode = B.data.selMode;
      requestClassChoice({
        onCancel: () => renderDepartPrep(),
        beforeConfirm: () => {
          deployPick = null;
          newRun(mode, picks, { skipClassChoice: true });
        },
      });
    });
    UI.act('depBack', () => { deployPick = null; renderHub(); });
    deployJustOpened = false;   // 首帧渲染完成，后续页内操作不再播动画
  }

  function deploySlotsUsed() {
    let n = 1;   // 「初始攻击」×5 固定占 1 格
    Object.keys(deployPick || {}).forEach(k => { if (deployPick[k] > 0) n++; });
    return n;
  }

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
  function hubShopHTML() {
    const B = SDT.Base;
    const room = B.stashRoom();
    const rows = HUB_SHOP_GOODS.map((g, i) => {
      const affordCoin = B.data.coins >= g.price;
      const roomOk = g.material ? true : room > 0;
      const afford = affordCoin && roomOk;
      const why = !affordCoin ? '储备币不足' : (roomOk ? (g.material ? '买入物资' : '买入仓库') : '仓库已满');
      const label = g.material
        ? `[[icon:${g.material === 'wood' ? 'wood' : 'bread'}]] <b>${esc(g.name)}</b><span class="dim"> · 基地物资 · ${escAttr(g.tip)}</span>`
        : (() => { const card = hubShopGoodsCard(g); return card ? `[[icon:cards]] <b>${esc(card.name)}</b><span class="dim"> · ${esc(card.type)} · ${escAttr(g.tip)}</span>` : ''; })();
      return `<div class="pk-row stash-row" title="${escAttr(g.tip)}">
          <span>${label}</span>
        <button class="mini-btn ok" data-act="shopBuy" data-i="${i}" ${afford ? '' : 'disabled'} title="${escAttr(why)}">[[icon:coin]] ${g.price} 币</button>
      </div>`;
    }).join('');
    return `
      <div class="hub-two">
        <section class="hub-card">
          <h3>[[icon:coin]] 远征补给商店</h3>
          <div class="base-line">储备 <b>${B.data.coins}</b> 币 · 仓库空格 <b>${room}</b> 格</div>
          <div class="stash-list">${rows}</div>
        </section>
        <section class="hub-card">
          <h3>[[icon:book]] 补给说明</h3>
          <p class="ov-note">买下的基础卡直接放入<b>卡牌仓库</b>；出发前在「出发」页勾选带入对局。</p>
          <p class="ov-note">[[icon:coin]] 储备币来源：仓库卖出。储备币不进局、不随对局增减，只用于基地消费。</p>
          <p class="ov-note">口粮/木材买入直接折入基地物资（升级宠物 / 扩建）。「初始攻击」每局自动携带、火球为衍生牌，均不在货架。</p>
        </section>
      </div>`;
  }

  function hubStashHTML() {
    const B = SDT.Base;
    const used = B.stashUsed(), cap = B.stashCap();
    const pkN = B.data.pocket.reduce((a, b) => a + b.count, 0);
    const collN = Object.keys(B.data.collection).length;
    const keys = B.keyCount ? B.keyCount() : 0;
    const stashRows = B.data.stash.length
      ? B.data.stash.map((s, i) => {
          const marked = B.isCollected(s.card);
          const mat = B.materialInfo ? B.materialInfo(s.card) : null;
          const meta = mat
            ? `可使用 · 每张折入${mat.label} ×${B.materialAmount(s.card)} · 不可卖币`
            : `${s.card.cost}费 · ${s.card.type}${s.card.cls ? ' · ' + esc(characterName(s.card.cls)) : ''} · 收购 ${SDT.Cards.sellPrice(s.card)} 币/张`;
          return `<button type="button" class="pk-row stash-row${marked ? ' collected' : ''}" data-act="stashItem" data-i="${i}"
              aria-label="${escAttr(s.card.name)}，${mat ? '使用材料' : '卖出或收藏'}" title="${mat ? '点击查看：使用（材料不可卖出）' : '点击查看：卖出 / 收藏'}">
            <span>[[icon:cards]] ${marked ? '[[icon:sparkles]]' : ''} <b>${esc(s.card.name)}</b>${s.count > 1 ? ` ×${s.count}` : ''}</span>
            <span class="dim">${meta}</span>
          </button>`;
        }).join('')
      : '<p class="ov-empty" style="margin:2px 0 0">（空——撤离成功后在整理界面把战利品放回这里）</p>';
    // 消耗口袋：按稀有度用钥匙复原（需求 #1/#11：古朴1/稀有2/史诗3/传说4）
    const pocketRows = B.data.pocket.length
      ? B.data.pocket.map((p, i) => {
          const cost = B.pocketKeyCost(p);
          const afford = keys >= cost;
          return `<div class="pk-row"><span>[[icon:cards]] <b>${esc(p.card.name)}</b>${p.count > 1 ? ` ×${p.count}` : ''}
              <span class="dim">· ${esc(p.card.rarity || '?')}</span></span>
            <button class="mini-btn ok" data-act="restoreCard" data-i="${i}" ${afford ? '' : 'disabled'}
              title="${afford ? '消耗钥匙复原到卡牌仓库' : '钥匙不足'}">[[icon:key]] 复原 ×${cost}</button></div>`;
        }).join('')
      : '<p class="ov-empty" style="margin:2px 0 0">（空——对战消耗的卡牌有 1/3 概率随撤离回到这里）</p>';
    return `
      <div class="hub-two">
        <section class="hub-card">
          <h3>[[icon:archive]] 卡牌仓库</h3>
          <div class="base-line">仓库容量 <b>${used}</b> / ${cap} 张 · [[icon:sparkles]] 图鉴 <b>${collN}</b></div>
          <div class="base-bar"><i style="width:${(used / cap * 100).toFixed(1)}%"></i></div>
          <div class="stash-list">${stashRows}</div>
        </section>
        <section class="hub-card">
          <h3>[[icon:pocket]] 消耗口袋 <span class="set-tip">共 ${pkN} 张</span></h3>
          <p class="ov-note" style="margin:0 0 6px">[[icon:key]] 用钥匙复原（古朴1 / 稀有2 / 史诗3 / 传说4）· <b>下一次出发后口袋清空</b></p>
          <div class="stash-list">${pocketRows}</div>
          <h3 style="margin-top:14px">[[icon:archive]] 物资</h3>
          <button type="button" class="pk-row stash-row" data-act="rawItem" data-kind="wood" aria-label="木材，基地建设材料，不可卖出" title="基地建设材料 · 不可卖出">
            <span>[[icon:wood]] <b>木材</b> ×<b>${B.data.wood}</b></span><span class="dim">背包与仓库扩建用 · 不可卖币</span>
          </button>
          <button type="button" class="pk-row stash-row" data-act="rawItem" data-kind="rations" aria-label="口粮，基地建设材料，不可卖出" title="基地建设材料 · 不可卖出">
            <span>[[icon:bread]] <b>口粮</b> ×<b>${B.data.rations}</b></span><span class="dim">宠物升级用 · 不可卖币</span>
          </button>
        </section>
      </div>
      ${hubPetsHTML()}`;
  }

  // —— 宠物栏（需求 #4：仓库界面增加宠物系统；孵化走宠物蛋弹窗）——
  function hubPetsHTML() {
    const B = SDT.Base;
    const owned = B.ownedPets();
    const sel = B.carriedPet();
    const rows = B.PETS.map(p => {
      const have = owned.includes(p.id);
      const lv = B.petLevel(p.id);
      const on = sel && sel.id === p.id;
      if (!have) {
        return `<div class="pk-row pet-row locked">
          <span>[[icon:paw]] <b>？？？</b><span class="dim">· 未孵化</span></span>
          <span class="dim">[[icon:crystal]] 宠物蛋 + 50 币孵化</span>
        </div>`;
      }
      return `<div class="pk-row pet-row${on ? ' on' : ''}">
        <span>[[icon:${p.icon}]] <b>${esc(p.name)}</b> <span class="dim">Lv.${lv}</span></span>
        <span class="pet-ops">
          ${on ? '<span class="got">[[icon:check]] 携带中</span>'
            : `<button class="mini-btn ok" data-act="selPet" data-id="${p.id}" title="携带这只宠物出战">携带</button>`}
        </span>
        <span class="dim pet-desc">${esc(p.desc.replace(/^携带效果：/, ''))}</span>
      </div>`;
    }).join('');
    const hasEgg = B.data.stash.some(s => s.card.id === B.PET_EGG_ID);
    return `
      <section class="hub-card" style="margin-top:14px">
        <h3>[[icon:paw]] 宠物 <span class="set-tip">${owned.length} / ${B.PETS.length} 只 · 携带 1 只出战</span></h3>
        <p class="ov-note" style="margin:0 0 6px">初始宠物「汪汪狗」自动获得；其余只能用<b>宠物蛋</b>（宝箱 0.7% 起掉落：每开箱未出 +3%、每打赢一场战斗再 +0.2%）+ 50 币在仓库孵化。宠物在「升级」页用口粮升级，携带不同宠物保护格数量不同。</p>
        <div class="stash-list">${rows}</div>
        ${hasEgg ? '<p class="hint ok-hint">[[icon:crystal]] 仓库里有宠物蛋——点击它进行孵化！</p>' : ''}
      </section>`;
  }

  // 仓库物品弹窗：卡面预览 + 使用（材料卡 / 宠物蛋） / 卖出 / 收藏
  function openStashItem(i) {
    const B = SDT.Base;
    const s = B.data.stash[i];
    if (!s) { renderHub(); return; }
    // 宠物蛋（需求 #2）：仓库中点击孵化——消耗 1 张宠物蛋 + 50 币，随机孵出未拥有的宠物
    if (s.card.id === B.PET_EGG_ID) {
      const unowned = B.PETS.filter(p => !B.ownedPets().includes(p.id));
      const poor = B.data.coins < B.HATCH_COST;
      game.state = 'modal';
      _set_cardPageOpen(false);
      UI.showOverlay('[[icon:crystal]] 宠物蛋', `
        <div class="stash-pop-card">${SDT.Cards.cardHTML(s.card, 'sm')}</div>
        <p class="ov-stats">×${s.count} 张 · 孵化消耗：宠物蛋 ×1 + <b class="gold">50 币</b>（储备 ${B.data.coins}）</p>
        <p class="ov-note">[[icon:paw]] 孵化将随机获得 1 只<b>未拥有</b>的宠物${unowned.length ? `（还差 ${unowned.length} 只集齐）` : ''}。${unowned.length ? '' : '已集齐全部宠物，蛋可以留着收藏。'}</p>
        <div class="ov-btns">
          <button class="ov-btn ok" data-act="hatchEgg" ${!unowned.length || poor ? 'disabled' : ''}>[[icon:paw]] 孵化（-1 蛋 -50 币）</button>
        </div>
        <div class="ov-btns"><button class="ov-btn" data-act="stashBack">↩ 返回仓库</button></div>`);
      UI.act('hatchEgg', () => {
        const r = B.hatchPet();
        if (r.ok) {
          Sfx.ding();
          UI.log(`[[icon:paw]] 孵化成功！获得宠物<b>「${esc(r.pet.name)}」</b>——${esc(r.pet.desc)}（可在仓库页携带 / 升级页升级）`, 'loot');
          SDT.Meta.checkUnlocks();
        } else if (r.why === 'poor') UI.log('[[icon:coin]] 储备币不足 50，无法孵化（卖出仓库卡牌攒币）', 'warn');
        else if (r.why === 'all') UI.log('[[icon:paw]] 已经集齐全部宠物了', 'dim');
        else UI.log('[[icon:crystal]] 仓库里没有宠物蛋了', 'warn');
        renderHub();
      });
      UI.act('stashBack', () => renderHub());
      return;
    }
    // 材料卡（木材/口粮/钥匙）：只能使用折入真实物资，不可卖出换币（2026-09-08 定版）
    const mat = B.materialInfo ? B.materialInfo(s.card) : null;
    if (mat) {
      const per = B.materialAmount(s.card);
      game.state = 'modal';
      _set_cardPageOpen(false);   // 弹窗层级：只能通过按钮返回仓库（Esc 不关闭）
      UI.showOverlay('[[icon:archive]] 仓库材料', `
        <div class="stash-pop-card">${SDT.Cards.cardHTML(s.card, 'sm')}</div>
        <p class="ov-stats">×${s.count} 张 · 每张折入<b class="gold">${mat.label} ×${per}</b></p>
        <p class="ov-note">[[icon:wood]] 材料可直接使用变成真正的${mat.label}；材料是基地的根基，<b>不可卖出换币</b>。</p>
        <div class="ov-btns">
          <button class="ov-btn ok" data-act="matUseOne">[[icon:check]] 使用 1 张</button>
          <button class="ov-btn ok" data-act="matUseAll" ${s.count < 2 ? 'disabled' : ''}>[[icon:check]] 全部使用（×${s.count}）</button>
        </div>
        <div class="ov-btns"><button class="ov-btn" data-act="stashBack">↩ 返回仓库</button></div>`);
      const useOne = () => {
        const r = B.useStashMaterial(s.card.name, false);
        if (r.ok) { Sfx.ding(); UI.log(r.msg, 'loot'); }
        renderHub();
      };
      const useAll = () => {
        const r = B.useStashMaterial(s.card.name, true);
        if (r.ok) { Sfx.ding(); UI.log(r.msg, 'loot'); }
        renderHub();
      };
      const confirmMaterial = (message, run) => {
        UI.showOverlay('[[icon:question]] 确认使用', `<p class="ov-note">${message}</p><div class="ov-btns">
          <button class="ov-btn" data-act="matConfirmCancel">保留，返回仓库</button>
          <button class="ov-btn danger" data-act="matConfirmOk">确认使用</button>
        </div>`, 'glass', { initialFocus: '[data-act="matConfirmCancel"]' });
        UI.act('matConfirmCancel', () => openStashItem(i));
        UI.act('matConfirmOk', run);
      };
      UI.act('matUseOne', () => {
        if (s.count === 1) { confirmMaterial(`这是仓库里的最后一张${mat.label}卡，使用后卡牌将消失。`, useOne); return; }
        useOne();
      });
      UI.act('matUseAll', () => {
        confirmMaterial(`使用全部 ${s.count} 张${mat.label}卡，卡牌将从仓库移除并折入基地物资。`, useAll);
      });
      UI.act('stashBack', () => renderHub());
      return;
    }
    const marked = B.isCollected(s.card);
    const price = SDT.Cards.sellPrice(s.card);
    const special = isSpecialCollect(s.card);
    const confirmStashAction = (message, run) => {
      UI.showOverlay('[[icon:question]] 确认操作', `
        <p class="ov-note">${message}</p>
        <div class="ov-btns">
          <button class="ov-btn" data-act="stashConfirmCancel">保留，返回仓库</button>
          <button class="ov-btn danger" data-act="stashConfirmOk">确认操作</button>
        </div>`, 'glass', { initialFocus: '[data-act="stashConfirmCancel"]' });
      UI.act('stashConfirmCancel', () => openStashItem(i));
      UI.act('stashConfirmOk', () => run());
    };
    // 职业收藏室（2026-09-16 Item 15 定版）：收藏即用掉（从仓库移除），每次收藏都转化熟练度经验；
    // 收藏进度（data.collection）只在首次登记。旧「同一张只计一次/卡牌保留」口径作废。
    const convertType = !!s.card.cls && (s.card.rarity === '职业' || s.card.type === '能力卡');
    const convertible = convertType && !marked;
    game.state = 'modal';
    _set_cardPageOpen(false);   // 弹窗层级：只能通过按钮返回仓库（Esc 不关闭）
    UI.showOverlay(marked ? '[[icon:sparkles]] 已收藏' : '[[icon:archive]] 仓库物品', `
      <div class="stash-pop-card">${SDT.Cards.cardHTML(s.card, 'sm')}</div>
      <p class="ov-stats">×${s.count} 张 · 收购价 <b class="gold">${price} 币</b>/张
        ${s.count > 1 ? `（全部卖出 +${price * s.count} 币）` : ''}</p>
      ${special ? '<p class="ov-note">[[icon:sparkles]] <b>特殊收藏品</b>——收藏后可完成对应成就，且收藏期间不可卖出。</p>' : ''}
      ${marked && !convertType ? '<p class="ov-note">[[icon:sparkles]] 收藏中的物品受保护：取消收藏后才能卖出（图鉴记录会保留）。</p>' : ''}
      ${convertible ? `<p class="ov-note">[[icon:medal]] <b>职业收藏室</b>：收藏即用掉这张卡（从仓库移除、不再占格），转化为对应人物的熟练度经验——<b>重复收藏重复获得经验</b>（同一张卡只有首次收藏推进收藏进度）。</p>` : ''}
      <div class="ov-btns">
        ${s.card.id === 'tt-econpack' ? `<button class="ov-btn ok" data-act="econpackUse">[[icon:cards]] 使用（获得 5 张随机卡牌）</button>` : ''}
        ${convertible
          ? `<button class="ov-btn ok" data-act="collCollectOne">[[icon:medal]] 收藏 1 张（+${s.card.type === '能力卡' ? 50 : 10} 经验 · 卡牌用掉）</button>${s.count > 1 ? `<button class="ov-btn" data-act="collCollectAll">全部收藏（×${s.count}）</button>` : ''}`
          : `<button class="ov-btn${marked ? '' : ' ok'}" data-act="collToggle">${marked ? '[[icon:sparkles]] 取消收藏' : '[[icon:sparkles]] 收藏'}</button>`}
        <button class="ov-btn${marked ? ' ok' : ''}" data-act="sellOne" ${marked ? 'disabled' : ''}>[[icon:coin]] 卖出 1 张（+${price}）</button>
      </div>
      <div class="ov-btns">
        <button class="ov-btn" data-act="sellAll" ${marked || s.count < 2 ? 'disabled' : ''}>[[icon:coin]] 全部卖出（+${price * s.count} 币）</button>
        <button class="ov-btn" data-act="stashBack">↩ 返回仓库</button>
      </div>`);
    const useEconPack = () => {
      // 经济卡包（2026-09-09 审计补实装）：仓库界面点击使用，获得 5 张随机卡牌。
      // 只在基地仓库可用（局内不可用是定版）；局外没有对局，拆包所得必须入卡牌仓库——
      // 塞进对局背包（game.ownedCards）会在下次开局被清空，卡就白丢了（2026-09-19 审计 P1-4）
      if (s.card.id !== 'tt-econpack') return;
      if (B.stashRoom() < 5) { UI.log(`[[icon:archive]] 仓库空位不足 5 格（现 ${B.stashRoom()}）——先卖出或扩建仓库再拆包`, 'warn'); return; }
      const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c));
      if (!pool.length) { UI.log('[[icon:cards]] 卡牌库是空的，没有可获得的卡牌', 'warn'); return; }
      const cards = [];
      for (let k = 0; k < 5; k++) {
        cards.push({ card: { ...pool[Math.floor(Random.random('loot') * pool.length)] }, count: 1 });
      }
      const si = B.data.stash.indexOf(s);
      if (si >= 0) { s.count--; if (s.count <= 0) B.data.stash.splice(si, 1); }
      B.depositCards(cards);
      B.save();
      UI.log(`[[icon:cards]] <b>经济卡包</b>：拆开获得 5 张随机卡牌（入卡牌仓库）`, 'loot');
      renderHub();
    };
    UI.act('econpackUse', () => {
      if (s.card.id !== 'tt-econpack') return;
      if (s.count === 1) { confirmStashAction('这是仓库里的最后一个经济卡包，拆开后卡包将消失。', useEconPack); return; }
      useEconPack();
    });
    const collectOne = () => {
      // 2026-09-16 定版（Item 15）：职业卡/能力卡收藏即用掉——重复收藏重复获得经验，进度只记首次
      const first = !B.isCollected(s.card);
      if (first) B.collectToggle(s.card);   // 仅首次登记收藏进度
      SDT.Meta.onCollect(s.card, true);     // 每次收藏都结算经验
      const si = B.data.stash.indexOf(s);
      if (si >= 0) { s.count--; if (s.count <= 0) B.data.stash.splice(si, 1); }
      B.save();
      SDT.Meta.checkUnlocks();
      Sfx.ding();
      UI.log(`[[icon:medal]] 已收藏【<b>${esc(s.card.name)}</b>】并转化为人物经验（卡牌用掉，不再占格${first ? '，收藏进度 +1' : ''}）`, 'loot');
      renderHub();
    };
    UI.act('collCollectOne', () => {
      if (!convertType) return;
      confirmStashAction(`收藏【${esc(s.card.name)}】会消耗 1 张卡并转化为人物熟练度经验。`, collectOne);
    });
    const collectAll = () => {
      if (!convertType) return;
      const n = s.count;
      for (let k = 0; k < n; k++) {
        const first = k === 0 && !B.isCollected(s.card);
        if (first) B.collectToggle(s.card);
        SDT.Meta.onCollect(s.card, true);
      }
      const si = B.data.stash.indexOf(s);
      if (si >= 0) B.data.stash.splice(si, 1);
      B.save();
      SDT.Meta.checkUnlocks();
      Sfx.ding();
      UI.log(`[[icon:medal]] 已收藏【<b>${esc(s.card.name)}</b>】×${n}，全部转化为人物经验（卡牌用掉）`, 'loot');
      renderHub();
    };
    UI.act('collCollectAll', () => {
      if (!convertType) return;
      confirmStashAction(`收藏【${esc(s.card.name)}】×${s.count} 会消耗整堆卡牌，并转化为人物熟练度经验。`, collectAll);
    });
    UI.act('collToggle', () => {
      const now = B.collectToggle(s.card);
      Sfx.ding();
      // 经验结算必须最先：checkUnlocks → syncCollXp 会把已收藏的职业卡回填为
      // 「已结算」，若先于 onCollect 执行，首次收藏的 +10 就被吃掉了
      SDT.Meta.onCollect(s.card, now);
      // 2026-09-10 留言 #39 定版：收藏只记录 + 转化经验，卡牌保留在仓库——
      // 此前整堆从仓库删除（玩家感受等同卖出）。重复收藏入口已被收藏记录挡住，经验不重复发放。
      UI.log(now
        ? `[[icon:sparkles]] 已收藏【<b>${esc(s.card.name)}</b>】入职业收藏室，转化为人物熟练度经验（卡牌保留在仓库）${isSpecialCollect(s.card) ? '（特殊收藏品）' : ''}`
        : `[[icon:sparkles]] 已取消收藏【<b>${esc(s.card.name)}</b>】`, now ? 'loot' : 'dim');
      SDT.Meta.checkUnlocks();
      renderHub();
    });
    const sellOne = () => {
      const r = B.sellStashCards(s.card.name, 1);
      if (r.ok) { Sfx.ding(); UI.log(r.msg, 'coin'); }
      renderHub();
    };
    UI.act('sellOne', () => {
      if (price >= 5 || s.count === 1) {
        confirmStashAction(`卖出【${esc(s.card.name)}】将获得 ${price} 币${s.count === 1 ? '，这也是仓库里的最后一张' : ''}。`, sellOne);
        return;
      }
      sellOne();
    });
    const sellAll = () => {
      const r = B.sellStashCards(s.card.name, s.count);
      if (r.ok) { Sfx.ding(); UI.log(r.msg, 'coin'); }
      renderHub();
    };
    UI.act('sellAll', () => {
      if (price >= 5 || s.count === 1) {
        confirmStashAction(`卖出【${esc(s.card.name)}】整堆（×${s.count}）将获得 ${price * s.count} 币，操作不可撤回。`, sellAll);
        return;
      }
      sellAll();
    });
    UI.act('stashBack', () => renderHub());
  }

  // 基地物资（木材/口粮）：材料不可卖出换币（2026-09-08 定版）——只作展示说明
  function openRawItem(kind) {
    const B = SDT.Base;
    const item = kind === 'wood' ? MAP.items.wood : MAP.items.rations;
    const have = B.data[kind];
    game.state = 'modal';
    _set_cardPageOpen(false);   // 弹窗层级：只能通过按钮返回仓库
    UI.showOverlay(`[[icon:archive]] ${item.name}`, `
      <p class="ov-stats">储备 <b>${have}</b> 个</p>
      <p class="ov-note">${kind === 'wood' ? '木材用于扩建背包与仓库容量' : '口粮用于升级宠物安全格'}——材料是基地建设的根基，<b>不可卖出换币</b>。</p>
      <div class="ov-btns"><button class="ov-btn" data-act="stashBack2">↩ 返回仓库</button></div>`);
    UI.act('stashBack2', () => renderHub());
  }

  // —— 升级页：背包扩建 + 仓库扩建 + 宠物升级（保险升级改为宠物升级，需求 #2/#14）——
  function hubUpgradeHTML() {
    const B = SDT.Base;
    const R = MAP.rules;
    const owned = B.ownedPets();
    const sel = B.carriedPet();
    // 宠物升级：每只宠物独立进度，口粮递增 2-3-4-5，上限 Lv.5；
    // 携带中的宠物决定保护格数量（小企鹅咕嘎 +2：4-8 格）
    const petRows = B.PETS.map(p => {
      const have = owned.includes(p.id);
      if (!have) {
        return `<div class="pk-row pet-row locked"><span>[[icon:paw]] <b>？？？</b><span class="dim">· 未孵化（宠物蛋 + 50 币，仓库页）</span></span><span class="dim">Lv.? / ${B.PET_LEVEL_MAX}</span></div>`;
      }
      const lv = B.petLevel(p.id);
      const maxed = lv >= B.PET_LEVEL_MAX;
      const cost = B.petUpCost(p.id);
      const on = sel && sel.id === p.id;
      return `<div class="pk-row pet-row${on ? ' on' : ''}">
        <span>[[icon:${p.icon}]] <b>${esc(p.name)}</b>${on ? ' <span class="got">[[icon:check]] 携带中</span>' : ''}
          <span class="dim pet-desc">${esc(p.desc.replace(/^携带效果：/, ''))}</span></span>
        <span class="pet-ops">
          <span class="dim">Lv.${lv}${maxed ? ' · MAX' : ` → ${lv + 1}`}</span>
          <button class="mini-btn ok" data-act="upPet" data-id="${p.id}" ${maxed || B.data.rations < cost ? 'disabled' : ''}
            title="${maxed ? '已满级' : `消耗口粮 ×${cost} 升级`}">${maxed ? '已满级' : `[[icon:bread]] ×${cost} 升级`}</button>
        </span>
      </div>`;
    }).join('');
    return `
      <div class="hub-two">
        <section class="hub-card">
          <h3>[[icon:bag]] 背包扩建</h3>
          <div class="base-line">背包容量 <b>${B.bagCap()}</b> / ${R.bagMax} 格</div>
          <div class="base-bar"><i style="width:${(B.bagCap() / R.bagMax * 100).toFixed(1)}%"></i></div>
          <button class="ov-btn ok" data-act="upBag" ${B.canUpgradeBag() ? '' : 'disabled'}>[[icon:wood]] ×${R.bagUpgradeWood} 扩建 +1 格</button>
          ${B.bagCap() >= R.bagMax ? '<p class="hint ok-hint">[[icon:check]] 已达上限</p>' : ''}
        </section>
        <section class="hub-card">
          <h3>[[icon:archive]] 仓库扩建</h3>
          <div class="base-line">仓库容量 <b>${B.stashCap()}</b> / ${R.stashMax} 张</div>
          <div class="base-bar"><i style="width:${(B.stashCap() / R.stashMax * 100).toFixed(1)}%"></i></div>
          <button class="ov-btn ok" data-act="upStash" ${B.canUpgradeStash() ? '' : 'disabled'}>[[icon:wood]] ×${R.stashUpgradeWood} 扩建 +${R.stashUpgradeSlots} 张</button>
          ${B.stashCap() >= R.stashMax ? '<p class="hint ok-hint">[[icon:check]] 已达上限</p>' : ''}
        </section>
      </div>
      <section class="hub-card" style="margin-top:14px">
        <h3>[[icon:paw]] 宠物升级 <span class="set-tip">口粮 ${B.PET_UP_COSTS.join('-')} · 携带中的宠物决定保护格 <b>${B.safeCap()}</b> 格</span></h3>
        <p class="ov-note" style="margin:0 0 6px">每只宠物的升级进度相互独立（Lv.1 起每级 +1 保护格）；携带不同宠物，保护格数量不同——小企鹅咕嘎可到 4-8 格。在仓库页切换携带的宠物。</p>
        <div class="stash-list">${petRows}</div>
      </section>`;
  }

  // —— 人物页：各人物熟练度等级 ——
  function hubClassesHTML() {
    const rows = SDT.Meta.classSummary().map(c => `
      <div class="ach-row${c.lv > 1 || c.xp > 0 ? ' done' : ''}">
        <div class="cls-hub-art">${SDT.Art.classArt(c.cls)}</div>
        <div class="ach-info">
          <b>${esc(characterName(c.cls))} <span style="color:#e0a458;font-size:12px">Lv.${c.lv}${c.maxed ? ' · MAX' : ''}</span></b>
          <span>熟练加成：${SDT.Meta.perkText(c.lv)}（出征时生效） · 人物卡 ${c.pool} 张</span>
          <div class="xp-bar"><i style="width:${c.maxed ? 100 : (c.xp / c.need * 100).toFixed(1)}%"></i></div>
          <div class="xp-txt">${c.maxed ? '已满级' : `经验 ${c.xp} / ${c.need}`}</div>
        </div>
      </div>`).join('');
    return `
      <section class="hub-card">
        <h3>[[icon:medal]] 人物熟练度</h3>
        <div class="ach-list">${rows}</div>
      </section>`;
  }

  // —— 职业收藏室（2026-09-09：成就系统 → 成就与职业收藏室系统）——
  // 仓库中收藏的职业卡与能力卡陈列于此；进度只计不同的职业卡 + 能力卡，
  // 达成 5/15/30/45/全收集里程碑可各领一次奖励（见 meta.js COLL_MILESTONES）。
  function collRoomHTML() {
    const M = SDT.Meta, B = SDT.Base;
    const total = M.collTotal();
    const prog = M.collProgress();
    const pct = total ? Math.min(100, prog / total * 100) : 0;
    const msRows = M.COLL_MILESTONES.map(m => {
      const need = M.collMsNeed(m);
      const reached = M.collMsReached(m);
      const claimed = M.isCollClaimed(m.id);
      return `<div class="coll-ms${claimed ? ' done' : reached ? ' reach' : ''}">
        <b>收藏 ${need} 张</b>
        <span class="rw">${M.collRewardText(m)}</span>
        ${claimed ? '<span class="got">[[icon:check]] 已领取</span>'
          : reached ? `<button class="mini-btn ok" data-act="claimColl" data-id="${m.id}">领取</button>`
          : `<span class="dim">${prog} / ${need}</span>`}
      </div>`;
    }).join('');
    const groups = SDT.Cards.CLASSES.map(cls => {
      const pool = M.collectPool().filter(c => c.cls === cls);
      const gotN = pool.filter(c => B.isCollected(c)).length;
      const slots = pool.map(c => B.isCollected(c)
        ? `<button class="coll-slot on" data-act="collZoom" data-id="${escAttr(c.id)}"
             title="${escAttr(c.name)} · 已收藏 · 点击查看">${SDT.Cards.cardHTML(c, 'sm')}</button>`
        : '<div class="coll-slot off" title="尚未收藏"><span>？</span></div>').join('');
      return `<div class="coll-group">
        <div class="coll-group-head"><b>${esc(characterName(cls))}</b>
          <span class="dim">${gotN} / ${pool.length} 张 · 收藏职业卡 +10 经验 · 能力卡 +50 经验</span></div>
        <div class="coll-cards">${slots}</div>
      </div>`;
    }).join('');
    return `
      <section class="hub-card coll-room">
        <h3>[[icon:sparkles]] 职业收藏室 <span class="set-tip">收藏进度 ${prog} / ${total}</span></h3>
        <p class="ov-note" style="margin:0 0 8px">收藏的职业卡与能力卡会陈列在这里。收藏即用掉这张卡（从仓库移除、不再占格），转化为对应人物熟练度经验——职业卡 <b>+10</b> 点、能力卡 <b>+50</b> 点，<b>重复收藏重复获得经验</b>（同一张卡只有首次收藏推进收藏进度）。收藏<b>不同</b>的职业卡与能力卡推进进度，阶段目标各有一次奖励。</p>
        <div class="base-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div class="coll-ms-list">${msRows}</div>
        ${groups}
      </section>`;
  }

  // —— 成就页 ——（2026-09-09：升级为「成就与职业收藏室」——卡背图鉴 + 成就 + 职业收藏室）
  function hubAchHTML() {
    const M = SDT.Meta, B = SDT.Base;
    const doneN = M.ACHIEVEMENTS.filter(a => M.isUnlocked(a)).length;
    const rows = M.ACHIEVEMENTS.map(a => {
      const unlocked = M.isUnlocked(a), claimed = M.isClaimed(a.id);
      let rw = [a.reward.wood ? `[[icon:wood]] ×${a.reward.wood}` : '', a.reward.rations ? `[[icon:bread]] ×${a.reward.rations}` : '']
        .filter(Boolean).join(' ');
      if (a.back) {
        const bd = (SDT.Cards.CARD_BACKS || []).find(b => b.id === a.back);
        if (bd) rw += (rw ? ' ' : '') + `[[icon:cards]] ${bd.name}`;
      }
      return `
      <div class="ach-row${unlocked ? ' done' : ''}">
        <div class="ach-ico">${a.icon}</div>
        <div class="ach-info"><b>${a.name}</b><span>${a.desc}</span></div>
        <div class="ach-ops">${
          claimed ? '<span class="got">[[icon:check]] 已领取</span>'
          : unlocked ? `<div class="rw">奖励：${rw}</div><button class="mini-btn ok" data-act="claimAch" data-id="${a.id}" style="margin-top:4px">领取</button>`
          : `<span class="rw" style="opacity:.55">奖励：${rw}</span>`
        }</div>
      </div>`;
    }).join('');
    // 卡背图鉴：默认卡背恒可用，其余随成就领取解锁（每档存档独立）
    const equipped = B.backSel();
    const backsHTML = (SDT.Cards.CARD_BACKS || []).map(b => {
      const unlocked = B.isBackUnlocked(b.id);
      const on = equipped === b.id;
      return `<button class="back-card${on ? ' on' : ''}${unlocked ? '' : ' locked'}"
          data-act="selBack" data-id="${b.id}" title="${unlocked ? (on ? '当前卡背' : '点击装备') : '未解锁 · ' + b.from}">
        <span class="back-thumb">${SDT.Cards.cardBackHTML(b.id)}</span>
        <b>${b.name}</b>
        <span class="dim">${unlocked ? (on ? '[[icon:check]] 使用中' : '点击装备') : '[[icon:lock]] ' + b.from}</span>
      </button>`;
    }).join('');
    return `
      <section class="hub-card">
        <h3>[[icon:cards]] 卡背图鉴</h3>
        <div class="back-grid">${backsHTML}</div>
      </section>
      <section class="hub-card">
        <h3>[[icon:trophy]] 成就 <span class="set-tip">${doneN} / ${M.ACHIEVEMENTS.length} 已解锁</span></h3>
        <div class="ach-list">${rows}</div>
      </section>
      ${collRoomHTML()}`;
  }

  function closeBase() {
    _set_cardPageOpen(false);
    UI.hideOverlay();
    showTitle();   // 基地只在局外（标题/撤离结算后）可达，关闭即回主菜单
  }

  // ---------- 背包（物资+卡牌混占格 · 安全格 · 消耗口袋） ----------
  // 设计者 2026-09-02 定版：从背包丢弃的牌无法取回；消耗的牌可在火堆复原

export { closeBase, deployPick, openBaseHub, renderHub };
configureCardNavigation({
  closeBase,
  renderHub,
  resetDeployPick: () => { deployPick = null; },
});
