/* ============================================================
 * agent.console.js —— 开发者控制台的「Agent」「快捷键」页签
 *
 * Agent 页签：LLM 配置、快进开关、自动跑局（贪心/随机/LLM）启停、observe 预览。
 * 快捷键页签：quick-nav 全页面跳转表 + 当前合法性 + 点击直达。
 * 由 run/game.run.dev.js 的多页签控制台装配；经 window.SDT.Agent 晚绑定取接口。
 * ============================================================ */
import { esc, escAttr } from '../core/shared.js';
import { listPages, jump } from '../ui/quick-nav.js';

const Agent = () => window.SDT?.Agent;

// ---------- 运行状态（控制台按钮态） ----------
let running = false;

function statusLine(text) {
  const el = document.getElementById('devcAgentStatus');
  if (el) el.textContent = text;
}

function runWith(policyName) {
  const A = Agent();
  if (!A || running) return;
  const decide = policyName === 'llm' ? A.llm.decide() : A.policies[policyName]({ resetSlots: true });
  running = true;
  statusLine(`自动跑局中（${policyName}）……`);
  A.autoRun({
    decide, driver: policyName, maxSteps: 3000,
    runTimeoutMs: 30 * 60 * 1000,   // 局级墙钟（2026-09-28 代码线）：交互驱动无人盯守时的最后防线
    onStep: (r) => statusLine(`自动跑局中（${policyName}）· 第 ${r.obs.turn} 回合 · ${r.obs.phase} · HP ${r.obs.run?.hp ?? '—'}`),
  })
    .then(trace => statusLine(`跑局结束：${trace.stopReason || ''} ${trace.length} 步（记录见「数据」页签）`))
    .catch(e => statusLine(`跑局异常：${String(e?.message || e)}——运行已停止，可换策略重试；LLM 相关失败先检查下方配置`))
    .finally(() => { running = false; });
}

// ---------- Agent 页签 ----------
function agentTabHTML() {
  const A = Agent();
  /** @type {Partial<ReturnType<RuntimeFacade['Agent']['llm']['loadConfig']>>} */
  const cfg = A?.llm.loadConfig() || {};
  const enabled = !!(cfg.apiKey && cfg.model);
  const turbo = A?.isTurbo();
  return `
    <div class="devc-statusbar">
      <span class="devc-driver ${running ? 'bot' : 'human'}">${running ? '驱动：Agent 自动跑局' : '驱动：真人玩家'}</span>
      <span class="devc-live${running ? '' : ' off'}">${running ? '运行中' : '闲置'}</span>
      <button class="devc-stop" data-act="devcRunStop" ${running ? '' : 'disabled'} title="随时可停：当前步收口后退出">停止</button>
    </div>
    <p class="ov-note" id="devcAgentStatus">${running ? '自动跑局中……' : '闲置。跑局记录落在「数据」页签，人类玩家的对局同样入账并标「真人」。'}</p>
    <section class="devc-sec"><b class="devc-h">策略 <span class="devc-scope">人工触发一局</span></b><div class="devc-btns">
      <button class="hs-btn" data-act="devcRunGreedy" ${running ? 'disabled' : ''} title="规则贪心策略，不依赖外部服务">贪心一局</button>
      <button class="hs-btn" data-act="devcRunRandom" ${running ? 'disabled' : ''} title="均匀随机动作（对照组）">随机一局</button>
      <button class="hs-btn" data-act="devcRunLlm" ${running || !enabled ? 'disabled' : ''} title="${enabled ? '走下方 LLM 配置出牌' : '先填好 LLM 配置'}">LLM 一局</button>
    </div></section>
    <section class="devc-sec"><b class="devc-h">快进 <span class="devc-scope">全局动画开关</span></b><div class="devc-btns">
      <button class="hs-btn" data-act="devcTurbo">快进：${turbo ? '开' : '关'}</button>
    </div><p class="ov-note">只加速动画演示，不改变结算规则；对真人局同样生效。</p></section>
    <section class="devc-sec"><b class="devc-h">LLM 接入 <span class="devc-scope">仅本机 localStorage</span></b>
      <div class="devc-form">
        <input id="devcLlmUrl" class="clib-search" placeholder="baseURL，如 https://api.example.com/v1" value="${escAttr(cfg.baseUrl || '')}">
        <input id="devcLlmKey" class="clib-search" placeholder="apiKey" autocomplete="off" value="${escAttr(cfg.apiKey || '')}">
        <input id="devcLlmModel" class="clib-search" placeholder="model" value="${escAttr(cfg.model || '')}">
      </div>
      <div class="devc-btns">
        <button class="hs-btn" data-act="devcLlmSave">保存配置</button>
        <button class="hs-btn" data-act="devcLlmReset">恢复已存</button>
      </div>
      <p class="ov-note">${enabled ? '已配置 ✓' : '未配置（LLM 一局不可用，自动退化贪心）'}——apiKey 只存本机，不写入导出与日志。</p>
    </section>
    <section class="devc-sec"><b class="devc-h">observe 预览 <span class="devc-scope">只读</span></b>
      <div class="devc-btns"><button class="hs-btn sm" data-act="devcObsRefresh">刷新</button></div>
      <pre id="devcObsPreview" class="devc-pre" style="max-height:220px;overflow:auto">${esc(obsPreview())}</pre>
    </section>`;
}

