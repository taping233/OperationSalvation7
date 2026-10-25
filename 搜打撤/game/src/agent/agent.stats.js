/* ============================================================
 * agent.stats.js —— 跑局聚合统计（数据分析系统核心口径）
 *
 * 输入 = agent.recorder.listRuns() 的逐局记录；输出 = 与记录字段一一对应的
 * 汇总：通关率 / 撤离率 / 死亡率 / 死亡层分布 / 带出卡牌价值 / 行动与战斗 /
 * 按职业·模式·驱动切分。纯函数，Node 批跑与游戏内数据页共用同一口径。
 * ============================================================ */

const rate = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

// 顶层 driver 是结算时点标签；随局来源以 recorder 的 provenance 三态为准。
// 旧记录没有来源事实，不能从旧标签反推为真人局或自动局。
function provenanceDriver(run) {
  const driver = run?.provenance?.driver;
  return ['human', 'agent', 'mixed'].includes(driver) ? driver : 'unknown';
}

function outcomeCounts(runs) {
  const counts = { clear: 0, extract: 0, death: 0, abandon: 0 };
  for (const r of runs) {
    const key = Object.hasOwn(counts, r.outcome) ? r.outcome : 'abandon';
    counts[key] += 1;
  }
  return counts;
}

function groupBy(runs, keyOf) {
  const groups = new Map();
  for (const r of runs) {
    const key = keyOf(r) ?? '—';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return groups;
}

function brief(runs) {
  const counts = outcomeCounts(runs);
  const total = runs.length;
  const battles = runs.reduce((acc, r) => {
    acc.fought += r.battles?.fought || 0;
    acc.won += r.battles?.won || 0;
    return acc;
  }, { fought: 0, won: 0 });
  return {
    runs: total,
    outcomes: counts,
    clearRate: rate(counts.clear, total),
    extractRate: rate(counts.extract + counts.clear, total),   // 撤离率含通关撤离
    deathRate: rate(counts.death, total),
    surviveRate: rate(counts.clear + counts.extract, total),
    avgLayer: total ? Math.round((runs.reduce((s, r) => s + (r.maxLayer || 0), 0) / total) * 10) / 10 : 0,
    avgTurns: total ? Math.round(runs.reduce((s, r) => s + (r.turns || 0), 0) / total) : 0,
    avgDurationSec: total ? Math.round(runs.reduce((s, r) => s + (r.durationSec || 0), 0) / total) : 0,
    avgCarriedValue: total ? Math.round(runs.reduce((s, r) => s + (r.carriedValue || 0), 0) / total) : 0,
    maxCarriedValue: runs.reduce((m, r) => Math.max(m, r.carriedValue || 0), 0),
    battles,
    battleWinRate: rate(battles.won, battles.fought),
  };
}

function aggregate(runs) {
  const total = runs.length;
  const deathByLayer = {};
  // 死因分桶（09-26 方法论补强）：层×节点×败因——假设从这里直接长出来，不靠人工翻 trace。
  //   节点维度：G.trackPos（死亡时所在格），层维度 maxLayer
  // 败因使用死亡时记录的事实；旧记录缺少来源时归未知，撤退场次不能反推死因。
  const deathBucket = {};
  const cardAgg = new Map();   // 名称 → { name, rarity, seen, carriedCount, value }
  for (const r of runs) {
    if (r.outcome === 'death' && r.maxLayer != null) {
      deathByLayer[r.maxLayer] = (deathByLayer[r.maxLayer] || 0) + 1;
      const cause = r.deathCause === 'battle' ? '战斗中' : r.deathCause === 'nonBattle' ? '战后' : '未知';
      const key = `L${r.maxLayer}${r.node != null ? 'N' + r.node : ''}/${cause}`;
      deathBucket[key] = (deathBucket[key] || 0) + 1;
    }
    for (const c of r.carried || []) {
      const e = cardAgg.get(c.name) || { name: c.name, rarity: c.rarity, seen: 0, carriedCount: 0, value: c.value };
      e.seen += 1;
      e.carriedCount += c.count || 1;
      cardAgg.set(c.name, e);
    }
  }
  const topCards = [...cardAgg.values()]
    .sort((a, b) => b.carriedCount * b.value - a.carriedCount * a.value)
    .slice(0, 12);
  const section = (keyOf) => Object.fromEntries(
    [...groupBy(runs, keyOf)].map(([key, list]) => [key, brief(list)]),
  );
  return {
    total,
    overall: brief(runs),
    deathByLayer,
    deathBucket,
    topCards,
    byClass: section(r => r.class),
    byMode: section(r => r.mode),
    byDriver: section(provenanceDriver),
  };
}

export { aggregate, brief, rate, provenanceDriver };
