/* ============================================================
 * 搜打撤 v0.9 —— 局外成长：职业熟练度等级 + 成就（数据存于基地存档）
 *
 * 职业：与卡牌库的职业卡同源（SDT.Cards.CLASSES，开局二选一）。
 * 每个职业有持久熟练度等级（1~10），以该职业出征时：
 *   每级 生命上限 +2（Lv.1 为基础，升级立即生效于下一局出征）。
 * 经验（计入本局所选职业）：小怪 +6 · BOSS +40
 *   · 撤离成功 +20+2×行动次数 · 撤离失败安慰 +5（受玩法经验倍率修正）
 *
 * 成就：基于基地统计自动解锁，回基地领取少量物资奖励。
 * ============================================================ */
(function () {
  const SDT = window.SDT;

  const LEVEL_MAX = 10;
  const xpForNext = (lv) => 50 + (Math.max(1, lv) - 1) * 30;   // 升到 lv+1 所需经验

  const B = () => SDT.Base;
  const clsData = (cls) => {
    const d = B().data.classes;
    if (!d[cls]) d[cls] = { lv: 1, xp: 0 };
    return d[cls];
  };
  const classLv = (cls) => clsData(cls).lv;
  const classXP = (cls) => clsData(cls).xp;

  // 职业清单（来自卡牌库职业表；卡牌库异常时兜底空表）
  const classList = () => {
    try { return (SDT.Cards.CLASSES || []).slice(); } catch (e) { return []; }
  };
  // 职业加成文本（出征时生效）
  const perkText = (lv) => `生命上限 +${Math.max(0, (lv - 1) * 2)}`;

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
      if (SDT.UI) SDT.UI.log(`[[icon:medal]] <b>${cls}</b> 熟练度提升！现在是 <b>Lv.${d.lv}</b>（出征 ${perkText(d.lv)}）`, 'ok');
    }
    B().save();
    return ups;
  }

  // ---------- 成就定义 ----------
  // done(stats) 依据基地统计判定；reward 为领取后的基地物资；
  // back 为领取后解锁的卡背（id 对应 Cards.CARD_BACKS，v0.21）。
  const ACHIEVEMENTS = [
    { id: 'firstExtract', icon: '[[icon:exit]]', name: '初出茅庐', desc: '首次撤离成功',
      reward: { wood: 2 }, done: (s) => s.extracts >= 1 },
    { id: 'extract3', icon: '[[icon:bag]]', name: '老练搜刮者', desc: '累计撤离成功 3 次',
      reward: { rations: 2 }, done: (s) => s.extracts >= 3 },
    { id: 'kill10', icon: '[[icon:swords]]', name: '猎手', desc: '累计击败 10 个敌人',
      reward: { wood: 2 }, back: 'wolf', done: (s) => s.kills >= 10 },
    { id: 'firstBoss', icon: '[[icon:skull]]', name: '弑神者', desc: '首次击败祭坛 BOSS',
      reward: { wood: 3 }, back: 'boss', done: (s) => s.bossKills.length >= 1 },
    { id: 'allBoss', icon: '[[icon:crystal]]', name: '祭坛征服者', desc: '击败全部 3 只祭坛 BOSS',
      reward: { rations: 3 }, back: 'altar', done: (s) => s.bossKills.length >= 3 },
    { id: 'rich30', icon: '[[icon:coin]]', name: '小有积蓄', desc: '单局撤离时携带 ≥ 30 币',
      reward: { rations: 2 }, back: 'coin', done: (s) => s.bestRunCoins >= 30 },
    { id: 'stash20', icon: '[[icon:archive]]', name: '仓廪充实', desc: '累计运回 20 张卡牌入库',
      reward: { rations: 2 }, back: 'vault', done: (s) => s.stashTotal >= 20 },
    { id: 'bagMax', icon: '[[icon:bag]]', name: '能工巧匠', desc: '背包扩建至满级（30 格）',
      reward: { rations: 3 }, done: (_s, d) => (d
        ? SDT.MAP.rules.bagSize + (d.bagUp || 0)
        : SDT.Base.bagCap()) >= SDT.MAP.rules.bagMax },
    { id: 'safeMax', icon: '[[icon:paw]]', name: '最忠实的伙伴', desc: '宠物安全格升满（6 格）',
      reward: { wood: 3 }, back: 'pet', done: (_s, d) => (d
        ? SDT.MAP.rules.safeStart + (d.safeUp || 0)
        : SDT.Base.safeCap()) >= SDT.MAP.rules.safeMax },
    { id: 'class3', icon: '[[icon:medal]]', name: '崭露头角', desc: '任意职业熟练度达到 3 级',
      reward: { wood: 2 }, done: (_s, d) => d
        ? Object.values(d.classes || {}).some(c => (c.lv || 1) >= 3)
        : classList().some(c => classLv(c) >= 3) },
    // ---- 收藏图鉴成就（v0.23）：在基地仓库[[icon:sparkles]]收藏物品后解锁 ----
    { id: 'collectGold', icon: '[[icon:coin]]', name: '珍品收藏家', desc: '收藏桌游珍宝「金币」',
      reward: { wood: 2 }, done: (_s, d) => !!(((d || B().data).collection || {})['tt-gold']) },
    { id: 'collectLegend', icon: '[[icon:medal]]', name: '传说典藏', desc: '收藏任意一张传说卡牌',
      reward: { rations: 2 }, done: (_s, d) => Object.values((d || B().data).collection || {})
        .some(c => c.rarity === '传说') },
    { id: 'collect5', icon: '[[icon:home]]', name: '博物学家', desc: '收藏 5 张不同的卡牌',
      reward: { rations: 3 }, done: (_s, d) => Object.keys((d || B().data).collection || {}).length >= 5 },
  ];

  const achById = (id) => ACHIEVEMENTS.find(a => a.id === id);
  const isUnlocked = (a, data) => {
    const d = data || B().data;
    try { return !!a.done(d.stats, d); } catch (e) { return false; }
  };
  const isClaimed = (id) => !!B().data.achClaimed[id];
  const pendingAch = () => ACHIEVEMENTS.filter(a => isUnlocked(a) && !isClaimed(a.id));

  // 领取奖励：返回 {ok, msg}
  function claim(id) {
    const a = achById(id);
    if (!a || !isUnlocked(a) || isClaimed(id)) return { ok: false };
    B().data.achClaimed[id] = true;
    B().data.wood += a.reward.wood || 0;
    B().data.rations += a.reward.rations || 0;
    if (a.back) B().unlockBack(a.back);   // 卡背奖励：随成就领取解锁（v0.21）
    B().save();
    const parts = [];
    if (a.reward.wood) parts.push(`[[icon:wood]] 木材 ×${a.reward.wood}`);
    if (a.reward.rations) parts.push(`[[icon:bread]] 口粮 ×${a.reward.rations}`);
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
    const fresh = ACHIEVEMENTS.filter(a => isUnlocked(a) && !isClaimed(a.id) && !a._seen);
    fresh.forEach(a => { a._seen = true; });
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
      case 'extract':
        s.extracts++;
        s.bestRunCoins = Math.max(s.bestRunCoins, d.coins || 0);
        addXP(d.cls, Math.round((20 + (d.actions || 0) * 2) * xpMul()));
        break;
      case 'death':
        s.deaths++;
        addXP(d.cls, 5);
        break;
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
      try { pool = SDT.Cards.classPool(cls).length; } catch (e) {}
      return { cls, lv, xp, need, maxed: lv >= LEVEL_MAX, pool };
    });
  }

  SDT.Meta = {
    LEVEL_MAX, xpForNext, perkText,
    classList, classLv, classXP, addXP, classSummary,
    ACHIEVEMENTS, achById, isUnlocked, isClaimed, pendingAch, claim, checkUnlocks, syncBackUnlocks,
    track, setXpMul,
  };
})();
