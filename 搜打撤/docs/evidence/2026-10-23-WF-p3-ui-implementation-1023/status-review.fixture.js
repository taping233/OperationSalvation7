// Isolated DEV review only. Copy this file into the frozen game root, then
// import it from that copy's index. Never import it from the product entry.
// Buttons render constructed display snapshots; they do not prove gameplay triggers.
const COUNTS = [0, 1, 4, 5, 8, 16];
const AMOUNTS = [1, 9, 10, 99];
const KEYS = ['atkUp', 'bleed', 'swordForm', 'freeze', 'spellUp', 'poison', 'stealth', 'healban',
  'reduce', 'dodge', 'immune', 'natureForm', 'cosmosForm', 'silence', 'abreak', 'atkDown'];
const PROTECTED = '#runTopBar,.sts-topbar,.sts-hud-l,.sts-hud-r,.sts-hand-tools,.sts-energy-wrap,.bt-hand-page,.sts-hand,.sts-tactics,.sts-nameplate,[data-act="btEnd"]';

// Only fields consumed by updateUnits are copied. The real snapshot stays the
// authoritative source; no property is written to it or to SDT.game/engine/storage.
function copyRecord(value) {
  if (Array.isArray(value)) return value.map(copyRecord);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyRecord(item)]));
  return value;
}

function displaySnapshot(base, count, amount, combat) {
  const status = () => Object.fromEntries(KEYS.slice(0, count).map(key => [key, combat.BUFF_META[key]?.flag ? 1 : amount]));
  const allies = base.allies.length ? base.allies : [{
    name: '联邦巡防兵', hp: 18, maxHp: 18, atk: 3, dead: false,
    defense: { shield: 0, armor: 0, guard: false },
  }];
  return {
    ...base, opts: { ...base.opts, devSample: true }, player: { ...base.player }, pdef: { ...base.pdef },
    pstat: { ...copyRecord(base.pstat), status: status() },
    foes: base.foes.map(foe => ({ ...copyRecord(foe), status: status() })),
    allies: allies.map(ally => ({ ...copyRecord(ally), status: status() })),
    equipped: copyRecord(base.equipped), playerEffects: [],
  };
}

