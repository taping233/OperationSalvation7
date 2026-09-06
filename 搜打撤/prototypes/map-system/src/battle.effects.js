/**
 * 将卡牌自然语言拆成稳定的结算时点。这里只解析文本，不读写战斗状态。
 * @param {string} description
 */
function splitEffectClauses(description) {
  const out = { immediate: [], turnStart: [], battle: [], onInfused: [] };
  String(description || '').split(/[。；;\n]/).forEach(source => {
    const text = source.trim();
    if (!text) return;
    let match;
    if ((match = text.match(/^被注能时[：:，,]?\s*(.+)$/))) {
      out.onInfused.push(match[1]);
      return;
    }
    if ((match = text.match(/^(每回合开始时|下回合开始时?|下个回合开始时?|回合开始时)[：:，,]?\s*(.+)$/))) {
      out.turnStart.push({ text: match[2], each: /^每回合开始时/.test(text) });
      return;
    }
    if (/^(本局对战内|本场对战|本场战斗)/.test(text)) {
      out.battle.push(text);
      return;
    }
    out.immediate.push(text);
  });
  return out;
}

/**
 * 创建文本效果执行器。所有状态变化都通过显式端口进入，解析层不再依赖战斗模块内部变量。
 * @param {object} deps
 */
function createEffectExecutor(deps) {
  const {
    combat, getAlive, getPlayerStatus, getPlayerDefense, getMode,
    log, escapeHtml, heal, pushFloat, drawCards, grantStarterAttack,
    markNoDrawNext, queueDiscover, randomDiscoverCard, addTempCard,
    addDeckCard, allCards, shuffleDeck, addEnergy, addEnergyCap,
  } = deps;

  return function applyTextEffects(card, text, target) {
    const desc = String(text || '');
    const pstat = getPlayerStatus();
    const pdef = getPlayerDefense();
    const esc = escapeHtml;
    let did = false;
    const durOv = (desc.match(/持续\s*(\d+)\s*回合/) || [])[1];
    const curseTarget = (target && !target.dead) ? target : getAlive()[0] || null;

    const bm = desc.match(/附加\s*(\d+)\s*层?\s*流血/);
    if (bm || /附加流血/.test(desc)) {
      const n = bm ? +bm[1] : 1;
      if (curseTarget) { combat.addCurse(curseTarget, 'bleed', n); log(`[[icon:blood]] <b>${esc(curseTarget.name)}</b> 附加 ${n} 层流血`, 'sys'); did = true; }
    }
    const pm = desc.match(/附加\s*(?:(\d+)\s*层)?\s*中毒/);
    if (pm) {
      const n = pm[1] ? +pm[1] : 1;
      if (curseTarget) { combat.addCurse(curseTarget, 'poison', n); log(`[[icon:skull]] <b>${esc(curseTarget.name)}</b> 附加 ${n} 层中毒（每层回合末 1 点固定伤害）`, 'sys'); did = true; }
    }
    if (!/免疫冰冻|对冰冻/.test(desc) && /附加冰冻|冰冻\s*所有|冰冻\s*\d+\s*名|冻结/.test(desc)) {
      const fm = desc.match(/(?:冻结|冰冻)状态\s*(\d+)\s*回合/);
      const n = fm ? +fm[1] : (durOv ? +durOv : 1);
      if (curseTarget) { combat.addCurse(curseTarget, 'freeze', n); log(`[[icon:crystal]] <b>${esc(curseTarget.name)}</b> 被冰冻 ${n} 回合（无法行动）`, 'sys'); did = true; }
    }
    if (/沉默/.test(desc)) {
      const n = durOv ? +durOv : 1;
      if (curseTarget) { combat.addCurse(curseTarget, 'silence', n); log(`[[icon:cross]] <b>${esc(curseTarget.name)}</b> 被沉默 ${n} 回合（技能无效，攻击除外）`, 'sys'); did = true; }
    }
    if (/破甲/.test(desc)) {
      const n = durOv ? +durOv : 2;
      if (curseTarget) { combat.addCurse(curseTarget, 'abreak', n); log(`[[icon:tools]] <b>${esc(curseTarget.name)}</b> 破甲 ${n} 回合（无法减免伤害——元素庇幕失效）`, 'sys'); did = true; }
    }
    if (/禁疗/.test(desc)) {
      const n = durOv ? +durOv : 2;
      if (curseTarget) { combat.addCurse(curseTarget, 'healban', n); log(`[[icon:heart]] <b>${esc(curseTarget.name)}</b> 禁疗 ${n} 回合（无法回复生命）`, 'sys'); did = true; }
    }

    if (/潜行/.test(desc)) {
      const stm = desc.match(/潜行(?:状态)?\s*(\d+)\s*回合/);
      const n = stm ? +stm[1] : (durOv ? +durOv : 1);
      combat.addBlessing(pstat, 'stealth', n);
      log(`[[icon:runner]] <b>祝福·潜行</b>：${n} 回合内无法成为被攻击对象（造成伤害会破除）`, 'ok');
      did = true;
    }
    const atkB = !/状态下/.test(desc)
      ? (desc.match(/攻击\s*\+\s*(\d+)/) || desc.match(/攻\s*\+\s*(\d+)/) ||
         desc.match(/\+\s*(\d+)\s*攻/) || desc.match(/获得\s*(\d+)\s*点?攻击力?/))
      : null;
    if (atkB) {
      combat.addBlessing(pstat, 'atkUp', +atkB[1]);
      log(`[[icon:swords]] <b>祝福·攻击力增加</b>：攻击力 +${atkB[1]}（本场战斗，当前加成 ${pstat.status.atkUp}）`, 'ok');
      did = true;
    }
    const spB = !/状态下/.test(desc)
      ? (desc.match(/法伤\s*\+\s*(\d+)/) || desc.match(/法术伤害\s*\+\s*(\d+)/))
      : null;
    if (spB) {
      combat.addBlessing(pstat, 'spellUp', +spB[1]);
      log(`[[icon:crystal]] <b>祝福·法伤增加</b>：法术伤害 +${spB[1]}（本场战斗，当前加成 ${pstat.status.spellUp}）`, 'ok');
      did = true;
    }
    if (/免疫伤害/.test(desc) || /无敌/.test(desc)) {
      const im = desc.match(/(\d+)\s*回合内[^。]*无敌/) || desc.match(/无敌[^。]*?(\d+)\s*回合/);
      const n = im ? +im[1] : (durOv ? +durOv : 1);
      combat.addBlessing(pstat, 'immune', n);
      log(`[[icon:sparkles]] <b>祝福·免疫伤害</b>：${n} 回合内不受到任何伤害`, 'ok');
      did = true;
    }
    const rdB = desc.match(/减伤\s*(\d+)?/);
    if (rdB) {
      const n = rdB[1] ? +rdB[1] : 1;
      combat.addBlessing(pstat, 'reduce', n);
      log(`[[icon:plate]] <b>祝福·减伤</b>：每次受到的伤害 -${n}（本场战斗）`, 'ok');
      did = true;
    }
    if (/剑仙形态/.test(desc) || /每回合额外抽\s*\d+\s*张/.test(desc)) {
      combat.addBlessing(pstat, 'swordForm');
      log('[[icon:sword]] <b>祝福·剑仙形态</b>：回合开始时额外抽 1 张牌（本局对战）', 'ok');
      did = true;
    }
    if (/自然形态/.test(desc) || /回合开始时[^。]*获得\s*\d+\s*点?能量/.test(desc)) {
      combat.addBlessing(pstat, 'natureForm');
      log('[[icon:wood]] <b>祝福·自然形态</b>：回合开始时额外获得 1 点能量（本局对战）', 'ok');
      did = true;
    }
    if (/宇宙形态/.test(desc)) {
      combat.addBlessing(pstat, 'cosmosForm');
      log('[[icon:sparkles]] <b>祝福·宇宙形态</b>：本局对战内，所有卡牌变为 1 费', 'ok');
      did = true;
    }

    let healed = false, armored = false;
    const hm = desc.match(/回复\s*(\d+)\s*(?:点\s*生命|点?血)/) || desc.match(/\+\s*(\d+)\s*血/);
    if (hm) {
      healed = true;
      if ((pstat.status.healban || 0) > 0) {
        log(`[[icon:heart]] 禁疗中：回复 ${hm[1]} 点生命无效（还剩 ${pstat.status.healban} 回合）`, 'warn');
      } else { heal(+hm[1]); pushFloat({ unit: 'self', text: '💚', cls: 'stk', warm: true }); }
      did = true;
    }
    const am = desc.match(/获得\s*(\d+)\s*点?\s*护甲/) || desc.match(/\+\s*(\d+)\s*甲/);
    if (am) { armored = true; pdef.armor += +am[1]; log(`[[icon:plate]] 获得 ${am[1]} 点护甲`, 'sys'); did = true; }
    const sm = desc.match(/获得\s*(\d+)\s*点?\s*护盾/);
    if (sm) { pdef.shield += +sm[1]; log(`[[icon:shield]] 获得 ${sm[1]} 点护盾`, 'sys'); did = true; }
    if (/本回合所受伤害降为/.test(desc)) {
      pdef.guard = true;
      log('[[icon:shield]] 格挡：本回合所受伤害降为 1', 'sys');
      did = true;
    }
    if (/净化/.test(desc)) {
      const cleared = combat.purify(pstat);
      log(cleared.length
        ? `[[icon:sparkles]] 净化：清除了身上的 ${cleared.map(k => combat.CURSE_META[k].name).join('、')}`
        : '[[icon:sparkles]] 净化：身上没有诅咒，干干净净', 'ok');
      did = true;
    }

    let drawn = false;
    const dm = desc.match(/抽\s*(\d+)\s*张牌/);
    if (dm) {
      const n = +dm[1];
      if (getMode() === 'boss') {
        const got = drawCards(n);
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：抽了 ${got} 张牌`, 'sys');
      } else {
        grantStarterAttack(n);
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：获得 ${n} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
      }
      did = true; drawn = true;
    }
    if (/下回合无法抽牌|下个回合无法抽牌/.test(desc)) {
      markNoDrawNext();
      log('[[icon:cross]] 已标记：<b>下回合开始无法抽牌</b>', 'sys');
      did = true;
    }
    const dcm = desc.match(/发现\s*(?:(\d+)\s*张)?\s*(传说)?(?:卡牌|牌|卡)/);
    if (dcm) { queueDiscover({ n: dcm[1] ? +dcm[1] : 1, rarity: dcm[2] || null }); did = true; }
    const rm = desc.match(/(?:获得|获取)\s*(\d+)\s*张随机卡牌/) || desc.match(/随机获取\s*(\d+)\s*张卡牌/);
    if (rm) {
      const n = +(rm[1] || rm[2]);
      let got = 0;
      for (let i = 0; i < n; i++) {
        const discovered = randomDiscoverCard(null);
        if (discovered) { addTempCard(discovered); got++; }
      }
      log(`[[icon:cards]] <b>${esc(card.name)}</b>：随机获得 ${got} 张卡牌（置入手牌，战后消散）`, 'loot');
      did = true;
    }

    const shR = desc.match(/洗入\s*(\d+)\s*张随机卡牌/);
    const shN = desc.match(/将\s*(?:(\d+)\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?(?:洗入|放入|置入)牌库/);
    if (shR || shN) {
      const added = [];
      if (shR) {
        for (let i = 0; i < +shR[1]; i++) {
          const discovered = randomDiscoverCard(null);
          if (discovered) { addDeckCard(discovered); added.push(discovered.name); }
        }
      }
      if (shN) {
        const tpl = allCards().find(candidate => candidate.name === shN[2]);
        const count = shN[1] ? +shN[1] : 1;
        if (tpl) {
          for (let i = 0; i < count; i++) { addDeckCard(tpl); added.push(tpl.name); }
        } else {
          log(`[[icon:question]] 【${esc(card.name)}】找不到可洗入牌库的卡牌「${esc(shN[2])}」（占位）`, 'warn');
        }
      }
      if (added.length) {
        const deckSize = shuffleDeck();
        const counts = {};
        added.forEach(name => { counts[name] = (counts[name] || 0) + 1; });
        log(`[[icon:recycle]] <b>${esc(card.name)}</b>：将 ${Object.keys(counts).map(name => `【${esc(name)}】×${counts[name]}`).join('、')} 洗入牌库` +
          `（牌库 ${deckSize} 张，已洗混）`, 'sys');
        did = true;
      }
    }
    const hdN = desc.match(/将\s*(?:(\d+)\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?置入手牌/);
    if (hdN) {
      const tpl = allCards().find(candidate => candidate.name === hdN[2]);
      const count = hdN[1] ? +hdN[1] : 1;
      if (tpl) {
        for (let i = 0; i < count; i++) addTempCard(tpl);
        log(`[[icon:cards]] <b>${esc(card.name)}</b>：将 ${count} 张【${esc(tpl.name)}】置入手牌（战斗内临时卡，战后消散）`, 'loot');
      } else {
        log(`[[icon:question]] 【${esc(card.name)}】找不到可置入手牌的卡牌「${esc(hdN[2])}」（占位）`, 'warn');
      }
      did = true;
    }
    const em = desc.match(/获得\s*(\d+)\s*点?能量/);
    if (em) {
      const current = addEnergy(+em[1]);
      log(`[[icon:bolt]] 获得 ${em[1]} 点能量（当前 ${current}）`, 'sys');
      did = true;
    }
    const cm = desc.match(/能量上限\s*\+\s*(\d+)/);
    if (cm) {
      const currentMax = addEnergyCap(+cm[1]);
      log(`[[icon:bolt]] 本场战斗能量上限 +${cm[1]}（每回合 ${currentMax} 费）`, 'sys');
      did = true;
    }
    return { did, drawn, healed, armored };
  };
}

export { createEffectExecutor, splitEffectClauses };
