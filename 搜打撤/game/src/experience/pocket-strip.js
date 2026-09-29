/* pocket-strip.js —— 「随身口袋」常驻状态条（体验线 2026-09-28）
 *
 * 主题「带出去才作数」：卡牌=消耗品（打出进消耗口袋、火堆可复原、撤离时每张独立
 * 1/3 概率带回、随身币离局清零）。这套弹药经济此前只在背包弹窗/撤离面板可见，
 * 玩家在地图上做"深入还是收手"决策时看不到自己的资源前景。
 *
 * 数据口径（代码线 EXP-001 回复 00:30 核实）：
 *   背包占用  game.usedSlots()；容量  SDT.Base.bagCap()（基地域权威，game.bagCap 仅旧兜底）
 *   消耗袋    game.usedPocket（{card,count}[] 按卡名聚合，条目无 uid）
 *   带出预估  ownedCards 非初始攻击 100% 带回 + 消耗袋 Σcount×1/3 期望
 *            （extraction.commands.js:44-90：逐张伯努利；初始攻击 isSha 不入库）
 *   币        game.coins（离局清零，altar.js:675 口径；第3层起警示）
 * 可见性：game.runActive && game.myClass（同 #bagBtnFloat 口径，hud.js:84）。
 *
 * 实现：600ms 签名轮询 diff 更新（不接 UI.refresh，避免与他线文件耦合）；
 * 纯展示 pointer-events:none；inert 隔离对纯展示层无视觉影响。
 * 挂载：导出 startPocketStrip()（代码线拟从 game.boot.js 接线，见 EXP-001 续）；
 * 模块自启动兜底保留，boot 接线确认后由代码线决定是否撤掉 index.html 直挂行。
 */
import '../../css/pocket-strip.css';
import { previewExtraction } from '../run/extraction-preview.js';
import { layerEncounterMeta } from '../run/encounter-meta.js';
import { reduceMotion } from '../core/motion.js';

const POLL_MS = 600;

/* 切片3（2026-09-28）：章节面板层级风险徽标——「深入下一层的代价」过门前可见。
 * CODE-003（encounter-meta.js）是层级池元数据（同层战斗节点共享一个池，
 * 节点间无法互相区分），故装饰落点选章节导航：每层一行风险/精英概率，
 * 只标当前层之后的层（正在经历的层不需要预告）。渲染器重画会抹掉装饰，
 * tick 里每轮补挂（li 无 .eps-lyr 子元素才写，避免每帧动 DOM）。 */
const RISK_LABEL = { '低': '低危', '中': '常规', '高': '高危', '极高': '极高危' };

function decorateChapters() {
  const nav = document.getElementById('expeditionChapter');
  const SDT = window.SDT;
  const game = SDT && SDT.game;
  if (!nav || !game || !game.runActive || !SDT || !SDT.MAP) return;
  const cur = typeof game.layerIdx === 'number' ? game.layerIdx : 0;
  const rows = nav.querySelectorAll('ol > li');
  rows.forEach((li, idx) => {
    if (idx <= cur) {   // 当前与已过的层不预告
      const old = li.querySelector('.eps-lyr');
      if (old) old.remove();
      return;
    }
    if (li.querySelector('.eps-lyr')) return;
    const meta = layerEncounterMeta(SDT.MAP, idx);
    if (!meta) return;
    const tag = document.createElement('i');
    tag.className = 'eps-lyr';
    tag.dataset.tier = meta.risk || '中';
    const elite = meta.eliteChance > 0 ? ` · 精英 ${Math.round(meta.eliteChance * 100)}%` : '';
    tag.textContent = `${RISK_LABEL[meta.risk] || meta.risk}${elite}`;
    // 样式全部由 experience-loot.css 的 #expeditionChapter li .eps-lyr 段接管（美术线 02:4x 正式化，内联已撤）
    li.appendChild(tag);
  });
}

function bagCapacity() {
  const SDT = window.SDT;
  try {
    if (SDT && SDT.Base && typeof SDT.Base.bagCap === 'function') return SDT.Base.bagCap();
  } catch { /* 基地域未就绪时退回旧路径 */ }
  const game = SDT && SDT.game;
  return game && game.bagCap ? game.bagCap() : 0;
}

