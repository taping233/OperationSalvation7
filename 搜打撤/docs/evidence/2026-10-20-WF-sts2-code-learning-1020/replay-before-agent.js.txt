/* ============================================================
 * agent.js —— SDT.Agent 门面装配（Agent 接口链唯一入口）
 *
 * 对外协议（浏览器 console / CDP / 外部脚本同款）：
 *   SDT.Agent.observe()           → 当前局面 JSON（含可行动作清单）
 *   SDT.Agent.act(action)         → 执行动作（ui/move/battle/sys 四型）
 *   SDT.Agent.step(decide)        → 观察→决策→执行→等稳 一步
 *   SDT.Agent.autoRun({ decide }) → 连续驱动一局
 *   SDT.Agent.setTurbo(true)      → 快进（演出短路）
 *   SDT.Agent.scenes.run(name)    → 固定验收剧本（断言+报告 JSON，见 agent.scenes.js）
 * decide 契约：(obs) => action | null（null = 停止驱动）。
 * 协议详情见 docs/agent-protocol.md。
 * ============================================================ */
import { sdtDefine } from '../core/sdt-facade.js';
import { observe, settleSignature, phaseOf } from './agent.state.js';
import { act, step, autoRun, waitSettle, stopRun } from './agent.runner.js';
import { normalizeAction, actionId } from './agent.protocol.js';
import { isTurbo, setTurbo } from '../core/turbo.js';
import { greedyPolicy, randomPolicy, strategicPolicy } from './agent.policy.js';
import { decide as llmDecide, loadConfig as llmLoadConfig, saveConfig as llmSaveConfig, isEnabled as llmEnabled } from './agent.llm.js';
import * as recorder from './agent.recorder.js';
import * as stats from './agent.stats.js';
import { runScene, startScene, sceneStatus, listScenes } from './agent.scenes.js';
import { openDataPage, dataPanelHTML } from './agent.data.js';

const Agent = Object.freeze({
  version: 1,
  observe, act, step, autoRun, waitSettle, stopRun,
  phase: phaseOf,
  settleSignature,
  normalizeAction, actionId,
  policies: Object.freeze({ greedy: greedyPolicy, random: randomPolicy, strategic: strategicPolicy }),
  llm: Object.freeze({ decide: llmDecide, loadConfig: llmLoadConfig, saveConfig: llmSaveConfig, isEnabled: llmEnabled }),
  recorder: Object.freeze({
    recordRun: recorder.recordRun,
    noteBattle: recorder.noteBattle,
    resetRunCounters: recorder.resetRunCounters,
    snapshotRunBattles: recorder.snapshotRunBattles,
    restoreRunBattles: recorder.restoreRunBattles,
    listRuns: recorder.listRuns,
    clearRuns: recorder.clearRuns,
    exportJSON: recorder.exportJSON,
    exportCSV: recorder.exportCSV,
    setDriver: recorder.setDriver,
    getDriver: recorder.getDriver,
    // 2026-10-03 老板（SYS-11）：干预履历与停止原因的写入口（调试入口打标经此挂）
    noteIntervention: recorder.noteIntervention,
    noteStopReason: recorder.noteStopReason,
    classifyStop: recorder.classifyStop,
  }),
  stats: Object.freeze({ aggregate: stats.aggregate, brief: stats.brief }),
  scenes: Object.freeze({ run: runScene, start: startScene, status: sceneStatus, list: listScenes }),
  openDataPage,
  dataPanelHTML,
  isTurbo, setTurbo,
});

sdtDefine('Agent', Agent);
