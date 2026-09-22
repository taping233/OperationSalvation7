/* 由 game.hub.js 拆出（2026-09-22 六文件重构批3）：六页签 HTML 与物资/仓库抽屉
 * （商店/仓库/宠物/升级/人物/收藏室·成就 + openStashItem/openRawItem）。
 * 逐字搬迁（hubAchHTML 注入 hubCollectionView 形参为唯一签名理顺点，体不变）；
 * renderHub 回调经 game.hub.bridge.js 的 slots 间接调用，本文件不 import 壳。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { CHARACTERS, characterFor, characterName } from './characters.js';
import { esc } from './shared.js';
import { MAP } from './game.session.js';
import { escAttr } from './shared.js';
import { MODES, game, getActiveSlot, newRun, requestClassChoice, setLobby, showTitle } from './game.session.js';
import { Sfx, configureCardNavigation, _set_cardPageOpen } from './game.cardslib.js';
import { Random } from './random.js';
import { readBase, readBaseReceipt, commitBase } from './base.commands.js';
import { convertCollection, getCharacter, getCollection, selectSkin, stackKeyOf } from './collection.commands.js';
import { presentHome, homeErrorMessage } from './home.presenter.js';
import { validateLastLampState } from './story.last-lamp.js';
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
  function hubShopHTML() {
    const B = SDT.Base;
    const room = B.stashRoom();
    // 09-20 高级感改造批3：货架化——卡牌商品挂小卡面（同仓库网格缩放法），物资挂大图标；
    // 09-20 P1-6 的 poor 降饱和与原因行内可见口径保留
    const rows = HUB_SHOP_GOODS.map((g, i) => {
      const affordCoin = B.data.coins >= g.price;
      const roomOk = g.material ? true : room > 0;
      const afford = affordCoin && roomOk;
      const why = !affordCoin ? '储备币不足' : (roomOk ? (g.material ? '买入物资' : '买入仓库') : '仓库已满');
      const card = g.material ? null : hubShopGoodsCard(g);
      const visual = g.material
        ? `<span class="shelf-ico">[[icon:${g.material === 'wood' ? 'wood' : 'bread'}]]</span>`
        : (card ? SDT.Cards.cardHTML(card, 'sm') : '');
      const name = g.material ? esc(g.name) : (card ? esc(card.name) : '');
      const kind = g.material ? '基地物资' : (card ? esc(card.type) : '');
      return `<div class="shelf-item${afford ? '' : ' poor'}">
        <span class="shelf-visual">${visual}</span>
        <span class="shelf-info"><b>${name}</b><span class="dim">${kind} · ${escAttr(g.tip)}</span>
          ${afford ? '' : `<span class="poor-why">${escAttr(why)}</span>`}</span>
        <button class="mini-btn ok shop-price-tag" data-act="shopBuy" data-i="${i}" ${afford ? '' : 'disabled'} title="${escAttr(why)}">[[icon:coin]] ${g.price} 币</button>
      </div>`;
    }).join('');
    return `
      <div class="hub-two">
        <section class="hub-card">
          <h3>[[icon:coin]] 远征补给商店</h3>
          <div class="base-line">储备 <b>${B.data.coins}</b> 币 · 仓库空格 <b>${room}</b> 格</div>
          <div class="shop-shelf">${rows}</div>
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
    // 09-20 高级感改造批2：卡牌仓库从文字行改卡面网格——复用出征整备/收藏室同款
    // cardHTML('sm') 卡面，点击仍走 stashItem 弹窗（卖出/收藏交互不变）
    const stashRows = B.data.stash.length
      ? `<div class="stash-cardgrid">${B.data.stash.map((s, i) => {
          const marked = B.isCollected(s.card);
          const mat = B.materialInfo ? B.materialInfo(s.card) : null;
          return `<button type="button" class="stash-cell${marked ? ' collected' : ''}${mat ? ' is-material' : ''}" data-act="stashItem" data-i="${i}"
              aria-label="${escAttr(s.card.name)}${s.count > 1 ? ` ×${s.count}` : ''}，${mat ? '使用材料' : '卖出或收藏'}"
              title="${escAttr(s.card.name)}${s.count > 1 ? ` ×${s.count}` : ''} · ${mat ? '点击使用（材料不可卖出）' : '点击卖出 / 收藏'}">
            ${SDT.Cards.cardHTML(s.card, 'sm')}
            ${s.count > 1 ? `<b class="stack-count">×${s.count}</b>` : ''}
            ${marked ? '<span class="cell-mark">[[icon:sparkles]]</span>' : ''}
            ${mat ? '<span class="cell-tag">可使用</span>' : ''}
          </button>`;
        }).join('')}</div>`
      : `<div class="stash-empty">
          <span class="empty-ico">[[icon:archive]]</span>
          <b>仓库空空如也</b>
          <span>撤离成功后在整理界面把战利品放回这里；出发页点「出发整备」即可开启第一趟远征。</span>
        </div>`;
    // 消耗口袋：按稀有度用钥匙复原（需求 #1/#11：古朴1/稀有2/史诗3/传说4）；行首挂小卡面缩略
    const pocketRows = B.data.pocket.length
      ? B.data.pocket.map((p, i) => {
          const cost = B.pocketKeyCost(p);
          const afford = keys >= cost;
          return `<div class="pk-row pocket-row"><span class="pocket-thumb">${SDT.Cards.cardHTML(p.card, 'sm')}</span>
            <span class="pocket-info"><b>${esc(p.card.name)}</b>${p.count > 1 ? ` ×${p.count}` : ''}
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
          <div class="stash-scroll">${stashRows}</div>
        </section>
        <section class="hub-card">
          <h3>[[icon:pocket]] 消耗口袋 <span class="set-tip">共 ${pkN} 张</span></h3>
          <p class="ov-note" style="margin:0 0 6px">[[icon:key]] 用钥匙复原（古朴1 / 稀有2 / 史诗3 / 传说4）· <b>下一次出发后口袋清空</b></p>
          <div class="stash-list">${pocketRows}</div>
          <h3 style="margin-top:14px">[[icon:archive]] 物资</h3>
          <div class="material-grid">
            <button type="button" class="material-cell" data-act="rawItem" data-kind="wood" aria-label="木材 ×${B.data.wood}，基地建设材料，不可卖出" title="基地建设材料 · 不可卖出">
              <span class="mat-ico">[[icon:wood]]</span><b>${B.data.wood}</b>
              <span class="mat-use">背包与仓库扩建</span>
            </button>
            <button type="button" class="material-cell" data-act="rawItem" data-kind="rations" aria-label="口粮 ×${B.data.rations}，基地建设材料，不可卖出" title="基地建设材料 · 不可卖出">
              <span class="mat-ico">[[icon:bread]]</span><b>${B.data.rations}</b>
              <span class="mat-use">宠物升级</span>
            </button>
          </div>
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
        <p class="ov-note" style="margin:0 0 6px">初始宠物「汪汪狗」自动获得；其余只能用<b>宠物蛋</b>（宝箱 0.7% 起掉落：每开箱未出 +3%、每打赢一场战斗再 +0.2%）+ 50 币在仓库孵化。宠物在「升级」页用口粮升级，携带不同宠物安全格数量不同。</p>
        <div class="stash-list">${rows}</div>
        ${hasEgg ? '<p class="hint ok-hint">[[icon:crystal]] 仓库里有宠物蛋——点击它进行孵化！</p>' : ''}
      </section>`;
  }

  // 仓库物品弹窗：卡面预览 + 使用（材料卡 / 宠物蛋） / 卖出 / 收藏
  function openStashItem(i) {
    const B = SDT.Base;
    const s = B.data.stash[i];
    if (!s) { hubBridge.renderHub(); return; }
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
        hubBridge.renderHub();
      });
      UI.act('stashBack', () => hubBridge.renderHub());
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
        hubBridge.renderHub();
      };
      const useAll = () => {
        const r = B.useStashMaterial(s.card.name, true);
        if (r.ok) { Sfx.ding(); UI.log(r.msg, 'loot'); }
        hubBridge.renderHub();
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
      UI.act('stashBack', () => hubBridge.renderHub());
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
      hubBridge.renderHub();
    };
    UI.act('econpackUse', () => {
      if (s.card.id !== 'tt-econpack') return;
      if (s.count === 1) { confirmStashAction('这是仓库里的最后一个经济卡包，拆开后卡包将消失。', useEconPack); return; }
      useEconPack();
    });
    const collectOne = async () => {
      // 2026-09-16 定版（Item 15）：职业卡/能力卡收藏即用掉——重复收藏重复获得经验，进度只记首次
      const first = !B.isCollected(s.card);
      const read = readBase(B.slot);
      if (!read.ok) { UI.log(homeErrorMessage(read), 'warn'); return; }
      const result = await convertCollection({ slotId: B.slot, requestId: homeRequestId('collect-one'), expectedRevision: read.revision }, { stackKey: stackKeyOf(s), count: 1 });
      if (!result.ok) { UI.log(result.message || '收藏失败，卡牌未消耗', 'warn'); return; }
      Sfx.ding();
      UI.log(`[[icon:medal]] 已收藏【<b>${esc(s.card.name)}</b>】并转化为人物经验（卡牌用掉，不再占格${first ? '，收藏进度 +1' : ''}）`, 'loot');
      hubBridge.renderHub();
    };
    UI.act('collCollectOne', () => {
      if (!convertType) return;
      confirmStashAction(`收藏【${esc(s.card.name)}】会消耗 1 张卡并转化为人物熟练度经验。`, collectOne);
    });
    const collectAll = async () => {
      if (!convertType) return;
      const n = s.count;
      const read = readBase(B.slot);
      if (!read.ok) { UI.log(homeErrorMessage(read), 'warn'); return; }
      const result = await convertCollection({ slotId: B.slot, requestId: homeRequestId('collect-all'), expectedRevision: read.revision }, { stackKey: stackKeyOf(s), count: n });
      if (!result.ok) { UI.log(result.message || '收藏失败，卡牌未消耗', 'warn'); return; }
      Sfx.ding();
      UI.log(`[[icon:medal]] 已收藏【<b>${esc(s.card.name)}</b>】×${n}，全部转化为人物经验（卡牌用掉）`, 'loot');
      hubBridge.renderHub();
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
      hubBridge.renderHub();
    });
    const sellOne = () => {
      const r = B.sellStashCards(s.card.name, 1);
      if (r.ok) { Sfx.ding(); UI.log(r.msg, 'coin'); }
      hubBridge.renderHub();
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
      hubBridge.renderHub();
    };
    UI.act('sellAll', () => {
      if (price >= 5 || s.count === 1) {
        confirmStashAction(`卖出【${esc(s.card.name)}】整堆（×${s.count}）将获得 ${price * s.count} 币，操作不可撤回。`, sellAll);
        return;
      }
      sellAll();
    });
    UI.act('stashBack', () => hubBridge.renderHub());
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
    UI.act('stashBack2', () => hubBridge.renderHub());
  }

  // —— 升级页：背包扩建 + 仓库扩建 + 宠物升级（保险升级改为宠物升级，需求 #2/#14）——
  function hubUpgradeHTML() {
    const B = SDT.Base;
    const R = MAP.rules;
    const owned = B.ownedPets();
    const sel = B.carriedPet();
    // 宠物升级：每只宠物独立进度，口粮递增 2-3-4-5，上限 Lv.5；
    // 携带中的宠物决定安全格数量（小企鹅咕嘎 +2：4-8 格）
    // 09-20 P1-8：未孵化的不再逐只铺「？？？」占位行（与仓库页重复且无操作），
    // 收成一行摘要 + 去仓库按钮；已孵化的正常列出升级入口。
    const lockedN = B.PETS.length - owned.length;
    const petRows = B.PETS.map(p => {
      const have = owned.includes(p.id);
      if (!have) return '';
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
      <div class="hub-upgrade-layout">
        <section class="hub-card up-card">
          <h3>[[icon:bag]] 背包扩建</h3>
          <div class="up-cap"><b>${B.bagCap()}</b><small>/ ${R.bagMax} 格</small></div>
          <div class="base-bar"><i style="width:${(B.bagCap() / R.bagMax * 100).toFixed(1)}%"></i></div>
          <button class="ov-btn ok" data-act="upBag" ${B.canUpgradeBag() ? '' : 'disabled'}>[[icon:wood]] ×${R.bagUpgradeWood} 扩建 +1 格</button>
          ${B.bagCap() >= R.bagMax ? '<p class="hint ok-hint">[[icon:check]] 已达上限</p>' : ''}
        </section>
        <section class="hub-card up-card">
          <h3>[[icon:archive]] 仓库扩建</h3>
          <div class="up-cap"><b>${B.stashCap()}</b><small>/ ${R.stashMax} 张</small></div>
          <div class="base-bar"><i style="width:${(B.stashCap() / R.stashMax * 100).toFixed(1)}%"></i></div>
          <button class="ov-btn ok" data-act="upStash" ${B.canUpgradeStash() ? '' : 'disabled'}>[[icon:wood]] ×${R.stashUpgradeWood} 扩建 +${R.stashUpgradeSlots} 张</button>
          ${B.stashCap() >= R.stashMax ? '<p class="hint ok-hint">[[icon:check]] 已达上限</p>' : ''}
        </section>
        <section class="hub-card up-pets">
          <h3>[[icon:paw]] 宠物升级 <span class="set-tip">口粮 ${B.PET_UP_COSTS.join('-')} · 携带中的宠物决定安全格 <b>${B.safeCap()}</b> 格</span></h3>
          <p class="ov-note" style="margin:0 0 6px">每只宠物的升级进度相互独立（Lv.1 起每级 +1 安全格）；携带不同宠物，安全格数量不同——小企鹅咕嘎可到 4-8 格。在仓库页切换携带的宠物。</p>
          ${lockedN > 0 ? `<div class="pk-row pet-row locked"><span>[[icon:paw]] <b>？？？</b><span class="dim">· 未孵化 ×${lockedN}——宠物蛋 + 50 币在仓库页孵化</span></span><button class="mini-btn ok" data-act="hubTab" data-tab="stash">去仓库孵化</button></div>` : ''}
          <div class="stash-list">${petRows}</div>
        </section>
      </div>`;
  }

  // —— 人物页：各人物熟练度等级 ——
  function hubClassesHTML() {
    const summary = SDT.Meta.classSummary();
    const totalCards = summary.reduce((n, c) => n + c.pool, 0);
    const trained = summary.filter(c => c.lv > 1 || c.xp > 0).length;
    const rows = summary.map((c, index) => {
      const pct = c.maxed ? 100 : Math.min(100, c.need ? c.xp / c.need * 100 : 0);
      const character = characterFor(c.cls);
      const skinView = character && getCharacter(SDT.Base.data, character.id);
      const skins = skinView?.availableSkinIds || ['default'];
      return `<article class="class-dossier${c.lv > 1 || c.xp > 0 ? ' trained' : ''}">
        <div class="class-dossier-art">${SDT.Art.classArt(c.cls)}</div>
        <div class="class-dossier-shade"></div>
        <div class="class-dossier-index">0${index + 1}</div>
        <div class="class-dossier-copy">
          <span class="class-dossier-kicker">FIELD OPERATIVE</span>
          <h3>${esc(characterName(c.cls))}</h3>
          <p>${esc(SDT.Meta.perkText(c.lv))}</p>
          <div class="class-dossier-meta"><b>Lv.${c.lv}${c.maxed ? ' · MAX' : ''}</b><span>人物卡 ${c.pool} 张</span></div>
          <div class="xp-bar" aria-label="熟练度 ${pct.toFixed(0)}%"><i style="width:${pct.toFixed(1)}%"></i></div>
          <div class="xp-txt">${c.maxed ? '熟练度已满' : `经验 ${c.xp} / ${c.need}`}</div>
          <div class="class-skins" aria-label="${esc(characterName(c.cls))}皮肤">${skins.map(id => `<button class="mini-btn${skinView.selectedSkinId === id ? ' ok' : ''}" data-act="selectCharacterSkin" data-character="${character.id}" data-skin="${escAttr(id)}" aria-pressed="${skinView.selectedSkinId === id}">${id === 'default' ? '默认' : esc(id)}</button>`).join('')}</div>
        </div>
      </article>`;
    }).join('');
    return `
      <section class="class-command">
        <div class="class-command-copy">
          <span class="section-kicker">BASE PERSONNEL // 05</span>
          <h3>人物档案</h3>
          <p>熟练度加成会在出征时自动生效。收藏对应人物的职业卡与能力卡，可继续积累经验。</p>
        </div>
        <div class="class-command-stats">
          <span><small>在册人物</small><b>${summary.length}</b></span>
          <span><small>已培养</small><b>${trained}</b></span>
          <span><small>人物卡池</small><b>${totalCards}</b></span>
        </div>
      </section>
      <section class="class-dossier-grid" aria-label="人物熟练度档案">${rows}</section>`;
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
  function hubAchHTML(hubCollectionView) {
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
    const collTotal = M.collTotal();
    const collProgress = M.collProgress();
    const unlockedBacks = (SDT.Cards.CARD_BACKS || []).filter(b => B.isBackUnlocked(b.id)).length;
    const storyCheck = validateLastLampState(B.data.story);
    const storyState = storyCheck.ok ? storyCheck.value : null;
    const storyRecord = !storyCheck.ok
      ? `<section class="hub-card"><h3>[[icon:notes]] 见闻纪念</h3><p class="ov-note">故事记录无法读取，原数据已保留。</p></section>`
      : storyState.stage < 3
        ? `<section class="hub-card"><h3>[[icon:notes]] 见闻纪念 <span class="set-tip">${storyState.stage} / 3</span></h3><p class="ov-note">${storyState.stage ? '《最后一盏引路灯》的线索已经记入档案，等待下一次探索。' : '尚未记录环境故事。'} 故事记录不提供地图或战力效果。</p></section>`
        : storyState.ending === 'open_beacon'
          ? `<section class="hub-card"><h3>[[icon:notes]] 北门远灯记录</h3><p class="ov-note">你让灯光越过风雪，公共疏散线也随之暴露。故事记录不提供地图或战力效果。</p></section>`
          : `<section class="hub-card"><h3>[[icon:notes]] 遮光近照记录</h3><p class="ov-note">你让窄光留在墙边，近路仍隐蔽，远处却看不见出口。故事记录不提供地图或战力效果。</p></section>`;
    const content = hubCollectionView === 'achievements'
      ? `<section class="hub-card collection-panel"><h3>[[icon:trophy]] 成就记录 <span class="set-tip">${doneN} / ${M.ACHIEVEMENTS.length} 已解锁</span></h3><div class="ach-list">${rows}</div></section>`
      : hubCollectionView === 'classes'
        ? collRoomHTML()
        : `<section class="hub-card collection-panel"><h3>[[icon:cards]] 卡背图鉴 <span class="set-tip">${unlockedBacks} / ${(SDT.Cards.CARD_BACKS || []).length} 已解锁</span></h3><div class="back-grid">${backsHTML}</div></section>`;
    return `
      ${storyRecord}
      <section class="collection-command">
        <div class="collection-command-copy">
          <span class="section-kicker">ARCHIVE COLLECTION // 07</span>
          <h3>收藏档案室</h3>
          <p>卡背、成就与人物收藏分区归档。切换分类不会离开基地，也不会丢失当前浏览位置。</p>
        </div>
        <div class="collection-command-stats">
          <span><small>卡背</small><b>${unlockedBacks}/${(SDT.Cards.CARD_BACKS || []).length}</b></span>
          <span><small>成就</small><b>${doneN}/${M.ACHIEVEMENTS.length}</b></span>
          <span><small>人物收藏</small><b>${collProgress}/${collTotal}</b></span>
        </div>
      </section>
      <nav class="collection-tabs" aria-label="收藏分类">
        <button class="${hubCollectionView === 'backs' ? 'on' : ''}" data-act="hubCollectionView" data-view="backs" aria-pressed="${hubCollectionView === 'backs'}">[[icon:cards]] 卡背图鉴</button>
        <button class="${hubCollectionView === 'achievements' ? 'on' : ''}" data-act="hubCollectionView" data-view="achievements" aria-pressed="${hubCollectionView === 'achievements'}">[[icon:trophy]] 成就记录</button>
        <button class="${hubCollectionView === 'classes' ? 'on' : ''}" data-act="hubCollectionView" data-view="classes" aria-pressed="${hubCollectionView === 'classes'}">[[icon:sparkles]] 人物收藏</button>
      </nav>
      ${content}`;
  }

export { hubShopHTML, hubStashHTML, hubPetsHTML, openStashItem, openRawItem, hubUpgradeHTML, hubClassesHTML, collRoomHTML, hubAchHTML, HUB_SHOP_GOODS, hubShopGoodsCard };
