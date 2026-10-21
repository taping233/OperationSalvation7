/* ui.comm-feed.js —— D10 无线电通讯演出组件（2026-10-04）。
 * 终端行 + 时间戳风格（非聊天气泡）：新消息 --ease-spring 弹入（commRowIn），
 * 旧消息经 FLIP（transform 反向补偿→过渡回 0）平滑上推；「传输中…」打字指示；
 * D5 分段进度条预留挂点（.comm-progress / .comm-seg.lit，点亮编排归 P1）。
 * 样式在 css/motion-transitions.css（经 motion-transitions.js 注入的 link）。
 * 本文件不接入任何游戏流程——数据挂接（game.run.flow 剧情流位）归后续批次；
 * 演示由 URL 参数 ?commDemo=1 触发，去掉参数即无任何运行痕迹（demo 可关）。
 * 战斗域零接触：组件只被显式调用或 demo 挂载，不自动出现在任何战斗界面。 */
import { reduceMotion } from '../core/motion.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

// 单行消息：msg = { ts, tag, chan?, text }——ts/tag/chan 转义，text 允许调用方
// 传内联 <b> 强调（与 UI.log 的 Icons.rich 语义对齐，调用方负责转义）。
export function commRowHTML(msg) {
  const chan = msg.chan ? ` data-chan="${esc(msg.chan)}"` : '';
  return `<div class="comm-row"${chan}>` +
    `<span class="comm-ts">${esc(msg.ts)}</span>` +
    `<span class="comm-tag">${esc(msg.tag)}</span>` +
    `<p class="comm-txt">${msg.text}</p></div>`;
}

// FLIP 追加：旧行被新行推下的位移用反向 transform 补偿后过渡回 0（只动 transform）。
// reduce 下（matchMedia 或设置开关，core/motion.js 权威口径）直接就位零动画。
export function appendCommRow(feed, msg) {
  const rows = [.../** @type {NodeListOf<HTMLElement>} */ (feed.querySelectorAll('.comm-row'))];
  const prevTops = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
  feed.insertAdjacentHTML('beforeend', commRowHTML(msg));
  const newRow = feed.lastElementChild;
  if (reduceMotion()) return newRow;
  for (const r of rows) {
    const delta = prevTops.get(r) - r.getBoundingClientRect().top;   // >0 = 被推下
    if (!delta) continue;
    r.style.transition = 'none';
    r.style.transform = `translateY(${-delta}px)`;                   // 反向补偿
    void r.offsetWidth;                                              // 强制补偿位生效
    r.style.transition = 'transform .3s var(--ease-pop)';
    r.style.transform = '';
    r.addEventListener('transitionend', () => {
      r.style.transition = '';
      r.style.transform = '';
    }, { once: true });
  }
  newRow.classList.add('comm-in');                                   // --ease-spring 弹入
  newRow.addEventListener('animationend', () => newRow.classList.remove('comm-in'), { once: true });
  return newRow;
}

// 「传输中…」打字指示：三点 opacity 脉动（循环动画仅此指示件，非战斗域）
export function commTypingHTML() {
  return '<div class="comm-typing" aria-label="传输中">传输中<i></i><i></i><i></i></div>';
}
export function setTyping(feed, on) {
  const cur = /** @type {HTMLElement} */ (feed.querySelector('.comm-typing'));
  if (on && !cur) feed.insertAdjacentHTML('beforeend', commTypingHTML());
  if (!on && cur) cur.remove();
}

// D5 分段进度条挂点：segs=总格数，lit=已点亮格数（点亮编排与 transition-delay 归 P1-D5）
export function commProgressHTML(segs = 6, lit = 0) {
  return `<div class="comm-progress" role="progressbar" aria-valuemax="${segs}" aria-valuemin="0" aria-valuenow="${lit}">` +
    Array.from({ length: segs }, (_, i) => `<i class="comm-seg${i < lit ? ' lit' : ''}"></i>`).join('') +
    '</div>';
}
export function setProgress(panel, lit) {
  const bar = /** @type {HTMLElement} */ (panel?.querySelector('.comm-progress'));
  if (!bar) return;
  bar.setAttribute('aria-valuenow', String(lit));
  [.../** @type {NodeListOf<HTMLElement>} */ (bar.querySelectorAll('.comm-seg'))].forEach((seg, i) => seg.classList.toggle('lit', i < lit));
}

