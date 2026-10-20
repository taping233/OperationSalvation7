/* 由 game.hub.js 拆出（2026-09-22 六文件重构批3）：出发页与出征整备流
 * （hubDeployHTML / openDepartPrep / renderDepartPrep / deploySlotsUsed + deployPick 暂存态）。
 * renderHub 回调经 game.hub.bridge.js 的 slots 间接调用，本文件不 import 壳。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { characterFor, characterName } from '../core/characters.js';
import { esc } from '../core/shared.js';
import { MAP } from '../run/game.session.js';
import { escAttr } from '../core/shared.js';
import { MODES, game, newRun, requestClassChoice } from '../run/game.session.js';
import { Sfx, _set_cardPageOpen } from './game.cardslib.js';
import { slots as hubBridge } from './game.hub.bridge.js';   // 别名防局部 slots（槽位数）遮蔽——实机 depBack 曾因此 TypeError
import { bindDepartureFilters, updateDepartureView } from './departure.view-updates.js';
import { departureSummary, previewRecommendedDeparture } from './departure.summary.js';
import { baseHomeV3HTML } from './hub.home-v3.js';
import { enterDepartureCut, startDepartureHandoff } from '../ui/departure-transition.js';
import '../../css/departure-selected.css';
import { bindDepartureDrag } from './departure.drag.js';
import { departureStackKey, findDepartureStack } from './base-departure.commands.js';
import { deployPick, replaceDeployPick } from './departure.selection-state.js';
import { stackCapOf } from '../core/card-capacity.js';
import '../../css/roster-reference.css';
const departureFaces = new WeakMap();
const recommendationViews = new WeakMap();
function renderDepartureCard(card) {
  let signature;
  try { signature = JSON.stringify(card); }
  catch { return SDT.Cards.cardHTML({ ...card }, 'sm'); }
  let face = departureFaces.get(card);
  if (!face || face.signature !== signature) {
    face = { signature, card:{ ...card } };
    departureFaces.set(card, face);
  }
  return SDT.Cards.cardHTML(face.card, 'sm');
}
  // 基地首页：房间入口、行动难度与出征整备。
  function hubDeployHTML() {
    const B = SDT.Base;
    const prepared = !!(deployCharacter && deploymentSlot === B.slot);
    return baseHomeV3HTML({ base:B, meta:SDT.Meta, modes:MODES,
      mode:MODES[B.data.selMode] ? B.data.selMode : 'standard', prepared,
      character:characterFor(prepared ? deployCharacter : 'wu'),
      picks:Object.values(deployPick || {}).reduce((sum, count) => sum + count, 0) });
  }

  // ---------- 出征整备：先选择人物，再选择从仓库携带的卡牌 ----------
  // 带入背包的卡牌才能在战斗中使用；「初始攻击」固定携带、不入库也不会出现在这里。
  // 共享选择引用归纯状态模块；本页仍负责规范化和完整整备生命周期。
  let deployPickFresh = false;   // 整备入口刚注入过预设选择（随后打开整备页时保留）
  async function setDeployPick(v, { characterId = null, petId = null } = {}, isCurrent = () => true) {
    const character = characterId ? characterFor(characterId) : null;
    if (characterId && !character) return false;
    const base = SDT.Base, slot = base.slot, generation = ++departureGeneration;
    if (petId && !await base.setPet(petId)) return false;
    if (SDT.Base !== base || base.slot !== slot || generation !== departureGeneration || !isCurrent()) return false;
    replaceDeployPick(v == null ? null : Object.fromEntries(Object.entries(v).map(([key, count]) => {
      const stack = findDepartureStack(SDT.Base.data.stash, key);
      return [stack ? departureStackKey(stack) : key, count];
    })));
    deployPickFresh = true; deploymentSlot = SDT.Base.slot; deployCharacter = character?.rulesetId || null; deployStart = null;
    return true;
  }
  let deployCharacter = null;
  let deployStart = null;
  let deploymentSlot = null;
  let deploySubmitting = false;
  let deployHint = '';      // 页内提示（容量不足等）
  let deployRecommendation = null, deployUndo = null;
  let deployFilters = { rarity: '', type: '', cost: '' }; // 筛选只属于本次整备，不写存档。
  let departureGeneration = 0;
  let departureEntry = null;
  let deployJustOpened = false;   // 出发准备页刚打开（只播一次入场动画）

  function openDepartPrep({ chooseAgain = false } = {}) {
    if (departureEntry?.slot === SDT.Base.slot && departureEntry.current() && !departureEntry.picked) return departureEntry.promise;
    if (!chooseAgain && deploymentSlot === SDT.Base.slot && deployCharacter && deployStart && deployPick) {
      deploySubmitting = false;
      deployJustOpened = true; renderDepartPrep();
      enterDepartureCut(document.getElementById('depMain'));
      return;
    }
    const generation = ++departureGeneration;
    const slot = SDT.Base.slot;
    const current = () => departureGeneration === generation && SDT.Base.slot === slot && deploymentSlot === slot;
    if (deploymentSlot !== SDT.Base.slot) {
      deploymentSlot = SDT.Base.slot;
      replaceDeployPick(null); deployCharacter = null; deployStart = null; deployPickFresh = false;
    }
    deploySubmitting = false;
    game.state = 'modal';
    deployHint = '';
    deployRecommendation = null; deployUndo = null;
    if (deployPickFresh || !deployPick) deployFilters = { rarity: '', type: '', cost: '' };
    // 预设应用链路（applyPicks → openDeparture）刚注入的选择必须保留：
    // 此前无条件清空，应用预设后确认出发只携带初始攻击（09-30 深审 ROOT-01）
    if (!deployPick) replaceDeployPick({});
    deployPickFresh = false;
    deployJustOpened = true;   // 页面初次打开时播放入场动画
    // 2026-09-07 留言：仓库卡牌不再自动塞进背包——全部留在左侧，由玩家自己拖
    let entry;
    const choice = requestClassChoice({
      onPresented: () => { if (current()) enterDepartureCut(document.querySelector('#overlay .cls2-page')); },
      isCurrent: current,
      isConfirmationCurrent: () => current() && !!document.getElementById('depMain') && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing'),
      initialCharacter: deployCharacter,
      onCancel: () => { if (current()) hubBridge.renderHub(); },
      onSelect: (cl, start) => {
        if (!current()) return;
        if (entry) entry.picked = true;
        deployCharacter = cl;
        deployStart = start;
        renderDepartPrep();
        enterDepartureCut(document.getElementById('depMain'));
      },
      beforeConfirm: async () => {
        const stage = document.getElementById('depMain');
        if (!current() || !deployStart || !stage || UI.el.overlay.hidden || UI.el.overlay.classList.contains('closing')) return false;
        if (Object.entries(deployPick || {}).some(([key, count]) => count > 0 && (!findDepartureStack(SDT.Base.data.stash, key) || findDepartureStack(SDT.Base.data.stash, key).count < count))) {
          deploySubmitting = false;
          deployHint = '[[icon:cross]] 仓库库存或卡堆身份已变化，请重新检查携带选择后出发。';
          deployJustOpened = true; renderDepartPrep();
          return false;
        }
        const mode = SDT.Base.data.selMode;
        const picks = { ...(deployPick || {}) };
        const started = await newRun(mode, picks, { skipClassChoice: true,
          isCurrent: () => current() && stage.isConnected && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing'),
        });
        if (!current() || !stage.isConnected) return false;
        if (started !== false && !SDT.Base.data.ammoTaught) {
          const taught = await SDT.Base.markAmmoTaught?.();
          if (!current() || !stage.isConnected) return false;
          if (taught === false) UI.log('教学记录未保存，远征已保留；下次进入时可重试。', 'warn');
        }
        if (started === false) {
          deploySubmitting = false;
          document.getElementById('depMain')?.classList.remove('dep-tearing');
          const button = document.querySelector('#depMain [data-act="confirmDeploy"]');
          if (button) button.disabled = false;
          deployHint = '[[icon:cross]] 出征存档尚未完成，携带选择已保留；请重试或返回选档继续恢复。';
          renderDepartPrep();
          return false;
        }
        replaceDeployPick(null);
        deployStart = null;
        SDT.Sound.sfx('deployStart');
        return true;
      },
    });
    entry = { slot, current, picked:false, promise: null };
    departureEntry = entry;
    entry.promise = Promise.resolve(choice).then(opened => {
      if (opened === false || !current()) return false;
      return true;
    }).finally(() => { if (departureEntry === entry) departureEntry = null; });
    return entry.promise;
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
      const key = departureStackKey(s);
      const n = deployPick[key] || 0;
      const left = Math.max(0, s.count - n);
      return `<div class="dep-card${n > 0 ? ' picked' : ''}${left <= 0 ? ' drained' : ''}" draggable="true" role="button" tabindex="0" aria-pressed="${n > 0 ? 'true' : 'false'}"
          data-act="pickAdd" data-name="${escAttr(s.card.name)}" data-stack-key="${escAttr(key)}"
          aria-label="带入${escAttr(s.card.name)}，还可带 ${left} 张"
          title="${escAttr(s.card.name)} · 还可带 ${left}">
        <div class="dep-card-face">${renderDepartureCard(s.card)}</div>
        <div class="dep-quantity"><span>剩余 <b class="dep-own">${left}</b></span><span>已带 <b class="dep-picked-count">${n}</b></span></div>
      </div>`;
    }).join('') +
      (B.data.stash.some(s => s.card.rarity === '职业')
        ? '<p class="ov-empty" style="margin:4px 0 0">（职业卡不能带入对局——可在仓库归档培养或出售）</p>'
        : '');
  }

  function renderDepartPrep() {
    const B = SDT.Base;
    const preview = departurePreview();
    const slots = preview.slots;
    const full = slots >= preview.capacity;
    game.state = 'modal';
    _set_cardPageOpen(true);
    const renderCell = cell => {
      if (!cell) return '<div class="bag-cell empty" aria-hidden="true"></div>';
      const { card, count, fixed, stackKey } = cell;
      return `<div class="bag-cell ${fixed ? 'fixed' : 'filled'}" ${fixed ? '' : 'draggable="true"'} role="button" tabindex="0" data-act="bagZoom" data-name="${escAttr(card.name)}"${stackKey ? ` data-stack-key="${escAttr(stackKey)}"` : ''}
        aria-label="${escAttr(card.name)} ×${count}，${fixed ? '含固定初始牌' : '点击查看，拖回仓库移除'}" title="${escAttr(card.name)} ×${count}">
        ${renderDepartureCard(card)}<b class="dep-n on">×${count}</b></div>`;
    };
    // —— 宠物携带选择（需求 #4：出发界面增加选择宠物携带的功能）——
    const petStrip = B.PETS.filter(p => B.ownedPets().includes(p.id)).map(p => {
      const on = B.carriedPet() && B.carriedPet().id === p.id;
      return `<button class="pet-chip${on ? ' on' : ''}" data-act="depPet" data-id="${p.id}"
          title="${escAttr(p.desc)}">
        [[icon:${p.icon}]] <b>${esc(p.name)}</b><span class="pet-chip-lv">Lv.${B.petLevel(p.id)}</span>
      </button>`;
    }).join('');
    const capacityHtml = `[[icon:bag]] 已装 <b>${slots}/${preview.capacity}</b> 格${full ? ' · 背包已满' : ` · 余 ${preview.capacity - slots} 格`}`;
    const summaryHtml = `<b>${esc(MODES[B.data.selMode]?.name || '标准模式')}</b> · ${esc(preview.starter.name)} ×${preview.starterCount} · 额外 ${preview.extraCount} 张<br>入城随机获得最多 2 张不同职业卡，实际占格届时计入<br>${B.carriedPet() ? esc(B.carriedPet().desc) : '无宠物加成'}${B.safeCap ? ` · 安全格 ${B.safeCap()} 格` : ''}${preview.resourceBonus ? ` · 珍珠盒额外 ${preview.resourceBonus} 格仅放资源卡` : ''}`;
    const currentStage = document.getElementById('depMain');
    if (!deployJustOpened && currentStage?.dataset.departureView === 'cover-v3'
      && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing')) {
      const updated = updateDepartureView(currentStage, {
        stash: B.data.stash, picks: deployPick, cells:preview.cells, renderCell, renderCard:renderDepartureCard,
        slots, capacity: preview.capacity, capacityHtml, hint: deployHint,
        summaryHtml, petId: B.carriedPet()?.id || '', rich: html => SDT.Icons.rich(html),
      });
      if (updated !== false) { syncRecommendationButtons(currentStage); return; }
    }
    const bagCells = Array.from({ length:Math.max(preview.capacity, preview.cells.length) }, (_, i) => renderCell(preview.cells[i])).join('');
    UI.showOverlay('', `
      <div class="pg hub departure-cover departure-glass camp-detail camp-depart-detail ui-scale-system" id="depMain" data-departure-view="cover-v3">
        <button class="ak-sq ak-exit ak-back-tl" data-act="depBack" title="返回人物选择（Esc）" aria-label="返回人物选择">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9"
                  fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M4 12h10M4 12l4-4M4 12l4 4"
                  fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <header class="hub-head">
          <div class="camp-detail-heading"><small>EXPEDITION / 03</small><h2>出征整备</h2></div>
          <nav class="camp-steps" aria-label="出征步骤"><button data-act="depMode">01 模式</button><button data-act="depBack">02 人物</button><b aria-current="step">03 整备</b></nav>
          <span class="pg-spacer"></span>
        </header>
        <div class="dep-body${deployJustOpened ? ' page-in' : ''}">
          <aside class="camp-depart-person">
            <div class="camp-depart-person-art" data-character="${escAttr(characterFor(deployCharacter)?.id || '')}" data-skin="${escAttr(SDT.Art?.getSkin?.(deployCharacter) || 'default')}" aria-hidden="true">${SDT.Art?.classFullArt?.(characterFor(deployCharacter)?.id) || ''}</div>
            <div class="camp-depart-person-copy"><small>DEPARTURE CHECKLIST</small><h3>本次人物：${esc(characterName(deployCharacter))}</h3><button class="mini-btn" data-act="depBack">更换人物</button></div>
          </aside>
          <section class="hub-card dep-storage">
            <h3>仓库候选</h3>
            <div class="dep-recommend"><button class="mini-btn" data-act="depRecommendPreview">预览推荐装配</button><button class="mini-btn" data-act="depRecommendApply" disabled>应用预览</button><button class="mini-btn" data-act="depRecommendUndo" disabled>撤销推荐</button></div>
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
            <h3>本次携带</h3><p class="dep-summary" id="depSummary" aria-live="polite">${summaryHtml}</p>
            <div class="bag-grid${full ? ' full' : ''}" id="depBag">${bagCells}</div>
            ${petStrip ? `<div class="pet-strip"><span class="pet-strip-label">[[icon:paw]] 随行宠物</span>${petStrip}</div>` : ''}
            <details class="dep-survival"${B.data.ammoTaught ? '' : ' open'}><summary>用过的牌去哪了？</summary><p>所有用过的牌都进入<b>消耗区</b>，复原后可以再用。</p><p>复原方法在背包查看；撤离时再确认带回结果。</p></details>
          </section>
        </div>
        <p class="dep-status" id="depStatus" role="status"${deployHint ? '' : ' hidden'}>${deployHint}</p>
        <footer class="dep-foot">
          <span class="dep-capacity" id="depCapacity">${capacityHtml}</span>
          ${B.data.pocket.length ? `<span class="camp-depart-next warning">待复原卡牌 ${B.data.pocket.reduce((n, s) => n + s.count, 0)} 张 · 出发后清空</span>` : ''}
          <button id="btnDeploy" class="ui-control" data-act="confirmDeploy">出发 <span aria-hidden="true">→</span></button>
        </footer>
      </div>`, 'page');
    const stage = document.getElementById('depMain'), slot = B.slot, generation = departureGeneration;
    syncRecommendationButtons(stage);
    const current = () => generation === departureGeneration && SDT.Base.slot === slot && stage?.isConnected
      && document.getElementById('depMain') === stage && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing');
    const act = (name, handler) => UI.act(name, data => { if (current()) return handler(data); });
    const signature = recommendationSignature;
    act('depRecommendPreview', async () => {
      const before = signature();
      let previewDeployment;
      try { ({ previewDeployment } = await import('./preparation.commands.js')); }
      catch { if (current()) { deployHint = '推荐预览暂不可用，可继续手动整备或再次预览。'; renderDepartPrep(); } return; }
      if (!current() || before !== signature()) return;
      const plan = previewRecommendedDeparture({ ...departureOptions(), previewDeployment });
      deployRecommendation = { ...plan, signature: signature() };
      deployHint = plan.added.length ? `推荐补充：${plan.added.map(esc).join('、')}各 1 张。预览占 ${plan.summary.slots}/${plan.summary.capacity} 格；点击「应用预览」后仍可调整，当前未扣仓。`
        : '当前库存或剩余容量没有可补充的推荐；已选卡牌保持不变。建议留 3 格接收战利品与入城职业卡。';
      renderDepartPrep();
    });
    act('depRecommendApply', () => {
      if (!deployRecommendation || deployRecommendation.signature !== signature()) {
        deployHint = '请先预览推荐；若库存或选择有变化，请重新预览。'; renderDepartPrep(); return;
      }
      const before = { ...deployPick };
      replaceDeployPick({ ...deployRecommendation.picks });
      deployUndo = { before, after: JSON.stringify(deployPick) };
      deployRecommendation = null;
      deployHint = '已应用推荐，尚未扣仓；可拖回仓库调整或点击「撤销推荐」。'; renderDepartPrep();
    });
    act('depRecommendUndo', () => {
      if (!deployUndo || deployUndo.after !== JSON.stringify(deployPick)) {
        deployHint = '没有可撤销的推荐，或你已继续调整；保留当前选择。'; renderDepartPrep(); return;
      }
      replaceDeployPick({ ...deployUndo.before }); deployUndo = null; deployRecommendation = null;
      deployHint = '已撤销推荐，恢复应用前的携带选择；仓库未扣卡。'; renderDepartPrep();
    });
    bindDepartureFilters(stage, B.data.stash, {
      cells:preview.cells, renderCard:renderDepartureCard,
      filters: deployFilters, rarities: SDT.Cards.RARITIES, types: SDT.Cards.TYPES,
      rarityOf: card => SDT.Cards.rarityOf(card),
      onFiltersChange: filters => { if (current()) deployFilters = filters; },
    });
    const addPick = (key) => {
      if (!current()) return;
      const B2 = SDT.Base;
      const stack = findDepartureStack(B2.data.stash, key);
      if (!stack) return;
      key = departureStackKey(stack);
      const name = stack.card.name;
      if (stack.card.rarity === '职业') {
        deployHint = '[[icon:cross]] 职业卡不能带入对局——可在仓库归档培养或出售。';
        renderDepartPrep();
        return;
      }
      const cur = deployPick[key] || 0;
      if (cur >= stack.count) return;
      // 同名每格叠放上限（装备 1，其余 3，见 game.session stackCapOf；局内第 cap+1 张起另占一格）——
      // 整备来源上按此封顶（2026-09-19 审计）；预设路径的超限多占格已改由 previewDeployment 分段计入（A3-PREP-02）
      const stackCap = game.stackCapOf ? game.stackCapOf(stack.card) : 3;
      const sameNameCount = Object.entries(deployPick).reduce((sum, [pickedKey, count]) => sum + (findDepartureStack(B2.data.stash, pickedKey)?.card.name === name ? count : 0), 0);
      if (sameNameCount >= stackCap) {
        deployHint = `[[icon:cross]] 整备同名卡牌最多携带 ${stackCap} 张（每格叠放上限，局内超出会另占一格，这里不提供）——想多带就分摊到不同卡牌上。`;
        renderDepartPrep();
        return;
      }
      if (sameNameCount === 0 && deploySlotsUsed() >= B2.bagCap()) {
        deployHint = `[[icon:bag]] 背包格数已满（${B2.bagCap()} 格）——先移出其他卡牌，或回基地用木材扩建背包。`;
        renderDepartPrep();
        return;
      }
      deployHint = '';
      deployPick[key] = cur + 1;
      renderDepartPrep();
    };
    const subPick = (key) => {
      if (!current()) return;
      const stack = findDepartureStack(SDT.Base.data.stash, key);
      key = stack ? departureStackKey(stack) : key;
      const cur = deployPick[key] || 0;
      if (cur <= 0) return;
      deployPick[key] = cur - 1;
      deployHint = '';
      renderDepartPrep();
    };
    act('pickAdd', (d) => addPick(d.stackKey || d.name));
    // 需求 #4：出发时携带的宠物（即时保存，出发后生效）
    let petSelecting = false;
    act('depPet', async (d) => {
      if (petSelecting) return false;
      petSelecting = true;
      let selected;
      try { selected = await B.setPet(d.id); }
      catch { selected = false; }
      finally { petSelecting = false; }
      if (!current()) return false;
      if (!selected) { UI.log('伙伴选择未保存，请重试。', 'warn'); return false; }
      Sfx.tick();
      const pet = SDT.Base.petById(d.id);
      UI.log(`[[icon:paw]] 本局携带宠物<b>「${esc(pet.name)}」</b>：${esc(pet.desc)}`, 'ok');
      renderDepartPrep();
    });
    // 放大层只展示卡面；额外携带卡拖回左侧移除。
    act('bagZoom', (d) => {
      const preview = departurePreview();
      const isSha = preview.starter.name === d.name;
      const extra = deployPick[d.stackKey || d.name] || 0;
      const n = (isSha ? preview.starterCount : 0) + extra;
      if (n <= 0) return;
      const stack = isSha ? { card: preview.starter } : findDepartureStack(B.data.stash, d.stackKey || d.name);
      if (!stack) return;
      UI.showCardZoom(stack.card, {
        // 初始攻击固定携带：详情只读，不给「移出背包」按钮（2026-09-07 留言：初始攻击也要能点击详情）
        footer: '',
      });
    });
    // 拖拽：仓库卡面 → 背包格带入；背包卡面拖回仓库区移除
    const pool = document.getElementById('depPool');
    const bag = document.getElementById('depBag');
    if (pool && bag) {
      bindDepartureDrag(pool, bag, { add: addPick, remove: subPick });
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
        e.dataTransfer.setData('text/plain', card.dataset.stackKey || card.dataset.name);
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
    act('confirmDeploy', () => {
      if (deploySubmitting || !deployStart) return;
      deploySubmitting = true;
      const button = document.querySelector('#depMain [data-act="confirmDeploy"]');
      if (button) button.disabled = true;
      SDT.Sound.sfx('prepReady');
      if (!deployStart) return;
      const startChoice = deployStart;
      const recover = error => {
        if (error) console.error('[departure] 出发未完成', error);
        // A successful newRun clears deployStart. Never retry that committed run,
        // or touch a newer page after this handoff has become stale.
        if (!current() || deployStart !== startChoice) return;
        deploySubmitting = false;
        if (button?.isConnected) button.disabled = false;
        deployHint = '[[icon:cross]] 出发未完成，携带选择已保留；请返回更换人物后重试。';
        renderDepartPrep();
      };
      startDepartureHandoff(async () => current() && await startChoice() === true, stage)
        .then(completed => { if (!completed) recover(); })
        .catch(recover);
    });
    act('depBack', () => { openDepartPrep({ chooseAgain: true }); });
    act('depMode', () => { hubBridge.renderHub(); });
    deployJustOpened = false;   // 首帧渲染完成，后续页内操作不再播动画
  }

  function recommendationSignature() {
    return JSON.stringify([SDT.Base.slot, SDT.Base.data.selMode, SDT.Base.carriedPet()?.id, SDT.Base.bagCap(), departurePreview().starterCount,
      SDT.Base.data.stash.map(stack => [departureStackKey(stack), stack.count, stack.card.name, stack.card.rarity]), deployPick]);
  }
  function syncRecommendationButtons(root) {
    if (!root) return;
    let buttons = recommendationViews.get(root);
    if (!buttons || [buttons.apply, buttons.undo].some(node => node && !root.contains(node))) {
      const panel = root.getElementsByClassName('dep-recommend')[0];
      const controls = [...(panel?.children || [])];
      buttons = { apply:controls.find(node => node.dataset.act === 'depRecommendApply'), undo:controls.find(node => node.dataset.act === 'depRecommendUndo') };
      recommendationViews.set(root, buttons);
    }
    const { apply, undo } = buttons;
    const applyDisabled = !(deployRecommendation?.added.length && deployRecommendation.signature === recommendationSignature());
    const undoDisabled = !(deployUndo && deployUndo.after === JSON.stringify(deployPick));
    if (apply && apply.disabled !== applyDisabled) apply.disabled = applyDisabled;
    if (undo && undo.disabled !== undoDisabled) undo.disabled = undoDisabled;
  }
  function departurePreview() {
    return departureSummary(departureOptions());
  }
  function departureOptions() {
    const B = SDT.Base;
    return { starterCount: MAP.rules.starterSha, starterCard: SDT.Cards.SHA,
      fireball: SDT.Cards.all?.().find(card => card.id === 'tt3-fireball'), pet: B.carriedPet(),
      stash: B.data.stash, picks: deployPick, capacity: B.bagCap(),
      stackCapOf: game.stackCapOf || stackCapOf };
  }
  function deploySlotsUsed() { return departurePreview().slots; }

  // —— 仓库页：卡牌仓库（容量 / 卖出 / 收藏）+ 消耗区 + 物资 ——

export { hubDeployHTML, openDepartPrep, deployPick, setDeployPick };
