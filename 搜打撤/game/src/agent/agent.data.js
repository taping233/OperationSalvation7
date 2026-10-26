/* ============================================================
 * agent.data.js —— 游戏内数据分析页（控制台「数据」页签的面板本体）
 *
 * 汇总卡片（通关率/撤离率/死亡率/带出价值/战斗）+ 死亡层分布 + 高价值卡 +
 * 切分对比 + 最近明细 + JSON/CSV 导出。openDataPage() 独立可用；
 * 控制台改版（切片 5）经 dataPanelHTML() 内嵌同一面板。
 * ============================================================ */
import { esc, escAttr } from '../core/shared.js';
import { listRuns, clearRuns, exportJSON, exportCSV } from './agent.recorder.js';
import { aggregate, provenanceDriver } from './agent.stats.js';

const fmtTime = (ts) => {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const OUTCOME_ZH = { clear: '通关撤离', extract: '撤离', death: '死亡', abandon: '放弃' };
// 驱动标签：真人 / 脚本 / LLM 分色，让「辅助局」在明细里一眼可辨（不作为自然平衡依据）
const DRIVER_ZH = {
  human: { label: '真人', cls: 'human' },
  agent: { label: 'Agent', cls: 'bot' },
  mixed: { label: '混合干预', cls: 'bot' },
  unknown: { label: '未记录', cls: '' },
  greedy: { label: '脚本·贪心', cls: 'bot' },
  random: { label: '脚本·随机', cls: 'bot' },
  llm: { label: 'LLM', cls: 'llm' },
};
const driverTag = (d) => {
  const m = DRIVER_ZH[d];
  return m ? `<span class="devc-driver sm ${m.cls}">${m.label}</span>` : `<span class="devc-driver sm">${esc(d)}</span>`;
};
const driverLabel = (d) => DRIVER_ZH[d]?.label || d;
// 2026-10-03 老板（SYS-11）：明细「驱动」列改读 provenance 三态——混合干预一眼可辨；
// 旧记录（SYS-11 前无 provenance 结构）显示「未记录」不炸。
// 明细、切分表与 CSV 的 provenanceDriver 使用相同三态；具体脚本标签留在明细与 JSON。
const provenanceTag = (r) => {
  const p = r && r.provenance;
  const driver = provenanceDriver(r);
  if ((driver === 'agent' || driver === 'mixed') && p.agentDriver) {
    const label = DRIVER_ZH[p.agentDriver]?.label || p.agentDriver;
    return `<span class="devc-driver sm bot" title="${escAttr(label)}">${driverLabel(driver)}·${esc(label)}</span>`;
  }
  return driverTag(driver);
};

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 10s 兜底回收（原 1s）：Firefox/杀软扫描/大 CSV 场景下 revoke 早于下载落盘会静默失败
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function summaryCard(k, v, tone = '') {
  return `<div class="doom-stat"><span class="ds-k">${k}</span><b class="ds-v ${tone}">${v}</b></div>`;
}

function dataPanelHTML() {
  const runs = listRuns();
  const agg = aggregate(runs);
  const o = agg.overall;
  const layerBars = Object.entries(agg.deathByLayer).sort((a, b) => +a[0] - +b[0])
    .map(([layer, n]) => `<div class="dt-bar-row"><span>第 ${layer} 层</span><i style="width:${Math.min(100, n * 20)}%"></i><b>${n}</b></div>`).join('')
    || '<p class="ov-note">暂无死亡记录。</p>';
  const topCards = agg.topCards.length
    ? agg.topCards.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.rarity)}</td><td>${c.carriedCount}</td><td>${c.value}</td></tr>`).join('')
    : '<tr><td colspan="4" class="dim">暂无带出记录</td></tr>';
  const splitRows = (title, groups) => {
    const rows = Object.entries(groups)
      .sort((a, b) => b[1].runs - a[1].runs)
      .map(([key, s]) => `<tr><td>${esc(driverLabel(key))}</td><td>${s.runs}</td><td>${s.clearRate}%</td><td>${s.extractRate}%</td><td>${s.avgCarriedValue}</td></tr>`).join('');
    return `<section class="hub-card"><h3>${title}</h3>
      <table class="dt-table"><thead><tr><th>分组</th><th>局数</th><th>通关率</th><th>撤离率</th><th>均价值</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="dim">—</td></tr>'}</tbody></table></section>`;
  };
  const recent = runs.slice(-20).reverse()
    .map(r => `<tr><td>${fmtTime(r.ts)}</td><td>${provenanceTag(r)}</td><td>${OUTCOME_ZH[r.outcome] || esc(r.outcome)}</td><td>${r.maxLayer ?? '—'}</td><td>${r.turns ?? '—'}</td><td>${r.carriedValue}</td></tr>`).join('');
  return `
    <div class="doom-stats" style="margin:8px 0">
      ${summaryCard('总局数', agg.total)}
      ${summaryCard('通关率', o.clearRate + '%', 'good')}
      ${summaryCard('撤离率', o.extractRate + '%', 'good')}
      ${summaryCard('死亡率', o.deathRate + '%', 'bad')}
      ${summaryCard('均带出价值', o.avgCarriedValue, 'gold')}
      ${summaryCard('战斗胜率', o.battleWinRate + '%')}
    </div>
    <p class="ov-note">样本 ${agg.total} 局（本地环形缓冲，最多保留 200 局）${agg.total === 0 ? '——当前为空，先跑一局再回来看。' : ''}真人局与辅助局混记，辅助局胜率不作为自然平衡依据。</p>
    <p class="ov-note">口径：「通关撤离」行记入库卡（savedCards），「撤离」行记带出卡（carriedCards），均为最终确定集合——撤离时未选中的候选不入账。</p>
    <div class="dt-grid">
      <section class="hub-card"><h3>死亡层分布</h3><div class="dt-bars">${layerBars}</div></section>
      <section class="hub-card"><h3>高价值带出卡 Top</h3>
        <table class="dt-table"><thead><tr><th>卡牌</th><th>稀有度</th><th>带出</th><th>单价</th></tr></thead><tbody>${topCards}</tbody></table></section>
      ${splitRows('按驱动对比', agg.byDriver)}
      ${splitRows('按职业对比', agg.byClass)}
      ${splitRows('按模式对比', agg.byMode)}
      <section class="hub-card"><h3>最近 20 局</h3>
        <table class="dt-table"><thead><tr><th>时间</th><th>驱动</th><th>结局</th><th>层</th><th>行动</th><th>带出价值</th></tr></thead><tbody>${recent || '<tr><td colspan="6" class="dim">暂无记录</td></tr>'}</tbody></table></section>
    </div>
    <div class="devc-actions"><div class="ov-btns">
      <button class="ov-btn" data-act="dataExportJSON">导出 JSON</button>
      <button class="ov-btn" data-act="dataExportCSV">导出 CSV</button>
    </div></div>
    <div class="devc-danger-zone">
      <div class="dz-txt"><b>清空本地跑局记录</b>
        <span>将删除本地全部 ${runs.length} 局记录（含真人局），清空后不可恢复；如需留档请先用上方导出。</span></div>
      <button class="devc-danger-btn" data-act="dataClear">清空记录</button>
    </div>`;
}

