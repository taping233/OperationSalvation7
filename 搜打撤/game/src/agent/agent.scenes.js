/* ============================================================
 * agent.scenes.js —— 固定验收剧本库（SDT.Agent.scenes）
 *
 * 目的：把「实机验收一步步驱动」压成一次调用。每个场景 = 前置 + 驱动 +
 * 断言，跑完返回结构化报告（pass / 断言清单 / 终态摘要），验收直接落证据。
 * 全部走既有命令面（autoRun / dev 跳节点），不模拟鼠标；断言读权威状态。
 *
 * 用法（内置浏览器 console / iab-drive 一行式）：
 *   SDT.Agent.scenes.list()                        // 场景清单
 *   await SDT.Agent.scenes.run('battle')           // 单场景（测试局直跳）
 *   await SDT.Agent.scenes.run('fullrun')          // greedy 完整局（默认 turbo）
 * 外部 evaluate 只回原始值：JSON.stringify(await SDT.Agent.scenes.run(...))。
 * 协议详情见 docs/agent-protocol.md「验收剧本」节。
 * ============================================================ */
import { SCENE_CATALOG } from './agent.scenes.catalog.js';

// 只在验收入口被调用时解析场景实现；清单和轮询接口在启动后立即同步可用。
let runtimePromise = null;
let running = false;
let activeReportPromise = null;
const reports = new Map();

function loadRuntime() {
  if (!runtimePromise) {
    const loading = import('./agent.scenes.runtime.js');
    const retryable = loading.catch(error => {
      if (runtimePromise === retryable) runtimePromise = null;
      throw error;
    });
    runtimePromise = retryable;
  }
  return runtimePromise;
}

// 分体驱动：start（fire-and-forget，报告落 reports）→ status（轮询取结果）。
// run 绑定本次执行的 Promise，避免同名重跑覆盖等待者的报告。
function startScene(name, options = {}) {
  const verdict = { started: reports.has(name) && !reports.get(name) ? false : true, name };
  if (running) return { ok: false, ...verdict, code: 'SCENE_BUSY', message: '已有场景在跑' };
  if (!Object.hasOwn(SCENE_CATALOG, name)) return { ok: false, ...verdict, code: 'UNKNOWN_SCENE' };
  // 装载期间即占用执行口，避免两次同步 start 都通过忙碌检查。
  running = true;
  reports.set(name, null);
  activeReportPromise = loadRuntime()
    .then(runtime => runtime.executeScene(name, options))
    .catch(error => ({
      ok: false, pass: false, scene: name, title: SCENE_CATALOG[name].title,
      code: 'SCENE_LOAD_FAILED', message: String(error?.message || error).slice(0, 200),
      assertions: [], errors: [],
    }))
    .then(report => {
      reports.set(name, report);
      running = false;
      return report;
    });
  return { ok: true, ...verdict, message: '场景已在页面内后台启动，用 status 轮询' };
}

function sceneStatus(name) {
  if (!reports.has(name)) return { started: false, done: false, report: null };
  const report = reports.get(name);
  return { started: true, done: !!report, report: report || null };
}

async function runScene(name, options = {}) {
  const boot = startScene(name, options);
  if (!boot.ok) return { ok: false, pass: false, ...boot };
  return activeReportPromise;
}

function listScenes() {
  return Object.entries(SCENE_CATALOG).map(([id, s]) => ({ id, title: s.title, desc: s.desc, turboDefault: !!(/** @type {typeof s & {turbo?:boolean}} */ (s)).turbo }));
}

export { runScene, startScene, sceneStatus, listScenes };
