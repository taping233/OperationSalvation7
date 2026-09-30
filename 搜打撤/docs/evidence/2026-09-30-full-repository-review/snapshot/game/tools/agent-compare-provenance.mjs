const CONFIG_KEYS = [
  'mode', 'seedBase', 'runs', 'maxSteps', 'timeoutMs', 'probeUi', 'profile',
  'selfcheck', 'debugSteps', 'scdbg',
];
const RUNTIME_KEYS = ['lockSha256', 'node', 'platform', 'arch'];

const isRecord = value => value != null && typeof value === 'object' && !Array.isArray(value);

function runSeedIssues(runs) {
  const reasons = [];
  const seen = new Set();
  const duplicates = new Set();
  let missing = 0;
  for (const run of runs) {
    if (run?.seed == null) { missing++; continue; }
    if (seen.has(run.seed)) duplicates.add(run.seed);
    seen.add(run.seed);
  }
  if (missing) reasons.push(`有 ${missing} 局 seed 缺失`);
  if (duplicates.size) reasons.push(`有 ${duplicates.size} 个重复 seed`);
  return { reasons, seeds: seen };
}

function metadataReasons(side, summary) {
  if (!isRecord(summary) || !isRecord(summary.meta)) return [`${side} summary.json 缺失或格式无效`];
  const provenance = summary.meta.provenance;
  if (!isRecord(provenance)) return [];
  const reasons = [];
  if (provenance.schemaVersion !== 1) reasons.push(`${side} provenance schemaVersion 必须为 1`);
  if (!isRecord(provenance.code)) reasons.push(`${side} provenance.code 缺失`);
  else {
    if (typeof provenance.code.fingerprint !== 'string' || !provenance.code.fingerprint) reasons.push(`${side} code.fingerprint 缺失`);
    if (provenance.code.changedDuringRun !== false) reasons.push(`${side} changedDuringRun 必须为 false`);
  }
  if (!isRecord(provenance.runtime)) reasons.push(`${side} provenance.runtime 缺失`);
  else for (const key of RUNTIME_KEYS) {
    if (typeof provenance.runtime[key] !== 'string' || !provenance.runtime[key]) reasons.push(`${side} runtime.${key} 缺失`);
  }
  if (!isRecord(provenance.config)) reasons.push(`${side} provenance.config 缺失`);
  else for (const key of CONFIG_KEYS) {
    if (!Object.hasOwn(provenance.config, key)) reasons.push(`${side} config.${key} 缺失`);
  }
  if (!isRecord(provenance.weights) || typeof provenance.weights.sha256 !== 'string' || !provenance.weights.sha256) {
    reasons.push(`${side} weights.sha256 缺失`);
  }
  return reasons;
}

/**
 * Checks whether paired runs have enough matching provenance to support promotion.
 * Legacy summaries remain readable, but are deliberately not promotion evidence.
 */
export function inspectComparisonProvenance({ challengerSummary, championSummary, challengerRuns, championRuns }) {
  const challengerProvenance = challengerSummary?.meta?.provenance;
  const championProvenance = championSummary?.meta?.provenance;
  const hasChallenger = isRecord(challengerProvenance);
  const hasChampion = isRecord(championProvenance);
  const reasons = [];

  if (!hasChallenger && !hasChampion) {
    reasons.push('两侧 summary 均无 provenance（历史数据未验证代码与实验条件）');
    return { status: 'legacy', eligible: false, reasons, sides: describeSides(challengerSummary, championSummary) };
  }
  if (hasChallenger !== hasChampion) reasons.push('只有一侧 summary 含 provenance');

  reasons.push(...metadataReasons('challenger', challengerSummary));
  reasons.push(...metadataReasons('champion', championSummary));
  const cp = challengerProvenance;
  const hp = championProvenance;
  if (hasChallenger && hasChampion) {
    if (cp.schemaVersion !== hp.schemaVersion) reasons.push('provenance schemaVersion 不一致');
    if (cp.code?.fingerprint !== hp.code?.fingerprint) reasons.push('代码 fingerprint 不一致');
    if (cp.code?.changedDuringRun !== false || hp.code?.changedDuringRun !== false) reasons.push('运行期间代码状态变化，不能配对晋级');
    for (const key of RUNTIME_KEYS) {
      if (cp.runtime?.[key] !== hp.runtime?.[key]) reasons.push(`runtime.${key} 不一致`);
    }
    for (const key of CONFIG_KEYS) {
      if (cp.config?.[key] !== hp.config?.[key]) reasons.push(`config.${key} 不一致`);
    }
    if (cp.config?.probeUi !== false || hp.config?.probeUi !== false) reasons.push('正式配对要求两侧 probeUi=false');
  }

  const challengerSeedInfo = runSeedIssues(challengerRuns);
  const championSeedInfo = runSeedIssues(championRuns);
  reasons.push(...challengerSeedInfo.reasons.map(reason => `challenger ${reason}`));
  reasons.push(...championSeedInfo.reasons.map(reason => `champion ${reason}`));
  const commonSeeds = [...challengerSeedInfo.seeds].filter(seed => championSeedInfo.seeds.has(seed));
  const denominator = Math.min(challengerRuns.length, championRuns.length);
  const pairRate = denominator ? commonSeeds.length / denominator * 100 : 0;
  if (!challengerRuns.length || !championRuns.length) reasons.push('runs.jsonl 为空');
  if (challengerRuns.length !== championRuns.length) reasons.push('两侧 runs 局数不一致');
  if (hasChallenger && Number.isInteger(cp?.config?.runs) && cp.config.runs !== challengerRuns.length) {
    reasons.push('challenger config.runs 与 runs.jsonl 局数不一致');
  }
  if (hasChampion && Number.isInteger(hp?.config?.runs) && hp.config.runs !== championRuns.length) {
    reasons.push('champion config.runs 与 runs.jsonl 局数不一致');
  }
  if (pairRate !== 100) reasons.push(`seed 配对率为 ${pairRate.toFixed(1)}%，必须为 100%`);

  return {
    status: reasons.length ? 'blocked' : 'verified',
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    pairRate,
    commonSeeds: commonSeeds.length,
    sides: describeSides(challengerSummary, championSummary),
  };
}

function describeSides(challengerSummary, championSummary) {
  const describe = summary => ({
    policy: summary?.meta?.policy ?? 'unknown',
    driver: summary?.meta?.driver ?? 'unknown',
    weightsSha256: summary?.meta?.provenance?.weights?.sha256 ?? 'unknown',
  });
  return { challenger: describe(challengerSummary), champion: describe(championSummary) };
}
