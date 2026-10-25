import { isLegacySealedHero } from '../../cards/card-legacy-battle-policy.js';
import { hasStructuredTrigger } from '../effects/battle.trigger-source.js';

/** Battle setup and collection mechanics mutate only the injected live runtime. */
export function createSetupMechanics({ runtime: instanceRuntime, cards, combat: Combat, random: Random,
  evaluateRunes, esc, shuffle, findCard, addTempCard, sweepDead, choiceQueue, processChoice }) {
  const SEALED_HERO_ID = 'tt8-hero-sealer';
  const SEAL_LIMB_IDS = ['tt8-curseimmune', 'tt8-energycap', 'tt8-nofocus', 'tt8-healplus'];
  const SOVEREIGN_ID = 'tt8-abyss-sovereign';

  function sealCardById(id) { return cards.all().find(c => c.id === id) || null; }

  function sealSetup(card) {
    if (card?.rules?.battle?.setup) return card.rules.battle.setup;
    if (!hasStructuredTrigger(card, 'onPlay') && isLegacySealedHero(card)) {
      return { mode: 'boss', injectIds: SEAL_LIMB_IDS,
        collection: { ids: [SEALED_HERO_ID, ...SEAL_LIMB_IDS], into: SOVEREIGN_ID } };
    }
    return null;
  }

  function injectSealCards() {
    const setups = (instanceRuntime.G.ownedCards || []).filter(entry => instanceRuntime.sel.has(entry.uid))
      .map(entry => sealSetup(entry.card)).filter(setup => setup && setup.mode === instanceRuntime.mode);
    if (!setups.length) return;
    setups.forEach(setup => setup.injectIds.forEach(id => {
      const tpl = sealCardById(id);
      if (!tpl) return;
      const uid = 'bts' + Date.now().toString(36) + instanceRuntime.nextTmpSeq();
      instanceRuntime.granted.push({ uid, card: { ...tpl } });
      instanceRuntime.drawPile.push(uid);
    }));
    instanceRuntime.set$drawPile(shuffle(instanceRuntime.drawPile));
    instanceRuntime.G.log('[[icon:skull]] <b>深海封印</b>：「受缚之残影」与四张「封印肢体」沉入牌库——集齐 5 张封印之牌，破除封印！', 'sys');
  }

  function checkSealTransformation() {
    if (instanceRuntime.sealDone) return;
    const ids = new Set(instanceRuntime.hand.map(uid => findCard(uid)?.card?.id));
    const collection = [...(instanceRuntime.G.ownedCards || []), ...instanceRuntime.granted]
      .map(entry => sealSetup(entry.card)?.collection)
      .find(rule => rule && rule.ids.every(id => ids.has(id)));
    if (!collection) return;
    const sealedInHand = collection.ids.map(id => instanceRuntime.hand.find(uid => findCard(uid)?.card?.id === id));
    instanceRuntime.set$sealDone(true);
    // ① 5 张封印单卡自动消耗（进消耗区/墓地，不再可用）
    sealedInHand.forEach(u => {
      const o = findCard(u);
      const i = instanceRuntime.hand.indexOf(u);
      if (i >= 0) instanceRuntime.hand.splice(i, 1);
      instanceRuntime.consumed.push(u);
      if (instanceRuntime.mode === 'boss') instanceRuntime.grave.push(u);
      instanceRuntime.cardAnims.push({ kind: 'burn', uid: u, name: o ? o.card.name : '' });
    });
    instanceRuntime.G.log('[[icon:flask]] 5 张封印之牌在深海的辉光中燃尽……', 'sys');
    // ② 化为深渊主宰·妲莉薇特（2 费能力卡，由玩家打出引爆「旧日再临」）
    const tpl = sealCardById(collection.into);
    if (tpl) addTempCard({ ...tpl });
    instanceRuntime.G.log('[[icon:helmet]] <b>封印破除——化为深渊主宰·妲莉薇特！打出她，旧日再临。</b>', 'ok');
    sweepDead();
  }

  // —— 龙巢符文开战结算（羁绊 + 符文效果，2026-09-16 Item 定版）——
  function applyNestRunes() {
    instanceRuntime.set$nestRunes((instanceRuntime.opts && instanceRuntime.opts.nest && instanceRuntime.opts.nest.runes) || []);
    if (!instanceRuntime.nestRunes.length) return;
    instanceRuntime.set$nestSyn(evaluateRunes(instanceRuntime.nestRunes));
    instanceRuntime.G.log('[[icon:gem]] <b>研究所符文</b>生效：' + instanceRuntime.nestRunes.map(r => esc(r.name + '（' + r.attrs.join('') + '）')).join('、'), 'ok');
    instanceRuntime.nestRunes.forEach(r => {
      if (r.kind === 'attack') Combat.addBlessing(instanceRuntime.pstat, 'atkUp', 1);
      if (r.kind === 'mana') Combat.addBlessing(instanceRuntime.pstat, 'spellUp', 1);
      instanceRuntime.applyRuneFlag(r.kind);   // 符文规则旗：time/arrow/unyield/ash/infinite/holy/shield/swift/fireball/spacetime
      if (r.kind === 'bleed') instanceRuntime.foes.forEach(f => { if (!f.dead) Combat.addCurse(f, 'bleed', 1); });
      if (r.kind === 'poison') instanceRuntime.delayed.push({ text: '对所有敌人附加 1 层中毒', cardName: '中毒符文', repeat: true });
    });
    if (instanceRuntime.nestSyn.water1) {
      const cc = cards.randomClassCard(instanceRuntime.G.myClass);
      if (cc) { addTempCard({ ...cc }); instanceRuntime.G.log('[[icon:medal]] <b>水 1</b>：获得 1 张本职业卡牌', 'ok'); }
    }
    if (instanceRuntime.nestSyn.water3) instanceRuntime.delayed.push({ text: '发现 1 张本职业卡牌', cardName: '水 3 羁绊', repeat: true });
    if (instanceRuntime.nestSyn.fire1 || instanceRuntime.nestSyn.fire3) {
      instanceRuntime.set$energy(instanceRuntime.energy + (1));
      instanceRuntime.G.log('[[icon:fire]] <b>火 1</b>：首回合额外 1 点能量' + (instanceRuntime.nestSyn.fire3 ? '（火 3 每回合开始也会 +1）' : ''), 'ok');
      if (instanceRuntime.nestSyn.fire3) instanceRuntime.delayed.push({ text: '获得 1 点能量', cardName: '火 3 羁绊', repeat: true });
    }
    if (instanceRuntime.nestSyn.grass1 || instanceRuntime.nestSyn.grass3) instanceRuntime.G.log('[[icon:wood]] <b>草' + (instanceRuntime.nestSyn.grass3 ? 3 : 1) + '</b>：装备栏' + (instanceRuntime.nestSyn.grass3 ? '无上限' : '上限 +1'), 'ok');
    if (instanceRuntime.nestSyn.light1 || instanceRuntime.nestSyn.light3) {
      const n = instanceRuntime.nestSyn.light3 ? 3 : 1;
      const pool = cards.all().filter(c => c.rarity === '传说' && ['武术', '法术'].includes(c.type));
      const picked = [];
      for (let k = 0; k < n && pool.length; k++) {
        const c = pool.splice(Math.floor(Random.random('battle', 'generation') * pool.length), 1)[0];
        const zero = { ...c, cost: 0 };
        const uid0 = 'bts' + Date.now().toString(36) + instanceRuntime.nextTmpSeq();
        instanceRuntime.granted.push({ uid: uid0, card: zero });
        instanceRuntime.drawPile.push(uid0);
        picked.push(c.name);
      }
      instanceRuntime.set$drawPile(shuffle(instanceRuntime.drawPile));
      if (picked.length) instanceRuntime.G.log('[[icon:sparkles]] <b>光 ' + n + '</b>：洗入传说招式 ' + picked.join('、') + '（均为 0 费）', 'ok');
    }
    if (instanceRuntime.nestSyn.dark1 || instanceRuntime.nestSyn.dark3) instanceRuntime.G.log('[[icon:skull]] <b>暗' + (instanceRuntime.nestSyn.dark3 ? 3 : 1) + '</b>：你的伤害' + (instanceRuntime.nestSyn.dark3 ? '' : '对半血敌人') + ' +1', 'ok');
    if (instanceRuntime.nestRunes.some(r => r.kind === 'morph')) {
      const forms = cards.all().filter(c => /形态/.test(String(c.name || '')) && ['武术', '法术'].includes(c.type));
      const picks = [];
      for (let k = 0; k < 2 && forms.length; k++) picks.push(forms.splice(Math.floor(Random.random('battle', 'generation') * forms.length), 1)[0]);
      if (picks.length === 2) {
        choiceQueue.push({ cardName: '变身符文', options: picks.map(c => c.desc || c.name) }); processChoice();
        instanceRuntime.G.log('[[icon:sparkles]] <b>变身符文</b>：从 2 种随机形态中选择 1 张释放', 'sys');
      }
    }
    if (instanceRuntime.nestRunes.some(r => r.kind === 'holy')) instanceRuntime.G.log('[[icon:shield]] <b>圣洁符文</b>：前 3 回合免疫诅咒，回合结束 +4 甲', 'ok');
  }

  // 虚空符文：开局抽牌后，复制手牌与牌库中的 0 费招式各 1 张
  function applyVoidRune() {
    if (!instanceRuntime.nestRunes.some(r => r.kind === 'void')) return;
    let n = 0;
    instanceRuntime.hand.forEach(u => {
      const o = findCard(u);
      if (o && (o.card.cost || 0) === 0 && ['武术', '法术'].includes(o.card.type)) {
        addTempCard({ ...o.card }); n++;
      }
    });
    instanceRuntime.drawPile.forEach(u => {
      const o = findCard(u);
      if (o && (o.card.cost || 0) === 0 && ['武术', '法术'].includes(o.card.type)) {
        const uid1 = 'bts' + Date.now().toString(36) + instanceRuntime.nextTmpSeq();
        instanceRuntime.granted.push({ uid: uid1, card: { ...o.card } });
        instanceRuntime.drawPile.push(uid1);
        n++;
      }
    });
    if (n) instanceRuntime.G.log('[[icon:skull]] <b>虚空符文</b>：复制了 ' + n + ' 张 0 费招式', 'ok');
  }

  return { injectSealCards, checkSealTransformation, applyNestRunes, applyVoidRune };
}