export function installStatusReviewFixture() {
  if (!import.meta.env.DEV || !document.body) return { dispose() {} };
  const previous = document.getElementById('p3StatusReview');
  if (previous) return { dispose() {} };
  const root = document.createElement('aside');
  root.id = 'p3StatusReview'; root.setAttribute('aria-label', '构造状态展示验收');
  Object.assign(root.style, {
    position: 'absolute', zIndex: '30000', left: '12px', top: '120px', width: '300px', maxWidth: 'calc(100% - 24px)',
    boxSizing: 'border-box', padding: '8px', background: '#10212cf5', color: '#e7edf0', border: '1px solid #9ab9bf',
    borderRadius: '5px', font: '12px/1.5 "Microsoft YaHei",sans-serif', pointerEvents: 'auto',
  });
  const header = document.createElement('div');
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.textContent = '展开状态验收'; toggle.setAttribute('aria-expanded', 'false');
  header.append(toggle); root.append(header);
  const panel = document.createElement('div'); panel.hidden = true; root.append(panel);
  const note = document.createElement('p');
  note.textContent = '仅构造展示状态，不证明玩法触发。无随从时补一名展示随从；不连接引擎或存档。';
  Object.assign(note.style, { margin: '6px 0', color: '#bbcbd4' }); panel.append(note);
  const controls = [];
  function row(label, values, kind) {
    const line = document.createElement('div'); line.textContent = `${label}：`;
    Object.assign(line.style, { display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', margin: '6px 0' });
    for (const value of values) {
      const button = document.createElement('button'); button.type = 'button';
      button.dataset[kind] = String(value); button.textContent = String(value);
      button.setAttribute('aria-label', `${label}${value}`); button.setAttribute('aria-pressed', 'false');
      line.append(button); controls.push(button);
    }
    panel.append(line);
  }
  row('状态数量', COUNTS, 'count'); row('状态数值', AMOUNTS, 'amount');
  const restore = document.createElement('button'); restore.type = 'button'; restore.textContent = '恢复实战展示';
  panel.append(restore); controls.push(restore);
  const output = document.createElement('p'); output.setAttribute('role', 'status'); output.setAttribute('aria-live', 'polite');
  Object.assign(output.style, { margin: '6px 0 0', color: '#d5e4d5' }); panel.append(output);
  for (const button of root.querySelectorAll('button')) Object.assign(button.style, {
    font: 'inherit', padding: '3px 7px', minHeight: '26px', border: '1px solid #718f99', borderRadius: '3px',
    background: '#233e4b', color: '#e7edf0', transform: 'none', cursor: 'pointer', boxShadow: 'none',
  });
  // Mount only inside the current battle's modal ownership. A body sibling is
  // correctly isolated by the product modal manager and cannot receive input.

  let api = null, loading = null, frame = 0, disposed = false, count = 8, amount = 1, appliedToken = null;
  let message = '请进入 devSample或隔离无档位测试战斗。';
  const load = () => loading ||= Promise.all([
    import('./src/battle/core/battle.core.js'), import('./src/battle/view/battle.layers.js'), import('./src/run/game.session.js'),
  ]).then(([core, layers, session]) => { api = { ...layers, getSnapshot: core.getSnapshot, combat: core.Combat, getActiveSlot: session.getActiveSlot }; schedule(); });
  function stageNow() {
    return [...document.querySelectorAll('#overlay .battle-stage.sts')].find(stage =>
      stage.isConnected && !stage.closest('[hidden],[inert]') && stage.getClientRects().length) || null;
  }
  function current() {
    const stage = stageNow();
    if (!stage || !api) return null;
    try {
      const snapshot = api.getSnapshot();
      const isolatedTest = location.origin === 'http://127.0.0.1:5319' && api.getActiveSlot() === null && window.SDT?.game?.devMode === true;
      return (snapshot.opts?.devSample === true || isolatedTest) && snapshot.player && snapshot.pstat ? { stage, snapshot } : null;
    } catch { return null; }
  }
  function render(snapshot, stage) {
    const body = stage.closest('#ovBody') || stage;
    const mounts = api.mountUnitLayer(body, snapshot.battleToken);
    if (!mounts) throw new Error('当前单位挂载点未就绪');
    api.updateUnits(mounts, snapshot, {
      isBoss: !!snapshot.opts.isBoss, pendingTarget: snapshot.pendingTarget,
      pendingItem: snapshot.pendingItem, slamPending: snapshot.slamPending, dartPending: snapshot.dartPending,
    });
  }
  function apply() {
    const active = current();
    if (!active) { message = '仅允许在可见的 devSample或隔离无档位测试战斗应用。'; schedule(); return; }
    try {
      render(displaySnapshot(active.snapshot, count, amount, api.combat), active.stage);
      appliedToken = active.snapshot.battleToken;
      message = `构造展示：每单位 ${count} 项；非开关数值 ${amount}。${active.snapshot.allies.length ? '' : '随从为构造展示。'}`;
    } catch (error) { message = `未应用：${error.message}`; }
    schedule();
  }
  function restoreLive() {
    const active = current();
    if (!active) { message = '当前没有可恢复的测试战斗。'; schedule(); return; }
    try { render(active.snapshot, active.stage); appliedToken = null; message = '已用当前真实快照恢复展示。'; }
    catch (error) { message = `未恢复：${error.message}`; }
    schedule();
  }
  function overlaps(a, b) { return a.left < b.right + 6 && a.right > b.left - 6 && a.top < b.bottom + 6 && a.bottom > b.top - 6; }
  function position(stage) {
    const area = stage?.getBoundingClientRect() || { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const scaleX = stage?.offsetWidth ? area.width / stage.offsetWidth : 1;
    const scaleY = stage?.offsetHeight ? area.height / stage.offsetHeight : 1;
    const protectedRects = [...document.querySelectorAll(PROTECTED)].filter(node => !node.closest('[hidden]'))
      .map(node => node.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
    const bounds = root.getBoundingClientRect(), width = bounds.width, height = bounds.height;
    for (let y = Math.max(8, area.top + 8); y + height <= Math.min(innerHeight, area.bottom) - 8; y += 24) {
      const xs = [Math.max(8, area.left + (area.right - area.left - width) / 2), area.left + 8, area.right - width - 8];
      for (const x of xs) {
        if (x < 8 || x + width > innerWidth - 8) continue;
        const candidate = { left: x, right: x + width, top: y, bottom: y + height };
        if (protectedRects.some(rect => overlaps(candidate, rect))) continue;
        root.style.left = `${(x - area.left) / scaleX + (stage?.scrollLeft || 0) - (stage?.clientLeft || 0)}px`;
        root.style.top = `${(y - area.top) / scaleY + (stage?.scrollTop || 0) - (stage?.clientTop || 0)}px`;
        root.style.visibility = 'visible'; return true;
      }
    }
    return false;
  }
  function sync() {
    frame = 0;
    const stage = stageNow();
    if (!stage) {
      for (const button of controls) button.disabled = true;
      root.remove(); return;
    }
    // Renderers may replace the battle shell. Reattach our detached fixture to
    // its new owner; never clear inert attributes belonging to the product.
    if (root.parentElement !== stage) stage.append(root);
    if (stage && !api) load().catch(error => { message = `工具未加载：${error.message}`; schedule(); });
    let active = null;
    try { active = current(); } catch { /* Battle runtime may still be mounting. */ }
    for (const button of controls) {
      button.disabled = !active;
      button.style.opacity = active ? '1' : '.6';
      if (button.dataset.count) button.setAttribute('aria-pressed', String(Number(button.dataset.count) === count));
      if (button.dataset.amount) button.setAttribute('aria-pressed', String(Number(button.dataset.amount) === amount));
      button.style.background = button.getAttribute('aria-pressed') === 'true' ? '#426b73' : '#233e4b';
    }
    if (appliedToken !== null && active?.snapshot.battleToken !== appliedToken) {
      appliedToken = null; message = '原验收场次已离开；新场次未应用构造状态。';
    }
    const text = active ? message : '仅允许在可见的 devSample或隔离无档位测试战斗应用；当前按钮不可操作。';
    if (output.textContent !== text) output.textContent = text;
    root.style.width = panel.hidden ? '126px' : '300px';
    let fits = position(stage);
    if (!fits && !panel.hidden) {
      panel.hidden = true; toggle.textContent = '展开状态验收'; toggle.setAttribute('aria-expanded', 'false');
      root.style.width = '126px';
      fits = position(stage);
    }
    if (!fits) root.style.visibility = 'hidden';
  }
  function schedule() { if (!disposed && !frame) frame = requestAnimationFrame(sync); }
  function clicked(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button === toggle) {
      panel.hidden = !panel.hidden; toggle.textContent = panel.hidden ? '展开状态验收' : '折叠状态验收';
      toggle.setAttribute('aria-expanded', String(!panel.hidden)); schedule(); return;
    }
    if (button === restore) { restoreLive(); return; }
    if (button.dataset.count) count = Number(button.dataset.count);
    if (button.dataset.amount) amount = Number(button.dataset.amount);
    apply();
  }
  root.addEventListener('click', clicked);
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  const resize = new ResizeObserver(schedule); resize.observe(document.documentElement);
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
    root.removeEventListener('click', clicked); root.remove();
  }
  schedule(); return { dispose };
}

export const statusReviewFixture = installStatusReviewFixture();
if (import.meta.hot) import.meta.hot.dispose(() => statusReviewFixture.dispose());
