import { SLOT_EMBLEMS } from './slot-emblems.js';

/** Read-only save-card presentation; no restore or deletion commands. */
export function createSlotPickerView({ readMeta, esc, fmtPlayTime }) {
  // 选档徽记：透明底蓝金切角印章，五种图形在独立美术模块中维护。
  const SLOT_ICONS = SLOT_EMBLEMS;

  // 选档页背景：CSS/SVG 手绘（蓝紫雾气 + 发光鹿马剪影 + 鸟群 + 光斑，缓慢漂移呼吸）
  const SLOT_BG_SILHOUETTES = `
    <svg class="sil sil-horse" viewBox="0 0 200 170" aria-hidden="true">
      <path fill="currentColor" d="M52 148 l4-52 c-16-6-24-18-22-34 2-14 14-24 30-26
        6-16 22-26 40-24 l4-14 8 16 c16 4 26 14 28 28 l22 4 c8 2 12 9 8 15 l-20 6
        -6 34 -8 47 h-10 l-2-46 -28 4 -4 42 h-10 l-3-42 -14 1 -5 41 Z"/>
    </svg>
    <svg class="sil sil-deer" viewBox="0 0 220 190" aria-hidden="true">
      <g stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round">
        <path d="M120 44 C112 30 112 20 118 8 M118 22 l-12-10 M118 16 l12-12 M116 30 l-10 2 M118 26 l12 0"/>
        <path d="M104 46 C96 34 94 24 98 12 M99 26 l-11-8 M98 18 l10-10"/>
      </g>
      <path fill="currentColor" d="M118 44 c20-2 36 8 42 24 l26 4 c9 2 12 10 7 16 l-22 7
        -7 30 -7 52 h-10 l-3-50 -34 4 -4 46 h-10 l-4-46 -18-2 -7 48 h-10 l-3-50
        c-14-6-21-17-19-30 2-15 15-25 32-26 10-16 30-25 51-27 Z"/>
    </svg>
    <svg class="sil-birds" viewBox="0 0 420 70" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
        <path d="M10 40 q9-11 18 0 q9-11 18 0"/>
        <path d="M90 18 q7-9 14 0 q7-9 14 0"/>
        <path d="M180 44 q8-10 16 0 q8-10 16 0"/>
        <path d="M300 22 q6-8 12 0 q6-8 12 0"/>
        <path d="M370 46 q7-9 14 0 q7-9 14 0"/>
      </g>
    </svg>`;

  // 档位卡信息：进行中对局的进度、最近保存时间、累计游玩时间和成就。
  function slotInfoHTML(baseData, run) {
    if (!baseData && !run) return '<span class="slot-empty">尚未建立存档</span>';
    const total = Math.max(baseData?.stats?.playSeconds || 0, run?.elapsed || 0);
    const names = baseData
      ? readMeta().ACHIEVEMENTS.filter(a => readMeta().isUnlocked(a, baseData)).map(a => a.name)
      : [];
    const prog = run
      ? `<div class="si-line si-progress">当前进度<b>${run.nestActive ? '研究所远征进行中' :`第 ${(run.layerIdx ?? 0) + 1} 层 · ${esc(run.myClass || '未选人物')}`}</b></div>`
      : '';
    const saved = Number(run?.savedAt) > 0 ? new Date(Number(run.savedAt)) : null;
    const p = (n) => String(n).padStart(2, '0');
    const savedLine = saved && !Number.isNaN(saved.getTime())
      ? `<div class="si-line si-saved">上次保存 ${p(saved.getMonth() + 1)}-${p(saved.getDate())} ${p(saved.getHours())}:${p(saved.getMinutes())}</div>`
      : '';
    const resources = run ? `<div class="si-line">生命 <b>${Math.max(0, run.hp || 0)} / ${run.maxHp || '—'}</b> · 金币 <b>${Math.max(0, run.coins || 0)}</b></div>` : '';
    return prog + resources +
      savedLine + '<details class="slot-more"><summary>更多档案信息</summary>' +
      `<div class="si-line">游玩时间 <b class="num">${total > 0 ? fmtPlayTime(total) : '暂无记录'}</b></div>` +
      `<div class="si-line">已解锁成就 <b class="num">${names.length}</b>` +
      `${names.length ? `<span class="si-sub">${esc(names.join('、'))}</span>` : ''}</div></details>`;
  }

  return { SLOT_ICONS, SLOT_BG_SILHOUETTES, slotInfoHTML };
}
