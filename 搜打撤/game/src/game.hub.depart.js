/* 由 game.hub.js 拆出（2026-09-22 六文件重构批3）：出发页与出征整备流
 * （hubDeployHTML / openDepartPrep / renderDepartPrep / deploySlotsUsed + deployPick 暂存态）。
 * 逐字搬迁；renderHub 回调经 game.hub.bridge.js 的 slots 间接调用，本文件不 import 壳。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from './shared.js';
import { MAP } from './game.session.js';
import { escAttr } from './shared.js';
import { MODES, game, getActiveSlot, newRun, requestClassChoice, setLobby, showTitle } from './game.session.js';
import { Sfx, configureCardNavigation, _set_cardPageOpen } from './game.cardslib.js';
import { slots as hubBridge } from './game.hub.bridge.js';   // 别名防局部 slots（槽位数）遮蔽——实机 depBack 曾因此 TypeError
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
            <button class="ov-btn" data-act="openPreparation" style="margin-top:10px">[[icon:flag]] 下一局目标与两套预设</button>
            <button id="btnNest" class="deploy-primary${SDT.Base.data.nestUnlocked ? '' : ' nest-locked'}" data-act="nestDeploy" style="margin-top:10px"
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
            <em>${pet ? esc(pet.desc) : '可在仓库页选择携带的宠物'}</em>
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
  // ESM 导入绑定不可赋值：壳侧重置改经 setter（2026-09-22 拆分理顺点）
  function setDeployPick(v) { deployPick = v; }
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
    UI.act('depBack', () => { deployPick = null; hubBridge.renderHub(); });
    deployJustOpened = false;   // 首帧渲染完成，后续页内操作不再播动画
  }

  function deploySlotsUsed() {
    let n = 1;   // 「初始攻击」×5 固定占 1 格
    Object.keys(deployPick || {}).forEach(k => { if (deployPick[k] > 0) n++; });
    return n;
  }

  // —— 仓库页：卡牌仓库（容量 / 卖出 / 收藏）+ 消耗口袋 + 物资 ——

export { hubDeployHTML, openDepartPrep, renderDepartPrep, deploySlotsUsed, deployPick, setDeployPick };