function ensureEl() {
  let el = document.getElementById('expPocketStrip');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'expPocketStrip';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<span class="eps-cell eps-bag"><b class="eps-num" data-eps="bag">0</b><i class="eps-lab">背包</i></span>' +
    '<span class="eps-cell eps-pocket" data-eps="pocketCell"><b class="eps-num" data-eps="pocket">0</b><i class="eps-lab">消耗袋</i></span>' +
    '<span class="eps-cell eps-coins" data-eps="coinsCell"><b class="eps-num" data-eps="coins">0</b><i class="eps-lab" data-eps="coinsLab">随身币·离局清零</i></span>' +
    '<span class="eps-cell eps-forecast" data-eps="forecastCell"><b class="eps-num" data-eps="forecast">0</b><i class="eps-lab">带出预估·张</i></span>' +
    '<i class="eps-hint">格=种类数 · 预估按张数 · 消耗卡撤离每张 1/3 概率带回（火堆可复原）</i>';
  document.body.appendChild(el);
  return el;
}

function setCell(el, key, text) {
  const node = el.querySelector(`[data-eps="${key}"]`);
  if (node && node.textContent !== text) node.textContent = text;
}

function tick() {
  // 测试环境拆除后定时器仍触发（600ms 永久 interval 无清理通道）：window 已删时安全短路；浏览器内不可达，行为逐字不变。
  if (typeof window === "undefined") return;
  const SDT = window.SDT;
  const game = SDT && SDT.game;
  if (!game) return;
  try { decorateChapters(); } catch { /* 章节装饰失败不阻塞状态条 */ }
  const visible = !!(game.runActive && game.myClass);
  const el = visible ? ensureEl() : document.getElementById('expPocketStrip');
  if (!el) return;
  if (!visible) { el.hidden = true; return; }
  el.hidden = false;

  const used = game.usedSlots ? game.usedSlots() : (game.inventory ? game.inventory.length : 0);
  // CODE-002（代码线 00:50 交付）：口径唯一权威的期望值投影，替换本模块手写口径
  const pv = previewExtraction(game, SDT.Base);
  const cap = pv.bagCap != null ? pv.bagCap : bagCapacity();
  const pocket = pv.pocketTotal;
  const keepable = pv.bagTotal;
  const expectKept = Math.round(pv.expectedKept * 10) / 10;  // 期望值，一位小数
  const coins = pv.coins;
  const layerN = (typeof game.layerIdx === 'number' ? game.layerIdx : 0) + 1;

  const sig = `${used}/${cap}|${pocket}|${keepable}|${coins}|${layerN}`;
  if (sig === el.dataset.epsSig) return;
  const prevPocket = Number(el.dataset.epsPocket || 0);
  el.dataset.epsSig = sig;
  el.dataset.epsPocket = String(pocket);

  setCell(el, 'bag', `${used}/${cap || '?'}`);
  setCell(el, 'pocket', String(pocket));
  setCell(el, 'forecast', keepable ? (pocket ? `${keepable}+≈${expectKept}` : String(keepable)) : (pocket ? `≈${expectKept}` : '0'));
  setCell(el, 'coins', String(coins));
  // 币格标签分层（评估#2）：第3层起=离局清零警示；前两层持币=中性"暂无离局点"（首个撤离点在第3层）
  setCell(el, 'coinsLab', layerN >= 3 ? '随身币·离局清零' : '随身币·暂无离局点');

  // 状态着色：袋中有卡=可挽回资产；第3层起持币进入"该花了"警示
  const pocketCell = el.querySelector('[data-eps="pocketCell"]');
  const coinsCell = el.querySelector('[data-eps="coinsCell"]');
  if (pocketCell) pocketCell.classList.toggle('eps-warn', pocket > 0);
  if (coinsCell) coinsCell.classList.toggle('eps-warn', coins > 0 && layerN >= 3);

  // 回执（Meier："做完决定要有回执"）：消耗袋变多=刚打掉了卡，脉冲一下；
  // 动效敏感玩家（reduce-motion）跳过脉冲，信息仍由数值变化承载（GA 指南第4条）
  if (pocket > prevPocket && !reduceMotion()) {
    const pc = el.querySelector('[data-eps="pocketCell"]');
    if (pc) { pc.classList.remove('eps-pop'); void pc.offsetWidth; pc.classList.add('eps-pop'); }
  }
}

let started = false;
export function startPocketStrip() {
  if (started) return;
  started = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setInterval(tick, POLL_MS));
  } else {
    setInterval(tick, POLL_MS);
  }
}

if (!window.__expPocketStrip) {
  window.__expPocketStrip = true;
  startPocketStrip();
}
