/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from './shared.js';
import { MAP } from './game.core.js';
import { escAttr } from './shared.js';
import { MODES, game, newRun, setLobby, showTitle } from './game.core.js';
import { Sfx, _set_cardPageOpen } from './game.cardslib.js';

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
    const pending = M.pendingAch().length;
    // 页签切换时才播放入场动画（页内操作重渲染不闪）
    const tabChanged = renderHub._lastTab !== hubTab;
    renderHub._lastTab = hubTab;
    // v0.22 图标页签：大图标为主 + 小字注记（仓库=木房子）
    const TABS = [
      { id: 'deploy', icon: 'flag', name: '出发' },
      { id: 'stash', icon: 'home', name: '仓库' },
      { id: 'upgrade', icon: 'tools', name: '升级' },
      { id: 'classes', icon: 'medal', name: '职业' },
      { id: 'ach', icon: 'trophy', name: '成就' },
    ];
    const body = hubTab === 'deploy' ? hubDeployHTML()
      : hubTab === 'stash' ? hubStashHTML()
      : hubTab === 'upgrade' ? hubUpgradeHTML()
      : hubTab === 'classes' ? hubClassesHTML()
      : hubAchHTML();
    registerHubHelp(hubTab);
    UI.showOverlay('', `
      <div class="pg hub hub-${hubTab}" id="hubMain">
        <button class="pg-close" data-act="closeBase" title="关闭（Esc）">[[icon:cross]]</button>
        <header class="hub-head hub-head-min">
          ${UI.helpBtn('hub-' + hubTab)}
          <span class="pg-spacer"></span>
          <span class="hub-res">
            <span class="res-chip">[[icon:wood]] 木材 <b>${B.data.wood}</b></span>
            <span class="res-chip">[[icon:bread]] 口粮 <b>${B.data.rations}</b></span>
            <span class="res-chip" title="卖出仓库物品所得 · 出发时随身带走">[[icon:coin]] 储备 <b>${B.data.coins}</b> 币</span>
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
    UI.act('hubTab', (d) => { hubTab = d.tab; renderHub(); });
    UI.act('selMode', (d) => { B.data.selMode = d.mode; B.save(); renderHub(); });
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
    UI.act('upSafe', () => {
      if (!B.upgradeSafe()) return;
      Sfx.ding();
      UI.log(`[[icon:paw]] 阿七升级：安全格 <b>${B.safeCap()}</b> 格（- [[icon:bread]]×${MAP.rules.safeUpgradeRations}）`, 'ok');
      SDT.Meta.checkUnlocks();
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
      const r = B.restore(+d.i);
      if (r === true) { Sfx.ding(); UI.log('[[icon:check]] 卡牌已复原，回到卡牌仓库', 'ok'); }
      else if (r === 'sha') UI.log('[[icon:cards]] 初始牌「初始攻击」无需入库——每局自动携带，已直接消耗', 'dim');
      else if (r === 'full') UI.log(`[[icon:archive]] 仓库容量不足（${B.stashUsed()}/${B.stashCap()} 张），先卖出或升级仓库`, 'warn');
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
    UI.act('closeBase', closeBase);
  }

  // —— 基地各页签的 ? 帮助主题（说明文字统一收进二级界面，不在页面直铺） ——
  function registerHubHelp(tab) {
    const R = MAP.rules;
    const T = {
      deploy: { title: '出发说明', items: [
        ['玩法选择', '出发后会随机空降到外圈入口，并从全部职业中自由选择 1 个本局职业（熟练度提供常驻加成）。'],
        ['出征预报', '点击「出发」后会打开出征整备：选择要从仓库携带的卡牌——只有带上的卡才能在战斗中使用。撤离成功后也会出现整理界面，让你把背包战利品放回仓库。'],
        ['宝藏大门', '在棋盘的钥匙格收集钥匙，集齐 ' + (SDT.Base.KEY_NEEDED || 10) + ' 把可开启特殊关卡（关卡制作中）。'],
      ] },
      stash: { title: '仓库说明', items: [
        ['卡牌仓库', '点击物品可卖出换储备币，或收藏进图鉴（传说卡与桌游珍宝是特殊收藏品，收藏后完成对应成就，收藏期间不可卖出）。出发时自选携带。'],
        ['消耗口袋', '对战小怪用过的卡会随撤离回到这里，复原后回仓库。'],
        ['物资', '点击木材/口粮可卖出换储备币（卖出后不可买回）：木材用于背包与仓库扩建，口粮用于安全格升级。储备币会在下次出发时随身带走。'],
      ] },
      upgrade: { title: '升级说明', items: [
        ['背包扩建', '每消耗木材 ×' + R.bagUpgradeWood + ' 扩建 1 格，上限 ' + R.bagMax + ' 格。'],
        ['仓库扩建', '每消耗木材 ×' + R.stashUpgradeWood + ' 扩建 ' + R.stashUpgradeSlots + ' 张容量，上限 ' + R.stashMax + ' 张。'],
        ['宠物小屋', '宠物「阿七」看守着背包的安全格——撤离失败时，它会把安全格里的卡牌抢运回基地。每消耗口粮 ×' + R.safeUpgradeRations + ' 升级 1 格，上限 ' + R.safeMax + ' 格。'],
      ] },
      classes: { title: '职业说明', items: [
        ['熟练度', '每局出发时从全部角色中自由选择 1 个；击败敌人、撤离成功都会累积所选角色的熟练度经验，升级获得常驻加成（下一局出征生效）。'],
      ] },
      ach: { title: '成就与卡背', items: [
        ['卡背图鉴', '牌库堆 / 背包翻面使用的卡背；领取对应成就奖励解锁，点击即可装备。'],
        ['成就', '达成条件后自动解锁（页内显示奖励内容），回基地点击「领取」获得物资与卡背奖励。'],
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
    return `
      <div class="deploy-grid">
        <section class="hub-card">
          <h3>[[icon:swords]] 选择玩法</h3>
          <div class="mode-list">${Object.values(MODES).map(md => `
            <button class="mode-card${md.id === curMode ? ' on' : ''}" data-act="selMode" data-mode="${md.id}">
              <span class="mode-ico">${md.icon}</span>
              <span class="mode-info"><b>${md.name}</b><span>${md.desc}</span></span>
              <span class="mode-ckpt">${md.ckpt}</span>
            </button>`).join('')}
          </div>
        </section>
        <section class="hub-card">
          <h3>[[icon:notes]] 出征预报</h3>
          <div class="deploy-forecast" style="margin:0 0 4px">
            <span class="fc-chip">[[icon:heart]] 生命 <b>${MAP.rules.playerMaxHp}</b></span>
            <span class="fc-chip">[[icon:swords]] 攻击 <b>${MAP.rules.playerAtk}</b></span>
            <span class="fc-chip">[[icon:coin]] 开局币 <b>${(m.startCoins || 0) + B.data.coins}</b></span>
            <span class="fc-chip">[[icon:dice]] 骰子 <b>${MAP.rules.diceSides} 面</b></span>
            <span class="fc-chip">[[icon:bag]] 背包 <b>${B.bagCap()} 格</b></span>
            <span class="fc-chip">[[icon:lock]] 安全格 <b>${B.safeCap()} 格</b></span>
            <span class="fc-chip">[[icon:archive]] 仓库 <b>${B.stashUsed()}/${B.stashCap()} 张</b></span>
          </div>
          <div class="deploy-foot">
            <button id="btnDeploy" data-act="deploy">出 发</button>
          </div>
        </section>
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
    // 预选：尽量全带（同名堆叠占 1 格背包，「初始攻击」已固定占 1 格）
    let slots = 1;
    B.data.stash.forEach(s => {
      if (slots >= B.bagCap()) return;
      deployPick[s.card.name] = s.count;
      slots++;
    });
    renderDepartPrep();
  }

  function deployPickRowsHTML() {
    const B = SDT.Base;
    if (!B.data.stash.length) {
      return '<p class="ov-empty" style="margin:6px 0 0">仓库里还没有卡牌——撤离成功后在整理界面把战利品放回仓库，下次出征就能带上了。</p>';
    }
    return B.data.stash.map(s => {
      const n = deployPick[s.card.name] || 0;
      return `<div class="pk-row dep-row">
        <span class="dep-name">[[icon:cards]] <b>${esc(s.card.name)}</b>${s.count > 1 ? ` <span class="dim">仓 ${s.count}</span>` : ''}</span>
        <span class="dep-stepper">
          <button class="step-btn" data-act="pickSub" data-name="${escAttr(s.card.name)}" ${n <= 0 ? 'disabled' : ''}>−</button>
          <b class="dep-n${n > 0 ? ' on' : ''}">${n}</b>
          <button class="step-btn" data-act="pickAdd" data-name="${escAttr(s.card.name)}" ${n >= s.count ? 'disabled' : ''}>＋</button>
        </span>
      </div>`;
    }).join('');
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
        <p class="help-item"><b>携带规则</b>只有从这里带入背包的仓库卡牌才能在战斗中使用；同名堆叠只占 1 格。</p>
        <p class="help-item"><b>初始攻击</b>「初始攻击」×${MAP.rules.starterSha} 每局固定携带，不入库也不出现在上方列表。</p>
        <p class="help-item"><b>格数</b>背包格数 = 卡牌种类数 + 初始攻击；背包容量可在基地「升级」页用木材扩建。</p>`,
      back: () => renderDepartPrep(),
    });
    UI.showOverlay('', `
      <div class="pg hub" id="depMain">
        <button class="pg-close" data-act="depBack" title="返回基地（Esc）">[[icon:cross]]</button>
        <header class="hub-head">
          <h2>[[icon:bag]] 出征整备</h2>
          ${UI.helpBtn('deploy-prep')}
          <span class="sub">玩法【${MODES[m].name}】 · 选择要从仓库带入背包的卡牌</span>
          <span class="pg-spacer"></span>
          <span class="hub-res">
            <span class="res-chip">[[icon:bag]] 背包 <b class="${full ? 'fulled' : ''}">${slots}/${B.bagCap()}</b> 格</span>
            <span class="res-chip">[[icon:coin]] 携带 <b>${B.data.coins}</b> 币</span>
          </span>
        </header>
        <div class="dep-body${deployJustOpened ? ' page-in' : ''}">
          <section class="hub-card">
            <h3>[[icon:archive]] 仓库卡牌</h3>
            <div class="dep-list">${deployPickRowsHTML()}</div>
          </section>
          <section class="hub-card">
            <h3>[[icon:bag]] 背包预览</h3>
            <div class="pk-row"><span>[[icon:cards]] <b>初始攻击</b> <span class="dim">×${MAP.rules.starterSha} · 固定携带（不可入库）</span></span></div>
            ${Object.keys(deployPick).filter(k => deployPick[k] > 0).map(k =>
              `<div class="pk-row"><span>[[icon:cards]] <b>${esc(k)}</b> <span class="dim">×${deployPick[k]}</span></span></div>`).join('')}
            ${deployHint ? `<p class="hint warn-hint">${deployHint}</p>` : ''}
            <div class="dep-foot">
              <button class="dep-back" data-act="depBack">← 返回</button>
              <button id="btnDeploy" data-act="confirmDeploy">[[icon:exit]] 确认出发</button>
            </div>
          </section>
        </div>
      </div>`, 'page');
    UI.act('pickAdd', (d) => {
      const B2 = SDT.Base;
      const stack = B2.data.stash.find(x => x.card.name === d.name);
      if (!stack) return;
      const cur = deployPick[d.name] || 0;
      if (cur >= stack.count) return;
      if (cur === 0 && deploySlotsUsed() >= B2.bagCap()) {
        deployHint = `[[icon:bag]] 背包格数已满（${B2.bagCap()} 格）——先减少其他卡牌，或回基地用木材扩建背包。`;
        renderDepartPrep();
        return;
      }
      deployHint = '';
      deployPick[d.name] = cur + 1;
      renderDepartPrep();
    });
    UI.act('pickSub', (d) => {
      const cur = deployPick[d.name] || 0;
      if (cur <= 0) return;
      deployPick[d.name] = cur - 1;
      deployHint = '';
      renderDepartPrep();
    });
    UI.act('confirmDeploy', () => {
      const picks = deployPick;
      deployPick = null;
      UI.hideOverlay();
      _set_cardPageOpen(false);
      newRun(B.data.selMode, picks);
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

  function hubStashHTML() {
    const B = SDT.Base;
    const used = B.stashUsed(), cap = B.stashCap();
    const pkN = B.data.pocket.reduce((a, b) => a + b.count, 0);
    const collN = Object.keys(B.data.collection).length;
    const stashRows = B.data.stash.length
      ? B.data.stash.map((s, i) => {
          const marked = B.isCollected(s.card);
          const price = SDT.Cards.sellPrice(s.card);
          return `<div class="pk-row stash-row${marked ? ' collected' : ''}" data-act="stashItem" data-i="${i}"
              title="点击查看：卖出 / 收藏">
            <span>[[icon:cards]] ${marked ? '[[icon:sparkles]]' : ''} <b>${esc(s.card.name)}</b>${s.count > 1 ? ` ×${s.count}` : ''}</span>
            <span class="dim">${s.card.cost}费 · ${s.card.type}${s.card.cls ? ' · ' + esc(s.card.cls) : ''} · 收购 ${price} 币/张</span>
          </div>`;
        }).join('')
      : '<p class="ov-empty" style="margin:2px 0 0">（空——撤离成功后在整理界面把战利品放回这里）</p>';
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
          <div class="stash-list">${B.data.pocket.length
            ? B.data.pocket.map((p, i) => `
              <div class="pk-row"><span>[[icon:cards]] <b>${esc(p.card.name)}</b>${p.count > 1 ? ` ×${p.count}` : ''}</span>
              <button class="mini-btn ok" data-act="restoreCard" data-i="${i}">[[icon:check]] 复原</button></div>`).join('')
            : '<p class="ov-empty" style="margin:2px 0 0">（空——对战小怪用过的卡会随撤离回到这里）</p>'}</div>
          <h3 style="margin-top:14px">[[icon:archive]] 物资</h3>
          <div class="pk-row stash-row" data-act="rawItem" data-kind="wood" title="点击查看：卖出">
            <span>[[icon:wood]] <b>木材</b> ×<b>${B.data.wood}</b></span><span class="dim">收购 ${MAP.items.wood.value} 币/个 · 背包扩建用</span>
          </div>
          <div class="pk-row stash-row" data-act="rawItem" data-kind="rations" title="点击查看：卖出">
            <span>[[icon:bread]] <b>口粮</b> ×<b>${B.data.rations}</b></span><span class="dim">收购 ${MAP.items.rations.value} 币/个 · 安全格升级用</span>
          </div>
        </section>
      </div>`;
  }

  // 仓库物品弹窗：卡面预览 + 卖出 / 收藏
  function openStashItem(i) {
    const B = SDT.Base;
    const s = B.data.stash[i];
    if (!s) { renderHub(); return; }
    const marked = B.isCollected(s.card);
    const price = SDT.Cards.sellPrice(s.card);
    const special = isSpecialCollect(s.card);
    game.state = 'modal';
    _set_cardPageOpen(false);   // 弹窗层级：只能通过按钮返回仓库（Esc 不关闭）
    UI.showOverlay(marked ? '[[icon:sparkles]] 已收藏' : '[[icon:archive]] 仓库物品', `
      <div class="stash-pop-card">${SDT.Cards.cardHTML(s.card, 'sm')}</div>
      <p class="ov-stats">×${s.count} 张 · 收购价 <b class="gold">${price} 币</b>/张
        ${s.count > 1 ? `（全部卖出 +${price * s.count} 币）` : ''}</p>
      ${special ? '<p class="ov-note">[[icon:sparkles]] <b>特殊收藏品</b>——收藏后可完成对应成就，且收藏期间不可卖出。</p>' : ''}
      ${marked ? '<p class="ov-note">[[icon:sparkles]] 收藏中的物品受保护：取消收藏后才能卖出（图鉴记录会保留）。</p>' : ''}
      <div class="ov-btns">
        <button class="ov-btn${marked ? '' : ' ok'}" data-act="collToggle">${marked ? '[[icon:sparkles]] 取消收藏' : '[[icon:sparkles]] 收藏'}</button>
        <button class="ov-btn${marked ? ' ok' : ''}" data-act="sellOne" ${marked ? 'disabled' : ''}>[[icon:coin]] 卖出 1 张（+${price}）</button>
      </div>
      <div class="ov-btns">
        <button class="ov-btn" data-act="sellAll" ${marked || s.count < 2 ? 'disabled' : ''}>[[icon:coin]] 全部卖出（+${price * s.count}）</button>
        <button class="ov-btn" data-act="stashBack">↩ 返回仓库</button>
      </div>`);
    UI.act('collToggle', () => {
      const now = B.collectToggle(s.card);
      SDT.Meta.checkUnlocks();
      Sfx.ding();
      UI.log(now
        ? `[[icon:sparkles]] 已收藏【<b>${esc(s.card.name)}</b>】进入图鉴${isSpecialCollect(s.card) ? '（特殊收藏品）' : ''}`
        : `[[icon:sparkles]] 已取消收藏【<b>${esc(s.card.name)}</b>】`, now ? 'loot' : 'dim');
      renderHub();
    });
    UI.act('sellOne', () => {
      const r = B.sellStashCards(s.card.name, 1);
      if (r.ok) { Sfx.ding(); UI.log(r.msg, 'coin'); }
      renderHub();
    });
    UI.act('sellAll', () => {
      const r = B.sellStashCards(s.card.name, s.count);
      if (r.ok) { Sfx.ding(); UI.log(r.msg, 'coin'); }
      renderHub();
    });
    UI.act('stashBack', () => renderHub());
  }

  // 基地物资（木材/口粮）卖出弹窗
  function openRawItem(kind) {
    const B = SDT.Base;
    const item = kind === 'wood' ? MAP.items.wood : MAP.items.rations;
    const have = B.data[kind];
    game.state = 'modal';
    _set_cardPageOpen(false);   // 弹窗层级：只能通过按钮返回仓库
    UI.showOverlay(`[[icon:archive]] ${item.name}`, `
      <p class="ov-stats">储备 <b>${have}</b> 个 · 收购价 <b class="gold">${item.value} 币</b>/个</p>
      <p class="ov-note">${kind === 'wood' ? '木材用于扩建背包与仓库容量' : '口粮用于升级宠物安全格'}——卖出后不可买回，确定吗？</p>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="rawSellOne" ${have < 1 ? 'disabled' : ''}>[[icon:coin]] 卖出 1 个（+${item.value}）</button>
        <button class="ov-btn" data-act="rawSellAll" ${have < 2 ? 'disabled' : ''}>[[icon:coin]] 全部卖出（+${item.value * have}）</button>
      </div>
      <div class="ov-btns"><button class="ov-btn" data-act="stashBack2">↩ 返回仓库</button></div>`);
    UI.act('rawSellOne', () => {
      const r = B.sellRaw(kind, false);
      if (r.ok) { Sfx.ding(); UI.log(r.msg, 'coin'); }
      renderHub();
    });
    UI.act('rawSellAll', () => {
      const r = B.sellRaw(kind, true);
      if (r.ok) { Sfx.ding(); UI.log(r.msg, 'coin'); }
      renderHub();
    });
    UI.act('stashBack2', () => renderHub());
  }

  // —— 升级页：背包扩建 + 仓库扩建 + 宠物安全格 ——
  function hubUpgradeHTML() {
    const B = SDT.Base;
    const R = MAP.rules;
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
        <section class="hub-card">
          <h3>[[icon:paw]] 宠物小屋</h3>
          <div class="pet-row"><span class="pet-ava">[[icon:paw]]</span>
            <div>宠物<b>「阿七」</b>看守着背包的安全格</div></div>
          <div class="base-line">安全格 <b>${B.safeCap()}</b> / ${R.safeMax} 格</div>
          <div class="base-bar green"><i style="width:${(B.safeCap() / R.safeMax * 100).toFixed(1)}%"></i></div>
          <button class="ov-btn ok" data-act="upSafe" ${B.canUpgradeSafe() ? '' : 'disabled'}>[[icon:bread]] ×${R.safeUpgradeRations} 升级 +1 安全格</button>
          ${B.safeCap() >= R.safeMax ? '<p class="hint ok-hint">[[icon:check]] 已达上限</p>' : ''}
        </section>
      </div>`;
  }

  // —— 职业页：各职业熟练度等级 ——
  function hubClassesHTML() {
    const rows = SDT.Meta.classSummary().map(c => `
      <div class="ach-row${c.lv > 1 || c.xp > 0 ? ' done' : ''}">
        <div class="cls-hub-art">${SDT.Art.classArt(c.cls)}</div>
        <div class="ach-info">
          <b>${esc(c.cls)} <span style="color:#e0a458;font-size:12px">Lv.${c.lv}${c.maxed ? ' · MAX' : ''}</span></b>
          <span>熟练加成：${SDT.Meta.perkText(c.lv)}（出征时生效） · 职业卡 ${c.pool} 张</span>
          <div class="xp-bar"><i style="width:${c.maxed ? 100 : (c.xp / c.need * 100).toFixed(1)}%"></i></div>
          <div class="xp-txt">${c.maxed ? '已满级' : `经验 ${c.xp} / ${c.need}`}</div>
        </div>
      </div>`).join('');
    return `
      <section class="hub-card">
        <h3>[[icon:medal]] 职业熟练度</h3>
        <div class="ach-list">${rows}</div>
      </section>`;
  }

  // —— 成就页 ——（v0.21：顶部新增卡背图鉴，卡背由成就领取解锁）
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
      </section>`;
  }

  function closeBase() {
    _set_cardPageOpen(false);
    UI.hideOverlay();
    showTitle();   // 基地只在局外（标题/撤离结算后）可达，关闭即回主菜单
  }

  // ---------- 背包（物资+卡牌混占格 · 安全格 · 消耗口袋） ----------
  // 设计者 2026-09-02 定版：从背包丢弃的牌无法取回；消耗的牌可在火堆复原

export { closeBase, deployPick, openBaseHub, renderHub };
const _set_deployPick = (v) => { deployPick = v; };
export { _set_deployPick };
