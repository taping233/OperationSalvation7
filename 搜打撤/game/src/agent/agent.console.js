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
    onStep: (r) => statusLine(`自动跑局中（${policyName}）· 第 ${r.obs.turn} 回合 · ${r.obs.phase} · HP ${r.obs.run?.hp ?? '—'}`),
  })
    .then(trace => statusLine(`跑局结束：${trace.length} 步（记录见「数据」页签）`))
    .catch(e => statusLine(`跑局异常：${String(e?.message || e)}`))
    .finally(() => { running = false; });
}

// ---------- Agent 页签 ----------
function agentTabHTML() {
  const A = Agent();
  const cfg = A?.llm.loadConfig() || {};
  const enabled = !!(cfg.apiKey && cfg.model);
  const turbo = A?.isTurbo();
  return `
    <section class="devc-sec"><b class="devc-h">自动跑局</b><div class="devc-row">
      <button class="hs-btn" data-act="devcRunGreedy" ${running ? 'disabled' : ''}>贪心一局（快进）</button>
      <button class="hs-btn" data-act="devcRunRandom" ${running ? 'disabled' : ''}>随机一局</button>
      <button class="hs-btn" data-act="devcRunLlm" ${running || !enabled ? 'disabled' : ''} title="${enabled ? '' : '先填好 LLM 配置'}">LLM 一局</button>
      <button class="hs-btn" data-act="devcRunStop" ${running ? '' : 'disabled'}>停止</button>
      <button class="hs-btn" data-act="devcTurbo">快进：${turbo ? '开' : '关'}</button>
    </div><p class="ov-note" id="devcAgentStatus">${running ? '自动跑局中……' : '闲置。跑局记录落在「数据」页签，人类玩家的对局同样入账。'}</p></section>
    <section class="devc-sec"><b class="devc-h">LLM 接入（OpenAI 兼容，配置只存本机）</b><div class="devc-row">
      <input id="devcLlmUrl" class="clib-search" placeholder="baseURL，如 https://api.example.com/v1" value="${escAttr(cfg.baseUrl || '')}">
      <input id="devcLlmKey" class="clib-search" placeholder="apiKey" value="${escAttr(cfg.apiKey || '')}">
      <input id="devcLlmModel" class="clib-search" placeholder="model" value="${escAttr(cfg.model || '')}">
      <button class="hs-btn" data-act="devcLlmSave">保存配置</button>
      <span class="dim">${enabled ? '已配置 ✓' : '未配置（LLM 一局不可用，自动退化贪心）'}</span>
    </div></section>
    <section class="devc-sec"><b class="devc-h">observe 预览（喂给模型的局面 JSON）</b>
      <div class="devc-row"><button class="hs-btn" data-act="devcObsRefresh">刷新</button></div>
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
    const val = id => document.getElementById(id)?.value?.trim() || '';
    A?.llm.saveConfig({ baseUrl: val('devcLlmUrl'), apiKey: val('devcLlmKey'), model: val('devcLlmModel') });
    UI.log('[[icon:tools]] LLM 配置已保存（仅本机 localStorage）', 'sys');
    render();
  });
  UI.act('devcObsRefresh', () => {
    const pre = document.getElementById('devcObsPreview');
    if (pre) pre.textContent = obsPreview();
  });
}

// ---------- 快捷键页签 ----------
function keysTabHTML() {
  const rows = listPages().map(p => `
    <div class="devc-row" style="justify-content:space-between">
      <span><kbd>Alt+${esc(p.key)}</kbd> ${esc(p.name)}</span>
      <button class="hs-btn sm" data-act="devcGoto" data-page="${escAttr(p.id)}" ${p.ok ? '' : 'disabled'}
        title="${p.ok ? '点击直达' : '当前状态不可进入'}">${p.ok ? '进入' : '不可用'}</button>
    </div>`).join('');
  return `
    <section class="devc-sec"><b class="devc-h">页面快捷进入键（Alt+键位）</b>${rows}
    <p class="ov-note">战斗/对局中受保护的页面会拒绝进入并提示；另有 Ctrl+L 开关本控制台、B 开背包、Esc 关弹层。</p></section>`;
}

function bindKeysTab(render) {
  const UI = window.SDT.UI;
  UI.act('devcGoto', (d) => {
    if (jump(d.page)) { UI.hideOverlay(); return; }
    render();
  });
}

export { agentTabHTML, bindAgentTab, keysTabHTML, bindKeysTab };
