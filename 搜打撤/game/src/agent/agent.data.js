/* ============================================================
 * agent.data.js —— 游戏内数据分析页（控制台「数据」页签的面板本体）
 *
 * 汇总卡片（通关率/撤离率/死亡率/带出价值/战斗）+ 死亡层分布 + 高价值卡 +
 * 切分对比 + 最近明细 + JSON/CSV 导出。openDataPage() 独立可用；
 * 控制台改版（切片 5）经 dataPanelHTML() 内嵌同一面板。
 * ============================================================ */
import { esc } from '../core/shared.js';
import { listRuns, clearRuns, exportJSON, exportCSV } from './agent.recorder.js';
import { aggregate } from './agent.stats.js';

const fmtTime = (ts) => {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const OUTCOME_ZH = { clear: '通关撤离', extract: '撤离', death: '死亡', abandon: '放弃' };

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      .map(([key, s]) => `<tr><td>${esc(key)}</td><td>${s.runs}</td><td>${s.clearRate}%</td><td>${s.extractRate}%</td><td>${s.avgCarriedValue}</td></tr>`).join('');
    return `<section class="hub-card"><h3>${title}</h3>
      <table class="dt-table"><thead><tr><th>分组</th><th>局数</th><th>通关率</th><th>撤离率</th><th>均价值</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="dim">—</td></tr>'}</tbody></table></section>`;
  };
  const recent = runs.slice(-20).reverse()
    .map(r => `<tr><td>${fmtTime(r.ts)}</td><td>${esc(r.driver)}</td><td>${OUTCOME_ZH[r.outcome] || esc(r.outcome)}</td><td>${r.maxLayer ?? '—'}</td><td>${r.turns ?? '—'}</td><td>${r.carriedValue}</td></tr>`).join('');
  return `
    <div class="doom-stats" style="margin:8px 0">
      ${summaryCard('总局数', agg.total)}
      ${summaryCard('通关率', o.clearRate + '%', 'good')}
      ${summaryCard('撤离率', o.extractRate + '%', 'good')}
      ${summaryCard('死亡率', o.deathRate + '%', 'bad')}
      ${summaryCard('均带出价值', o.avgCarriedValue, 'gold')}
      ${summaryCard('战斗胜率', o.battleWinRate + '%')}
    </div>
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
    <div class="ov-btns">
      <button class="ov-btn" data-act="dataExportJSON">导出 JSON</button>
      <button class="ov-btn" data-act="dataExportCSV">导出 CSV</button>
      <button class="ov-btn danger" data-act="dataClear">清空记录</button>
    </div>`;
}

// 数据面板动作（导出/清空）：独立数据页与控制台「数据」页签共用
function bindDataActions(render) {
  const UI = window.SDT.UI;
  UI.act('dataExportJSON', () => download(`sdt-runs-${Date.now()}.json`, exportJSON(), 'application/json'));
  UI.act('dataExportCSV', () => download(`sdt-runs-${Date.now()}.csv`, exportCSV(), 'text/csv'));
  UI.act('dataClear', (d) => {
    if (d.confirm !== '1') {
      // 两步确认：首点变「确认清空？」，与危险操作同款防误触
      const btn = document.querySelector('#ovBody [data-act="dataClear"]');
      if (btn) { btn.dataset.confirm = '1'; btn.textContent = '确认清空？'; btn.classList.add('arm'); }
      return;
    }
    clearRuns();
    UI.log('[[icon:tools]] 跑局记录已清空', 'sys');
    render();
  });
}

function openDataPage() {
  const UI = window.SDT.UI;
  const render = () => {
    UI.showOverlay('[[icon:chart]] 跑局数据', `<div class="pg hub">${dataPanelHTML()}</div>`, 'page');
    bindDataActions(render);
  };
  render();
}

export { openDataPage, dataPanelHTML, bindDataActions, download };
