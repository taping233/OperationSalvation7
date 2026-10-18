/* 由 game.bag.js 拆出（2026-09-22 六文件重构批4）：背包 3D 拖拽（v0.21）——
 * bindBagDrag / makeBagGhost / bagDropTarget / onBagDragMove / onBagDragUp + bagDrag 拖拽态。
 * 逐字搬迁；对壳本体的调用经 game.bag.bridge.js 的 bagSlots（禁 import 壳），
 * bindBagDrag 经桥反向注册供壳 showBackpack 调用。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';
import { cardStacks, game, saveGame } from '../run/game.session.js';
import { bagSlots } from './game.bag.bridge.js';
import { captureBattleContext } from '../battle/battle-loader.js';
  // ---------- 背包拖拽（v0.21 → v2 2026-10-15）：堆排序 · 左栏分区钮拖放跨区 · 双击进特写 ----------
  export let bagDrag = null;   // {name, fromSafe, cell, ghost, card3d, sx, sy, lx, ly, vx, vy, moved}

  function bindBagDrag() {
    const body = UI.el.ovBody;
    const bagGrid = body.querySelector('.bag-grid');
    if (!bagGrid) return;
    const sameRun = captureBattleContext(game), cards = game.ownedCards;
    let suppressClick = false;
    bagGrid.addEventListener('click', event => {
      if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; }
    }, true);
    const current = () => sameRun() && !game.battleActive && game.ownedCards === cards && bagGrid.isConnected
      && body === UI.el.ovBody && body.querySelector('.bag-grid') === bagGrid
      && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing');
    bagGrid.addEventListener('keydown', e => {
      if (!current() || e.repeat || !['Enter', ' '].includes(e.key)) return;
      const cell = e.target.closest('.bag-tile[data-act="inspectStack"]');
      if (!cell || e.target !== cell) return;
      e.preventDefault(); e.stopPropagation(); cell.click();
    });
    // 按住拖动（pointer 事件，鼠标/触屏通用）；单击看卡走格子上的 inspectStack（v2 看卡操作台）
    const onDown = (e) => {
      if (!current() || e.button !== 0 || bagDrag) return;
      if (e.target.closest('button')) return;   // 格内按钮优先
      const cell = e.target.closest('.bag-tile[data-stack]');
      if (!cell || cell.dataset.pocket === '1') return;
      e.preventDefault();
      bagDrag = {
        name: cell.dataset.stack, fromSafe: cell.dataset.safe === '1', cell, pointerId: e.pointerId, current,
        sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY,
        vx: 0, vy: 0, moved: false, ghost: null, card3d: null,
        suppressClick: () => { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); },
      };
      cell.classList.add('dragging');
      SDT.Sound.sfx('pick');
      window.addEventListener('pointermove', onBagDragMove);
      window.addEventListener('pointerup', onBagDragUp);
      window.addEventListener('pointercancel', onBagDragCancel);
      window.addEventListener('blur', resetBagDrag);
    };
    bagGrid.addEventListener('pointerdown', onDown);
  }

  // 拖拽浮影：真正的卡面 + 跟随速度的 3D 姿态
  function makeBagGhost(name) {
    const o = game.ownedCards.find(x => x.card.name === name);
    if (!o || !bagDrag) return;
    const ghost = document.createElement('div');
    ghost.className = 'bag-ghost';
    ghost.innerHTML = `<div class="bag-ghost-3d">${SDT.Cards.cardHTML(o.card, 'sm', { hideCost: true })}</div>`;
    document.body.appendChild(ghost);
    bagDrag.ghost = ghost;
    bagDrag.card3d = ghost.querySelector('.bag-ghost-3d');
  }

  function bagDropTarget(x, y, srcCell) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    // v2：左栏分区钮即跨区拖放目标——盾钮存入安全格，背包钮取出
    const railSafe = el.closest('#ovBody .bag-rz[data-zone="safe"]');
    if (railSafe) return { kind: 'safe', el: railSafe };
    const railBag = el.closest('#ovBody .bag-rz[data-zone="bag"]');
    if (railBag) return { kind: 'railBag', el: railBag };
    const cell = el.closest('#ovBody .bag-grid .bag-tile');
    if (!cell) {
      const board = el.closest('#ovBody .bag-board');
      if (board) return { kind: 'area', el: board };   // 网格空处 = 放到卡牌区末尾
      return null;
    }
    if (cell.dataset.stack && cell !== srcCell) {
      return { kind: 'stack', el: cell, name: cell.dataset.stack };
    }
    return { kind: 'area', el: cell };   // 物资格 / 原格 = 放到卡牌区末尾
  }

  // 当前高亮的落点格：pointermove 是高频路径，用追踪变量替代每次全树查询 .drop-here
  let bagDropMarked = null;
  function clearBagDropMark() {
    if (bagDropMarked) { bagDropMarked.classList.remove('drop-here'); bagDropMarked = null; }
  }

  // 高回报率鼠标合帧（09-30 性能审计 F2，同 battle.aim.js 模式）：pointermove 只采样坐标，
  // elementFromPoint 命中检测/浮影定位每显示帧一次——此前逐事件全跑（125-1000Hz 设备上
  // 每秒数百次强制命中测试 + 布局属性写入）
  let bagDragFrame = 0;
  let bagDragPoint = null;
  function onBagDragMove(e) {
    if (!bagDrag || e.pointerId !== bagDrag.pointerId) return;
    if (!bagDrag.current()) { resetBagDrag(); return; }
    bagDragPoint = { x: e.clientX, y: e.clientY };
    if (bagDragFrame) return;
    bagDragFrame = requestAnimationFrame(bagDragFrameStep);
  }
  function bagDragFrameStep() {
    bagDragFrame = 0;
    if (!bagDrag || !bagDragPoint) return;
    if (!bagDrag.current()) { resetBagDrag(); return; }
    const x = bagDragPoint.x, y = bagDragPoint.y;
    bagDragPoint = null;
    const dx = x - bagDrag.lx, dy = y - bagDrag.ly;
    bagDrag.vx = bagDrag.vx * 0.72 + dx * 0.9;   // 平滑速度 → 3D 倾角
    bagDrag.vy = bagDrag.vy * 0.72 + dy * 0.9;
    bagDrag.lx = x; bagDrag.ly = y;
    if (!bagDrag.moved) {
      if (Math.hypot(x - bagDrag.sx, y - bagDrag.sy) < 5) return;
      bagDrag.moved = true;
      makeBagGhost(bagDrag.name);
    }
    if (bagDrag.ghost) {
      // 浮影定位走合成器 transform（left/top 是布局属性，每帧写会触发布局）
      bagDrag.ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const ry = Math.max(-30, Math.min(30, bagDrag.vx * 1.5));
      const rx = Math.max(-22, Math.min(22, -bagDrag.vy * 1.4));
      bagDrag.card3d.style.transform =
        `translate(-50%, -62%) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) scale(1.07)`;
    }
    clearBagDropMark();
    const t = bagDropTarget(x, y, bagDrag.cell);
    if (t && t.el) { t.el.classList.add('drop-here'); bagDropMarked = t.el; }
  }

  function onBagDragUp(e) {
    if (!bagDrag || e.pointerId !== bagDrag.pointerId) return;
    const d = bagDrag;
    resetBagDrag();
    if (!d.current()) return;
    if (!d.moved) return;   // 原地按住未拖动 = 无操作
    d.suppressClick();
    SDT.Sound.sfx('drop');
    const t = bagDropTarget(e.clientX, e.clientY, d.cell);
    if (!t) { bagSlots.showDiscardConfirm(d.name, d.fromSafe); return; }
    if (t.kind === 'safe') {
      if (!d.fromSafe) bagSlots.moveStackSafe(d.name, true);   // 拖入安全格（左栏盾钮）
      return;
    }
    if (t.kind === 'railBag') {
      // 从安全格拖回左栏背包钮 = 取出（落点次序按末尾追加）
      if (d.fromSafe) {
        bagSlots.moveStackOrder(d.name, null);
        bagSlots.moveStackSafe(d.name, false);
      }
      return;
    }
    // 拖资源卡到珍珠盒上 = 直接存入（2026-09-17 留言「拖动资源卡到珍珠盒上可以把资源卡移动到珍珠盒内」）
    if (t.kind === 'stack' && !d.fromSafe && t.name === '珍珠盒') {
      const stack = cardStacks(false).find(st => st.card.name === d.name);
      if (!stack) return;
      if (stack.card.type !== '资源') {
        UI.log('[[icon:gem]] 珍珠盒只收资源卡（木材/口粮/钥匙/货币等）——点击珍珠盒可打开存放界面', 'warn');
        SDT.Sound.sfx('deny');
        bagSlots.showBackpack(true);
        return;
      }
      const boxes = game.ownedCards.filter(x => x.card && x.card.id === 'tt2-pearlbox').length;
      const cap = boxes * 9;
      const storedN = game.ownedCards.filter(x => x.stored && !x.pouchOf).length;
      if (storedN + stack.count > cap) {
        UI.log(`[[icon:gem]] 珍珠盒放不下了（${storedN}/${cap} 张）——先取出一些`, 'warn');
        SDT.Sound.sfx('deny');
        bagSlots.showBackpack(true);
        return;
      }
      stack.uids.forEach(uid => { const o = game.ownedCards.find(x => x.uid === uid); if (o) o.stored = 1; });
      UI.log(`[[icon:gem]] 【<b>${esc(stack.card.name)}</b>】×${stack.count} 已拖入珍珠盒——腾出 1 个背包格`, 'ok');
      SDT.Sound.sfx('gain');
      saveGame();
      bagSlots.showBackpack(true);
      return;
    }
    if (d.fromSafe) {
      // 从安全格拖回背包：落点之前插入并取出
      bagSlots.moveStackOrder(d.name, t.kind === 'stack' ? t.name : null);
      bagSlots.moveStackSafe(d.name, false);
      return;
    }
    if (t.kind === 'stack') bagSlots.moveStackOrder(d.name, t.name);
    else bagSlots.moveStackOrder(d.name, null);   // 空格/物资格 = 移到卡牌区末尾
    saveGame();
    // Same-zone order changes preserve the page, artwork, focus and scroll.
    const grid = d.cell.parentElement;
    const moving = [...grid.querySelectorAll('.bag-tile[data-stack]')].filter(cell => cell.dataset.stack === d.name);
    const before = t.kind === 'stack' && t.name !== d.name
      ? [...grid.children].find(cell => cell.dataset.stack === t.name) : null;
    for (const cell of moving) grid.insertBefore(cell, before || null);
  }


function onBagDragCancel(event) { if (event.pointerId === bagDrag?.pointerId) resetBagDrag(); }
export function resetBagDrag() {
  window.removeEventListener('pointermove', onBagDragMove); window.removeEventListener('pointerup', onBagDragUp);
  window.removeEventListener('pointercancel', onBagDragCancel); window.removeEventListener('blur', resetBagDrag);
  if (bagDragFrame) cancelAnimationFrame(bagDragFrame); bagDragFrame = 0; bagDragPoint = null;
  clearBagDropMark(); bagDrag?.cell.classList.remove('dragging'); bagDrag?.ghost?.remove(); bagDrag = null;
}
bagSlots.bindBagDrag = bindBagDrag;   // 反向注册：壳 showBackpack 渲染后经桥挂拖拽（唯一消费链，2026-10-02 审计 A 档摘除无效 export）
