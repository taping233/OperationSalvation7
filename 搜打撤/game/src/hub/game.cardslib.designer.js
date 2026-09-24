/* 卡牌制作坊 + 卡牌导入/导出（拆分自 game.cardslib.js，行为原样保留）。
   经 createCardDesigner(deps) 工厂接收宿主（照相馆壳 game.cardslib.js）的
   页面开关访问器与开/关页回调，避免壳↔切片循环依赖；
   制作坊草稿（draft/editingCard/designerReturnLib）为本模块私有状态。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc, escAttr } from '../core/shared.js';
import { game } from '../run/game.session.js';
import { MECH_GROUPS, MECH_ALL } from '../cards/mech-sentences.js';
import { CARD_DESIGNER_WRITES_ENABLED, Sfx, cardHTML } from './game.cardslib.common.js';

const RARITIES = SDT.Cards.RARITIES;
const TYPES = SDT.Cards.TYPES;
const DMG_TYPES = SDT.Cards.DMG_TYPES;

export function createCardDesigner(deps) {
  let editingCard = null;        // 制作坊正在编辑的原卡（null = 新建）
  let designerReturnLib = false; // 关闭制作坊时是否回到卡牌库
  let draft = null;              // 制作坊草稿

  // 描述里追加 / 递增次数 / 整句移除一条机制句式，返回新描述
  function mechToggle(desc, item) {
    if (!item.sen.test(desc)) {
      const phrase = item.tpl(1);
      return desc.trim() ? desc.replace(/\s*$/, '') + (/[。；;]$/.test(desc.trim()) ? '' : '；') + phrase : phrase;
    }
    const m = desc.match(item.cnt);
    const n = m ? +(m[1] || 1) : 1;
    if (item.max > 1 && n < item.max) return desc.replace(item.sen, item.tpl(n + 1));
    // 已到上限或不可叠加 → 整句移除，并清掉开头残留的分隔符
    return desc.replace(item.sen, '').replace(/^[；;\s]+/, '').trim();
  }

  // ======== 卡牌制作坊 ========
  function openCardDesigner(card) {
    if (!CARD_DESIGNER_WRITES_ENABLED) { deps.openCardLibrary(); return; }
    if (game.state !== 'idle' && game.state !== 'modal' && game.state !== 'title') return;
    if (game.state !== 'modal') deps.setCardPagePrevState(game.state);   // 同 openCardLibrary：记录来源
    game.state = 'modal';
    // 当前顶层正是卡牌库页面 → 关闭制作坊时回到库
    designerReturnLib = deps.getCardPageOpen() && !!document.getElementById('libGrid');
    deps.setCardPageOpen(true);
    editingCard = card || null;
    draft = {
      id: card ? card.id : null,
      name: card ? card.name : '',
      cost: card ? card.cost : 1,
      rarity: card ? card.rarity : '古朴',
      type: card ? card.type : '武术',
      dmg: card ? Math.max(0, +card.dmg || 0) : 0,
      // 伤害类型词条：已标注优先，其次按描述推导，新建默认攻击（法术类型切换时补默认）
      dmgType: card
        ? (SDT.Cards.DMG_TYPE_META[card.dmgType] ? card.dmgType
          : (SDT.Cards.deriveDmgType(card) || 'fixed'))
        : 'attack',
      // 抽卡 / 注能词条：已标注优先，其次按描述回填，新建默认 0
      draw: card ? Math.max(0, +(card.draw || 0) || SDT.Cards.deriveDraw(card) || 0) : 0,
      infuse: card ? Math.max(0, +(card.infuse || 0) || SDT.Cards.deriveInfuse(card) || 0) : 0,
      heal: card ? Math.max(0, +(card.heal || 0) || SDT.Cards.deriveHeal(card) || 0) : 0,
      armor: card ? Math.max(0, +(card.armor || 0) || SDT.Cards.deriveArmor(card) || 0) : 0,
      desc: card ? (card.desc || '') : '',
      value: card ? Math.max(0, +card.value || 0) : 0,
      // 出售资格：默认不可出售；编辑旧卡时按 isSellable 回显（含「可出售」备注推导）
      sellable: card ? SDT.Cards.isSellable(card) : false,
      // 身份字段原样保留：制作坊表单不编辑它们，但保存时必须带回，
      // 否则 upsert 整卡替换会丢 cls/hero（能力卡专属立绘与 heroOf 依赖）
      cls: card ? (card.cls || '') : '',
      hero: card ? !!card.hero : false,
      tokenOf: card ? (card.tokenOf || undefined) : undefined,
      unrandom: card ? !!card.unrandom : false,
      // 2026-09-19 留言 #29：馆方记录（与卡面效果描述分开的一段正式档案文本）
      note: card ? (card.note || '') : '',
    };
    renderDesigner();
  }

  // 机制词条按钮组（on 态 + 次数角标实时反映描述内容）
  function mechChipsHTML() {
    return MECH_GROUPS.map(g => `
      <div class="mech-group">
        <div class="mech-group-name">${g.name}</div>
        <div class="mech-chips">${g.items.map(it => {
          const on = it.sen.test(draft.desc);
          const m = on ? draft.desc.match(it.cnt) : null;
          const n = m ? +(m[1] || 1) : 0;
          return `<button type="button" class="mech-chip${on ? ' on' : ''}" data-act="mech" data-k="${it.k}" title="${escAttr(it.tpl(Math.max(1, n)))}（点击${on ? (it.max > 1 && n < it.max ? '叠加次数' : '移除') : '写入描述'}）">${SDT.Icons.img(it.icon)}${it.label}${n > 1 ? `<em>${n}</em>` : ''}</button>`;
        }).join('')}</div>
      </div>`).join('');
  }

  // 机制词条改动后：同步描述框 / 字数 / 按钮态 / 卡面预览
  function mechSyncUI() {
    const ta = document.getElementById('cardDesc');
    if (ta) ta.value = draft.desc;
    const cnt = document.getElementById('descCount');
    if (cnt) cnt.textContent = `${draft.desc.length}/100`;
    const wrap = document.getElementById('mechChips');
    if (wrap) wrap.innerHTML = mechChipsHTML();
    updateDesignerPreview();
  }

  function renderDesigner() {
    const isDmgType = DMG_TYPES.includes(draft.type);
    UI.showOverlay('', `
      <div class="pg cdes">
        <button class="pg-close" data-act="closeDesigner" title="${designerReturnLib ? '返回照相馆（Esc）' : '关闭（Esc）'}">[[icon:cross]]</button>
        <header class="pg-head">
          <h2>[[icon:cards]] 卡牌制作坊</h2>
          <span class="pg-spacer"></span>
          ${designerReturnLib ? '<button class="hs-btn" data-act="closeDesigner">← 返回照相馆</button>' : ''}
          <button class="hs-btn gold" data-act="saveCard">[[icon:save]] ${editingCard ? '保存修改' : '保存卡牌'}</button>
        </header>
        <div class="cdes-main">
          <div class="cdes-stage" id="cdesStage">
            <div id="cardTilt"><div id="cardPreview"></div></div>
            <p class="stage-hint">[[icon:mouse]] 移动鼠标可以转动卡牌</p>
          </div>
          <div class="cdes-form">
            <div class="cdes-sec"><span>基础设定</span></div>
            <div class="cdes-row"><label>卡牌名称</label>
              <input id="cardName" type="text" maxlength="12" value="${escAttr(draft.name)}" placeholder="起个名字（≤12 字）"></div>
            <div class="cdes-row"><label>类型 <span class="row-tip">决定卡牌边框与图腾</span></label>
              <div class="seg type-seg">${TYPES.map(t =>
                `<button data-act="pickType" data-t="${t}" class="${draft.type === t ? 'on' : ''}">${SDT.Icons.img(SDT.Cards.TYPE_ART[t] || 'question')}${t}</button>`).join('')}</div></div>
            <div class="cdes-duo">
              <div class="cdes-row"><label>费用</label>
                <div class="seg">${[0, 1, 2, 3, 4, 5].map(v =>
                  `<button class="cost-gem${draft.cost === v ? ' on' : ''}" data-act="pickCost" data-v="${v}">${v}</button>`).join('')}</div></div>
              <div class="cdes-row"><label>稀有度 <span class="row-tip">边框光效 · 商店价格</span></label>
                <div class="seg">${RARITIES.map((r, i) =>
                  `<button class="rar-dot rv${i}${draft.rarity === r ? ' on' : ''}" data-act="pickRar" data-r="${r}"><i></i>${r}</button>`).join('')}</div></div>
            </div>
            <div class="cdes-sec"><span>战斗词条</span></div>
            <div class="cdes-row" id="rowDmg" ${isDmgType ? '' : 'hidden'}><label>伤害词条 <span class="row-tip">武术 / 法术专属 · 四类伤害体系（design.md §3）</span></label>
              <div class="seg dmgtype-seg">${SDT.Cards.DMG_TYPE_ORDER.map(dt => {
                const m = SDT.Cards.DMG_TYPE_META[dt];
                return `<button data-act="pickDmgType" data-dt="${dt}" class="${draft.dmgType === dt ? 'on' : ''}" title="${escAttr(m.tip)}"><i>${m.icon}</i>${m.name}</button>`;
              }).join('')}</div>
              <div class="dmg-ctl">
                <button class="hs-btn round" data-act="dmgAdj" data-v="-1" title="减少">−</button>
                <input id="cardDmg" type="number" min="0" max="99" value="${draft.dmg}">
                <button class="hs-btn round" data-act="dmgAdj" data-v="1" title="增加">＋</button>
                <span class="dmg-hint">显示为卡牌左下角的<span class="dmg-num">红色伤害宝石</span></span>
              </div></div>
            <div class="cdes-row"><label>抽卡 <span class="row-tip">BOSS 战从牌库抽 N 张 · 普通战斗改为获得 N 张初始攻击</span></label>
              <div class="dmg-ctl">
                ${[0, 1, 2, 3, 4, 5].map(v =>
                  `<button class="cost-gem${draft.draw === v ? ' on' : ''}" data-act="pickDraw" data-v="${v}">${v}</button>`).join('')}
                <span class="dmg-hint">0 = 无该词条</span>
              </div></div>
            <div class="cdes-row"><label>注能 <span class="row-tip">打出前需先选择 N 张手牌消耗</span></label>
              <div class="dmg-ctl">
                ${[0, 1, 2, 3, 4, 5].map(v =>
                  `<button class="cost-gem${draft.infuse === v ? ' on' : ''}" data-act="pickInfuse" data-v="${v}">${v}</button>`).join('')}
                <span class="dmg-hint">0 = 无该词条；有注能时卡面类型行下方会显示角标</span>
              </div></div>
            <div class="cdes-row"><label>回复 / 护甲 <span class="row-tip">简单词条 · 战斗中拖到自己身上打出；禁疗会阻止回复</span></label>
              <div class="dmg-ctl">
                <span class="dmg-hint" style="margin-right:4px">[[icon:heart]] 回复</span>
                <input id="cardHeal" type="number" min="0" max="99" value="${draft.heal}">
                <span class="dmg-hint" style="margin:0 4px 0 14px">[[icon:plate]] 护甲</span>
                <input id="cardArmor" type="number" min="0" max="99" value="${draft.armor}">
                <span class="dmg-hint">0 = 无该词条；可与描述中的其他效果组合</span>
              </div></div>
            <div class="cdes-sec"><span>机制词条</span><em>点击写入规范句式 · 战斗中自动实装</em></div>
            <div class="cdes-row" id="mechChips">${mechChipsHTML()}</div>
            <p class="dmg-hint" style="margin:-6px 0 22px">[[icon:lantern]] 再点一次叠加次数，到上限后再点移除；句式与战斗结算（battle.core 词条解析）一一对应，也可在描述里手写其他效果。</p>
            <div class="cdes-sec"><span>描述与经济</span></div>
            <div class="cdes-row"><label>效果描述 <span class="row-tip">可选</span><span class="pg-spacer"></span><span class="desc-count" id="descCount">${draft.desc.length}/100</span></label>
              <textarea id="cardDesc" rows="4" maxlength="100" placeholder="点上方机制词条自动生成，或手写描述。">${esc(draft.desc)}</textarea></div>
            <div class="cdes-row" id="rowValue"><label>币值 [[icon:coin]] <span class="row-tip">卡牌右下角金色角标 · 商店收购参考价</span></label>
              <div class="dmg-ctl">
                <button class="hs-btn round" data-act="valAdj" data-v="-1" title="减少">−</button>
                <input id="cardValue" type="number" min="0" max="99" value="${draft.value}">
                <button class="hs-btn round" data-act="valAdj" data-v="1" title="增加">＋</button>
                <label class="sellable-tgl" title="所有卡牌默认不可出售，勾选后才能在商店卖掉"><input type="checkbox" id="cardSellable" ${draft.sellable ? 'checked' : ''}> 可出售</label>
                <span class="dmg-hint">0 = 不显示角标；勾「可出售」才能卖给商店</span>
              </div></div>
            <div class="cdes-row"><label>备注描述 <span class="row-tip">可选 · 点卡放大时展示</span></label>
              <textarea id="cardNote" rows="2" maxlength="200" placeholder="写给自己的备注：使用心得、combo 提示、来源纪念……（与效果描述分开，不影响战斗）">${esc(draft.note)}</textarea></div>
            <p class="dmg-hint">[[icon:lantern]] 保存后可在商店刷出、在战斗中实装；数据保存在本浏览器。</p>
          </div>
        </div>
      </div>`, 'page');
    updateDesignerPreview();
    bindDesignerTilt();
    UI._inputHandler = (e) => {
      if (e.target.id === 'cardName') draft.name = e.target.value;
      else if (e.target.id === 'cardDesc') {
        draft.desc = e.target.value;
        const cnt = document.getElementById('descCount');
        if (cnt) cnt.textContent = `${draft.desc.length}/100`;
        // 手动改动描述后同步机制按钮态（不重写 textarea，保持光标）
        const wrap = document.getElementById('mechChips');
        if (wrap) wrap.innerHTML = mechChipsHTML();
      }
      else if (e.target.id === 'cardDmg') draft.dmg = Math.max(0, Math.min(99, Math.floor(+e.target.value || 0)));
      else if (e.target.id === 'cardHeal') draft.heal = Math.max(0, Math.min(99, Math.floor(+e.target.value || 0)));
      else if (e.target.id === 'cardArmor') draft.armor = Math.max(0, Math.min(99, Math.floor(+e.target.value || 0)));
      else if (e.target.id === 'cardValue') draft.value = Math.max(0, Math.min(99, Math.floor(+e.target.value || 0)));
      else if (e.target.id === 'cardSellable') { draft.sellable = e.target.checked; return; }
      else if (e.target.id === 'cardNote') { draft.note = e.target.value; return; }
      else return;
      updateDesignerPreview();
    };
    UI.act('mech', (d) => {
      const item = MECH_ALL.find(it => it.k === d.k);
      if (!item) return;
      draft.desc = mechToggle(draft.desc, item);
      if (draft.desc.length > 100) { UI.log('描述超过 100 字上限，最后一条词条放不下了', 'warn'); mechSyncUI(); return; }
      Sfx.tick();
      mechSyncUI();
    });
    UI.act('closeDesigner', closeDesigner);
    UI.act('pickType', (d) => {
      draft.type = d.t;
      if (!DMG_TYPES.includes(d.t)) draft.dmg = 0;
      else if (!SDT.Cards.DMG_TYPE_META[draft.dmgType]) draft.dmgType = d.t === '法术' ? 'spell' : 'attack';
      Sfx.tick(); syncDesignerForm();
    });
    UI.act('pickDmgType', (d) => { draft.dmgType = d.dt; Sfx.tick(); syncDesignerForm(); });
    UI.act('pickCost', (d) => { draft.cost = +d.v; Sfx.tick(); syncDesignerForm(); });
    UI.act('pickDraw', (d) => { draft.draw = +d.v; Sfx.tick(); syncDesignerForm(); });
    UI.act('pickInfuse', (d) => { draft.infuse = +d.v; Sfx.tick(); syncDesignerForm(); });
    UI.act('pickRar', (d) => { draft.rarity = d.r; Sfx.tick(); syncDesignerForm(); });
    UI.act('dmgAdj', (d) => { draft.dmg = Math.max(0, Math.min(99, draft.dmg + (+d.v))); syncDesignerForm(); });
    UI.act('valAdj', (d) => { draft.value = Math.max(0, Math.min(99, draft.value + (+d.v))); syncDesignerForm(); });
    UI.act('saveCard', saveDraftCard);
  }

  function syncDesignerForm() {
    document.querySelectorAll('#ovBody .type-seg [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === draft.type));
    document.querySelectorAll('#ovBody [data-act="pickDmgType"]').forEach(b => b.classList.toggle('on', b.dataset.dt === draft.dmgType));
    document.querySelectorAll('#ovBody [data-act="pickCost"]').forEach(b => b.classList.toggle('on', +b.dataset.v === draft.cost));
    document.querySelectorAll('#ovBody [data-act="pickDraw"]').forEach(b => b.classList.toggle('on', +b.dataset.v === draft.draw));
    document.querySelectorAll('#ovBody [data-act="pickInfuse"]').forEach(b => b.classList.toggle('on', +b.dataset.v === draft.infuse));
    document.querySelectorAll('#ovBody [data-act="pickRar"]').forEach(b => b.classList.toggle('on', b.dataset.r === draft.rarity));
    const row = document.getElementById('rowDmg');
    if (row) row.hidden = !DMG_TYPES.includes(draft.type);
    const dmgInput = document.getElementById('cardDmg');
    if (dmgInput) dmgInput.value = draft.dmg;
    const healInput = document.getElementById('cardHeal');
    if (healInput) healInput.value = draft.heal;
    const armorInput = document.getElementById('cardArmor');
    if (armorInput) armorInput.value = draft.armor;
    const valRow = document.getElementById('rowValue');
    if (valRow) valRow.hidden = false;
    const valInput = document.getElementById('cardValue');
    if (valInput) valInput.value = draft.value;
    updateDesignerPreview();
  }

  function updateDesignerPreview() {
    const el = document.getElementById('cardPreview');
    if (!el) return;
    el.innerHTML = cardHTML({ ...draft, name: draft.name.trim(), _preview: true }, 'xl');
  }

  function bindDesignerTilt() {
    // 老板留言 #50：预览卡倾斜动画已关闭，保留空函数避免调用点报错
  }

  function saveDraftCard() {
    if (!CARD_DESIGNER_WRITES_ENABLED) return;
    if (!draft.name.trim()) { UI.log('卡牌名称不能为空', 'warn'); return; }
    const wasEditing = !!editingCard;
    const card = SDT.Cards.upsert({
      id: draft.id || undefined,
      name: draft.name.trim(),
      cost: draft.cost,
      rarity: draft.rarity,
      type: draft.type,
      dmg: DMG_TYPES.includes(draft.type) ? draft.dmg : 0,
      dmgType: DMG_TYPES.includes(draft.type) && draft.dmg > 0 ? draft.dmgType : undefined,
      draw: draft.draw > 0 ? draft.draw : undefined,      // 抽卡词条（0 = 不带词条）
      infuse: draft.infuse > 0 ? draft.infuse : undefined, // 注能词条（0 = 不带词条）
      heal: draft.heal > 0 ? draft.heal : undefined,       // 回复词条（0 = 不带词条）
      armor: draft.armor > 0 ? draft.armor : undefined,    // 护甲词条（0 = 不带词条）
      desc: draft.desc.trim(),
      value: draft.value,
      sellable: draft.sellable === true,  // 显式记录出售资格（缺省 false = 默认不可出售）
    });
    if (draft.cls) card.cls = draft.cls;         // 身份字段回写（见 openCardDesigner 草稿注释）
    if (draft.hero) card.hero = true;
    if (draft.tokenOf) card.tokenOf = draft.tokenOf;
    if (draft.unrandom) card.unrandom = true;
    // #29 备注描述：有内容写入、清空则摘除字段。upsert 内部已 saveAll，
    // 这些 upsert 之后的字段补写必须再显式落盘一次，否则关页面即丢
    if (draft.note.trim()) card.note = draft.note.trim();
    else delete card.note;
    SDT.Cards.saveAll(SDT.Cards.all());
    deps.setLastSavedId(card.id);
    Sfx.ding();
    UI.log(`[[icon:cards]] 卡牌【<b>${esc(card.name)}</b>】已${wasEditing ? '更新' : '收入照相馆'}`, 'ok');
    if (designerReturnLib) deps.renderCardLibrary();
    else deps.closeLibPage();
  }

  function closeDesigner() {
    if (designerReturnLib) deps.renderCardLibrary();
    else deps.closeLibPage();
  }

  function showCardsExportOverlay() {
    deps.setCardPageOpen(false);
    const json = JSON.stringify({ game: 'sdt', format: 'cards', version: 2, cards: SDT.Cards.all() }, null, 2);
    UI.showOverlay('[[icon:upload]] 导出卡牌', `
      <p class="ov-note">把下面的 JSON 发给开发者/AI，即可把卡牌接入战斗系统。</p>
      <textarea id="ovExport" class="ov-textarea" readonly>${esc(json)}</textarea>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="copyCards">复制到剪贴板</button>
        <button class="ov-btn" data-act="downloadCards">下载文件</button>
        <button class="ov-btn" data-act="backLib">← 返回照相馆</button>
      </div>`);
    UI.act('copyCards', async () => {
      try { await navigator.clipboard.writeText(json); UI.log('卡牌 JSON 已复制', 'ok'); }
      catch { UI.log('复制失败，请手动全选复制', 'warn'); }
    });
    UI.act('downloadCards', () => {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sdt-cards.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    UI.act('backLib', () => deps.openCardLibrary());
  }

  function showCardsImportOverlay() {
    if (!CARD_DESIGNER_WRITES_ENABLED) { deps.openCardLibrary(); return; }
    deps.setCardPageOpen(false);
    UI.showOverlay('[[icon:download]] 导入卡牌', `
      <p class="ov-note">粘贴卡牌 JSON（按 id 合并覆盖）。</p>
      <textarea id="ovImport" class="ov-textarea" placeholder='{"game":"sdt","cards":[…]}'></textarea>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="doImportCards">导入</button>
        <button class="ov-btn" data-act="backLib2">取消</button>
      </div>`);
    UI.act('doImportCards', () => {
      if (!CARD_DESIGNER_WRITES_ENABLED) return;
      const ta = document.getElementById('ovImport');
      try {
        const parsed = JSON.parse(ta.value);
        const cards = Array.isArray(parsed) ? parsed : parsed.cards;
        if (!Array.isArray(cards)) throw new Error('缺少 cards 数组');
        for (const c of cards) {
          if (!c.name) continue;
          SDT.Cards.upsert({
            id: c.id, name: String(c.name).slice(0, 12),
            cost: [0, 1, 2, 3, 4, 5].includes(+c.cost) ? +c.cost : 1,
            rarity: RARITIES.includes(c.rarity) ? c.rarity : '古朴',
            type: TYPES.includes(c.type) ? c.type : '武术',
            dmg: Math.max(0, Math.min(99, +c.dmg || 0)),
            dmgType: SDT.Cards.DMG_TYPE_META[c.dmgType] ? c.dmgType : undefined,
            draw: Math.max(0, Math.min(99, +c.draw || 0)) || undefined,
            infuse: Math.max(0, Math.min(99, +c.infuse || 0)) || undefined,
            heal: Math.max(0, Math.min(99, +c.heal || 0)) || undefined,
            armor: Math.max(0, Math.min(99, +c.armor || 0)) || undefined,
            desc: String(c.desc || '').slice(0, 100),
            value: Math.max(0, Math.min(99, +c.value || 0)),
            sellable: typeof c.sellable === 'boolean' ? c.sellable : undefined,
          });
        }
        UI.log('卡牌导入完成', 'ok');
        deps.openCardLibrary();
      } catch (err) { UI.log('导入失败：' + err.message, 'warn'); }
    });
    UI.act('backLib2', () => deps.openCardLibrary());
  }

  return { openCardDesigner, closeDesigner, showCardsExportOverlay, showCardsImportOverlay };
}
