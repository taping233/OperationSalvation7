/* 由 game.bag.js 拆出（2026-09-22 六文件重构批4）：背包 3D 拖拽（v0.21）——
 * bindBagDrag / makeBagGhost / bagDropTarget / onBagDragMove / onBagDragUp + bagDrag 拖拽态。
 * 逐字搬迁；对壳本体的调用经 game.bag.bridge.js 的 bagSlots（禁 import 壳），
 * bindBagDrag 经桥反向注册供壳 showBackpack 调用。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from './shared.js';
import { cardStacks, doDeath, game, newUid, safeUsed, saveGame, usedSlots } from './game.session.js';
import { bagSlots } from './game.bag.bridge.js';
  // ---------- 背包拖拽（v0.21）：3D 立体手感 · 堆排序 · 拖入/拖出安全格 ----------
  export let bagDrag = null;   // {name, fromSafe, cell, ghost, card3d, sx, sy, lx, ly, vx, vy, moved}
  let bagTiltBound = false;   // 悬停倾斜是 document 级委托，只绑一次（避免重复打开背包时叠加监听）

  function bindBagDrag() {
    const body = UI.el.ovBody;
    const bagGrid = body.querySelector('.bag-grid:not(.safe-grid)');
    const safeGrid = body.querySelector('.safe-grid');
    if (!bagGrid) return;

    // 悬停 3D 倾斜：卡牌跟随指针微微转动（立体感）
    if (!bagTiltBound) {
      bagTiltBound = true;
      document.addEventListener('mousemove', (e) => {
        if (bagDrag || UI.el.overlay.hidden) return;
        // 卡槽只存在于背包页（mode==='bagpage' 时 overlay 带 bag-full 类）：
        // 其他弹层（基地/商店/战斗/撤离页…）打开时直接跳出，
        // 避免每次鼠标移动都白跑一轮 querySelectorAll + closest。
        if (!UI.el.overlay.classList.contains('bag-full')) return;
        const root = UI.el.ovBody;
        root.querySelectorAll('.card-slot.tilted, .safe-slot.tilted').forEach(c => {
          c.classList.remove('tilted');
          const inner = c.querySelector('.flip-inner');
          if (inner) inner.style.transform = c.classList.contains('flipped') ? 'rotateY(180deg)' : '';
        });
        const cell = e.target.closest && e.target.closest('#ovBody .card-slot, #ovBody .safe-slot');
        if (!cell || (e.target.closest && e.target.closest('button'))) return;
        const r = cell.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        const flip = cell.classList.contains('flipped') ? 180 : 0;
        const inner = cell.querySelector('.flip-inner');
        if (inner) {
          cell.classList.add('tilted');
          inner.style.transform = `rotateY(${(flip + px * 16).toFixed(1)}deg) rotateX(${(-py * 14).toFixed(1)}deg)`;
        }
      });
    }
    // 双击翻面：正面 ⇄ 当前装备的卡背
    const onDbl = (e) => {
      const cell = e.target.closest('.card-slot, .safe-slot');
      if (!cell || e.target.closest('button')) return;
      cell.classList.toggle('flipped');
      const inner = cell.querySelector('.flip-inner');
      if (inner) inner.style.transform = cell.classList.contains('flipped') ? 'rotateY(180deg)' : '';
      SDT.Sound.sfx('click');
    };
    bagGrid.addEventListener('dblclick', onDbl);
    if (safeGrid) safeGrid.addEventListener('dblclick', onDbl);
    // 按住拖动（pointer 事件，鼠标/触屏通用）
    const onDown = (e, fromSafe) => {
      if (e.button !== 0 || bagDrag) return;
      if (e.target.closest('button')) return;   // 格内按钮优先
      const cell = e.target.closest(fromSafe ? '.safe-slot' : '.card-slot');
      if (!cell || !cell.dataset.stack) return;
      e.preventDefault();
      bagDrag = {
        name: cell.dataset.stack, fromSafe, cell,
        sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY,
        vx: 0, vy: 0, moved: false, ghost: null, card3d: null,
      };
      cell.classList.add('dragging');
      SDT.Sound.sfx('pick');
      window.addEventListener('pointermove', onBagDragMove);
      window.addEventListener('pointerup', onBagDragUp, { once: true });
    };
    bagGrid.addEventListener('pointerdown', (e) => onDown(e, false));
    if (safeGrid) safeGrid.addEventListener('pointerdown', (e) => onDown(e, true));
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
    const safeCell = el.closest('#ovBody .safe-grid .bag-slot');
    if (safeCell) return { kind: 'safe', el: safeCell };
    const cell = el.closest('#ovBody .bag-grid:not(.safe-grid) .bag-slot');
    if (!cell) return null;
    if (cell.classList.contains('card-slot') && cell !== srcCell) {
      return { kind: 'stack', el: cell, name: cell.dataset.stack };
    }
    return { kind: 'area', el: cell };   // 空格 / 物资格 = 放到卡牌区末尾
  }

  // 当前高亮的落点格：pointermove 是高频路径，用追踪变量替代每次全树查询 .drop-here
  let bagDropMarked = null;
  function clearBagDropMark() {
    if (bagDropMarked) { bagDropMarked.classList.remove('drop-here'); bagDropMarked = null; }
  }

  function onBagDragMove(e) {
    if (!bagDrag) return;
    const dx = e.clientX - bagDrag.lx, dy = e.clientY - bagDrag.ly;
    bagDrag.vx = bagDrag.vx * 0.72 + dx * 0.9;   // 平滑速度 → 3D 倾角
    bagDrag.vy = bagDrag.vy * 0.72 + dy * 0.9;
    bagDrag.lx = e.clientX; bagDrag.ly = e.clientY;
    if (!bagDrag.moved) {
      if (Math.hypot(e.clientX - bagDrag.sx, e.clientY - bagDrag.sy) < 5) return;
      bagDrag.moved = true;
      makeBagGhost(bagDrag.name);
    }
    if (bagDrag.ghost) {
      bagDrag.ghost.style.left = e.clientX + 'px';
      bagDrag.ghost.style.top = e.clientY + 'px';
      const ry = Math.max(-30, Math.min(30, bagDrag.vx * 1.5));
      const rx = Math.max(-22, Math.min(22, -bagDrag.vy * 1.4));
      bagDrag.card3d.style.transform =
        `translate(-50%, -62%) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) scale(1.07)`;
    }
    clearBagDropMark();
    const t = bagDropTarget(e.clientX, e.clientY, bagDrag.cell);
    if (t && t.el) { t.el.classList.add('drop-here'); bagDropMarked = t.el; }
  }

  function onBagDragUp(e) {
    window.removeEventListener('pointermove', onBagDragMove);
    clearBagDropMark();
    // 兜底清一次（战斗悬停等也用 drop-here 类；一次性查询开销可忽略）
    document.querySelectorAll('#ovBody .drop-here').forEach(el => el.classList.remove('drop-here'));
    const d = bagDrag;
    bagDrag = null;
    if (!d) return;
    d.cell.classList.remove('dragging');
    if (d.ghost) d.ghost.remove();
    if (!d.moved) return;   // 原地按住未拖动 = 无操作
    SDT.Sound.sfx('drop');
    const t = bagDropTarget(e.clientX, e.clientY, d.cell);
    if (!t) { bagSlots.showDiscardConfirm(d.name, d.fromSafe); return; }
    if (t.kind === 'safe') {
      if (!d.fromSafe) bagSlots.moveStackSafe(d.name, true);   // 拖入安全格
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
    bagSlots.showBackpack(true);
  }


export function resetBagDrag() { bagDrag = null; }   // 壳侧 showBackpack 刷新时清拖拽（ESM 导入绑定不可赋值，2026-09-22 理顺点）
bagSlots.bindBagDrag = bindBagDrag;   // 反向注册：壳 showBackpack 渲染后经桥挂拖拽

export { bindBagDrag };
