import { DATA } from '../core/data-loader.js';
import { characterFor, characterName, migrateCharacterProgress } from '../core/characters.js';
import { Random } from '../core/random.js';

  const SDT = window.SDT;

  const LEVEL_MAX = 10;
  // 2026-09-09 需求 #5：升级速度随等级变慢（约 10 次通关满级），每级 +1 生命上限
  const xpForNext = (lv) => 50 + (Math.max(1, lv) - 1) * 40;   // 升到 lv+1 所需经验

  const B = () => SDT.Base;
  // 职业熟练度迁移（2026-09-05 职业整合定版）：旧职业的熟练度并入新职业——
  // 战士/牧师/法师/降临者同名直接沿用；侠客取 刺客/剑客/游侠 中熟练度最高的一份。
  // 惰性执行：第一次访问新职业数据时并入一次，旧条目保留不清除（回滚安全）。
  const clsData = (cls) => {
    const base = migrateCharacterProgress(B().data);
    const character = characterFor(cls);
    if (character) return base.characters[character.id];
    const d = base.classes;
    if (!d[cls]) d[cls] = { lv: 1, xp: 0 };
    return d[cls];
  };
  const classLv = (cls) => clsData(cls).lv;
  const classXP = (cls) => clsData(cls).xp;

  // 职业清单（来自卡牌库职业表；卡牌库异常时兜底空表）
  const classList = () => {
    try { return (SDT.Cards.CLASSES || []).slice(); } catch { return []; }
  };
  // 职业加成文本（出征时生效）：每级 +1 生命上限（2026-09-09 需求 #5）
  const perkText = (lv) => `生命上限 +${Math.max(0, (lv - 1) * 1)}`;

  // M02 事务门面使用的纯规则：只改调用方提供的 draft，不保存、不播音效、不写 UI。
  // 保持与 addXP 完全相同的等级上限和逐级扣经验口径。
  function addXpToProgress(progress, amount) {
    const before = { lv: Math.max(1, Number(progress && progress.lv) || 1), xp: Math.max(0, Number(progress && progress.xp) || 0) };
    const after = { ...before };
    const gain = Math.max(0, Number(amount) || 0);
    if (after.lv < LEVEL_MAX && gain > 0) {
      after.xp += gain;
      while (after.lv < LEVEL_MAX && after.xp >= xpForNext(after.lv)) {
        after.xp -= xpForNext(after.lv);
        after.lv++;
      }
    }
    return Object.freeze({ before: Object.freeze(before), after: Object.freeze(after), levelsGained: after.lv - before.lv });
  }

  const collectionXpFor = card => card && card.type === '能力卡' ? 50 : 10;

  // 增加经验并处理升级；返回升级次数
  function addXP(cls, amount) {
    if (!cls || amount <= 0) return 0;
    const d = clsData(cls);
    if (d.lv >= LEVEL_MAX) return 0;
    d.xp += amount;
    let ups = 0;
    while (d.lv < LEVEL_MAX && d.xp >= xpForNext(d.lv)) {
      d.xp -= xpForNext(d.lv);
      d.lv++; ups++;
      B().save();
      if (SDT.Sound) SDT.Sound.sfx('levelup');
      if (SDT.UI) SDT.UI.log(`[[icon:medal]] <b>${characterName(cls)}</b> 熟练度提升！现在是 <b>Lv.${d.lv}</b>（出征 ${perkText(d.lv)}）`, 'ok');
    }
    B().save();
    return ups;
  }

  // ---------- 成就定义 ----------
  // done(stats) 依据基地统计判定；reward 为领取后的基地物资；
  // back 为领取后解锁的卡背（id 对应 Cards.CARD_BACKS，v0.21）。
  // 成就展示/奖励数据外置 game/data/achievements.json（2026-09-11 架构批次 2）；
  // done 判定函数无法进 JSON，按 id 关联留在此处。
  const ACH_DONE = {
    firstExtract: (s) => s.extracts >= 1,
    extract3: (s) => s.extracts >= 3,
    kill10: (s) => s.kills >= 10,
    firstBoss: (s) => s.bossKills.length >= 1,
    allBoss: (s) => s.bossKills.length >= 3,
    rich30: (s) => s.bestRunCoins >= 30,
    stash20: (s) => s.stashTotal >= 20,
    bagMax: (_s, d) => (d
      ? SDT.MAP.rules.bagSize + (d.bagUp || 0)
      : SDT.Base.bagCap()) >= SDT.MAP.rules.bagMax,
    // v2 基地：安全格由「携带宠物等级」驱动（safeUp 已废除）——旧公式 safeStart+safeUp
    // 恒为 safeStart，成就永久死锁（2026-09-19 审计 P2-10）。此处按数据自算，peek 档与当前档通用。
    safeMax: (_s, d) => {
      const R = SDT.MAP.rules;
      const src = d || B().data;
      const rec = src.petSel ? (src.pets || {})[src.petSel] : null;
      const petDef = rec && (SDT.Base.PETS || []).find(p => p.id === src.petSel);
      const lv = rec ? Math.max(1, Math.min(SDT.Base.PET_LEVEL_MAX || 5, rec.lv || 1)) : 1;
      const bonus = (petDef && petDef.effect && petDef.effect.safeBonus) || 0;
      return Math.min(R.safeMax, R.safeStart + lv - 1) + bonus >= R.safeMax;
    },
    class3: (_s, d) => d
      ? Object.values(d.characters || d.classes || {}).some(c => (c.lv || 1) >= 3)
      : classList().some(c => classLv(c) >= 3),
    collectGold: (_s, d) => !!(((d || B().data).collection || {})['tt-gold']),
    collectLegend: (_s, d) => Object.values((d || B().data).collection || {})
      .some(c => c.rarity === '传说'),
    collect5: (_s, d) => Object.keys((d || B().data).collection || {}).length >= 5,
    petHatch1: (_s, d) => petHatchedN(d) >= 1,
    petHatch3: (_s, d) => petHatchedN(d) >= 3,
    petMax: (_s, d) => Object.values((d || B().data).pets || {}).some(p => (p.lv || 1) >= 5),
    petAll: (_s, d) => Object.keys((d || B().data).pets || {}).length >= (SDT.Base.PETS || []).length,
    unlimitedEnergy: (_s, d) => ((d || B().data).stats || {}).turnMovesMax >= 10,
    weaponMaster: (_s, d) => ((d || B().data).stats || {}).battleEquipsMax >= 5,
    runeFan: (_s, d) => new Set(((d || B().data).runes || []).flatMap(r2 => r2.attrs)).size >= 5,
    savior: (_s, d) => (((d || B().data).stats || {}).nestBossKills || []).length >= 2,
    beautifulVase: (_s, d) => ((d || B().data).runes || []).some(r2 => r2.attrs.length >= 2 && r2.kind === 'rainbow'),
    excuseMe: (_s, d) => ((d || B().data).stats || {}).reviveKills >= 1,
    // 09-24 定版：研究所结算分数累计档（分数在 game.nest.doNestExtract 落 stats.labTotalScore）
    labScore1: (_s, d) => (((d || B().data).stats || {}).labTotalScore || 0) >= 500,
    labScore2: (_s, d) => (((d || B().data).stats || {}).labTotalScore || 0) >= 1500,
    labScore3: (_s, d) => (((d || B().data).stats || {}).labTotalScore || 0) >= 4000,
  };
  const ACHIEVEMENTS = DATA.achievements.achievements.map(a => ({ ...a, done: ACH_DONE[a.id] }));
  // 孵化计数 = 已拥有宠物数 - 初始宠物（汪汪狗自动获得，不算孵化）
  const petHatchedN = (d) => Math.max(0, Object.keys((d || B().data).pets || {}).length - 1);

  // ---------- 职业收藏室（2026-09-09：成就系统升级为「成就与职业收藏室系统」）----------
  // 收藏池 = 在册职业卡（rarity=职业 且归属五职业）+ 能力卡（type=能力卡 且有归属）；
  // 职业整合时退役的旧职业卡（已去 cls）与能力卡的衍生牌不入池、不计进度。
  const isCollectible = (card) => !!card && !!card.cls &&
    classList().includes(card.cls) &&
    (card.rarity === '职业' || card.type === '能力卡');
  const collectPool = () => {
    try { return SDT.Cards.all().filter(isCollectible); } catch { return []; }
  };
  const collTotal = () => collectPool().length;
  // 收藏进度 = 图鉴中「不同」的职业卡 + 能力卡 张数
  const collProgress = (d) => {
    d = d || B().data;
    return collectPool().filter(c => !!d.collection[c.id]).length;
  };

  // 一次性收藏里程碑：need 为收藏张数，'all' = 全收集
  // 里程碑数据外置 achievements.json 的 collectionMilestones 字段（同上批次 2）
  const COLL_MILESTONES = DATA.achievements.collectionMilestones;
  const collMsById = (id) => COLL_MILESTONES.find(m => m.id === id);
  const collMsNeed = (m) => (m.need === 'all' ? collTotal() : m.need);
  const collMsReached = (m, d) => collProgress(d) >= collMsNeed(m);
  const isCollClaimed = (id) => !!B().data.collClaimed[id];
  const pendingColl = () => COLL_MILESTONES.filter(m => !isCollClaimed(m.id) && collMsReached(m));

  // 里程碑奖励文案（收藏室页 + 领奖播报共用）
  function collRewardText(m) {
    const parts = [];
    if (m.reward.wood) parts.push(`[[icon:wood]] 木材 ×${m.reward.wood}`);
    if (m.reward.rations) parts.push(`[[icon:bread]] 口粮 ×${m.reward.rations}`);
    if (m.reward.keys) parts.push(`[[icon:key]] 钥匙 ×${m.reward.keys}`);
    if (m.reward.legend) parts.push(`[[icon:medal]] 传说卡 ×${m.reward.legend}`);
    if (m.reward.egg) parts.push(`[[icon:crystal]] 宠物蛋 ×${m.reward.egg}`);
    return parts.join(' · ');
  }

  // 领取收藏里程碑奖励（每个一次性）。卡牌奖励（传说卡/宠物蛋）入卡牌仓库，
  // 容量不足则整批缓发：返回 {ok:false, why:'full'}。
  function claimColl(id) {
    const m = collMsById(id);
    if (!m || isCollClaimed(id) || !collMsReached(m)) return { ok: false };
    const cards = [];
    if (m.reward.legend) {
      // 传说卡与「员工通行证」同池：稀有度传说且可随机获得
      const pool = SDT.Cards.all().filter(c => c.rarity === '传说' && SDT.Cards.isRandomObtainable(c));
      const taken = new Set();
      for (let k = 0; k < m.reward.legend; k++) {
        const free = pool.filter(c => !taken.has(c.id));
        if (!free.length) break;
        const got = free[Math.floor(Random.random('coll') * free.length)];
        taken.add(got.id);
        cards.push({ card: { ...got }, count: 1 });
      }
    }
    if (m.reward.egg) {
      const egg = (SDT.Cards.all() || []).find(c => c.id === (SDT.Base.PET_EGG_ID || 'pet-egg'));
      if (egg) cards.push({ card: { ...egg }, count: 1 });
    }
    if (cards.length && SDT.Base.stashRoom() < cards.reduce((a, c) => a + (c.count || 1), 0)) {
      return { ok: false, why: 'full', msg: '仓库容量不足——先卖出或扩建卡牌仓库再来领取' };
    }
    B().data.collClaimed[id] = true;
    if (m.reward.wood) B().data.wood += m.reward.wood;
    if (m.reward.rations) B().data.rations += m.reward.rations;
    if (m.reward.keys) B().data.keys = (B().data.keys || 0) + m.reward.keys;
    if (cards.length) B().depositCards(cards);
    B().save();
    const msg = `[[icon:sparkles]] 领取职业收藏奖励【收藏 ${collMsNeed(m)} 张】：${collRewardText(m)}`;
    if (SDT.UI) SDT.UI.log(msg, 'loot');
    return { ok: true, msg };
  }

  // 收藏经验结算（仓库收藏动作后调用）：职业卡 +10 / 能力卡 +50 人物经验。
  // 2026-09-16 定版（Item 15）：重复收藏重复获得经验——取消「同一张只结算一次」的门槛；
  // 收藏进度（data.collection）仍只在首次收藏时登记（见 game.hub collCollectOne）。
  function onCollect(card, now) {
    if (!now || !isCollectible(card)) return null;
    const d = B().data;
    if (!d.collXp) d.collXp = {};
    const amount = card.type === '能力卡' ? 50 : 10;
    const ups = addXP(card.cls, amount);
    if (SDT.UI) {
      SDT.UI.log(`[[icon:medal]] ${characterName(card.cls)} 收藏入室，获得 <b>${amount}</b> 点人物经验` +
        `${ups ? `（升级了 ${ups} 级！）` : ''}`, 'ok');
    }
    checkCollMilestones();
    return { cls: card.cls, amount, ups };
  }

  // 老档回填：本特性上线前已收藏的职业卡按已结算处理（旧版收藏动作即时发过 +10），
  // 能力卡的 +50 为新增——不回填，已收藏的能力卡再次收藏时补结算一次。
  function syncCollXp() {
    const d = B().data;
    if (!d.collXp || typeof d.collXp !== 'object') d.collXp = {};
    let dirty = false;
    Object.keys(d.collection || {}).forEach(id => {
      if (d.collXp[id]) return;
      const card = collectPool().find(c => c.id === id);
      if (card && card.rarity === '职业') { d.collXp[id] = true; dirty = true; }
    });
    if (dirty) B().save();
  }

  // 播报去重按档位隔离（迭代评审 09-20 C-P3）：_seen 此前挂在模块级 ACHIEVEMENTS/
  // COLL_MILESTONES 定义对象上、会话内不清——档位 1 解锁过的成就到档位 2 不再播报。
  // 以 Base.slot 为键分桶，换档自动换新集合
  const seenBySlot = new Map();
  const seenSet = () => {
    const k = (SDT.Base && SDT.Base.slot) || 'default';
    if (!seenBySlot.has(k)) seenBySlot.set(k, new Set());
    return seenBySlot.get(k);
  };

  // 收藏进度达成播报（每次收藏后检查；未领取的里程碑只播报一次）
  function checkCollMilestones() {
    const seen = seenSet();
    const fresh = COLL_MILESTONES.filter(m => !isCollClaimed(m.id) && collMsReached(m) && !seen.has('coll:' + m.id));
    fresh.forEach(m => { seen.add('coll:' + m.id); });
    fresh.forEach(m => {
      if (SDT.UI) {
        SDT.UI.log(`[[icon:sparkles]] 职业收藏进度达成 <b>${collMsNeed(m)} / ${collTotal()}</b>` +
          `——回基地收藏室领取：${collRewardText(m)}`, 'loot');
      }
    });
    return fresh;
  }

  const achById = (id) => ACHIEVEMENTS.find(a => a.id === id);
  const isUnlocked = (a, data) => {
    const d = data || B().data;
    try { return !!a.done(d.stats, d); } catch { return false; }
  };
  const isClaimed = (id) => !!B().data.achClaimed[id];
  const pendingAch = () => ACHIEVEMENTS.filter(a => isUnlocked(a) && !isClaimed(a.id));

  // 领取奖励：返回 {ok, msg}
  // 09-24 扩展：支持 keys（此前 JSON 里 runeFan 等写了 keys 但 claim 从未发放——顺带修复）
  // 与 card（指定现役卡 id 入仓库，复用现有卡池；容量不足整单缓发，与 claimColl 同口径）
  function claim(id) {
    const a = achById(id);
    if (!a || !isUnlocked(a) || isClaimed(id)) return { ok: false };
    const cards = [];
    if (a.reward.card) {
      const c = SDT.Cards.all().find(x => x.id === a.reward.card);
      if (c) cards.push({ card: { ...c }, count: 1 });
    }
    if (cards.length && SDT.Base.stashRoom() < 1) {
      return { ok: false, why: 'full', msg: '仓库容量不足——先卖出或扩建卡牌仓库再来领取' };
    }
    B().data.achClaimed[id] = true;
    B().data.wood += a.reward.wood || 0;
    B().data.rations += a.reward.rations || 0;
    if (a.reward.keys) B().data.keys = (B().data.keys || 0) + a.reward.keys;
    if (cards.length) B().depositCards(cards);
    if (a.back) B().unlockBack(a.back);   // 卡背奖励：随成就领取解锁（v0.21）
    B().save();
    const parts = [];
    if (a.reward.wood) parts.push(`[[icon:wood]] 木材 ×${a.reward.wood}`);
    if (a.reward.rations) parts.push(`[[icon:bread]] 口粮 ×${a.reward.rations}`);
    if (a.reward.keys) parts.push(`[[icon:key]] 钥匙 ×${a.reward.keys}`);
    cards.forEach(c => parts.push(`[[icon:cards]] 【${c.card.name}】`));
    if (a.back) {
      const bd = (SDT.Cards.CARD_BACKS || []).find(b => b.id === a.back);
      parts.push(`[[icon:cards]] 卡背【${bd ? bd.name : a.back}】`);
    }
    const msg = `[[icon:trophy]] 领取成就奖励【${a.name}】：${parts.join(' · ')}`;
    if (SDT.UI) SDT.UI.log(msg, 'loot');
    return { ok: true, msg };
  }

  // 已领取的带卡背成就 → 补发卡背（v0.21 升级时老存档回填）
  function syncBackUnlocks() {
    ACHIEVEMENTS.forEach(a => { if (a.back && isClaimed(a.id)) B().unlockBack(a.back); });
  }

  // 解锁检测：返回本次新解锁的成就（只播报一次）
  function checkUnlocks() {
    syncBackUnlocks();
    syncCollXp();
    const seen = seenSet();
    const fresh = ACHIEVEMENTS.filter(a => isUnlocked(a) && !isClaimed(a.id) && !seen.has('ach:' + a.id));
    fresh.forEach(a => { seen.add('ach:' + a.id); });
    fresh.forEach(a => {
      if (SDT.UI) SDT.UI.log(`[[icon:trophy]] 成就解锁【<b>${a.name}</b>】${a.desc}——回基地领取奖励`, 'loot');
    });
    return fresh;
  }

  // ---------- 事件埋点（经验计入本局所选职业 d.cls） ----------
  // type: kill / extract / death / action / stash
  function track(type, d) {
    d = d || {};
    const s = B().data.stats;
    let changed = true;
    switch (type) {
      case 'turnMoves':
        if ((d.n || 0) > (s.turnMovesMax || 0)) s.turnMovesMax = d.n;
        break;
      case 'battleEquips':
        if ((d.n || 0) > (s.battleEquipsMax || 0)) s.battleEquipsMax = d.n;
        break;
      case 'reviveKill':
        s.reviveKills = (s.reviveKills || 0) + 1;
        break;
      case 'kill':
        if (d.boss) {
          if (!s.bossKills.includes(d.name)) s.bossKills.push(d.name);
          s.kills++;
          addXP(d.cls, Math.round(40 * xpMul()));
        } else {
          s.kills++;
          addXP(d.cls, Math.round(6 * xpMul()));
        }
        break;
      // （extract/death 两 case 已删：全仓无 track('extract'/'death') 调用方的孤儿副本，
      //   2026-09-25 老板批准的休眠代码清理。统计如需恢复请随调用点一并加回。）
      case 'action':
        s.actions++;
        break;
      case 'stash':
        s.stashTotal += d.count || 0;
        break;
      default:
        changed = false;
    }
    if (changed) B().save();
    checkUnlocks();
  }

  // 经验倍率：随本局玩法模式（由 game.js 在开局时设置）
  let _xpMul = 1;
  const xpMul = () => _xpMul;
  function setXpMul(m) { _xpMul = m || 1; }

  // 职业页汇总（基地 UI 用）
  function classSummary() {
    return classList().map(cls => {
      const lv = classLv(cls), xp = classXP(cls), need = xpForNext(lv);
      let pool = 0;
      try { pool = SDT.Cards.classPool(cls).length; } catch { /* 卡池未开放/未定义（早期存档）：按 0 张 */ }
      return { cls, lv, xp, need, maxed: lv >= LEVEL_MAX, pool };
    });
  }

  SDT.Meta = {
    LEVEL_MAX, xpForNext, perkText,
    addXpToProgress, collectionXpFor,
    classList, classLv, classXP, addXP, classSummary,
    ACHIEVEMENTS, achById, isUnlocked, isClaimed, pendingAch, claim, checkUnlocks, syncBackUnlocks,
    track, setXpMul,
    // —— 职业收藏室（2026-09-09）——
    isCollectible, collectPool, collTotal, collProgress,
    COLL_MILESTONES, collMsById, collMsNeed, collMsReached, collRewardText,
    isCollClaimed, pendingColl, claimColl, onCollect, checkCollMilestones, syncCollXp,
  };

export { SDT };
export { LEVEL_MAX, xpForNext, perkText, addXpToProgress, collectionXpFor };