// ── 演示入口：?commDemo=1 挂载右下面板（≥6 条撤离播报风格示例消息）。
// 文案参考 game.run.flow.js 撤离/信标叙事口吻，只读参考、零数据依赖。
const DEMO_MSGS = [
  { ts: 'T-00:12', tag: 'SYSTEM',  chan: 'system',  text: '链路已建立——<b>撤离窗口</b>开启，倒计时 04:00' },
  { ts: 'T-00:45', tag: 'BEACON',  chan: 'extract', text: '撤离信标已布设，信号强度 <b>86%</b>' },
  { ts: 'T-01:30', tag: 'OUTPOST', chan: 'warn',    text: '层间通路响应异常——建议绕行东侧竖井' },
  { ts: 'T-02:10', tag: 'SHUTTLE', chan: 'extract', text: '运输艇抵达停机坪，正在等待装填' },
  { ts: 'T-02:41', tag: 'SYSTEM',  chan: 'warn',    text: '检测到追踪信号——请尽快抵达撤离点' },
  { ts: 'T-03:05', tag: 'EXTRACT', chan: 'extract', text: '<b>全员登机</b>，撤离完成' },
];

export function mountCommDemo() {
  if (document.getElementById('commDemoPanel')) return;
  const panel = document.createElement('div');
  panel.id = 'commDemoPanel';
  panel.innerHTML =
    '<div class="comm-demo-head">COMM FEED // 无线电通讯<small>?commDemo=1</small>' +
    '<button type="button" class="comm-demo-close" title="关闭演示">×</button></div>' +
    '<div class="comm-feed"></div>' + commProgressHTML(DEMO_MSGS.length, 0);
  document.body.appendChild(panel);
  const feed = /** @type {HTMLElement} */ (panel.querySelector('.comm-feed'));
  let step = 0;
  let timer = null;
  let typingTimer = null;
  let closed = false;
  const onMode = e => {
    if (!closed && panel.isConnected) panel.style.display = e.detail === 'battle' ? 'none' : '';
  };
  // 面板滚动跟随最新消息；关闭时解绑，不让旧面板留在订阅链上。
  const observer = new MutationObserver(() => {
    if (!closed) feed.scrollTop = feed.scrollHeight;
  });
  observer.observe(feed, { childList: true });
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    clearTimeout(typingTimer);
    document.removeEventListener('sdt-overlay-mode', onMode);
    observer.disconnect();
    panel.remove();
  };
  /** @type {HTMLElement} */ (panel.querySelector('.comm-demo-close')).addEventListener('click', close);
  // 战斗中自动隐藏：demo 是开发演示件，其打字指示循环动画不得出现在战斗画面
  //（战斗域「零常驻循环动画」红线）；离开战斗自动恢复
  document.addEventListener('sdt-overlay-mode', onMode);
  const advance = () => {
    if (closed || !panel.isConnected) { close(); return; }
    setTyping(feed, false);
    appendCommRow(feed, DEMO_MSGS[step]);
    setProgress(panel, step + 1);
    step += 1;
    if (step >= DEMO_MSGS.length) { clearInterval(timer); return; }
    // 打字指示在两条消息之间出现（最后一条之后不再显示）
    typingTimer = setTimeout(() => {
      typingTimer = null;
      if (!closed && panel.isConnected) setTyping(feed, true);
    }, 900);
  };
  appendCommRow(feed, DEMO_MSGS[0]);
  setProgress(panel, 1);
  step = 1;
  setTyping(feed, true);
  timer = setInterval(advance, 1800);
}
