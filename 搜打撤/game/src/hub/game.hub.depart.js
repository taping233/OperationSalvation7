/* 由 game.hub.js 拆出（2026-09-22 六文件重构批3）：出发页与出征整备流
 * （hubDeployHTML / openDepartPrep / renderDepartPrep / deploySlotsUsed + deployPick 暂存态）。
 * 逐字搬迁；renderHub 回调经 game.hub.bridge.js 的 slots 间接调用，本文件不 import 壳。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';
import { MAP } from '../run/game.session.js';
import { escAttr } from '../core/shared.js';
import { MODES, game, newRun, requestClassChoice } from '../run/game.session.js';
import { Sfx, _set_cardPageOpen } from './game.cardslib.js';
import { slots as hubBridge } from './game.hub.bridge.js';   // 别名防局部 slots（槽位数）遮蔽——实机 depBack 曾因此 TypeError
import { turboMs } from '../core/turbo.js';
import { bindDepartureFilters, updateDepartureView } from './departure.view-updates.js';
  // —— 出发页：选择玩法 + 出征预报 + 宝藏大门 ——
  function hubDeployHTML() {
    const B = SDT.Base;
    const curMode = MODES[B.data.selMode] ? B.data.selMode : 'standard';
    const m = MODES[curMode];
    const keys = B.keyCount ? B.keyCount() : 0;
    const gateReady = keys >= (B.KEY_NEEDED || 10);
    return `
      <div class="deploy-brief">
        <section class="deploy-mission">
          <div class="deploy-mission-shade"></div>
          <div class="deploy-mission-art" aria-hidden="true"></div>
          <div class="deploy-mission-copy">
            <span class="eyebrow">WINTER EXPEDITION / OUTSKIRTS</span>
            <h3>[[icon:flag]] 远征准备</h3>
            <p class="deploy-mission-lead">选择行动模式，再准备本次携带的物资。</p>
            <div class="deploy-mission-target"><span>本局目标</span><b>${esc(m.name)}</b><small>${esc(m.ckpt)}</small></div>
            <button id="btnDeploy" class="deploy-primary" data-act="deploy">[[icon:exit]] 出发整备 <span>→</span></button>
            ${SDT.Base.data.nestUnlocked ? `<button id="btnNest" class="deploy-primary" data-act="nestDeploy" style="margin-top:10px"
              title="第二地图：深入经典生命研究所，夺取符文与样本">[[icon:skull]] 研究所远征 <span>→</span></button>` : ''}
            <!-- W2-02：锁态「经典生命研究所（钥匙 0/10）」不再占主列行动位——未解锁时收敛到右栏 MISSION BRIEF 末行 -->
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
      </div>
      ${gateReady ? `<section class="hub-card gate-strip gate-ready" data-act="gateInfo" role="button" tabindex="0"
        title="钥匙已集齐——宝藏大门虚位以待">
        <div class="gate-ico">${SDT.Art.gateIcon(gateReady)}</div>
        <div class="gate-txt">
          <b>宝藏大门</b>
          <span>[[icon:key]] 钥匙 <b class="gate-ok">${keys}/${B.KEY_NEEDED || 10}</b> ·
            钥匙已集齐——特殊关卡制作中，敬请期待</span>
        </div>
        <span class="gate-state">[[icon:sparkles]]</span>
        <span class="gate-scale" aria-hidden="true">${Array.from({ length: B.KEY_NEEDED || 10 }, () => `<i class="lit all"></i>`).join('')}</span>
      </section>` : ''}
      <!-- W2-02：锁态宝藏大门横条不再渲染（原 1600 首屏外/1280 裁切）——钥匙进度收敛到右栏 05 行+顶部资源条徽章 -->`;
  }

  // ---------- 出征整备（点击「出发」后）：选择从仓库携带的卡牌 ----------
  // 带入背包的卡牌才能在战斗中使用；「初始攻击」固定携带、不入库也不会出现在这里。
  let deployPick = null;    // 卡名 => 携带张数（出发准备页的暂存选择）
  // ESM 导入绑定不可赋值：壳侧重置改经 setter（2026-09-22 拆分理顺点）
  let deployPickFresh = false;   // 整备入口刚注入过预设选择（随后打开整备页时保留）
  function setDeployPick(v) { deployPick = v; deployPickFresh = true; }
  let deployHint = '';      // 页内提示（容量不足等）
  let deployFilters = { rarity: '', type: '', cost: '' }; // 筛选只属于本次整备，不写存档。
  let deployJustOpened = false;   // 出发准备页刚打开（只播一次入场动画）

  function openDepartPrep() {
    game.state = 'modal';
    deployHint = '';
    deployFilters = { rarity: '', type: '', cost: '' };
    // 预设应用链路（applyPicks → openDeparture）刚注入的选择必须保留：
    // 此前无条件清空，应用预设后确认出发只携带初始攻击（09-30 深审 ROOT-01）
    if (!deployPickFresh) deployPick = {};
    deployPickFresh = false;
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
        <div class="dep-card-face">${SDT.Cards.cardHTML(s.card, 'sm')}</div>
        <div class="dep-quantity"><span>剩余 <b class="dep-own">${left}</b></span><span>已带 <b class="dep-picked-count">${n}</b></span></div>
      </div>`;
    }).join('') +
      (B.data.stash.some(s => s.card.rarity === '职业')
        ? '<p class="ov-empty" style="margin:4px 0 0">（职业卡带出后无法带入对局——留在仓库收藏或出售）</p>'
        : '');
  }

  function renderDepartPrep() {
    const B = SDT.Base;
    const slots = deploySlotsUsed();
    const full = slots >= B.bagCap();
    game.state = 'modal';
    _set_cardPageOpen(true);
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
            ${SDT.Cards.cardHTML(stack.card, 'sm')}<b class="dep-n on">×${deployPick[name]}</b></div>`
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
    const capacityHtml = `[[icon:bag]] 已装 <b>${slots}/${B.bagCap()}</b> 格${full ? ' · 背包已满' : ` · 余 ${B.bagCap() - slots} 格`}`;
    const currentStage = document.getElementById('depMain');
    if (!deployJustOpened && currentStage?.dataset.departureView === 'cover-v3'
      && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing')) {
      updateDepartureView(currentStage, {
        stash: B.data.stash, picks: deployPick, bagHtml: bagCells,
        slots, capacity: B.bagCap(), capacityHtml, hint: deployHint,
        petId: B.carriedPet()?.id || '', rich: html => SDT.Icons.rich(html),
      });
      return;
    }
    UI.showOverlay('', `
      <div class="pg hub departure-cover" id="depMain" data-departure-view="cover-v3">
        <!-- W1-03：返回件统一为左上 ak-back-tl 方钮（原底中「← 返回」与确认出发并排是全站五种返回制式之一） -->
        <button class="ak-sq ak-exit ak-back-tl" data-act="depBack" title="返回基地（Esc）" aria-label="返回">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9"
                  fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M4 12h10M4 12l4-4M4 12l4 4"
                  fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <header class="hub-head">
          <span class="pg-spacer"></span>
          <span class="hub-res">
            <span class="res-chip">[[icon:bag]] 背包 <b data-dep-slots class="${full ? 'fulled' : ''}">${slots}/${B.bagCap()}</b> 格</span>
          </span>
        </header>
        <div class="dep-body${deployJustOpened ? ' page-in' : ''}">
          <section class="hub-card dep-storage">
            <h3>仓库卡牌 <span class="set-tip">点击或拖拽带入</span></h3>
            <div class="dep-filters">
              <label>稀有度<select id="depFilterRarity" aria-label="按稀有度筛选仓库卡牌"></select></label>
              <label>类型<select id="depFilterType" aria-label="按类型筛选仓库卡牌"></select></label>
              <label>费用<select id="depFilterCost" aria-label="按费用筛选仓库卡牌"></select></label>
              <span id="depFilterCount" aria-live="polite"></span>
              <button type="button" id="depFilterReset" aria-label="重置仓库筛选">重置</button>
            </div>
            <div class="dep-cards" id="depPool">${deployPickRowsHTML()}<p class="dep-no-results" id="depNoResults" hidden>没有匹配的卡牌</p></div>
          </section>
          <section class="hub-card dep-pack">
            <h3>背包</h3>
            ${petStrip ? `<div class="pet-strip"><span class="pet-strip-label">[[icon:paw]] 携带宠物</span>${petStrip}</div>` : ''}
            <div class="bag-grid${full ? ' full' : ''}" id="depBag">${bagCells}</div>
          </section>
        </div>
        <p class="dep-status" id="depStatus" role="status"${deployHint ? '' : ' hidden'}>${deployHint}</p>
        <footer class="dep-foot">
          <span class="dep-capacity" id="depCapacity">${capacityHtml}</span>
          <button id="btnDeploy" data-act="confirmDeploy">[[icon:exit]] 确认出发</button>
        </footer>
      </div>`, 'page');
    bindDepartureFilters(document.getElementById('depMain'), B.data.stash, {
      filters: deployFilters, rarities: SDT.Cards.RARITIES, types: SDT.Cards.TYPES,
      rarityOf: card => SDT.Cards.rarityOf(card),
      onFiltersChange: filters => { deployFilters = filters; },
    });
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
      // 同名每格叠放上限（初始攻击/火球 5，其余 3，见 game.session stackCapOf；局内第 cap+1 张起另占一格）——
      // 整备来源上按此封顶（2026-09-19 审计）；预设路径的超限多占格已改由 previewDeployment 分段计入（A3-PREP-02）
      const stackCap = game.stackCapOf ? game.stackCapOf(stack.card) : 3;
      if (cur >= stackCap) {
        deployHint = `[[icon:cross]] 整备同名卡牌最多携带 ${stackCap} 张（每格叠放上限，局内超出会另占一格，这里不提供）——想多带就分摊到不同卡牌上。`;
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
      if (!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
        // 高报告率鼠标合帧（同 game.bag.drag.js onBagDragMove F2 口径）：pointermove 只采样
        // 事件与坐标，closest 命中测试 / getBoundingClientRect / CSS 变量写入每显示帧一次
        // ——此前逐事件读写交替（125-1000Hz 设备上每秒数百次强制布局失效）
        let depSpotFrame = 0;
        let depSpotEvent = null;
        pool.addEventListener('pointermove', (e) => {
          depSpotEvent = e;
          if (depSpotFrame) return;
          depSpotFrame = requestAnimationFrame(() => {
            depSpotFrame = 0;
            const ev = depSpotEvent;
            depSpotEvent = null;
            if (!ev || !pool.isConnected) return;
            const card = ev.target.closest?.('.dep-card:not(.picked):not(.drained)');
            if (!card || !pool.contains(card)) return;
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--dep-spot-x', `${ev.clientX - rect.left}px`);
            card.style.setProperty('--dep-spot-y', `${ev.clientY - rect.top}px`);
          });
        });
      }
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
      // 09-25 二波美术：拖动卡池卡牌时，空背包格挂金框呼吸提示（.dep-target-hint），
      // 拖拽结束（无论落入与否）统一切走
      const setTargetHint = (on) => {
        bag.querySelectorAll('.bag-cell.empty').forEach(c => c.classList.toggle('dep-target-hint', on));
      };
      pool.addEventListener('dragstart', () => setTargetHint(true));
      [pool, bag].forEach(el => el.addEventListener('dragend', () => setTargetHint(false)));
      bag.addEventListener('drop', () => setTargetHint(false));
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
      SDT.Sound.sfx('prepReady');
      // 先选角色，确认角色后才真正创建新局；取消选角可以无损回到整备页，
      // deployPick 仍保留在内存中，因此不会丢失刚才的带入配置。
      const picks = { ...(deployPick || {}) };
      const mode = B.data.selMode;
      const startChoice = () => {
        requestClassChoice({
          onCancel: () => renderDepartPrep(),
          beforeConfirm: () => {
            const started = newRun(mode, picks, { skipClassChoice: true });
            if (started === false) {
              deployHint = '[[icon:cross]] 基地出征整备未保存，请重试；当前没有开始新局。';
              renderDepartPrep();
              return false;
            }
            deployPick = null;
            SDT.Sound.sfx('deployStart');
            return true;
          },
        });
      };
      // 09-25 二波美术：出发=沿「可撕封条线」撕开整备页转场（transform/opacity only）；
      // reduced-motion 直接跳过演出
      const stage = document.getElementById('depMain');
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (stage && !reduce) {
        stage.classList.add('dep-tearing');
        setTimeout(startChoice, turboMs(520));
      } else startChoice();
    });
    UI.act('depBack', () => { deployPick = null; hubBridge.renderHub(); });
    deployJustOpened = false;   // 首帧渲染完成，后续页内操作不再播动画
  }

  function deploySlotsUsed() {
    let n = 1;   // 「初始攻击」×5 固定占 1 格
    Object.keys(deployPick || {}).forEach(k => { if (deployPick[k] > 0) n++; });
    return n;
  }

  // —— 仓库页：卡牌仓库（容量 / 卖出 / 收藏）+ 消耗口袋 + 物资 ——

export { hubDeployHTML, openDepartPrep, deployPick, setDeployPick };