// 数据面板动作（导出/清空）：独立数据页与控制台「数据」页签共用
function bindDataActions(render, isCurrent = () => true) {
  const UI = window.SDT.UI;
  UI.act('dataExportJSON', () => isCurrent() && download(`sdt-runs-${Date.now()}.json`, exportJSON(), 'application/json'));
  UI.act('dataExportCSV', () => isCurrent() && download(`sdt-runs-${Date.now()}.csv`, exportCSV(), 'text/csv'));
  UI.act('dataClear', (d) => {
    if (!isCurrent()) return false;
    if (d.confirm !== '1') {
      // 两步确认：首点变「确认清空？」，与危险操作同款防误触
      const btn = /** @type {HTMLElement | null} */ (document.querySelector('#ovBody [data-act="dataClear"]'));
      if (btn) { btn.dataset.confirm = '1'; btn.textContent = '确认清空？'; btn.classList.add('arm'); }
      return;
    }
    clearRuns();
    UI.log('[[icon:tools]] 跑局记录已清空', 'sys');
    return render();
  });
}

function openDataPage({ onRender = (_page) => { void _page; }, isCurrent = () => true } = {}) {
  const UI = window.SDT.UI;
  let page = null, revision;
  const pageCurrent = () => isCurrent() && !!page?.isConnected && UI.el.ovBody.querySelector('.pg') === page
    && UI._overlayRevision === revision && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing');
  const render = () => {
    if (!isCurrent() || page && !pageCurrent()) return false;
    UI.showOverlay('[[icon:chart]] 跑局数据', `<div class="pg hub">${dataPanelHTML()}</div>`, 'page');
    page = UI.el.ovBody.querySelector('.pg');
    revision = UI._overlayRevision;
    // Capture each concrete render so detached buttons cannot act on its successor.
    const root = page, renderedRevision = revision;
    const renderedCurrent = () => pageCurrent() && page === root && revision === renderedRevision;
    bindDataActions(render, renderedCurrent);
    onRender({ root, revision, isCurrent:renderedCurrent });
    return root;
  };
  return render();
}

export { openDataPage, dataPanelHTML, bindDataActions, download };