function obsPreview() {
  const A = Agent();
  if (!A) return '{}';
  try {
    const text = JSON.stringify(A.observe(), null, 1);
    return text.length > 2600 ? text.slice(0, 2599) + '…（截断）' : text;
  } catch (error) {
    return `observe 失败：${String(error?.message || error)}`;
  }
}

function bindAgentTab(render) {
  const UI = window.SDT.UI;
  const A = Agent();
  UI.act('devcRunGreedy', () => runWith('greedy'));
  UI.act('devcRunRandom', () => runWith('random'));
  UI.act('devcRunLlm', () => runWith('llm'));
  UI.act('devcRunStop', () => { A?.stopRun(); statusLine('已请求停止（当前步收口后退出）'); });
  UI.act('devcTurbo', () => { A?.setTurbo(!A.isTurbo()); render(); });
  UI.act('devcLlmSave', () => {
    const val = id => (/** @type {HTMLInputElement | null} */ (document.getElementById(id)))?.value?.trim() || '';
    A?.llm.saveConfig({ baseUrl: val('devcLlmUrl'), apiKey: val('devcLlmKey'), model: val('devcLlmModel') });
    UI.log('[[icon:tools]] LLM 配置已保存（仅本机 localStorage）', 'sys');
    render();
  });
  // 保存/恢复配对的「恢复」侧：放弃未保存的输入，按已存配置重绘（纯 UI，不触碰存储）
  UI.act('devcLlmReset', () => render());
  UI.act('devcObsRefresh', () => {
    const pre = document.getElementById('devcObsPreview');
    if (pre) pre.textContent = obsPreview();
  });
}

// ---------- 快捷键页签 ----------
function keysTabHTML() {
  const rows = listPages().map(p => `
    <div class="devc-keyrow${p.ok ? '' : ' off'}">
      <span class="devc-key-name"><kbd>Alt+${esc(p.key)}</kbd> ${esc(p.name)}</span>
      ${p.ok
        ? `<button class="hs-btn sm" data-act="devcGoto" data-page="${escAttr(p.id)}" title="点击直达（与 Alt+${esc(p.key)} 同一入口）">进入</button>`
        : `<span class="devc-why">${esc(p.why || '当前状态不可进入')}</span>`}
    </div>`).join('');
  return `
    <section class="devc-sec"><b class="devc-h">页面快捷进入 <span class="devc-scope">与 Alt+键位同入口</span></b>
    <div class="devc-keylist">${rows}</div>
    <p class="ov-note">灰色行为当前守卫拦截，右侧写明原因（战斗/对局中受保护）；另有 Ctrl+L 开关本控制台、B 开背包、Esc 关弹层。</p>
    <p class="ov-note">本页为开发辅助导航：经此进入不作为正常玩法走线的覆盖证据。</p></section>`;
}

function bindKeysTab(render) {
  const UI = window.SDT.UI;
  UI.act('devcGoto', async (d) => {
    const source = document.getElementById('devConsole');
    // jump 成功时 page.enter 已在控制台同层开出目标页（控制台页被顶替=已关闭）；
    // 此时再 hideOverlay 会把新页的动作表一并清掉（INFRA-02），跳转失败才重绘本页。
    if (await jump(d.page)) {
      const page = listPages().find(p => p.id === d.page);
      UI.log(`[[icon:tools]] 快捷进入【${page?.name || d.page}】成功（去向已打开，与 Alt+${page?.key || '?'} 同入口）`, 'sys');
      return;
    }
    if (source?.isConnected && document.getElementById('devConsole') === source) render();
    return false;
  });
}

export { agentTabHTML, bindAgentTab, keysTabHTML, bindKeysTab };
