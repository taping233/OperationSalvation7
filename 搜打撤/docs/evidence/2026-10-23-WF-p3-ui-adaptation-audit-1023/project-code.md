# 项目现行代码摘录

每段保留原文件行号。摘录用于定位与理解；反编译片段不是可直接粘贴进 Vite 的实现。项目片段取自本轮冻结副本。

## P01

连续目标、停止与原有动画所有权

原文件：`game/src/ui/target-motion.js`；原行：26–28、37–51、66–135。

```text
--- game/src/ui/target-motion.js:26 ---
   26 | // A finite animation per element. Native Motion.stop() commits the currently
   27 | // displayed values, so a new target continues from that point rather than a seed.
   28 | // The installed map-easing.mjs accepts a string key and preserves its existing
--- game/src/ui/target-motion.js:37 ---
   37 |   function stopVisual(element) {
   38 |     const state = states.get(element);
   39 |     if (!state?.animation) return;
   40 |     const animation = state.animation;
   41 |     state.animation = null;
   42 |     active.delete(element);
   43 |     try {
   44 |       // Native commitStyles cannot sample a hidden or removed target. Cleanup
   45 |       // discards that animation; visible interruptions retain the current pose.
   46 |       if (!element.isConnected || element.closest('[hidden]')) animation.cancel?.();
   47 |       else animation.stop();
   48 |     } catch {
   49 |       // A parent can become display:none between the DOM check and native stop.
   50 |       animation.cancel?.();
   51 |     } finally { state.resolve?.(false); state.resolve = null; }
--- game/src/ui/target-motion.js:66 ---
   66 |   function retargetVisual(element, target, { duration = motionTiming.change, easing = motionEasing.enter, delay = 0, from } = {}) {
   67 |     if (!element?.style || !target) return finishedHandle(false);
   68 |     let state = states.get(element);
   69 |     const first = !state;
   70 |     if (!state) {
   71 |       state = { original:new Map(), pose:{}, animation:null, resolve:null, target:{}, signature:'', handle:null, settled:false };
   72 |       states.set(element, state);
   73 |     }
   74 |     const seed = first && from ? stylesFor(from, state.pose) : null;
   75 |     const goal = stylesFor(target, state.pose);
   76 |     const signature = JSON.stringify(goal);
   77 |     if (!first && signature === state.signature && (state.animation || state.settled)) return state.handle || finishedHandle(true);
   78 |     stopVisual(element);
   79 |     for (const property of new Set([...Object.keys(seed || {}), ...Object.keys(goal)])) {
   80 |       if (!state.original.has(property)) state.original.set(property, {
   81 |         value:element.style.getPropertyValue(property), priority:element.style.getPropertyPriority(property),
   82 |       });
   83 |     }
   84 |     state.target = goal;
   85 |     state.signature = signature;
   86 |     state.settled = false;
   87 |     if (seed) setStyles(element, seed);
   88 |     if (reduced() || duration <= 0) {
   89 |       setStyles(element, goal);
   90 |       state.settled = true;
   91 |       state.handle = finishedHandle(true);
   92 |       return state.handle;
   93 |     }
   94 |     let resolve;
   95 |     const finished = new Promise(done => { resolve = done; });
   96 |     state.resolve = resolve;
   97 |     try {
   98 |       const nativeRunner = run === legacyAnimate;
   99 |       // Explicit entrance poses need no computed-style sampling. Motion mini
  100 |       // otherwise reads styles after each region's seed write, flushing layout.
  101 |       const keyframes = Object.fromEntries(Object.entries(goal).map(([key, value]) => [
  102 |         key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
  103 |         nativeRunner && seed?.[key] !== undefined ? [seed[key], value] : value,
  104 |       ]));
  105 |       // The bundled Motion runner exposes exactly the native animations it
  106 |       // creates. Enumerating element animations twice forces style resolution.
  107 |       const before = nativeRunner ? null : new Set(element.getAnimations?.() || []);
  108 |       const animation = run(element, keyframes, { duration:Math.max(0, duration) / 1000, delay:Math.max(0, delay) / 1000, ease:easing });
  109 |       state.native = nativeRunner
  110 |         ? new Set(animation.animations.map(item => 'animation' in item ? item.animation : null).filter(Boolean))
  111 |         : new Set((element.getAnimations?.() || []).filter(item => !before.has(item)));
  112 |       state.animation = animation;
  113 |       active.add(element);
  114 |       const handle = { finished, stop() { if (state.animation === animation) stopVisual(element); } };
  115 |       state.handle = handle;
  116 |       Promise.resolve(animation).then(() => {
  117 |         if (state.animation !== animation) return;
  118 |         state.animation = null; active.delete(element);
  119 |         setStyles(element, goal);
  120 |         state.settled = true;
  121 |         state.resolve = null; resolve(true);
  122 |       }, () => {
  123 |         if (state.animation !== animation) return;
  124 |         state.animation = null; active.delete(element);
  125 |         setStyles(element, goal);
  126 |         state.settled = true;
  127 |         state.resolve = null; resolve(false);
  128 |       });
  129 |       return handle;
  130 |     } catch {
  131 |       // Environments without native animation still expose the final UI state.
  132 |       setStyles(element, goal);
  133 |       state.animation = null; active.delete(element); state.resolve = null;
  134 |       state.settled = true;
  135 |       resolve(true);
```

## P02

背包/设置的共享选中底板

原文件：`game/src/ui/selection-state-motion.js`；原行：1–8、31–63。

```text
--- game/src/ui/selection-state-motion.js:1 ---
    1 | import '../../css/selection-state-motion.css';
    2 | import { retargetVisual, clearVisual } from './target-motion.js';
    3 | 
    4 | const definitions = [
    5 |   { group: '.bag-rail', item: '.bag-rz', selected: '.bag-rz.on', kind: 'zone' },
    6 |   { group: '.bag-tools', item: '.bag-pill', selected: '.bag-pill.on', kind: 'filter' },
    7 |   { group: '.settings-nav', item: '.settings-tab', selected: '.settings-tab[aria-selected="true"]', kind: 'settings' },
    8 | ];
--- game/src/ui/selection-state-motion.js:31 ---
   31 |   function update() {
   32 |     frame = 0;
   33 |     if (disposed) return;
   34 |     if (membershipDirty) refreshMembership();
   35 |     for (const [group, state] of groups) {
   36 |       const { definition } = state;
   37 |       const selected = group.querySelector(definition.selected);
   38 |       const bounds = group.getBoundingClientRect();
   39 |       const rect = selected?.getBoundingClientRect();
   40 |       const visible = rect && rect.width > 0 && rect.height > 0 && bounds.width > 0 && bounds.height > 0;
   41 |       if (!visible) {
   42 |         if (state.signature !== 'hidden') retargetVisual(state.plate, { opacity: 0 });
   43 |         state.signature = 'hidden';
   44 |         state.ready = false;
   45 |         continue;
   46 |       }
   47 |       // Rectangles include ancestor page scaling; animation coordinates belong to the group.
   48 |       const scaleX = group.offsetWidth ? bounds.width / group.offsetWidth : 1;
   49 |       const scaleY = group.offsetHeight ? bounds.height / group.offsetHeight : 1;
   50 |       const computed = getComputedStyle(selected);
   51 |       const tint = definition.kind === 'settings'
   52 |         ? computed.getPropertyValue('--settings-category-tint').trim() || '204,181,139'
   53 |         : '108,155,169';
   54 |       const target = {
   55 |         x: (rect.left - bounds.left) / scaleX + group.scrollLeft - group.clientLeft,
   56 |         y: (rect.top - bounds.top) / scaleY + group.scrollTop - group.clientTop,
   57 |         width: rect.width / scaleX, height: rect.height / scaleY,
   58 |         color: `rgb(${tint})`, opacity: 1,
   59 |       };
   60 |       const signature = JSON.stringify(target);
   61 |       if (state.signature === signature) continue;
   62 |       retargetVisual(state.plate, target, state.ready ? {} : { duration: 0 });
   63 |       state.signature = signature;
```

## P03

奖励与背包的现行轻抬、选中与拖拽排除

原文件：`game/src/ui/card-state-motion.js`；原行：1–30、36–67。

```text
--- game/src/ui/card-state-motion.js:1 ---
    1 | import { retargetVisual, clearVisual } from './target-motion.js';
    2 | import { motionReduced, motionTiming } from './motion-presets.js';
    3 | import '../../css/card-state-motion.css';
    4 | 
    5 | const selector = '.reward-replica .reward-card,.bag-tile.card-face[data-stack]';
    6 | const installations = new WeakMap();
    7 | const blocked = element => element.closest('.dragging,[aria-grabbed="true"],.reward-unit.got,.reward-unit.dropped,.bt-hand,.sts-hand')
    8 |   || element.disabled || element.closest('[hidden],[inert]');
    9 | 
   10 | // Delegation survives reward and bag reconciliation without adding per-page listeners.
   11 | export function installCardStateMotion(root = document.body) {
   12 |   if (installations.has(root)) return installations.get(root);
   13 |   const tracked = new Map();
   14 |   const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
   15 |   let pointerCard = null, focusCard = null;
   16 |   function update(element) {
   17 |     if (!element) return;
   18 |     if (blocked(element)) { release(element); return; }
   19 |     if (!tracked.has(element)) tracked.set(element, true);
   20 |     element.dataset.cardStateMotion = 'true';
   21 |     const active = pointerCard === element || focusCard === element
   22 |       || element.matches('[aria-selected="true"],[aria-pressed="true"]')
   23 |       || !!element.closest('.is-pending-target');
   24 |     const quiet = motionReduced();
   25 |     retargetVisual(element, {
   26 |       y: active && !quiet ? -6 : 0, scale: active && !quiet ? 1.02 : 1, rotate: 0,
   27 |     }, { duration: quiet ? 0 : active ? motionTiming.change : motionTiming.cardReturn });
   28 |   }
   29 |   function release(element) {
   30 |     clearVisual(element); delete element.dataset.cardStateMotion; tracked.delete(element);
--- game/src/ui/card-state-motion.js:36 ---
   36 |     if (event.pointerType === 'touch') return;
   37 |     const next = card(event.target);
   38 |     if (!next || next === pointerCard) return;
   39 |     const previous = pointerCard; pointerCard = next; update(previous); update(next);
   40 |   }
   41 |   function out(event) {
   42 |     const previous = card(event.target);
   43 |     if (!previous || previous !== pointerCard || previous.contains(event.relatedTarget)) return;
   44 |     pointerCard = null; update(previous);
   45 |   }
   46 |   function focus(event) { const previous = focusCard; focusCard = card(event.target); update(previous); update(focusCard); }
   47 |   function blur(event) {
   48 |     const previous = card(event.target);
   49 |     if (!previous || previous.contains(event.relatedTarget)) return;
   50 |     focusCard = null; update(previous);
   51 |   }
   52 |   function reset() { for (const element of [...tracked.keys()]) release(element); }
   53 |   function preferenceChanged() { for (const element of [...tracked.keys()]) update(element); }
   54 |   const observer = new MutationObserver(records => {
   55 |     for (const element of [...tracked.keys()]) {
   56 |       if (!root.contains(element) || blocked(element)) release(element);
   57 |       else if (records.some(record => record.type === 'attributes' && (record.target === element || record.target.contains(element)))) update(element);
   58 |     }
   59 |     syncSelected();
   60 |   });
   61 |   function syncSelected() {
   62 |     for (const element of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('.reward-replica .is-pending-target .reward-card,.reward-replica .reward-card[aria-selected="true"],.bag-tile.card-face[data-stack][aria-selected="true"]'))) {
   63 |       if (!tracked.has(element)) update(element);
   64 |     }
   65 |   }
   66 |   observer.observe(root, { childList: true, subtree: true, attributes: true,
   67 |     attributeFilter: ['class','hidden','inert','disabled','aria-selected','aria-pressed','aria-grabbed'] });
```

## P04

设置行、开关滑块、页签内容入场的现行责任

原文件：`game/css/settings-navigation.css`；原行：127–176、250–269。

```text
--- game/css/settings-navigation.css:127 ---
  127 | #overlay .settings-tabbed .settings-group .chk {
  128 |   display: flex; align-items: center; gap: 24px;
  129 |   min-height: 84px; padding: 16px 28px; margin: 0 0 8px;
  130 |   background: linear-gradient(105deg, rgba(125,135,145,.22), rgba(60,70,81,.24));
  131 |   border: 1px solid #d9e6ef21; border-radius: 4px;
  132 |   box-shadow: inset 0 1px 0 #ecf4ff12, inset 0 -1px 0 #03080e33, 0 3px 8px #02060926;
  133 |   color: #e7edf3; font-size: var(--ui-text-body); animation: none;
  134 |   transition: background .15s ease, border-color .15s ease, box-shadow .15s ease;
  135 | }
  136 | #overlay .settings-tabbed .chk:hover {
  137 |   background: linear-gradient(105deg, rgba(136,154,171,.3), rgba(65,79,93,.36));
  138 |   border-color: #c8dbe34d;
  139 |   box-shadow: inset 0 1px 0 #edf5ff21, 0 7px 18px #02060940;
  140 | }
  141 | #overlay .settings-tabbed .chk:has(input[type="checkbox"]:checked) {
  142 |   border-right-color: rgba(var(--settings-tint),.35);
  143 | }
  144 | #overlay .settings-tabbed .settings-group .chk:has(input:focus-visible) {
  145 |   border-color: #bdcfdf80;
  146 |   background: linear-gradient(105deg, rgba(136,154,171,.3), rgba(65,79,93,.36));
  147 |   box-shadow: inset 0 0 0 1px #bdcfdf26, 0 5px 14px #02060940;
  148 | }
  149 | #overlay .settings-tabbed .chk::before,
  150 | #overlay .settings-tabbed .chk::after { display: none; }
  151 | #overlay .settings-tabbed .chk > .settings-row-copy,
  152 | #overlay .settings-tabbed .vol > span { display: block; flex: 1; min-width: 0; }
  153 | #overlay .settings-tabbed .settings-row-copy,
  154 | #overlay .settings-tabbed .vol > span { font-weight: 500; letter-spacing: .4px; }
  155 | #overlay .settings-tabbed .chk .set-en {
  156 |   display: block; margin: 6px 0 0; padding: 0; min-width: 0;
  157 |   font-size: var(--ui-text-label); color: #98a9b7; text-align: left; line-height: 1.3;
  158 | }
  159 | #overlay .settings-tabbed .chk input[type="checkbox"] {
  160 |   appearance: none; position: relative; flex: 0 0 48px;
  161 |   width: 48px; height: 26px; margin: 0;
  162 |   background: linear-gradient(180deg, #111923, #1c2631); border: 1px solid #657b8d; border-radius: 20px;
  163 |   box-shadow: inset 0 2px 4px #02060980, 0 1px 0 #e6f1ff0f; cursor: pointer;
  164 | }
  165 | #overlay .settings-tabbed .chk input[type="checkbox"]::before {
  166 |   content: ''; position: absolute; left: 4px; top: 4px;
  167 |   width: 16px; height: 16px; border-radius: 50%; background: #8397a8;
  168 |   box-shadow: 0 2px 4px #02060966, inset 0 1px 0 #ffffff66;
  169 |   transform: none; transition: transform .24s var(--settings-ease), background .18s ease;
  170 | }
  171 | #overlay .settings-tabbed .chk input[type="checkbox"]::after { display: none; }
  172 | #overlay .settings-tabbed .chk input[type="checkbox"]:checked {
  173 |   background: linear-gradient(180deg, rgba(var(--settings-tint),.65), rgba(var(--settings-tint),.34)), #19212a;
  174 |   border-color: rgba(var(--settings-tint),.8);
  175 | }
  176 | #overlay .settings-tabbed .chk input[type="checkbox"]:checked::before { transform: translateX(22px); background: #eef5fa; }
--- game/css/settings-navigation.css:250 ---
  250 | body:not(.reduce-motion) #overlay .settings-tabbed .settings-content {
  251 |   animation: none;
  252 | }
  253 | body:not(.reduce-motion) #overlay .settings-tabbed[data-settings-motion="change"] .settings-panel:not([hidden]) .settings-panel-head {
  254 |   animation: settingsContentIn var(--home-ui-change) var(--settings-ease) backwards;
  255 | }
  256 | body:not(.reduce-motion) #overlay .settings-tabbed[data-settings-motion="change"] .settings-panel:not([hidden]) :is(.chk,.btn-row,.hint) {
  257 |   animation: settingsContentIn var(--home-ui-change) var(--settings-ease) calc(var(--settings-order, 0) * var(--motion-stagger,35ms)) backwards;
  258 | }
  259 | @keyframes settingsContentIn {
  260 |   from { opacity: 0; transform: translateY(7px); }
  261 |   to { opacity: 1; transform: translateY(0); }
  262 | }
  263 | body.reduce-motion #overlay .settings-tabbed *,
  264 | body.reduce-motion #overlay .settings-tabbed *::before,
  265 | body.reduce-motion #overlay .settings-tabbed *::after { animation: none !important; transition: none !important; }
  266 | @media (prefers-reduced-motion: reduce) {
  267 |   #overlay .settings-tabbed *,
  268 |   #overlay .settings-tabbed *::before,
  269 |   #overlay .settings-tabbed *::after { animation: none !important; transition: none !important; }
```

## P05

发现选择的本地状态、确认、取消和键盘

原文件：`game/src/ui/discovery-selection.js`；原行：21–100、117–145。

```text
--- game/src/ui/discovery-selection.js:21 ---
   21 |   const { UI, root, optionSelector, selectAct, confirmAct, cancelAct, isCurrent, onConfirm, onCancel, onError } = ports;
   22 |   const previous = bindings.get(root), previousSelection = previous?.selected();
   23 |   previous?.dispose();
   24 |   const options = [...root.querySelectorAll(optionSelector)].filter(node => node instanceof HTMLButtonElement);
   25 |   let selected = options.includes(previousSelection) ? previousSelection : null;
   26 |   let busy = false, submitted = false, disposed = false;
   27 |   const confirmButton = /** @type {HTMLButtonElement} */ (root.querySelector(`[data-act="${confirmAct}"]`));
   28 |   const cancelButton = /** @type {HTMLButtonElement} */ (root.querySelector(`[data-act="${cancelAct}"]`));
   29 |   let status = /** @type {HTMLElement|null} */ (root.querySelector('.discovery-selection-status'));
   30 |   options.forEach(button => {
   31 |     button.dataset.discoveryOption = '';
   32 |     if (!button.querySelector(':scope > .discovery-selection-frame')) {
   33 |       const frame = document.createElement('span'); frame.className = 'discovery-selection-frame'; frame.setAttribute('aria-hidden', 'true'); button.append(frame);
   34 |     }
   35 |     if (!button.querySelector(':scope > .discovery-selection-mark')) {
   36 |       const mark = document.createElement('span'); mark.className = 'discovery-selection-mark'; mark.textContent = '✓ 已选中'; mark.setAttribute('aria-hidden', 'true'); button.append(mark);
   37 |     }
   38 |   });
   39 |   const live = () => !disposed && root.isConnected && !root.closest('[inert], [hidden], .closing, [data-ui-closing]') && isCurrent();
   40 |   const available = button => button && button.isConnected && root.contains(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
   41 |   const paint = () => {
   42 |     options.forEach(button => {
   43 |       const chosen = button === selected;
   44 |       button.classList.toggle('discovery-selected', chosen);
   45 |       button.dataset.discoverySelected = String(chosen);
   46 |       button.setAttribute('aria-pressed', String(chosen));
   47 |     });
   48 |     if (confirmButton) confirmButton.disabled = busy || submitted || !selected;
   49 |     if (cancelButton) cancelButton.disabled = busy || submitted;
   50 |     root.setAttribute('data-discovery-busy', String(busy));
   51 |     root.setAttribute('aria-busy', String(busy));
   52 |   };
   53 |   const showStatus = message => {
   54 |     if (!live()) return;
   55 |     if (!status) { status = document.createElement('p'); status.className = 'discovery-selection-status'; status.setAttribute('role', 'status'); root.append(status); }
   56 |     status.textContent = message;
   57 |   };
   58 |   const reportError = (error, operation) => {
   59 |     showStatus(`${operation}未完成，请重试。`);
   60 |     try { onError?.(error); } catch { /* The primary failure is already visible. */ }
   61 |   };
   62 |   const select = button => {
   63 |     if (!live() || busy || submitted || !options.includes(button) || !available(button)) return false;
   64 |     selected = button; if (status) status.textContent = ''; paint(); return true;
   65 |   };
   66 |   const confirm = async () => {
   67 |     if (!live() || busy || submitted || !selected || !available(selected)) return false;
   68 |     const button = selected;
   69 |     busy = true; paint();
   70 |     try {
   71 |       const result = await onConfirm(button.dataset, button);
   72 |       if (result !== false) submitted = true;
   73 |       else showStatus('确认未完成，请重试。');
   74 |       return result !== false;
   75 |     } catch (error) { reportError(error, '确认'); return false; }
   76 |     finally { busy = false; if (live()) paint(); else dispose(); }
   77 |   };
   78 |   const finishCancel = result => {
   79 |     busy = false;
   80 |     if (result !== false) {
   81 |       const returnFocus = selected;
   82 |       selected = null;
   83 |       if (live()) { paint(); if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true}); }
   84 |       else dispose();
   85 |       return true;
   86 |     }
   87 |     if (live()) { showStatus('取消未完成，请重试。'); paint(); } else dispose();
   88 |     return false;
   89 |   };
   90 |   const cancel = () => {
   91 |     if (!live() || busy || submitted) return false;
   92 |     busy = true; paint();
   93 |     try {
   94 |       const result = onCancel();
   95 |       if (result && typeof /** @type {{then?:unknown}} */ (result).then === 'function') {
   96 |         return Promise.resolve(result).then(finishCancel, error => { reportError(error, '取消'); return finishCancel(false); });
   97 |       }
   98 |       return finishCancel(result);
   99 |     } catch (error) { reportError(error, '取消'); return finishCancel(false); }
  100 |   };
--- game/src/ui/discovery-selection.js:117 ---
  117 |     if (!['ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(event.key)) return;
  118 |     if (event.key === 'Enter' && event.target.closest('button,a')
  119 |       && !event.target.closest(optionSelector) && event.target !== confirmButton && event.target !== cancelButton) return;
  120 |     event.preventDefault(); event.stopImmediatePropagation();
  121 |     if (!live() || busy || submitted) return;
  122 |     if (event.key === 'Escape') { void cancel(); return; }
  123 |     if (event.key === 'Enter') {
  124 |       const target = event.target.closest(optionSelector);
  125 |       if (target instanceof HTMLButtonElement) { if (select(target)) confirmButton?.focus({preventScroll:true}); }
  126 |       else if (event.target === cancelButton) void cancel();
  127 |       else void confirm();
  128 |       return;
  129 |     }
  130 |     const ready = options.filter(available);
  131 |     if (!ready.length) return;
  132 |     const focused = options.find(button => button === event.target);
  133 |     const index = ready.indexOf(selected || focused);
  134 |     const direction = event.key === 'ArrowRight' ? 1 : -1;
  135 |     const next = index < 0 ? ready[direction > 0 ? 0 : ready.length - 1]
  136 |       : ready[(index + direction + ready.length) % ready.length];
  137 |     if (select(next)) next.focus({preventScroll:true});
  138 |   };
  139 |   root.addEventListener('click', handleClick, true);
  140 |   root.addEventListener('keydown', handleKeydown, true);
  141 |   const releaseOwner = registerScreenOwner({ root, priority:30, isCurrent:live, onBack:() => {
  142 |     if (document.activeElement instanceof Element && root.contains(document.activeElement)
  143 |       && document.activeElement.closest('input,textarea,select,[contenteditable="true"]')) return;
  144 |     if (live()) void cancel(); else dispose();
  145 |   } });
```

## P06

发现页现有多重描边与已选标记

原文件：`game/css/discovery-selection.css`；原行：19–43。

```text
--- game/css/discovery-selection.css:19 ---
   19 | /* Real selection state belongs to the candidate button, independently of focus.
   20 |    The separate frame survives border resets; its inset edge remains visible even
   21 |    where a scrolling stage clips the outer glow. No animation or artwork repaint. */
   22 | body #overlay .card button[data-discovery-option] { position:relative; overflow:visible; }
   23 | body #overlay .card button[data-discovery-option] > .discovery-selection-frame {
   24 |   position:absolute; inset:0; z-index:3; pointer-events:none; box-sizing:border-box;
   25 |   border-radius:inherit; opacity:0;
   26 | }
   27 | body #overlay .card button[data-discovery-option] > .discovery-selection-mark {
   28 |   position:absolute; right:0; bottom:100%; z-index:4; margin-bottom:6px; padding:3px 10px;
   29 |   pointer-events:none; border:1px solid #f3dda1; border-radius:3px; background:#302b20;
   30 |   color:#fff0bb; font:650 16px/1.35 var(--font-ui,sans-serif); white-space:nowrap; opacity:0;
   31 | }
   32 | body #overlay .card button[data-discovery-option][data-discovery-selected="true"][aria-pressed="true"] {
   33 |   outline:3px solid #f0d58a; outline-offset:5px;
   34 |   box-shadow:0 0 0 2px #f5dea78c, 0 0 26px #e4be606e;
   35 | }
   36 | body #overlay .card button[data-discovery-option][data-discovery-selected="true"][aria-pressed="true"] > .discovery-selection-frame {
   37 |   opacity:1; border:3px solid #f0d58a; box-shadow:inset 0 0 12px #e4be6059, 0 0 20px #e4be6059;
   38 | }
   39 | body #overlay .card button[data-discovery-option][data-discovery-selected="true"][aria-pressed="true"] > .discovery-selection-mark { opacity:1; }
   40 | body #overlay .card button[data-discovery-option][data-discovery-selected="true"][aria-pressed="true"] > .hs-card {
   41 |   box-shadow:0 0 0 2px #f0d58a, 0 0 22px #e4be6066;
   42 | }
   43 | [data-discovery-busy="true"] .discovery-selection-actions { opacity:.7; }
```

## P07

战斗拾牌、跟手、归位和清理的 transform 所有权

原文件：`game/src/battle/view/battle.aim.js`；原行：521–552、587–627、691–708、875–901。

```text
--- game/src/battle/view/battle.aim.js:521 ---
  521 |     const originalTransform = returning ? returning.originalTransform : el.style.transform;
  522 |     const originalTransition = returning ? returning.originalTransition : el.style.transition;
  523 |     if (returning) returningCards.delete(el);
  524 |     aim = {
  525 |       uid, card: entry.card, side, el, kind: kind || 'card',
  526 |       fieldPlayable: isCard && (side === 'self' || isAreaEffect(entry.card) || isRandomEnemyEffect(entry.card)),
  527 |       pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY,
  528 |       playBlockedReason, reasonShown: false,
  529 |       ax: r.left + r.width / 2 - vr.left, ay: r.top - vr.top + 6,
  530 |       sx:e.clientX, sy:e.clientY, moved:isCard, hover:null, leftDown:true,
  531 |       snap, vr,   // pointermove 复用；战场重绘后会更新为新快照和 rect
  532 |       // 指向卡过出牌线进 target；无目标卡过线进 multi。
  533 |       follow: isCard, mode: 'drag',
  534 |       restCenter: { cx: r.left + r.width / 2, cy: r.top + r.height / 2, h: r.height },
  535 |       stage: el.closest('.battle-stage'),
  536 |       playY: isCard ? playZoneY(e.clientY) : -1,
  537 |       hasLeftCancel: false, hasEnteredPlay: false,
  538 |       originalTransform, originalTransition, originalInert:returning ? returning.originalInert : el.inert,
  539 |       targetMode:'release', motion:returning ? { ...returning.motion }
  540 |         : { x:r.left + r.width / 2, y:r.top + r.height / 2, scale:1 },
  541 |       reducedMotion: !!SDT.Motion?.reduceMotion?.(),
  542 |     };
  543 |     aim.targetSession = makeAimTargetSession(aim);
  544 |     if (isCard) {
  545 |       aim.baseRect = aimBaseRect(el);
  546 |       aim.slotLayout = aimSlotLayout(el);
  547 |       el.style.transition = 'none';
  548 |       el.inert = true;
  549 |       el.classList.add('aim-lift');
  550 |       paintCardPose(aim);
  551 |       SDT.Sound.sfx('cardSelect');
  552 |     }
--- game/src/battle/view/battle.aim.js:587 ---
  587 |   function cardLayoutBase(el) {
  588 |     const rect = (el.parentElement || el).getBoundingClientRect();
  589 |     const scale = uiScale();
  590 |     const width = el.offsetWidth || rect.width / scale || 260;
  591 |     const height = el.offsetHeight || 390;
  592 |     return { x:rect.left + ((el.offsetLeft || 0) + width / 2) * scale,
  593 |       y:rect.top + ((el.offsetTop || 0) + height / 2) * scale, width, height, scale };
  594 |   }
  595 |   function paintCardPose(a, base = cardLayoutBase(a.el)) {
  596 |     const pose = a.motion;
  597 |     const x = (pose.x - base.x) / base.scale;
  598 |     // CSS 以卡底为缩放原点；把 holder 中心坐标转换为同一布局坐标。
  599 |     const y = (pose.y - base.y) / base.scale + (pose.scale - 1) * base.height / 2;
  600 |     a.el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${pose.scale.toFixed(4)})`;
  601 |   }
  602 |   function advanceCardPose(a, target, delta, base = cardLayoutBase(a.el)) {
  603 |     // Exponential following composes over elapsed time: 30/60/144Hz reach the same pose.
  604 |     // Keep the established 60Hz response while preserving the latest pose on retarget.
  605 |     const elapsedFrames = Math.max(0, delta) * 60;
  606 |     const alpha = 1 - Math.pow(1 - 7 / 60, elapsedFrames);
  607 |     const scaleAlpha = 1 - Math.pow(1 - 8 / 60, elapsedFrames);
  608 |     a.motion.x += (target.x - a.motion.x) * alpha;
  609 |     a.motion.y += (target.y - a.motion.y) * alpha;
  610 |     a.motion.scale += (target.scale - a.motion.scale) * scaleAlpha;
  611 |     const scale = uiScale();
  612 |     const atPosition = ((target.x - a.motion.x) ** 2 + (target.y - a.motion.y) ** 2) / (scale * scale) < 1;
  613 |     const atScale = Math.abs(target.scale - a.motion.scale) < .002;
  614 |     if (atPosition) { a.motion.x = target.x; a.motion.y = target.y; }
  615 |     if (atScale) a.motion.scale = target.scale;
  616 |     paintCardPose(a, base);
  617 |     return atPosition && atScale;
  618 |   }
  619 |   function targetCardPose(a, base) {
  620 |     if (a.mode !== 'target' && a.mode !== 'clickTarget') return { x:a.lastX, y:a.lastY, scale:1 };
  621 |     const height = base.height * base.scale;
  622 |     return { x:a.vr.left + a.vr.width / 2, y:a.vr.top + a.vr.height - height * .75 / 2, scale:.75 };
  623 |   }
  624 |   function ensureMotionFrame() {
  625 |     if (!motionFrame) motionFrame = requestAnimationFrame(stepMotionFrame);
  626 |   }
  627 |   function stepMotionFrame(now) {
--- game/src/battle/view/battle.aim.js:691 ---
  691 |       aimArrowUpdate(from.x, from.y, tx, ty, AIM_COLOR[hit ? hit.kind : a.side], vr);
  692 |     }
  693 |   }
  694 |   function restoreCardPose(a, returnToHand) {
  695 |     if (!a.follow) return;
  696 |     const el = a.el;
  697 |     el.style.transition = 'none';
  698 |     el.style.transform = a.originalTransform;
  699 |     el.inert = a.originalInert;
  700 |     if (!returnToHand || !el.isConnected || !a.stage?.isConnected || UI.el.overlay.hidden
  701 |       || document.hidden || SDT.Motion?.reduceMotion?.()) {
  702 |       el.style.transition = a.originalTransition;
  703 |       return;
  704 |     }
  705 |     // 回归当前手牌的布局目标；不另开固定时长动画，位置/缩放共用 holder 插值时钟。
  706 |     const base = cardLayoutBase(el), target = el.getBoundingClientRect();
  707 |     a.rest = { x:(target.left + target.width / 2 - base.x) / base.scale,
  708 |       y:(target.top + target.height / 2 - base.y) / base.scale,
--- game/src/battle/view/battle.aim.js:875 ---
  875 |   function cancelAim() {
  876 |     const a = aim;
  877 |     aim = null;
  878 |     if (!a) return;
  879 |     aimPlayedAt = Date.now(); // 取消后吞掉本次按压可能产生的合成 click
  880 |     finishAim(a, true);
  881 |     clearThoughtBubble();
  882 |   }
  883 |   function onAimPointerCancel(e) { if (aim && e.pointerId === aim.pointerId) cancelAim(); }
  884 |   function onAimLostCapture(e) {
  885 |     if (aim && e.pointerId === aim.pointerId && (!aim.follow || aim.leftDown)) cancelAim();
  886 |   }
  887 |   function onAimVisibilityChange() {
  888 |     if (!document.hidden) return;
  889 |     // A background tab must not retain an invisible return tween or stale pointer capture.
  890 |     cancelAim();
  891 |     returningCards.forEach((record, el) => finishCardReturn(el, record));
  892 |     if (motionFrame) cancelAnimationFrame(motionFrame);
  893 |     motionFrame = 0; motionTime = 0;
  894 |   }
  895 |   function onAimKeydown(e) {
  896 |     const a = aim;
  897 |     if (a?.follow && (a.mode === 'target' || a.mode === 'clickTarget') && e.key === 'Enter'
  898 |       && !e.defaultPrevented && !e.isComposing && e.keyCode !== 229 && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey
  899 |       && !e.target?.closest?.('input, textarea, select, [contenteditable="true"], button, summary, .hsc-desc, [data-term], [data-ui-tip]')) {
  900 |       const hit = a.lastY < a.playY && aimHoverAt(a.lastX, a.lastY, a.targetSession);
  901 |       if (!hit) return;
```

## P08

静态命中区域与物理输入

原文件：`game/src/battle/view/battle.hand-hit.js`；原行：1–27、43–80。

```text
--- game/src/battle/view/battle.hand-hit.js:1 ---
    1 | /** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
    2 | // Shared hand policy: static rectangles in original paint order; no nearest-card snapping.
    3 | export function pickStaticHandRegion(regions, x, y) {
    4 |   for (let i = regions.length - 1; i >= 0; i--) {
    5 |     const r = regions[i];
    6 |     if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) return r.uid;
    7 |   }
    8 |   return null;
    9 | }
   10 | export function resolveHandHit({ regions, x, y, actualUid, interactive = false, ownerUid = null, accessBands = [] }) {
   11 |   if (interactive) return { uid: actualUid, route: 'control' };
   12 |   if (ownerUid != null && pickStaticHandRegion(accessBands, x, y) != null) return { uid: ownerUid, route: 'reading-access' };
   13 |   const uid = pickStaticHandRegion(regions, x, y);
   14 |   return uid == null ? { uid: actualUid, route: 'outside-reading' } : { uid, route: 'static-region' };
   15 | }
   16 | 
   17 | // Swept vertical bounds of real controls as the same card rises from rest to reading.
   18 | // Full card width joins its exposed strip to the control; the middle art remains selectable.
   19 | export function readingAccessBands({ uid, left, right, raisedTop, restDrop, cardTop, controls }) {
   20 |   return controls.filter(r => r.width > 0 && r.height > 0).map(r => ({ uid, left, right,
   21 |     top: raisedTop + (r.top - cardTop),
   22 |     bottom: raisedTop + (r.bottom - cardTop) + restDrop,
   23 |   }));
   24 | }
   25 | 
   26 | // One controller owns visual reading and physical card gestures. Commands remain
   27 | // with the existing view/aim callbacks; native controls never get rerouted.
--- game/src/battle/view/battle.hand-hit.js:43 ---
   43 |   function resolve(event, reading = true) {
   44 |     const cards = liveCards(), zoom = scale();
   45 |     const actual = cardOf(event.target);
   46 |     const actualUid = cards.includes(actual) ? actual.dataset.uid : null;
   47 |     const regions = cards.map(card => {
   48 |       const slot = card.closest('.bt-slot'), r = slot.getBoundingClientRect();
   49 |       const height = card.offsetHeight * zoom;
   50 |       const rest = (parseFloat(slot.style.getPropertyValue('--hand-rest')) || 0) * zoom;
   51 |       return { uid: card.dataset.uid, left: r.left, right: r.right,
   52 |         top: r.top + Math.min(rest, height), bottom: Math.max(r.top + rest + height, r.bottom) };
   53 |     });
   54 |     const owner = reading ? cards.find(card => card.dataset.uid === ownerUid) : null;
   55 |     let accessBands = [];
   56 |     if (owner) {
   57 |       const slot = owner.closest('.bt-slot'), r = slot.getBoundingClientRect();
   58 |       accessBands = readingAccessBands({ uid: ownerUid, left: r.left, right: r.right,
   59 |         raisedTop: r.top, restDrop: (parseFloat(slot.style.getPropertyValue('--hand-rest')) || 0) * zoom,
   60 |         cardTop: owner.getBoundingClientRect().top,
   61 |         controls: [.../** @type {NodeListOf<BattleElement>} */ (owner.querySelectorAll('.bt-infchip,.hsc-desc'))].map(el => el.getBoundingClientRect()) });
   62 |     }
   63 |     return resolveHandHit({ regions, x: event.clientX, y: event.clientY, actualUid,
   64 |       interactive: !!event.target?.closest?.(CONTROL), ownerUid: owner?.dataset.uid, accessBands });
   65 |   }
   66 |   function move(event) {
   67 |     if (event.pointerType === 'touch' || event.isPrimary === false || event.buttons || isAiming()) return;
   68 |     paint(resolve(event).uid);
   69 |   }
   70 |   function down(event) {
   71 |     if (event.button !== 0 || event.isPrimary === false || event.isComposing || event.defaultPrevented) return;
   72 |     if (isAiming() || existingAimPresses.has(event)) return;
   73 |     press = null;
   74 |     if (event.target?.closest?.(CONTROL)) return;
   75 |     const choice = resolve(event, event.pointerType !== 'touch');
   76 |     const card = liveCards().find(card => card.dataset.uid === choice.uid);
   77 |     if (!card) return;
   78 |     paint(choice.uid);
   79 |     press = { uid: choice.uid, pointerId: event.pointerId, aimed: false };
   80 |     onPointerDown(event, card);
```

## P09

状态生成、分组重写、角色名牌与敌方扩展标记

原文件：`game/src/battle/view/battle.layers.js`；原行：115–135、727–750、789–818、990–1005。

```text
--- game/src/battle/view/battle.layers.js:115 ---
  115 |   // compact（敌方名牌收纳，迭代评审 09-20）：总数>4 时退化为「图标+层数」——纯图标会丢层数（美术岗复核口径）；
  116 |   // 玩家名牌不传 compact，维持原样。09-20 老板：词条触摸讲解——data-term 交 term-tips.js 弹自绘讲解框
  117 |   // （系统 title 已被 game.boot 全局移除，触屏也无效），讲解框自带全名+全文，compact 不再需要分叉文案
  118 |   function statusChips(status, opts) {
  119 |     const compactAll = !!(opts && opts.compact);
  120 |     const activeBuffs = Combat.BUFFS.filter(k => (status[k] || 0) > 0);
  121 |     const activeCurses = Combat.CURSES.filter(k => (status[k] || 0) > 0);
  122 |     const compact = compactAll && (activeBuffs.length + activeCurses.length) > 4;
  123 |     const buffs = activeBuffs.map(k => {
  124 |       const m = Combat.BUFF_META[k];
  125 |       const v = m.timed ? ` ${status[k]}回合` : (m.flag ? '' : ` ${status[k]}`);
  126 |       const label = compact ? `${status[k]}${m.timed ? '回合' : ''}` : `${m.name}${v}`;
  127 |       return `<span class="bt-buff b-${k}" data-term="${k}">${m.icon} ${label}</span>`;
  128 |     });
  129 |     const curses = activeCurses.map(k => {
  130 |       const m = Combat.CURSE_META[k];
  131 |       const txt = m.stack ? `${m.name} ${status[k]}` : `${m.name} ${status[k]}回合`;
  132 |       const label = compact ? (m.stack ? `${status[k]}` : `${status[k]}回合`) : txt;
  133 |       return `<span class="bt-curse c-${k}" data-term="${k}">${m.icon} ${label}</span>`;
  134 |     });
  135 |     return buffs.concat(curses).join(' ');
--- game/src/battle/view/battle.layers.js:727 ---
  727 |     parts.chips.className = 'sts-chips';
  728 |     np.appendChild(parts.head); np.appendChild(parts.stats); np.appendChild(parts.chips);
  729 |     if (opts.equips) {
  730 |       parts.equips = document.createElement('div');
  731 |       parts.equips.className = 'sts-equips';
  732 |       parts.equips.style.display = 'none';
  733 |       parts.vitals.appendChild(parts.equips);
  734 |     }
  735 |     // 姓名、属性、状态与意图仍同组；生命条独立放在立绘之后，由布局锚定脚下。
  736 |     // The intent retains its own input handlers and never confirms a target.
  737 |     if (parts.intent) slot.appendChild(parts.intent);
  738 |     // The player's HP, equipment and statuses share a flow container; growing
  739 |     // icon rows reserve their own space instead of covering the status text.
  740 |     if (opts.equips) parts.vitals.appendChild(np);
  741 |     else slot.appendChild(np);
  742 |     return parts;
  743 |   }
  744 |   // 差分工具：html 变了才重写 innerHTML
  745 |   function setSection(el, sig, key, html) {
  746 |     if (sig[key] === html) return;
  747 |     sig[key] = html;
  748 |     el.innerHTML = SDT.Icons.rich(html);
  749 |   }
  750 |   // Compare live DOM values so retained or externally changed nodes stay authoritative.
--- game/src/battle/view/battle.layers.js:789 ---
  789 |   function updateSelfUnit(snapshot, ctx) {
  790 |     const { player, pdef, pstat, equipped } = snapshot;
  791 |     const sig = selfSig;
  792 |     setSection(selfParts.fig, sig, 'fig',
  793 |       player.myClass && SDT.Art.has(player.myClass) ? (SDT.Art.battleArt ? SDT.Art.battleArt(player.myClass) : SDT.Art.classArt(player.myClass)) : SDT.Icons.img('helmet'));
  794 |     const playerName = characterName(player.characterId || player.myClass);
  795 |     setUnitAttribute(selfParts.fig, 'role', 'img');
  796 |     setUnitAttribute(selfParts.fig, 'aria-label', playerName);
  797 |     setUnitHP(selfParts, sig, player.hp, player.maxHp, !sig.init);
  798 |     if (selfParts.armor.hidden !== !(pdef.armor > 0)) selfParts.armor.hidden = !(pdef.armor > 0);
  799 |     const armorText = `甲 ${pdef.armor || 0}`;
  800 |     if (selfParts.armor.textContent !== armorText) selfParts.armor.textContent = armorText;
  801 |     setUnitAttribute(selfParts.armor, 'aria-label', `护甲 ${pdef.armor || 0}`);
  802 |     // 常驻显示合计，强化来源可聚焦查看；护甲已在生命栏旁显示。
  803 |     setSection(selfParts.stats, sig, 'stats', playerCombatStatsHTML(player, pdef, pstat.status));
  804 |     setSection(selfParts.chips, sig, 'chips', curseChips(pstat.status) + (snapshot.playerEffects || []).map(effect =>
  805 |       `<span class="bt-buff" tabindex="0" data-player-effect="${escAttr(effect.key)}" data-term="${escAttr(effect.key)}" data-ui-tip data-ui-tip-title="${escAttr(effect.name)}" data-ui-tip-text="${escAttr(effect.description)}" data-ui-tip-note="${escAttr(effect.duration)}">[[icon:${escAttr(effect.icon)}]] ${esc(effect.name)} ${esc(effect.duration)}</span>`).join(' '));
  806 |     // 状态挂件（P2）：玩家自己被冰冻时同样点亮常驻状态光
  807 |     selfUnit.classList.toggle('fx-frozen', (pstat.status.freeze || 0) > 0);
  808 |     const pendingCard = ctx.pendingTarget && findCard(ctx.pendingTarget.uid);
  809 |     const clickCard = clickSelectedUid != null && findCard(clickSelectedUid);
  810 |     setTargetable(selfUnit, !!((pendingCard && targetSide(pendingCard.card) === 'self') || (clickCard && targetSide(clickCard.card) === 'self')), `${playerName}，自己，按 Enter 确认目标`);
  811 |     if (!selfUnit.classList.contains('can-target')) selfUnit.setAttribute('aria-label', `${playerName}，自己`);
  812 |     // 已穿戴装备（2026-09-09 老板 #9）：名称 + 说明 tooltip；带限定技能的可点击发动
  813 |     const equipsHTML = (equipped || []).map(e => equipmentInfoHTML(e, snapshot.busy, snapshot)).join('');
  814 |     setSection(selfParts.equips, sig, 'equips', equipsHTML);
  815 |     const equipsDisplay = equipsHTML ? '' : 'none';
  816 |     if (selfParts.equips.style.display !== equipsDisplay) selfParts.equips.style.display = equipsDisplay;
  817 |     sig.init = true;
  818 |   }
--- game/src/battle/view/battle.layers.js:990 ---
  990 |       setUnitAttribute(parts.fig, 'aria-label', f.name);
  991 |       // 姓名保留在可访问身份中；上方呈现攻击、意图和状态，生命条仍在脚下。
  992 |       setUnitHP(parts, sig, f.hp, f.maxHp, reattached || !sig.init);
  993 |       const simpleAttack = intents.length === 1 && intents[0].label === '攻击'
  994 |         && intents[0].damage === Math.max(0, f.atk || 0) && intents[0].hits === 1 && !intents[0].bleedBonus;
  995 |       const attackStat = simpleAttack ? '' : `<span class="sts-stat">[[icon:swords]] 攻 ${f.atk}${f.affix === 'frenzy' ? '×2' : ''}</span>`;
  996 |       setSection(parts.stats, sig, 'stats', `${attackStat}${immune ? '<span class="sts-stat">[[icon:crystal]] 庇幕免伤中</span>' : ''}`);
  997 |       // 反馈1021·10：状态诅咒/祝福与词缀之外，标记类负面状态此前一个角标都不出——
  998 |       // 腐化之种（deathBurst）与灵魂契约（damageEcho / soulContractMarked）在运行时被
  999 |       // 明确当作「已标记」参与结算，视图却只认 rotSeedMarked，敌人身上看不出挂了什么。
 1000 |       const echoMark = f.damageEcho || (f.soulContractMarked ? { amount: 2 } : null);
 1001 |       setSection(parts.chips, sig, 'chips', (aff ? `<span class="bt-affix" data-term="${f.affix}">${aff.icon} ${aff.name}</span>` : '')
 1002 |         + (f.rotSeedMarked || f.deathBurst ? '<span class="bt-affix" title="死亡时，对所有敌人造成等同于此时中毒层数的真实伤害">[[icon:skull]] 腐化标记</span>' : '')
 1003 |         + (echoMark ? `<span class="bt-affix">[[icon:sparkles]] 契约回响 ${+echoMark.amount || 2}</span>` : '')
 1004 |         + curseChips(f.status, { compact: true }));
 1005 |       sig.init = true;
```

## P10

血条/意图/状态布局与战斗卡片阅读/已选样式

原文件：`game/css/battle-stage.css`；原行：55–85、126–145、184–191。

```text
--- game/css/battle-stage.css:55 ---
   55 | #overlay .battle-stage.sts .sts-headrow>b{min-width:0;max-width:100%;font-weight:600;overflow-wrap:anywhere}
   56 | #overlay .battle-stage.sts .sts-you,#overlay .battle-stage.sts .bt-affix{font-size:18px;color:#c0d4de;padding:0;border:0;background:none}
   57 | #overlay .battle-stage.sts .sts-atkbadge{display:block;margin:0 0 5px;font-size:20px;color:#c5d7e0}
   58 | #overlay .battle-stage.sts .sts-hp{position:relative;height:26px;min-height:0;width:100%;box-sizing:border-box;overflow:hidden;border:1px solid #e8eeed40;border-radius:3px;background:#10202b52}
   59 | #overlay .battle-stage.sts .sts-hp>i{position:absolute;inset:0 auto 0 0;display:block;height:100%;transform-origin:left}
   60 | #overlay .battle-stage.sts .sts-hp-main{background:#a14f4c;transition:width .22s}
   61 | #overlay .battle-stage.sts .sts-me .sts-hp-main,#overlay .battle-stage.sts .sts-ally .sts-hp-main{background:#4a7282}
   62 | #overlay .battle-stage.sts .sts-hp-ghost{background:#dfbe80;transition:width .45s .15s}
   63 | #overlay .battle-stage.sts .sts-hp>span{position:absolute;inset:0;text-align:center;font-size:22px;font-weight:650;line-height:24px;color:#fff;text-shadow:0 1px 2px #07121c,0 0 4px #07121c}
   64 | #overlay .battle-stage.sts .sts-unit-vitals{position:absolute;left:50%;top:calc(100% + 10px);translate:-50% 0;width:230px;height:36px;min-height:0;max-width:100%;padding:4px;background:var(--battle-glass);border:1px solid var(--battle-line);border-radius:6px;z-index:5;pointer-events:none;box-sizing:border-box}
   65 | #overlay .battle-stage.sts .sts-unit-vitals[hidden]{display:none}
   66 | #overlay .battle-stage.sts .sts-me>.sts-unit-vitals{width:264px;max-width:none}
   67 | #overlay .battle-stage.sts .sts-ally>.sts-unit-vitals{width:180px}
   68 | #overlay .battle-stage.sts .sts-stats{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:4px 10px;margin-top:0;font-size:22px;color:#eef2ef;line-height:1.3}
   69 | #overlay .battle-stage.sts .sts-stats>.sts-stat{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-size:20px}
   70 | #overlay .battle-stage.sts .sts-stat>span{font-size:18px;color:#bfd2dc}
   71 | #overlay .battle-stage.sts .sts-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;font-size:18px}
   72 | #overlay .battle-stage.sts .sts-equips{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;font-size:18px}
   73 | #overlay .battle-stage.sts .sts-equip{background:#192e3bbd;color:#d1dce3;padding:3px 6px;border:1px solid #a4bdca30;cursor:help}
   74 | #overlay .battle-stage.sts .sts-intent{position:absolute;bottom:calc(100% + 20px);left:50%;translate:-50% 0;display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;width:auto;max-width:none;padding:8px 12px;margin:0;border:1px solid #a7c1cb66;border-radius:0;background:var(--battle-glass);backdrop-filter:blur(14px);color:#ffc3ac;box-shadow:none;font-size:24px;font-weight:600;line-height:1.35;cursor:help;z-index:11}
   75 | #overlay .battle-stage.sts .sts-nameplate:has(>.sts-stats:empty):has(>.sts-chips:empty)>.sts-intent{padding:0;margin:0;border-top:0}
   76 | #overlay .battle-stage.sts .bt-intent-part{display:inline-grid;grid-template-columns:26px minmax(0,1fr);align-items:center;gap:3px 7px;max-width:100%;white-space:normal}
   77 | #overlay .battle-stage.sts .bt-intent-short{display:contents}
   78 | #overlay .battle-stage.sts .bt-intent-action{grid-column:2;white-space:nowrap}
   79 | #overlay .battle-stage.sts .bt-intent-part+.bt-intent-part{margin-left:0}
   80 | #overlay .battle-stage.sts .bt-intent-detail{display:none;position:absolute;top:calc(100% + 10px);left:-12px;right:-12px;max-height:240px;overflow:auto;box-sizing:border-box;padding:12px;border:1px solid var(--battle-line);border-radius:4px;background:#142733fa;color:#d9e5eb;box-shadow:0 8px 20px #08152152;font-size:20px;font-weight:400;line-height:1.45;white-space:normal}
   81 | #overlay .battle-stage.sts .sts-intent:is(:hover,:focus-visible,.is-open) .bt-intent-detail{display:block}
   82 | #overlay .battle-stage.sts .sts-intent:is(:hover,:focus-visible,.is-open){color:#ffdbc9}
   83 | #overlay .battle-stage.sts .sts-intent .ic{flex:none;width:26px;height:26px}
   84 | #overlay .battle-stage.sts .can-target:not(.dead){cursor:crosshair}
   85 | #overlay .battle-stage.sts .drag-over:not(.dead){outline:none}
--- game/css/battle-stage.css:126 ---
  126 | #overlay .battle-stage.sts .bt-card:not(.aim-lift){transform:translateY(var(--hand-rest,64px))}
  127 | #overlay .battle-stage.sts .bt-card>.hs-card{width:100%;height:auto;min-height:0;margin:0;transform:none}
  128 | #overlay .battle-stage.sts .bt-slot:has(.aim-lift)::after{pointer-events:none}
  129 | #overlay .battle-stage.sts .sts-nameplate :is(.sts-stats,.sts-chips):empty{display:none}
  130 | #overlay .battle-stage.sts :where(.sts-hand:not([data-hand-hit="fixed"])) .bt-slot:hover,#overlay .battle-stage.sts .bt-slot:is(.hand-reading,:has(:focus-visible)){z-index:90}
  131 | #overlay .battle-stage.sts :where(.sts-hand:not([data-hand-hit="fixed"])) .bt-slot:hover .bt-card:not(.aim-lift),#overlay .battle-stage.sts .bt-slot:is(.hand-reading,:has(:focus-visible)) .bt-card:not(.aim-lift){transform:translateY(-30px);filter:drop-shadow(0 12px 20px #09162566)}
  132 | #overlay .battle-stage.sts .bt-slot:has(.aim-lift){z-index:100}
  133 | #overlay .battle-stage.sts .bt-card.aim-lift{transition:none}
  134 | #overlay .battle-stage.sts .sts-hand .bt-card.aim-lift,#overlay .battle-stage.sts .sts-hand .bt-card.aim-lift *{pointer-events:none}
  135 | #overlay .battle-stage.sts .bt-card.click-selected,#overlay .battle-stage.sts .bt-card.sel{outline:2px solid #c8e8f0;outline-offset:3px}
  136 | #overlay .battle-stage.sts .bt-card[data-hand-state="blocked"]{opacity:.72}
  137 | #overlay .battle-stage.sts :where(.sts-hand:not([data-hand-hit="fixed"])) .bt-slot:hover .bt-card[data-hand-state="blocked"],#overlay .battle-stage.sts .bt-slot:is(.hand-reading,:has(:focus-visible)) .bt-card[data-hand-state="blocked"]{opacity:.96}
  138 | #overlay .battle-stage.sts .bt-card::before,#overlay .battle-stage.sts .bt-card.click-selected::after{content:none}
  139 | #overlay .battle-stage.sts .bt-count{position:absolute;left:48px;right:auto;top:12px;z-index:12;min-width:24px;padding:2px 5px;background:#162b39eb;border:1px solid #b8cdd54d;border-radius:3px;color:#f3dfb4;font-size:14px}
  140 | #overlay .battle-stage.sts .bt-infchip{position:absolute;right:8px;z-index:15;min-height:40px;padding:5px 8px;border:1px solid #b7cbd36b;border-radius:3px;background:#19303ef5;color:#e2edf1;font-size:20px;line-height:1.3;cursor:pointer}
  141 | #overlay .battle-stage.sts .bt-infchip{top:56px;bottom:auto}
  142 | #overlay .battle-stage.sts .sts-hp .sts-hp-armor{position:absolute;left:0;top:0;bottom:0;z-index:4;display:grid;place-items:center;min-width:44px;box-sizing:border-box;padding:0 6px;border:0;border-right:1px solid #b7c6d4;border-radius:0;background:#354752;color:#fff;font:700 18px/1 var(--font-ui);text-align:center;white-space:nowrap}
  143 | #overlay .battle-stage.sts .sts-hp .sts-hp-armor[hidden]{display:none}
  144 | #overlay .battle-stage.sts .sts-hand>.ov-empty{position:absolute;top:300px;left:0;right:0;color:#c5d9e2;text-align:center;font-size:22px}
  145 | #overlay .battle-stage.sts[data-phase="enemy"] .sts-hand{opacity:.3;translate:0 90px;pointer-events:none}
--- game/css/battle-stage.css:184 ---
  184 | 
  185 | #overlay .battle-stage.sts .bt-slot:has(.click-selected){z-index:95}
  186 | #overlay .battle-stage.sts .bt-card.click-selected:not(.aim-lift){transform:translateY(0)}
  187 | #overlay .battle-stage.sts[data-phase="enemy"] .bt-turn-forecast{visibility:hidden}
  188 | 
  189 | /* Blur is limited to fixed controls; dragged cards and the painted world stay sharp. */
  190 | #overlay .battle-stage.sts :is(.sts-encounter,.sts-options>summary,.sts-tactics,.bt-pile,.bt-slam-btn,.sts-unit-vitals){backdrop-filter:blur(14px) saturate(115%);box-shadow:var(--battle-glass-shadow)}
  191 | /* The left resource column is unframed; local scope leaves the right-side controls intact. */
```

## P11

全局卡面边界与临时/变形光效

原文件：`game/css/card-layout-selected.css`；原行：1–16、169–189。

```text
--- game/css/card-layout-selected.css:1 ---
    1 | /* Shared card face. Hosts own width, placement, selection and drag behaviour only. */
    2 | /* Painted frame artwork is the card edge. Hosts must never add a rectangular rim,
    3 |    including hover, focus, selection and acquisition states. Keep border space so
    4 |    removing its paint does not change the card's placement or hit target. */
    5 | body :is(.hs-card,.bt-card,.bag-tile.card-face,.reward-card,.sac-card,.dep-card,
    6 |   .battle-pile-card,.entry-card-preview,.infusion-card-face,.card-tile,
    7 |   .lib-cardwrap:not(.studio-photo),.reward-acquisition-arrival,
    8 |   :has(> .hs-card[data-card-layout="split"])) {
    9 |   outline:none!important; border-color:transparent!important; box-shadow:none!important;
   10 | }
   11 | body :is(.hs-card,.bt-card,.bag-tile.card-face,.reward-card,.sac-card,.dep-card,
   12 |   .battle-pile-card,.entry-card-preview,.infusion-card-face,.card-tile,
   13 |   .lib-cardwrap:not(.studio-photo),:has(> .hs-card[data-card-layout="split"])):focus-visible {
   14 |   filter:brightness(1.08);
   15 | }
   16 | @font-face {
--- game/css/card-layout-selected.css:169 ---
  169 | .hs-card .hsc-state-aura {
  170 |   position: absolute; inset: -2%; z-index: 0; pointer-events: none;
  171 |   background: radial-gradient(ellipse at center, transparent 58%, var(--card-state-glow) 76%, transparent 87%);
  172 |   opacity: .65; filter: blur(5px); animation: card-state-breathe 3s ease-in-out infinite alternate;
  173 | }
  174 | .hs-card.is-temporary { --card-state-glow: #62d7e9; }
  175 | .hs-card.is-transforming { --card-state-glow: #bd8bfa; }
  176 | .hs-card.is-temporary.is-transforming .hsc-state-aura {
  177 |   background: radial-gradient(ellipse at 30% 50%, transparent 58%, #62d7e9 76%, transparent 87%),
  178 |     radial-gradient(ellipse at 70% 50%, transparent 58%, #bd8bfa 76%, transparent 87%);
  179 | }
  180 | .hs-card.is-temporary .hsc-frame { filter: drop-shadow(0 0 4px #62d7e9aa); }
  181 | .hs-card.is-transforming .hsc-frame { filter: drop-shadow(0 0 5px #bd8bfaaa); }
  182 | .hs-card.is-temporary.is-transforming .hsc-frame { filter: drop-shadow(-2px 0 4px #62d7e9aa) drop-shadow(2px 0 4px #bd8bfaaa); }
  183 | .hs-card .hsc-state-label {
  184 |   position: absolute; z-index: 10; top: 15%; right: 9%; max-width: 72%;
  185 |   padding: .2em .45em; border-radius: .25em; background: #18212feb;
  186 |   color: #f2edff; font-size: .62em; line-height: 1.3; pointer-events: auto;
  187 | }
  188 | @keyframes card-state-breathe { from { opacity: .35; } to { opacity: .8; } }
  189 | @media (prefers-reduced-motion: reduce) { .hs-card .hsc-state-aura { animation: none; } }
```

## P12

词条事件捕获与当前显示时机

原文件：`game/src/ui/term-tips.js`；原行：99–192。

```text
--- game/src/ui/term-tips.js:99 ---
   99 | /** 自事件目标向上找最近的带 data-term 的词条元素。
  100 |  * @param {EventTarget|null} t
  101 |  * @returns {Element|null}
  102 |  */
  103 | function closestTerm(t) {
  104 |   if (!(t instanceof Element) || !allowsTermTip(t)) return null;
  105 |   return t.closest('[data-term]');
  106 | }
  107 | 
  108 | /** @param {EventTarget|null} t @returns {Element|null} */
  109 | function closestTrigger(t) {
  110 |   if (!(t instanceof Element) || !allowsTermTip(t)) return null;
  111 |   return t.closest('[data-term], [data-ui-tip]');
  112 | }
  113 | 
  114 | /** document 级事件委托接管全部词条触发（悬停即显/按压即显/点击只讲解/滚动收起）。 */
  115 | function initTermTips() {
  116 |   document.addEventListener('pointerover', (e) => {
  117 |     if (hoverExitTimer !== null && !closestTrigger(e.target) && !isTip(e.target)) return;
  118 |     cancelHoverExit();
  119 |     if (isTip(e.target)) return;
  120 |     hoverEl = closestTrigger(e.target); syncTrigger();
  121 |   });
  122 |   document.addEventListener('pointerout', (e) => {
  123 |     if (isTip(e.target)) {
  124 |       if (isTip(e.relatedTarget)) return;
  125 |       hoverEl = closestTrigger(e.relatedTarget); syncTrigger();
  126 |       return;
  127 |     }
  128 |     if (closestTrigger(e.target) === closestTrigger(e.relatedTarget)) return;
  129 |     if (isTip(e.relatedTarget)) return;
  130 |     // Keep an already-painted panel open across its small anchor gap. A new
  131 |     // trigger cancels this timer and replaces the old content immediately.
  132 |     if (renderer && hoverEl && !closestTrigger(e.relatedTarget)) {
  133 |       cancelHoverExit();
  134 |       hoverExitTimer = window.setTimeout(() => {
  135 |         hoverExitTimer = null; hoverEl = null; syncTrigger();
  136 |       }, 120);
  137 |       return;
  138 |     }
  139 |     hoverEl = closestTrigger(e.relatedTarget); syncTrigger();
  140 |   });
  141 |   document.addEventListener('focusin', (e) => {
  142 |     focusEl = closestTrigger(e.target); syncTrigger();
  143 |   });
  144 |   document.addEventListener('focusout', (e) => {
  145 |     focusEl = closestTrigger(e.relatedTarget); syncTrigger();
  146 |   });
  147 |   document.addEventListener('keydown', (e) => {
  148 |     if (e.isComposing) return;
  149 |     if (e.key === 'Escape') hide();
  150 |     // Keep activation out of parent card handlers even before the chunk arrives.
  151 |     if ((e.key === 'Enter' || e.key === ' ') && closestTerm(e.target)) {
  152 |       e.preventDefault(); e.stopPropagation();
  153 |     }
  154 |   }, true);
  155 |   // 动作说明的鼠标悬停不随松键清除；触屏和原词条沿用按下显示、松手收起。
  156 |   document.addEventListener('pointerdown', (e) => {
  157 |     const t = closestTrigger(e.target);
  158 |     if (!t) return;
  159 |     if (e.button !== 0 && e.pointerType === 'mouse') return;
  160 |     show(t);
  161 |     pressedPointer = e.pointerType === 'mouse' && t.hasAttribute('data-ui-tip') ? null : e.pointerId;
  162 |   });
  163 |   /** @param {PointerEvent} e */
  164 |   const end = e => { if (pressedPointer !== null && e.pointerId === pressedPointer) hide(); };
  165 |   document.addEventListener('pointerup', end);
  166 |   document.addEventListener('pointercancel', end);
  167 |   // A cold touch that has moved away must not open a delayed tooltip. The
  168 |   // already-visible reading gesture retains its original release lifecycle.
  169 |   document.addEventListener('pointermove', e => {
  170 |     if (renderer || pressedPointer === null || pressedPointer !== e.pointerId) return;
  171 |     // Touch implicit capture keeps e.target on the original word after moving away.
  172 |     const hit = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(e.clientX, e.clientY) : e.target;
  173 |     if (closestTrigger(hit) !== curEl) hide();
  174 |   });
  175 |   // 点在词条上只讲解：捕获层拦掉 click，不触发卡面特写/出牌/按钮
  176 |   document.addEventListener('click', (e) => {
  177 |     if (!closestTerm(e.target)) return;
  178 |     e.preventDefault();
  179 |     e.stopPropagation();
  180 |   }, true);
  181 |   // 其他容器滚动即收；浮框自身滚动用于阅读长说明。
  182 |   window.addEventListener('scroll', e => { if (!isTip(e.target)) hide(); }, true);
  183 |   window.addEventListener('resize', () => { renderer?.resize(); });
  184 |   document.addEventListener('sdt-overlay-mode', hide);
  185 |   document.addEventListener('sdt-overlay-close', hide);
  186 |   document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  187 |   window.addEventListener('blur', hide);
  188 | }
  189 | 
  190 | // main.js 为 ESM defer 链，模块执行时 DOM 已解析，直接挂
  191 | initTermTips();
  192 | 
```

## P13

现有说明浮层、定位、跟随与生命周期

原文件：`game/src/ui/term-tips.runtime.js`；原行：80–152。

```text
--- game/src/ui/term-tips.runtime.js:80 ---
   80 | function renderContent(tip, meta) {
   81 |   const key = JSON.stringify(meta);
   82 |   if (key === contentKey) return;
   83 |   contentKey = key;
   84 |   tip.replaceChildren();
   85 |   tip.classList.toggle('is-action-tip', !!meta.dynamic);
   86 |   const icon = meta.icon && SDT.Icons && /** @type {{img?: (name: string) => string}} */ (SDT.Icons).img ? /** @type {{img: (name: string) => string}} */ (SDT.Icons).img(meta.icon) : '';
   87 |   if (icon) tip.insertAdjacentHTML('beforeend', icon);
   88 |   const title = document.createElement('b'); title.textContent = meta.name; tip.appendChild(title);
   89 |   if (meta.dynamic) {
   90 |     const text = document.createElement('span'); text.className = 'term-tip-text'; text.textContent = meta.text; tip.appendChild(text);
   91 |     if (meta.note) { const note = document.createElement('small'); note.textContent = meta.note; tip.appendChild(note); }
   92 |   } else {
   93 |     const separator = document.createElement('span'); separator.className = 'term-tip-sep'; separator.textContent = '——';
   94 |     tip.append(separator, document.createTextNode(meta.text));
   95 |   }
   96 | }
   97 | 
   98 | /** Body-mounted fixed positioning escapes transformed/clipped battle descendants.
   99 |  * @param {Element} el @param {HTMLDivElement} tip
  100 |  */
  101 | function positionTip(el, tip) {
  102 |   const sc = scale() || 1;
  103 |   const vw = Math.min(BASE_W, window.innerWidth / sc), vh = Math.min(BASE_H, window.innerHeight / sc);
  104 |   const inset = 8;
  105 |   tip.style.setProperty('--term-tip-max-width', `${Math.max(1, vw - inset * 2)}px`);
  106 |   tip.style.setProperty('--term-tip-max-height', `${Math.max(1, vh - inset * 2)}px`);
  107 |   const r = el.getBoundingClientRect();
  108 |   const x = r.left / sc, y = r.top / sc, w = r.width / sc, h = r.height / sc;
  109 |   const tw = tip.offsetWidth, th = tip.offsetHeight;
  110 |   /** @param {number} value @param {number} size @param {number} bound */
  111 |   const clamp = (value, size, bound) => Math.min(Math.max(value, inset), Math.max(inset, bound - size - inset));
  112 |   const left = clamp(x + w / 2 - tw / 2, tw, vw);
  113 |   const above = y - inset, below = vh - y - h - inset;
  114 |   const top = clamp(above >= th || above >= below ? y - th - inset : y + h + inset, th, vh);
  115 |   tip.style.left = `${Math.round(left)}px`;
  116 |   tip.style.top = `${Math.round(top)}px`;
  117 | }
  118 | 
  119 | /** Active only while a tooltip is visible: follow animation transforms and live action state. */
  120 | function followAnchor() {
  121 |   followFrame = null;
  122 |   if (!curEl || !tipEl || tipEl.hidden) return;
  123 |   const meta = isLive(curEl) && metaFor(curEl);
  124 |   if (!meta) { onHide(); return; }
  125 |   renderContent(tipEl, meta); positionTip(curEl, tipEl);
  126 |   if (typeof window.requestAnimationFrame === 'function') followFrame = window.requestAnimationFrame(followAnchor);
  127 | }
  128 | 
  129 | // Observe only during display. Removed/replaced anchors disappear at the mutation boundary.
  130 | const anchorObserver = new MutationObserver(() => { if (curEl && !isLive(curEl)) onHide(); });
  131 | 
  132 | /** @param {Element} el */
  133 | function show(el) {
  134 |   const meta = isLive(el) && metaFor(el);
  135 |   if (!meta) { onHide(); return; }
  136 |   const tip = ensureTip();
  137 |   // Overlay background isolation may have marked this passive body sibling inert.
  138 |   tip.removeAttribute('inert');
  139 |   curEl = el; renderContent(tip, meta); linkDescription(el);
  140 |   tip.hidden = false; positionTip(el, tip);
  141 |   anchorObserver.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden', 'inert', 'aria-hidden'] });
  142 |   if (followFrame === null && typeof window.requestAnimationFrame === 'function') followFrame = window.requestAnimationFrame(followAnchor);
  143 | }
  144 | 
  145 | 
  146 | function hide() {
  147 |   curEl = null;
  148 |   if (followFrame !== null) window.cancelAnimationFrame(followFrame);
  149 |   followFrame = null; anchorObserver.disconnect(); unlinkDescription();
  150 |   if (tipEl) tipEl.hidden = true;
  151 | }
  152 | function resize() { if (curEl && tipEl && !tipEl.hidden) positionTip(curEl, tipEl); }
```

## P14

卡面规则与词条浮层的互斥边界

原文件：`game/src/ui/term-tip-policy.js`；原行：1–8。

```text
--- game/src/ui/term-tip-policy.js:1 ---
    1 | // Card rules are read directly on the card or its detail page. Status and action
    2 | // controls outside those reading surfaces may still expose their own help.
    3 | export function allowsTermTip(element) {
    4 |   return element instanceof Element && !element.closest(
    5 |     '.hs-card, .card-rules-copy, .cz-photo-info, .pv-desc, .d-term',
    6 |   );
    7 | }
    8 | 
```

## P15

牌堆只读展示与不泄露隐藏顺序的分组

原文件：`game/src/battle/view/battle.pile-view.js`；原行：10–49。

```text
--- game/src/battle/view/battle.pile-view.js:10 ---
   10 | function pileCardKey(card) {
   11 |   return JSON.stringify(card, (_key, value) => {
   12 |     if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
   13 |     return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
   14 |   });
   15 | }
   16 | 
   17 | /** @param {readonly PileEntry[]} cards @returns {PileStack[]} */
   18 | export function buildPileStacks(cards) {
   19 |   /** @type {Map<string, PileStack>} */
   20 |   const grouped = new Map();
   21 |   for (const entry of cards) {
   22 |     const key = pileCardKey(entry.card);
   23 |     let stack = grouped.get(key);
   24 |     if (!stack) {
   25 |       stack = { key, card:entry.card, count:0, uids:[] };
   26 |       grouped.set(key, stack);
   27 |     }
   28 |     stack.count++;
   29 |     stack.uids.push(entry.uid);
   30 |   }
   31 |   // This copied display list never follows or mutates the hidden draw order.
   32 |   return [...grouped.values()].sort((a, b) =>
   33 |     (a.card.name || '').localeCompare(b.card.name || '', 'zh-CN') ||
   34 |     (a.card.type || '').localeCompare(b.card.type || '', 'zh-CN') ||
   35 |     (a.card.cost ?? 0) - (b.card.cost ?? 0) ||
   36 |     (a.card.id || '').localeCompare(b.card.id || '') || a.key.localeCompare(b.key));
   37 | }
   38 | 
   39 | /**
   40 |  * @param {{ cards: readonly PileEntry[], cardHTML: (card: PileCard, size: string) => string,
   41 |  * kind: string, isBoss?: boolean }} options
   42 |  */
   43 | export function battlePileBodyHTML({ cards, cardHTML, kind }) {
   44 |   const stacks = buildPileStacks(cards);
   45 |   const grave = kind === 'grave';
   46 |   const list = stacks.map((stack, i) => `<button type="button" class="battle-pile-card" data-act="btDecisionInspect" data-i="${i}" aria-label="查看 ${escAttr(stack.card.name || '卡牌')}，${stack.count} 张">${cardHTML(stack.card, 'lg')}${stack.count > 1 ? `<span class="battle-pile-count">×${stack.count}</span>` : ''}</button>`).join('');
   47 |   return { stacks, html:`<section data-decision-content="pile" data-battle-pile-view data-pile-total="${cards.length}">
   48 |     ${stacks.length ? `<div class="battle-pile-grid">${list}</div>` : `<div class="battle-pile-empty"><b>${grave ? '消耗牌堆为空' : '牌库已空'}</b></div>`}
   49 |     </section><div class="ov-btns"><button type="button" class="ov-btn ok battle-pile-back" data-act="${grave ? 'btGraveBack' : 'btDeckBack'}">返回战斗</button></div>` };
```

## P16

牌库卡宽、滚动、阅读和固定返回区

原文件：`game/css/battle-pile-view.css`；原行：43–78、89–89。

```text
--- game/css/battle-pile-view.css:43 ---
   43 |   justify-content:center; justify-items:center; align-items:start; align-content:start;
   44 |   width:100%; min-width:0; min-height:0; gap:36px 40px; box-sizing:border-box;
   45 |   margin:0; padding:14px 16px 24px; overflow-x:hidden; overflow-y:auto;
   46 |   overscroll-behavior:contain; scroll-padding-block:14px; scrollbar-width:thin;
   47 |   scrollbar-color:#afc5cf6b transparent;
   48 | }
   49 | body #overlay .battle-decision.battle-decision-unified[data-decision-kind="pile"] [data-battle-pile-view] .battle-pile-card {
   50 |   position:relative; display:block; width:280px!important; max-width:none!important; min-width:0;
   51 |   height:auto; margin:0; padding:0; border:0; border-radius:4px; background:none;
   52 |   box-shadow:none; text-align:left; cursor:pointer; scroll-margin-block:14px;
   53 |   transition:filter 140ms ease-out;
   54 | }
   55 | body #overlay .battle-decision.battle-decision-unified[data-decision-kind="pile"] [data-battle-pile-view] .battle-pile-card > .hs-card {
   56 |   display:block; width:280px!important; max-width:none!important; height:auto; margin:0;
   57 |   font-size:24px; pointer-events:none; filter:drop-shadow(0 8px 14px #0005);
   58 | }
   59 | body #overlay .battle-decision.battle-decision-unified[data-decision-kind="pile"] [data-battle-pile-view] .battle-pile-card:hover {
   60 |   filter:brightness(1.08);
   61 | }
   62 | body #overlay .battle-decision.battle-decision-unified[data-decision-kind="pile"] [data-battle-pile-view] .battle-pile-card:focus-visible {
   63 |   outline:3px solid #c5e3ed; outline-offset:5px;
   64 | }
   65 | body #overlay [data-battle-pile-view] .battle-pile-count {
   66 |   position:absolute; top:10px; right:12px; z-index:3; min-width:42px; box-sizing:border-box;
   67 |   padding:4px 10px; border:1px solid #a7c1cc61; border-radius:5px;
   68 |   color:#f3e5bd; background:#102631ed; font:650 25px/1.25 var(--font-ui,sans-serif);
   69 |   font-variant-numeric:tabular-nums; text-align:center; pointer-events:none;
   70 | }
   71 | body #overlay [data-battle-pile-view] .battle-pile-empty {
   72 |   display:grid; flex:1 1 auto; place-items:center; min-height:0;
   73 |   color:#c4d5dc; font:400 26px/1.45 var(--font-ui,sans-serif);
   74 | }
   75 | body #overlay .battle-decision.battle-decision-unified[data-decision-kind="pile"]:has([data-battle-pile-view]) .battle-decision-actions {
   76 |   flex:none; margin:0; padding:20px 36px 16px; border:0; background:none!important;
   77 | }
   78 | body #overlay .battle-decision.battle-decision-unified[data-decision-kind="pile"]:has([data-battle-pile-view]) .battle-decision-actions .ov-btns {
--- game/css/battle-pile-view.css:89 ---
   89 | 
```

## P17

大图层的 inert、焦点、关闭和源卡过渡

原文件：`game/src/ui/card-zoom-controller.js`；原行：13–33、171–230、259–299、343–385。

```text
--- game/src/ui/card-zoom-controller.js:13 ---
   13 | export function createCardZoomController({ readCards, readArt, readScale, readSound }) {
   14 |   return { show(host, card, opts = /** @type {import("./ui.dom.types.js").CardZoomOptions} */ ({})) {
   15 |     if (!card) return;
   16 |     const sourceBody = host.el.ovBody;
   17 |     const sourceRoot = sourceBody?.firstElementChild;
   18 |     const sourceCurrent = () => (!sourceBody || (host.el.ovBody === sourceBody && sourceBody.firstElementChild === sourceRoot))
   19 |       && !(opts.from instanceof Element && !opts.from.isConnected);
   20 |     const descriptionRenderer = opts.descriptionRenderer || createCardDescriptionRenderer(readCards()?.all?.() || []);
   21 |     const referenceTrail = opts.referenceTrail || [];
   22 |     const old = /** @type {import('./ui.dom.types.js').CardZoomElement} */ (document.getElementById('cardZoom'));
   23 |     if (old) {
   24 |       if (typeof old._closeCardZoom === 'function') old._closeCardZoom(true);
   25 |       else old.remove();
   26 |     }
   27 |     const previousFocus = opts.returnFocus instanceof HTMLElement
   28 |       ? opts.returnFocus
   29 |       : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
   30 |     const inertHost = host.el.overlay;
   31 |     const overlayWasInert = !!inertHost?.inert;
   32 |     if (inertHost) inertHost.inert = true;
   33 |     const content = createCardZoomContent(card, opts, descriptionRenderer, { readCards, readArt });
--- game/src/ui/card-zoom-controller.js:171 ---
  171 |       clearTimeout(negTimer);
  172 |       el.classList.remove('cz-neg');
  173 |       saveNote();
  174 |       closed = true;
  175 |       el.inert = true;
  176 |       if (photoMode && !immediate && !reducedMotion) {
  177 |         const photoPaper = /** @type {HTMLElement} */ (el.querySelector('.cz-photo-paper'));
  178 |         const viewportUnchanged = photoViewport
  179 |           && photoViewport.width === window.innerWidth
  180 |           && photoViewport.height === window.innerHeight
  181 |           && photoViewport.scale === readScale().scale();
  182 |         const sourceRect = viewportUnchanged ? visiblePhotoSourceRect() : null;
  183 |         const targetRect = photoLayoutRect || (photoPaper ? readScale().rect(photoPaper) : null);
  184 |         el.style.setProperty('--cz-photo-motion-ms', `${photoCloseMs}ms`);
  185 |         el.classList.remove('cz-photo-entering');
  186 |         el.classList.add('cz-photo-closing');
  187 |         if (photoPaper) {
  188 |           if (sourceRect && targetRect?.width > 0) {
  189 |             const scale = sourceRect.width / targetRect.width;
  190 |             const dx = sourceRect.left + sourceRect.width / 2 - (targetRect.left + targetRect.width / 2);
  191 |             const dy = sourceRect.top + sourceRect.height / 2 - (targetRect.top + targetRect.height / 2);
  192 |             el.style.setProperty('--cz-photo-to-transform', `translate(${dx}px, ${dy}px) scale(${scale})`);
  193 |             el.classList.add('cz-photo-closing-to-source');
  194 |           } else {
  195 |             el.classList.add('cz-photo-closing-fallback');
  196 |           }
  197 |         } else {
  198 |           el.classList.add('cz-photo-closing-fallback');
  199 |         }
  200 |         finishClose = () => {
  201 |           if (removed) return;
  202 |           removed = true;
  203 |           cancelCloseMotion();
  204 |           el.remove();
  205 |           if (inertHost) inertHost.inert = overlayWasInert;
  206 |           if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  207 |         };
  208 |         cancelCloseMotion = completeSurfaceMotion(photoPaper, finishClose, {
  209 |           event:'transitionend', name:'transform', duration:photoCloseMs,
  210 |         });
  211 |         return;
  212 |       }
  213 |       // cz-flip 的 animation:none 会一并压掉 czOut，收回前摘掉它恢复出场动画
  214 |       // （inline transform/opacity 一并清掉，防中途收回残留）
  215 |       const cardEl = /** @type {HTMLElement} */ (el.querySelector(photoMode ? '.cz-photo-image' : '.cz-card'));
  216 |       if (cardEl) {
  217 |         cardEl.classList.remove('cz-flip');
  218 |         cardEl.style.transform = '';
  219 |         cardEl.style.opacity = '';
  220 |       }
  221 |       finishClose = () => {
  222 |         if (removed) return;
  223 |         removed = true;
  224 |         cancelCloseMotion();
  225 |         el.remove();
  226 |         if (inertHost) inertHost.inert = overlayWasInert;
  227 |         if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  228 |       };
  229 |       el.classList.add('cz-out');
  230 |       cancelCloseMotion = completeSurfaceMotion(cardEl || el, finishClose, {
--- game/src/ui/card-zoom-controller.js:259 ---
  259 |       if (e.target.closest('.cz-close')) { close(); return; }
  260 |       const btn = /** @type {HTMLElement} */ (e.target.closest('.cz-foot [data-act]'));
  261 |       if (btn) {
  262 |         if (!sourceCurrent()) { close(); return; }
  263 |         invokeUiAction(host, btn, { allowBase:false });
  264 |         return;
  265 |       }
  266 |       if (photoMode) {
  267 |         // Layout gaps, info-panel padding and the hint are outside the photo too.
  268 |         // Keep the photo and editable/interactive content usable.
  269 |         if (!e.target.closest('.cz-photo-paper,.cz-note,button,input,textarea,select,a,[data-term]')) close();
  270 |         return;
  271 |       }
  272 |       if (e.target.closest('.cz-note, .inventory-zoom-info, .card-tip-group, .cz-list-nav')) return;
  273 |       close();
  274 |     });
  275 |     el.addEventListener('keydown', (e) => {
  276 |       if (!e.isComposing && !e.ctrlKey && !e.altKey && !e.metaKey && items.length > 1 && e.target instanceof Element && !e.target.closest('input,textarea,[contenteditable="true"]') && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
  277 |         e.preventDefault(); e.stopPropagation(); browse(e.key === 'ArrowLeft' ? -1 : 1); return;
  278 |       }
  279 |       if (e.key === 'Escape') {
  280 |         if (e.isComposing || e.keyCode === 229) {
  281 |           e.preventDefault();
  282 |           e.stopPropagation();
  283 |           return;
  284 |         }
  285 |         e.preventDefault();
  286 |         e.stopPropagation();
  287 |         close();
  288 |         return;
  289 |       }
  290 |       if (e.key !== 'Tab') return;
  291 |       const focusable = [.../** @type {NodeListOf<HTMLButtonElement>} */ (el.querySelectorAll('button,textarea,[href],[tabindex]:not([tabindex="-1"])'))]
  292 |         .filter(node => !node.disabled && node.getClientRects().length);
  293 |       if (!focusable.length) { e.preventDefault(); el.focus(); return; }
  294 |       const first = focusable[0], last = focusable[focusable.length - 1];
  295 |       if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  296 |       else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  297 |     }, true);
  298 |     document.body.appendChild(el);
  299 |     releaseOwner = registerScreenOwner({ root: el, priority: 50, onBack: () => close() });
--- game/src/ui/card-zoom-controller.js:343 ---
  343 |     // FLIP 起点终点都取布局口径（UiScale.rect）：dx/dy 喂 transform（布局值），zoom≠1 才不错位
  344 |     const fromR = photoMode ? visiblePhotoSourceRect()
  345 |       : opts.from && (opts.from.getBoundingClientRect ? readScale().rect(opts.from) : opts.from);
  346 |     if (photoMode) {
  347 |       if (fromR?.width > 0 && photoLayoutRect?.width > 0 && !reducedMotion) {
  348 |         // Commit the source pose without a transition before transitioning to the final pose.
  349 |         // Otherwise changing the source CSS variable starts a competing transition from .92.
  350 |         const previousTransition = photoPaper.style.transition;
  351 |         photoPaper.style.transition = 'none';
  352 |         const scale = fromR.width / photoLayoutRect.width;
  353 |         const dx = fromR.left + fromR.width / 2 - (photoLayoutRect.left + photoLayoutRect.width / 2);
  354 |         const dy = fromR.top + fromR.height / 2 - (photoLayoutRect.top + photoLayoutRect.height / 2);
  355 |         el.style.setProperty('--cz-photo-from-transform', `translate(${dx}px, ${dy}px) scale(${scale})`);
  356 |         el.classList.add('cz-photo-flipping');
  357 |         void photoPaper.offsetWidth;
  358 |         photoPaper.style.transition = previousTransition;
  359 |         el.classList.remove('cz-photo-entering');
  360 |         enterTimer = setTimeout(() => el.classList.remove('cz-photo-flipping'), photoEnterMs + 20);
  361 |       } else {
  362 |         el.classList.add(reducedMotion ? 'cz-photo-reduced' : 'cz-photo-flipping');
  363 |         void photoPaper?.offsetWidth;
  364 |         el.classList.remove('cz-photo-entering');
  365 |         if (!reducedMotion) enterTimer = setTimeout(() => el.classList.remove('cz-photo-flipping'), photoEnterMs + 20);
  366 |       }
  367 |     } else if (fromR && fromR.width > 0) {
  368 |       const cardEl = /** @type {HTMLElement} */ (el.querySelector('.cz-card'));
  369 |       const toR = readScale().rect(cardEl);
  370 |       if (toR.width > 0) {
  371 |         // FLIP：先摆到来源卡位置与等比尺寸（中心对齐），下一帧过渡到居中位。
  372 |         // 起步带低透明度 + 缓和曲线（.22,.61）：观感是"卡从原位浮现长大"，
  373 |         // 快曲线会让卡像从屏幕外冲进来（2026-09-12 老板复验反馈）。
  374 |         const s = fromR.width / toR.width;
  375 |         const dx = (fromR.left + fromR.width / 2) - (toR.left + toR.width / 2);
  376 |         const dy = (fromR.top + fromR.height / 2) - (toR.top + toR.height / 2);
  377 |         cardEl.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
  378 |         cardEl.style.opacity = '0.25';
  379 |         cardEl.classList.add('cz-flip');
  380 |         // 强制 reflow 落定初态再清空即触发过渡——不能用双 rAF：后台窗口 rAF
  381 |         // 停转会永远冻在起点（2026-09-12 实测），reflow 同步触发无此依赖。
  382 |         void cardEl.offsetWidth;
  383 |         cardEl.style.transform = '';
  384 |         cardEl.style.opacity = '';
  385 |       }
```

## P18

奖励输入保护及同类焦点导航

原文件：`game/src/ui/reward-interaction.js`；原行：1–37。

```text
--- game/src/ui/reward-interaction.js:1 ---
    1 | const owners = new WeakMap();
    2 | const submit = '.reward-claim, [data-act="chestTake"], [data-act="chestLeave"], [data-act="chestOverviewCoins"]';
    3 | 
    4 | // DOM input protection only: business commands retain their own live-source guards.
    5 | export function initRewardInteraction(root, { delay = 350 } = {}) {
    6 |   if (!root) return;
    7 |   const previous = owners.get(root);
    8 |   if (previous) { previous.until = performance.now() + delay; return; }
    9 |   const state = { until:performance.now() + delay };
   10 |   owners.set(root, state);
   11 |   root.addEventListener('click', event => {
   12 |     const button = event.target.closest?.(submit);
   13 |     // detail=0 programmatic clicks are not a carried pointer press. Keyboard is
   14 |     // guarded below, before the browser synthesises its click.
   15 |     if (button && (event.isTrusted || event.detail > 0) && performance.now() < state.until) {
   16 |       event.preventDefault(); event.stopImmediatePropagation();
   17 |     }
   18 |   }, true);
   19 |   root.addEventListener('keydown', event => {
   20 |     if (event.isComposing || event.target.matches?.('input,textarea,select,[contenteditable="true"]')) return;
   21 |     if (event.key === 'Enter' && event.target.closest?.(submit) && (event.repeat || performance.now() < state.until)) {
   22 |       event.preventDefault(); event.stopImmediatePropagation(); return;
   23 |     }
   24 |     if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
   25 |     const unit = event.target.closest?.('.reward-unit');
   26 |     if (!unit) return;
   27 |     const units = [...root.querySelectorAll('.reward-unit')].filter(item => item.querySelector('.reward-card'));
   28 |     const index = units.indexOf(unit);
   29 |     if (index < 0) return;
   30 |     const next = units[(index + (event.key === 'ArrowRight' ? 1 : units.length - 1)) % units.length];
   31 |     const claim = event.target.matches?.('.reward-claim');
   32 |     (claim ? next.querySelector('.reward-claim:not(:disabled)') || next.querySelector('.reward-card') : next.querySelector('.reward-card'))?.focus({ preventScroll:true });
   33 |     next.scrollIntoView?.({ block:'nearest', inline:'nearest' });
   34 |     event.preventDefault(); event.stopPropagation();
   35 |   });
   36 | }
   37 | 
```

## P19

领取后飞向背包、清理与位置重算

原文件：`game/src/ui/reward-acquisition-motion.js`；原行：24–117。

```text
--- game/src/ui/reward-acquisition-motion.js:24 ---
   24 | export function clearRewardAcquisition(host) {
   25 |   for (const flight of [...flights]) if (!host || host === flight.host) flight.dispose();
   26 | }
   27 | 
   28 | // Called only after the shared successful-grant hook. Missing endpoints use its existing reveal queue.
   29 | /** @param {HTMLElement} stage @param {{id?: string, name?: string}} card @param {{mode?: string, token?: unknown, count?: number, sceneSelector?: string}} [options] */
   30 | export function showRewardAcquisition(stage, card, { mode = 'chest', token, count = 1, sceneSelector = '.reward-replica,.cqo-overview' } = {}) {
   31 |   if (!stage?.isConnected || quietFeedback() || motionReduced()) return false;
   32 |   if (sceneSelector && !stage.querySelector(sceneSelector)) return false;
   33 |   const source = /** @type {HTMLElement} */ ([.../** @type {NodeListOf<HTMLElement>} */ (stage.querySelectorAll('[data-reward-card]'))]
   34 |     .find(element => element.dataset.rewardCard === String(card.id || card.name))?.querySelector('.reward-card'));
   35 |   const findTarget = () => [.../** @type {NodeListOf<HTMLElement>} */ (stage.querySelectorAll('[data-card-receive-anchor="bag"],.reward-capacity,[data-act="entrySupplyBag"]'))].find(visible);
   36 |   let target = findTarget();
   37 |   const face = /** @type {HTMLElement} */ (source?.querySelector('.hs-card'));
   38 |   if (!face || !visible(source) || !target) return false;
   39 |   const host = /** @type {HTMLElement} */ (stage.closest('#overlay')) || stage.parentElement;
   40 |   if (!host || host.hidden) return false;
   41 |   // A new run replaces any old run's purely visual receipt.
   42 |   for (const flight of [...flights]) if (flight.host === host && (flight.token !== token || flight.mode !== mode)) flight.dispose();
   43 |   const start = layoutRect(source);
   44 |   const node = document.createElement('div');
   45 |   node.className = 'reward-acquisition-card'; node.inert = true; node.setAttribute('aria-hidden','true');
   46 |   node.style.cssText = `left:${start.left}px;top:${start.top}px;width:${start.width}px;height:${start.height}px`;
   47 |   const clone = /** @type {HTMLElement} */ (face.cloneNode(true));
   48 |   for (const element of [clone, .../** @type {NodeListOf<HTMLElement>} */ (clone.querySelectorAll('*'))]) {
   49 |     element.removeAttribute('id'); element.removeAttribute('tabindex');
   50 |   }
   51 |   // The holder keeps its live endpoint; the face plays one short lift/shrink.
   52 |   // Retargeting the holder never restarts the face or extends the grant receipt.
   53 |   const body = document.createElement('div'); body.className = 'reward-acquisition-body';
   54 |   body.style.setProperty('--reward-flight-duration', `${motionTiming.acquire}ms`);
   55 |   body.append(clone); node.append(body); document.body.append(node);
   56 |   if (count > 1) {
   57 |     const badge = document.createElement('span'); badge.className = 'reward-acquisition-count';
   58 |     badge.textContent = `×${count}`; body.append(badge);
   59 |   }
   60 |   const nodes = new Set([node]);
   61 |   const deadline = performance.now() + motionTiming.acquire;
   62 |   const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
   63 |   let revision = 0, arrival = null, pendingFrame = null, endKey = '';
   64 |   const keyFor = box => [box.left, box.top, box.width, box.height].join(',');
   65 |   const flight = { host, stage, token, mode, dispose() {
   66 |     revision++;
   67 |     if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
   68 |     pendingFrame = null;
   69 |     window.removeEventListener('scroll', scheduleGeometry, true);
   70 |     window.removeEventListener('resize', scheduleGeometry);
   71 |     preference?.removeEventListener?.('change', refreshGeometry);
   72 |     if (receipts.get(host)?.owner === flight) receipts.delete(host);
   73 |     observer.disconnect(); for (const item of nodes) { clearVisual(item); item.remove(); }
   74 |     nodes.clear(); flights.delete(flight);
   75 |   } };
   76 |   function placeArrival() {
   77 |     const box = layoutRect(target);
   78 |     Object.assign(arrival.style, { left: `${box.left - 4}px`, top: `${box.top - 4}px`, width: `${box.width + 8}px`, height: `${box.height + 8}px` });
   79 |   }
   80 |   function travel() {
   81 |     const end = layoutRect(target), currentRevision = ++revision;
   82 |     endKey = keyFor(end);
   83 |     const run = retargetVisual(node, {
   84 |       x: end.left + end.width / 2 - start.left - start.width / 2,
   85 |       y: end.top + end.height / 2 - start.top - start.height / 2,
   86 |       scale: 1, rotate: 0, opacity: 1,
   87 |     }, { duration: Math.max(0, deadline - performance.now()), easing: motionEasing.travel });
   88 |     run.finished.then(completed => {
   89 |       if (!flights.has(flight) || revision !== currentRevision) return;
   90 |       if (!completed) { flight.dispose(); return; }
   91 |       const currentTarget = findTarget();
   92 |       if (!currentTarget) { flight.dispose(); return; }
   93 |       if (currentTarget !== target || keyFor(layoutRect(currentTarget)) !== endKey) { target = currentTarget; travel(); return; }
   94 |       clearVisual(node); node.remove(); nodes.delete(node);
   95 |       const shared = receipts.get(host);
   96 |       if (shared) { shared.detach(); arrival = shared.node; }
   97 |       else {
   98 |         arrival = document.createElement('i');
   99 |         arrival.className = 'reward-acquisition-arrival'; arrival.setAttribute('aria-hidden','true');
  100 |       }
  101 |       placeArrival(); document.body.append(arrival); nodes.add(arrival);
  102 |       receipts.set(host, { node: arrival, owner: flight, detach() { nodes.delete(arrival); flight.dispose(); } });
  103 |       retargetVisual(arrival, { opacity: 0, scale: 1.035 }, { from: { opacity: .65, scale: 1 }, duration: motionTiming.change }).finished.then(() => flight.dispose());
  104 |     });
  105 |   }
  106 |   function refreshGeometry() {
  107 |     if (!flights.has(flight)) return;
  108 |     if (motionReduced() || !stage.isConnected || host.hidden || !host.contains(stage)
  109 |       || (sceneSelector && !stage.querySelector(sceneSelector))) { flight.dispose(); return; }
  110 |     const replacement = findTarget();
  111 |     if (!replacement) return;
  112 |     const moved = replacement !== target || keyFor(layoutRect(replacement)) !== endKey;
  113 |     target = replacement;
  114 |     if (arrival) placeArrival(); else if (moved) travel();
  115 |   }
  116 |   function scheduleGeometry() {
  117 |     if (pendingFrame !== null) return;
```

## P20

奖励反馈与完成回执入口

原文件：`game/src/ui/reward-card-feedback.js`；原行：1–40。

```text
--- game/src/ui/reward-card-feedback.js:1 ---
    1 | import '../../css/reward-completion-receipt.css';
    2 | import { showSettledCardFeedback } from './card-result-feedback.js';
    3 | import { REWARD_DESTINATION } from './reward-state.js';
    4 | 
    5 | // Caller supplies only cards already granted successfully. This never grants or retries.
    6 | /** @param {HTMLElement} stage @param {{id?: string, name?: string}[]} cards @param {{mode?: string, token?: unknown, sceneSelector?: string}} [options] */
    7 | export function showRewardCardFeedback(stage, cards, { mode = 'chest', token, sceneSelector = '.reward-replica,.cqo-overview' } = {}) {
    8 |   if (!cards?.length) return;
    9 |   const groups = new Map();
   10 |   for (const card of cards) {
   11 |     if (!card?.name) continue;
   12 |     const key = card.id || card.name;
   13 |     const item = groups.get(key);
   14 |     if (item) item.count++;
   15 |     else groups.set(key, { kind:REWARD_DESTINATION, name:card.name, card:{ ...card }, count:1 });
   16 |   }
   17 |   showSettledCardFeedback(stage, [...groups.values()], { mode, token, sceneSelector, rewardSource: true });
   18 | }
   19 | 
   20 | // Non-modal acknowledgment after a completed reward queue has returned control.
   21 | // It never grants, delays continuation, or captures input.
   22 | let receipt = null, receiptTimer = null;
   23 | export function clearRewardCompletionReceipt() {
   24 |   clearTimeout(receiptTimer); receiptTimer = null;
   25 |   receipt?.remove(); receipt = null;
   26 | }
   27 | export function showRewardCompletionReceipt(cards) {
   28 |   clearRewardCompletionReceipt();
   29 |   const names = cards?.map(card => card?.name).filter(Boolean);
   30 |   if (!names?.length) return;
   31 |   receipt = document.createElement('aside');
   32 |   receipt.className = 'reward-completion-receipt';
   33 |   receipt.setAttribute('role', 'status'); receipt.setAttribute('aria-live', 'polite');
   34 |   receipt.textContent = `${names.join('、')} · 已入背包`;
   35 |   document.body.append(receipt);
   36 |   receiptTimer = setTimeout(clearRewardCompletionReceipt, 1800);
   37 | }
   38 | document.addEventListener('sdt-overlay-mode', clearRewardCompletionReceipt);
   39 | if (import.meta.hot) import.meta.hot.dispose(() => {
   40 |   clearRewardCompletionReceipt();
```

## P21

现有时长、缓动和减少动态偏好

原文件：`game/src/ui/motion-presets.js`；原行：1–36。

```text
--- game/src/ui/motion-presets.js:1 ---
    1 | /* 界面动效唯一参数来源；业务计时、转场跳过和路由仍由各自模块负责。 */
    2 | export const motionTiming = Object.freeze({
    3 |   pageEnter: 260, regionEnter: 260, change: 160, detailEnter: 220,
    4 |   exit: 180, feedback: 180, fastEnter: 180, fastExit: 110,
    5 |   stagger: 35, staggerMax: 105,
    6 |   navigation: 260, navigationDetail: 220, navigationStagger: 22, navigationStaggerMax: 66,
    7 |   panelExit: 160, handoff: 180, sceneEnter: 450,
    8 |   cardReturn: 120, acquire: 340,
    9 |   photoEnter: 140, photoAtelierEnter: 420, photoExit: 120,
   10 |   zoomExit: 260, completionSlack: 60, notice: 3200,
   11 |   resumeExit: 360,
   12 | });
   13 | export const motionEasing = Object.freeze({
   14 |   enter: 'cubic-bezier(.22,1,.36,1)',
   15 |   exit: 'cubic-bezier(.4,0,.7,1)',
   16 |   travel: 'cubic-bezier(.32,0,.18,1)',
   17 | });
   18 | export function motionReduced() {
   19 |   return document.body.classList.contains('reduce-motion')
   20 |     || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   21 | }
   22 | export function changeFrames(direction = 0) {
   23 |   return [
   24 |     { opacity: .6, transform: direction ? `translateX(${Math.sign(direction) * 10}px)` : 'translateY(6px)' },
   25 |     { opacity: 1, transform: 'none' },
   26 |   ];
   27 | }
   28 | if (typeof document !== 'undefined') {
   29 |   for (const [key, value] of Object.entries(motionTiming)) {
   30 |     const name = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
   31 |     document.documentElement.style.setProperty(`--motion-${name}`, `${value}ms`);
   32 |   }
   33 |   document.documentElement.style.setProperty('--motion-ease-enter', motionEasing.enter);
   34 |   document.documentElement.style.setProperty('--motion-ease-exit', motionEasing.exit);
   35 | }
   36 | 
```

## P22

页面/浮层输入所有权与返回路由

原文件：`game/src/ui/screen-owner.js`；原行：1–31。

```text
--- game/src/ui/screen-owner.js:1 ---
    1 | // Active presentation ownership is separate from game state and save data.
    2 | const owners = [];
    3 | export function currentScreenOwner() {
    4 |   for (let i = owners.length - 1; i >= 0; i--) {
    5 |     const owner = owners[i];
    6 |     let current = true;
    7 |     try { if (owner.isCurrent) current = owner.isCurrent(); } catch { current = false; }
    8 |     if (!owner.root.isConnected || owner.root.hidden || !current) owners.splice(i, 1);
    9 |   }
   10 |   return [...owners].sort((a, b) => b.priority - a.priority || b.order - a.order)[0] || null;
   11 | }
   12 | let order = 0;
   13 | // Optional validity readers are quick and side-effect-free; stale owners never consume input.
   14 | export function registerScreenOwner({ root, onBack, priority = 10, allowNavigation = false, isCurrent = null }) {
   15 |   const owner = { root, onBack, priority, allowNavigation, isCurrent, order: ++order };
   16 |   owners.push(owner);
   17 |   return () => { const at = owners.indexOf(owner); if (at >= 0) owners.splice(at, 1); };
   18 | }
   19 | export function gameplayInputAllowed() { return !currentScreenOwner(); }
   20 | export function pageNavigationAllowed() { const owner = currentScreenOwner(); return !owner || owner.allowNavigation; }
   21 | document.addEventListener('keydown', event => {
   22 |   if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
   23 |   const owner = currentScreenOwner();
   24 |   if (!owner) return;
   25 |   if (event.target instanceof Element && event.target.closest('[data-key-listening="true"]')) return;
   26 |   if (event.key === 'Escape' && owner.onBack) {
   27 |     event.preventDefault(); event.stopImmediatePropagation();
   28 |     if (!event.repeat) owner.onBack();
   29 |   }
   30 | }, true);
   31 | 
```

## P23

音频设置状态源、读值和刷新

原文件：`game/src/ui/settings-audio.js`；原行：1–56。

```text
--- game/src/ui/settings-audio.js:1 ---
    1 | import '../../css/settings-audio.css';
    2 | 
    3 | // Live feedback belongs to this settings page only; no polling or automatic download retries.
    4 | export function bindSettingsAudio(root, overlay, sound) {
    5 |   const status = /** @type {HTMLElement} */ (root.querySelector('#setMusicStatus'));
    6 |   const retry = /** @type {HTMLButtonElement} */ (root.querySelector('#setMusicRetry'));
    7 |   const sfxStatus = root.querySelector('#setSfxStatus');
    8 |   const sfxRetry = /** @type {HTMLButtonElement | null} */ (root.querySelector('#setSfxRetry'));
    9 |   const events = new AbortController();
   10 |   const current = () => root.isConnected && !overlay.hidden && overlay.contains(root);
   11 |   const stop = () => { events.abort(); observer.disconnect(); };
   12 |   const update = () => {
   13 |     if (!current()) { stop(); return; }
   14 |     const state = sound.musicPlayback;
   15 |     retry.hidden = !state?.canRetry;
   16 |     retry.disabled = !state?.canRetry;
   17 |     let message = '';
   18 |     if (state?.muted) message = '音乐已静音。';
   19 |     else if (state?.error?.stage === 'load') message = state.current && state.playing
   20 |       ? '当前场景音乐加载失败，仍在播放上一首。可手动重试。'
   21 |       : '音乐加载失败，请检查网络后重试。';
   22 |     else if (state?.error?.stage === 'play') message = '音乐播放等待浏览器授权，请点击页面或按键后重试。';
   23 |     else if (state?.enabled && state.requested && (!state.playing || state.current !== state.requested)) message = '正在加载音乐…';
   24 |     else if (state?.playing) message = '音乐播放正常。';
   25 |     if (status.textContent !== message) status.textContent = message;
   26 |     if (sfxStatus && sfxRetry) {
   27 |       const state = sound.sfxPlayback;
   28 |       const canRetry = !!state?.canRetry && !state?.muted && !state?.hidden;
   29 |       sfxRetry.hidden = !canRetry; sfxRetry.disabled = !canRetry;
   30 |       const message = state?.muted ? '音效已静音。' : state?.hidden ? '页面隐藏时暂停音效。'
   31 |         : state?.loading ? `正在加载音效（${state.loaded || 0} 项已就绪）…`
   32 |         : state?.failed ? `${state.failed} 项音效加载失败，可手动重试。`
   33 |         : state?.loaded ? '音效已就绪。' : '首次点击或按键后加载音效。';
   34 |       if (sfxStatus.textContent !== message) sfxStatus.textContent = message;
   35 |     }
   36 |   };
   37 |   const observer = new MutationObserver(() => { if (!current()) stop(); });
   38 |   observer.observe(overlay, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
   39 |   document.addEventListener('sdt-sfx-state', update, { signal: events.signal });
   40 |   document.addEventListener('sdt-music-state', update, { signal: events.signal });
   41 |   document.addEventListener('sdt-overlay-close', stop, { signal: events.signal });
   42 |   retry.addEventListener('click', () => {
   43 |     if (!current()) { stop(); return; }
   44 |     if (!sound.musicPlayback?.canRetry) { update(); return; }
   45 |     sound.retryMusic();
   46 |     update();
   47 |   }, { signal: events.signal });
   48 |   sfxRetry?.addEventListener('click', () => {
   49 |     if (!current()) { stop(); return; }
   50 |     if (sound.sfxPlayback?.canRetry) sound.retrySamples?.();
   51 |     update();
   52 |   }, { signal: events.signal });
   53 |   update();
   54 |   return stop;
   55 | }
   56 | 
```

## P24

图标字典、语义别名、字符映射和类型图标

原文件：`game/src/core/icons-bitmap.js`；原行：8–26、29–44、93–105。

```text
--- game/src/core/icons-bitmap.js:8 ---
    8 |   const ROOT = 'assets/ui/icons/';
    9 |   const NAMES = new Set('altar heart broken coin pouch sword swords bag dice upload download book cards home fire skull gem lantern key lock unlock crystal trash door exit tools pocket broom wood bread trophy paw map notes medal shield plate blood flask scroll save helmet question sparkles bolt recycle check cross arrow play skip hourglass gear pen folder archive mouse flag slime demon runner'.split(' '));
   10 |   const missingKeys = new Set();
   11 |   function reportMissing(kind, key) {
   12 |     const label = `${kind}:${String(key || '(empty)')}`;
   13 |     if (!missingKeys.has(label)) {
   14 |       missingKeys.add(label);
   15 |       console.error(`[SDT.Icons] missing bitmap: ${label}`);
   16 |     }
   17 |   }
   18 |   // W5-08（0926）：语义别名——chart/info 尚无专属位图，映射到现有位图消灭 missing bitmap
   19 |   // 空缺（跑局数据页头/终局结算提示）；零新素材，后续专属图出图后在此改指向即可。
   20 |   const ALIAS = { chart: 'archive', info: 'scroll' };
   21 |   function safe(name) { name = ALIAS[name] || name; if (NAMES.has(name)) return name; reportMissing('icon', name); return 'question'; }
   22 |   // 金币货币图标统一使用地图资源栏同源美术（2026-10-15 老板指示），不再走 icons/coin.png。
   23 |   const COIN_ART_URL = assetUrl('assets/ui/map-hud-1015/gold-is7-v2.webp');
   24 |   const ALTAR_ART_URL = assetUrl('assets/scenes/map-nodes/altar-symbol-1017-v2.webp');
   25 |   function url(name) { return safe(name) === 'altar' ? ALTAR_ART_URL : safe(name) === 'coin' ? COIN_ART_URL : assetUrl(`${ROOT}${safe(name)}.png`); }
   26 |   function img(name, cls, alt) { const n=safe(name); if(n==='altar') return `<span class="ic${cls?' '+esc(cls):''}" role="img" aria-label="${esc(alt||'祭坛')}" data-asset-key="icon-altar" style="position:relative;display:inline-block;overflow:hidden;filter:none"><img src="${url(n)}" alt="" draggable="false" loading="eager" decoding="async" style="position:absolute;left:-37.1%;top:-39.6%;width:171.3%;height:171.3%;max-width:none;max-height:none;object-fit:fill;filter:none"></span>`; return `<img class="ic${cls?' '+esc(cls):''}" src="${url(n)}" alt="${esc(alt||n)}" data-asset-key="icon-${esc(n)}" draggable="false" loading="eager" decoding="async">`; }
--- game/src/core/icons-bitmap.js:29 ---
   29 |   const add = (name, codes) => codes.forEach(code => { MAP[String.fromCodePoint(code)] = name; });
   30 |   add('heart',[0x2764,0x1f49a,0x1f497,0x1f494,0x1f496,0x1f691]); add('coin',[0x1fa99,0x1f4b0,0x1f4b8]);
   31 |   add('sword',[0x1f5e1]); add('swords',[0x2694,0x1f3f9,0x1f3af]); add('bag',[0x1f392,0x1f6d2]); add('dice',[0x1f3b2]);
   32 |   add('upload',[0x1f4e4]); add('download',[0x1f4e5]); add('book',[0x1f4da]); add('cards',[0x1f3b4,0x1f0cf]); add('home',[0x1f3e0,0x1f3d5]);
   33 |   add('fire',[0x1f525,0x1f4a5]); add('skull',[0x1f480,0x2620,0x1faa6]); add('gem',[0x1f48e]); add('lantern',[0x1f4a1]);
   34 |   add('key',[0x1f511,0x1f5dd]); add('lock',[0x1f512]); add('unlock',[0x1f513]); add('crystal',[0x1f52e,0x1f537]);
   35 |   add('trash',[0x1f5d1]); add('door',[0x1f6aa]); add('exit',[0x1f681]); add('tools',[0x1f6e0,0x1f528,0x26d3,0x1f9f0]);
   36 |   add('pocket',[0x1f9f3,0x1f45d]); add('broom',[0x1f9f9]); add('wood',[0x1fab5,0x1f33f]); add('bread',[0x1f35e]); add('trophy',[0x1f3c6]);
   37 |   add('paw',[0x1f43e,0x1f415]); add('map',[0x1f5fa]); add('notes',[0x1f4dd]); add('medal',[0x1f396,0x1f3c5]);
   38 |   add('shield',[0x1f6e1]); add('plate',[0x1faa8]); add('blood',[0x1fa78]); add('flask',[0x1f9ea,0x2697]); add('scroll',[0x1f4dc]);
   39 |   add('save',[0x1f4be]); add('helmet',[0x1f9b8]); add('question',[0x2754,0x2753,0x1f50d]); add('sparkles',[0x2728,0x1f31f,0x1f30c,0x1f4ab,0x2b50]);
   40 |   add('bolt',[0x26a1]); add('recycle',[0x267b,0x1f504,0x1f500]); add('check',[0x2714,0x2705]); add('cross',[0x2715,0x274c,0x1f6ab,0x1f910]);
   41 |   add('arrow',[0x27a1,0x1f4c8,0x1f4c9]); add('play',[0x25b6]); add('skip',[0x23ed]); add('hourglass',[0x23f3,0x231b]);
   42 |   add('gear',[0x2699,0x1f50a,0x1f4e1]); add('pen',[0x2712,0x270e]); add('folder',[0x1f4c1]); add('archive',[0x1f5c2,0x1f5c3,0x1f4e6]);
   43 |   add('mouse',[0x1f5b1]); add('flag',[0x1f3f3]); add('slime',[0x1f47e]); add('demon',[0x1f479,0x1f608,0x1f409]); add('runner',[0x1f3c3,0x1f47b,0x1f4a8]);
   44 |   add('question',[0x26a0,0x267e,0x221e,0x1f4cc]); add('crystal',[0x2744]);
--- game/src/core/icons-bitmap.js:93 ---
   93 |   const TYPE_ART={'武术':'swords','法术':'sparkles','道具':'flask','装备':'shield','事件':'dice','能力卡':'helmet','资源':'gem'};
   94 |   if(typeof document!=='undefined'&&document.body)hydrate(document.body);
   95 |   if (typeof MutationObserver!=='undefined'&&typeof document!=='undefined'&&document.body){
   96 |     observeIconHydration(document.body, { hydrate, scrubAttrs, hasTokens });
   97 |   }
   98 |   if (typeof window !== 'undefined') window.addEventListener('error', event => {
   99 |     const target=/** @type {HTMLImageElement | null} */ (event.target);
  100 |     if(target&&target.tagName==='IMG'&&target.dataset&&target.dataset.assetKey) reportMissing('file',target.getAttribute('src'));
  101 |   }, true);
  102 |   // 图标由可见 DOM 按需加载；启动不枚举全图标目录。
  103 |   // 旧独立 iconUrls/warmAllIcons 预热链已经退役。
  104 |   export const Icons = sdtDefine('Icons', {img,url,rich,hydrate,TYPE_ART,NAMES});
  105 | 
```

## P25

奖励卡、查看与领取的实际组件结构

原文件：`game/src/ui/reward-scene-view.js`；原行：1–133。

```text
--- game/src/ui/reward-scene-view.js:1 ---
    1 | import '../../css/room-rewards.css';
    2 | import '../../css/room-footer.css';
    3 | import { esc, escAttr } from '../core/shared.js';
    4 | /** @typedef {{ total?: number, pending?: number, received?: number, choiceCount?: number, choicePending?: boolean, choiceName?: string, bonusPending?: number }} RewardModeProgress */
    5 | 
    6 | export function rewardExitHTML(act, label = '继续探索', extraClass = '') {
    7 |   return `<button type="button" class="reward-exit ${escAttr(extraClass)}" data-act="${escAttr(act)}"><span class="reward-exit-icon" aria-hidden="true">[[icon:exit]]</span><span>${esc(label)}</span></button>`;
    8 | }
    9 | 
   10 | // Cards contain their own names and rules. This frame adds only acquisition actions.
   11 | export function rewardSceneHTML({ title, source = '', countLabel = '', rule = '', cards, actions, footer = '', coins = '', warning = '', details = '', className = 'reward-v14', count = 0, compact = false, claimMode = '', progress = /** @type {RewardModeProgress} */ ({}) }) {
   12 |   const mode = claimMode === 'one' || claimMode === 'all' ? claimMode : '';
   13 |   const choiceState = progress.choicePending ? 'pending' : progress.choiceName ? 'selected' : 'forfeited';
   14 |   const modeHeader = mode === 'one'
   15 |     ? `<div class="reward-mode-banner reward-mode-choice"><span class="reward-mode-mark" aria-hidden="true">1</span><div><span>${progress.choicePending ? `${progress.choiceCount || 0} 张候选 · 选取后其余永久放弃` : progress.choiceName ? `已选定「${esc(progress.choiceName)}」` : '本组已放弃'}</span></div></div>`
   16 |     : mode === 'all' ? `<div class="reward-mode-banner reward-mode-collection" role="status" aria-live="polite"><span class="reward-mode-mark">${progress.pending || 0}</span><div><b>${progress.pending ? '张待收下' : !progress.total ? '无卡牌待领' : progress.received === progress.total ? '卡牌已收齐' : '卡牌已处理'}</b><span>已收下 ${progress.received || 0} / ${progress.total || 0} 张</span></div></div>` : '';
   17 |   return `<section class="${escAttr(className)}${compact ? ' reward-compact' : ''} reward-replica room-reward${className.includes('reward-standalone-picker') ? ' ui-design-system' : ''}" data-reward-count="${count}"${mode ? ` data-reward-mode="${mode}"${mode === 'one' ? ` data-reward-choice-state="${choiceState}"` : ''}` : ''}>
   18 |     <header class="reward-head"><div>${source ? `<span class="reward-source">${esc(source)}</span>` : ''}<h3>${esc(title)}</h3>${modeHeader}${countLabel ? `<p class="reward-count">${esc(countLabel)}</p>` : ''}${rule ? `<p class="reward-rule">${esc(rule)}</p>` : ''}</div></header>
   19 |     <div class="reward-main"><div class="reward-stage loot-scroll"><div class="reward-objects"${mode === 'one' ? ' role="group" aria-label="互斥候选与独立附赠"' : mode === 'all' ? ' role="list" aria-label="可逐张收下的战利品"' : ''}>${coins}${cards}</div>${warning}${details}</div></div>
   20 |     ${footer || actions ? `<footer class="reward-foot room-footer"><div class="reward-footer-info">${footer}<small class="reward-keyboard-help">← → 切换卡牌 · Enter 执行 · Esc 返回</small></div><aside class="loot-actions room-footer-actions" aria-label="奖励操作">${actions}</aside></footer>` : ''}
   21 |   </section>`;
   22 | }
   23 | 
   24 | // A receipt changes card state, not its artwork. Keep the live cards and scroll
   25 | // containers connected while updating their controls and the surrounding facts.
   26 | export function patchRewardScene(host, html) {
   27 |   const current = /** @type {HTMLElement} */ (host?.querySelector('.reward-v14'));
   28 |   if (!current) return false;
   29 |   const template = document.createElement('template');
   30 |   template.innerHTML = html;
   31 |   const next = /** @type {HTMLElement} */ (template.content.querySelector('.reward-v14'));
   32 |   if (!next || !!/** @type {HTMLElement} */ (host.querySelector('.cqo-frame')) !== !!/** @type {HTMLElement} */ (template.content.querySelector('.cqo-frame'))) return false;
   33 |   const objects = /** @type {HTMLElement} */ (current.querySelector('.reward-objects'));
   34 |   const incoming = /** @type {HTMLElement} */ (next.querySelector('.reward-objects'));
   35 |   if (!objects || !incoming) return false;
   36 |   const key = unit => unit.dataset.rewardGroup ? `group:${unit.dataset.rewardGroup}` : unit.dataset.rewardIndex == null ? 'coins' : `${unit.dataset.rewardIndex}:${unit.dataset.rewardCard}`;
   37 |   const existing = new Map([.../** @type {HTMLCollectionOf<HTMLElement>} */ (objects.children)].map(unit => [key(unit), unit]));
   38 |   const units = [.../** @type {HTMLCollectionOf<HTMLElement>} */ (incoming.children)].map(fresh => {
   39 |     const unit = existing.get(key(fresh)), card = /** @type {HTMLElement} */ (unit?.querySelector('.reward-card'));
   40 |     if (!card || !/** @type {HTMLElement} */ (fresh.querySelector('.reward-card'))) return fresh;
   41 |     unit.className = fresh.className;
   42 |     unit.dataset.rewardRarity = fresh.dataset.rewardRarity;
   43 |     if (fresh.dataset.rewardCategory) unit.dataset.rewardCategory = fresh.dataset.rewardCategory;
   44 |     else delete unit.dataset.rewardCategory;
   45 |     let previous = card;
   46 |     for (const child of [.../** @type {HTMLCollectionOf<HTMLElement>} */ (fresh.children)].filter(child => !child.matches('.reward-card'))) {
   47 |       const old = /** @type {HTMLElement} */ (previous.nextElementSibling);
   48 |       if (old?.outerHTML === child.outerHTML) previous = old;
   49 |       else { if (old) old.replaceWith(child); else unit.append(child); previous = child; }
   50 |     }
   51 |     while (previous.nextElementSibling) previous.nextElementSibling.remove();
   52 |     return unit;
   53 |   });
   54 |   for (const [index, unit] of units.entries()) {
   55 |     if (objects.children[index] !== unit) objects.insertBefore(unit, objects.children[index] || null);
   56 |   }
   57 |   while (objects.children.length > units.length) objects.lastElementChild.remove();
   58 |   const stage = /** @type {HTMLElement} */ (current.querySelector('.reward-stage')), nextStage = /** @type {HTMLElement} */ (next.querySelector('.reward-stage'));
   59 |   const tail = [...stage.children].filter(child => child !== objects);
   60 |   const nextTail = [...nextStage.children].filter(child => child !== incoming);
   61 |   for (const [index, fresh] of nextTail.entries()) {
   62 |     const old = tail[index];
   63 |     // Keep an expanded outcome disclosure when its contents have not changed.
   64 |     if (old?.tagName === fresh.tagName && old.className === fresh.className && old.innerHTML === fresh.innerHTML) continue;
   65 |     if (old) old.replaceWith(fresh); else stage.append(fresh);
   66 |   }
   67 |   tail.slice(nextTail.length).forEach(child => child.remove());
   68 |   current.className = next.className;
   69 |   current.dataset.rewardCount = next.dataset.rewardCount;
   70 |   for (const attribute of ['data-reward-mode', 'data-reward-choice-state']) {
   71 |     if (next.hasAttribute(attribute)) current.setAttribute(attribute, next.getAttribute(attribute));
   72 |     else current.removeAttribute(attribute);
   73 |   }
   74 |   for (const selector of ['.reward-head', '.loot-actions', '.reward-foot']) {
   75 |     const old = current.querySelector(selector), fresh = next.querySelector(selector);
   76 |     if (old && fresh && old.innerHTML !== fresh.innerHTML) old.innerHTML = fresh.innerHTML;
   77 |     else if (old && !fresh) old.remove();
   78 |     else if (!old && fresh) current.append(fresh);
   79 |   }
   80 |   const background = /** @type {HTMLElement} */ (host.querySelector('.cqo-background'));
   81 |   const nextBackground = /** @type {HTMLElement} */ (template.content.querySelector('.cqo-background'));
   82 |   if (background && nextBackground && background.innerHTML !== nextBackground.innerHTML) background.innerHTML = nextBackground.innerHTML;
   83 |   return true;
   84 | }
   85 | 
   86 | export function restoreRewardActionFocus(host, focus) {
   87 |   if (!focus) return;
   88 |   const buttons = [.../** @type {NodeListOf<HTMLElement>} */ (host.querySelectorAll('[data-act]:not(:disabled)'))];
   89 |   const same = buttons.find(button => button.dataset.act === focus.action && button.dataset.i === focus.index);
   90 |   const claims = buttons.filter(button => ['chestTake1', 'chestPick', 'chestMakeRoom'].includes(button.dataset.act));
   91 |   const next = claims.find(button => Number(button.dataset.i) > Number(focus.index)) || claims[0];
   92 |   const fallback = focus.action === 'chestStay' ? buttons.find(button => button.dataset.act === 'chestSkip')
   93 |     : ['chestTake1', 'chestPick', 'chestMakeRoom', 'chestCoins'].includes(focus.action) ? next : null;
   94 |   const target = same || fallback || buttons.find(button => ['chestContinue', 'chestClosePicker'].includes(button.dataset.act));
   95 |   target?.focus({ preventScroll:true });
   96 |   if (!target) return;
   97 |   // Reveal only inside the reward's own scrollports, including the long horizontal row.
   98 |   for (const scroll of [target.closest('.reward-objects'), target.closest('.loot-scroll')]) {
   99 |     if (!scroll) continue;
  100 |     const view = scroll.getBoundingClientRect(), rect = target.getBoundingClientRect();
  101 |     if (!view.width || !view.height) continue;
  102 |     if (scroll.scrollWidth > scroll.clientWidth) {
  103 |       const delta = rect.right > view.right ? rect.right - view.right : rect.left < view.left ? rect.left - view.left : 0;
  104 |       scroll.scrollLeft += delta * scroll.clientWidth / view.width;
  105 |     }
  106 |     if (scroll.scrollHeight > scroll.clientHeight) {
  107 |       const delta = rect.bottom > view.bottom ? rect.bottom - view.bottom : rect.top < view.top ? rect.top - view.top : 0;
  108 |       scroll.scrollTop += delta * scroll.clientHeight / view.height;
  109 |     }
  110 |   }
  111 | }
  112 | 
  113 | // Both the card face and its zoom use this exact action; no business callbacks live here.
  114 | export function rewardClaimHTML({ index, cardName = '卡牌', state = 'pending', choice = false, fits = true, disabled = false, zoom = false, claimMode = '', bonus = false, actions = /** @type {{pick?: string, take?: string, organize?: string}} */ ({}) }) {
  115 |   if (claimMode === 'one' || claimMode === 'all') {
  116 |     const mode = choice ? 'one' : 'all';
  117 |     if (state !== 'pending') return `<span class="reward-unit-state reward-state-${mode} is-${state}" role="status"><span class="reward-claim-mark" aria-hidden="true">${state === 'received' ? '✓' : '×'}</span><span>${state === 'received' ? choice ? '已选定 · 已入背包' : '已收下' : choice ? '未选择 · 已放弃' : '已放弃'}</span></span>`;
  118 |     const action = fits ? choice ? actions.pick || 'chestPick' : actions.take || 'chestTake1' : actions.organize || 'chestMakeRoom';
  119 |     const label = fits ? choice ? '选择这张' : bonus ? '收下附赠' : '收下' : '整理背包';
  120 |     return `${zoom && choice ? '<p class="reward-choice-warning">选定后，其余基础候选将放弃。</p>' : ''}<button type="button" class="${zoom ? 'ov-btn ok' : 'reward-claim'} reward-claim-${mode}" data-act="${escAttr(action)}" data-i="${escAttr(index)}" data-cancel="false" aria-label="${escAttr(`${label}：${cardName || '卡牌'}`)}"${choice && fits ? ' aria-description="其余候选将永久放弃"' : ''}${disabled ? ' disabled' : ''}>${label}</button>`;
  121 |   }
  122 |   if (state !== 'pending') return `<span class="reward-unit-state">${state === 'received' ? choice ? '已选择' : '已收下' : '已放弃'}</span>`;
  123 |   const action = fits ? choice ? actions.pick || 'chestPick' : actions.take || 'chestTake1' : actions.organize || 'chestMakeRoom';
  124 |   const label = fits ? choice ? '选择这张' : '收下' : '整理背包';
  125 |   const accessibleLabel = `${label}：${cardName || '卡牌'}`;
  126 |   return `${zoom && choice ? '<p class="reward-choice-warning">其余选项将放弃</p>' : ''}<button type="button" class="${zoom ? 'ov-btn ok' : 'reward-claim'}" data-act="${escAttr(action)}" data-i="${escAttr(index)}" data-cancel="false" aria-label="${escAttr(accessibleLabel)}"${disabled ? ' disabled' : ''}>${label}</button>`;
  127 | }
  128 | 
  129 | // Cancel returns to the owning reward surface; it never means forfeiting rewards.
  130 | export function rewardReturnHTML({ action, organize = false, className = '', arrow = false }) {
  131 |   return `<button type="button"${className ? ` class="${escAttr(className)}"` : ''} data-${organize ? 'organize' : 'act'}="${escAttr(action)}" data-cancel="true">${arrow ? '<span aria-hidden="true">←</span> ' : ''}返回奖励</button>`;
  132 | }
  133 | 
```

## P26

现有多段伤害计数与四个活跃飘字槽位

原文件：`game/src/battle/view/battle.vfx.js`；原行：248–263、393–415。

```text
--- game/src/battle/view/battle.vfx.js:248 ---
  248 |   function spawnFloats(body, baseDelay = 0) {
  249 |     const list = takeFloats();
  250 |     const supportAction = takeCardAction(body, list);
  251 |     if (supportAction) playUnitFrames(supportAction);
  252 |     if (!list.length) return;
  253 |     const ov = UI.el.overlay;
  254 |     const ovR = uiRect(ov);   // 布局口径：飘字/贴图定位
  255 |     const perUnit = {};   // #19：同单位多段伤害错峰呈现
  256 |     const damageBeatCounts = new Map();
  257 |     let previousDue = 0;
  258 |     const stagedHealth = new Set();
  259 |     list.forEach((f) => {
  260 |       if (f.hpBefore == null) return;
  261 |       const key = String(f.unit);
  262 |       damageBeatCounts.set(key, (damageBeatCounts.get(key) || 0) + 1);
  263 |     });
--- game/src/battle/view/battle.vfx.js:393 ---
  393 |       }
  394 |       // 活跃文字占用四个相邻槽位；多段结算仍沿原队列，不以动画结束阻塞规则。
  395 |       const used = new Set(Array.from(/** @type {NodeListOf<BattleElement>} */ (ov.querySelectorAll('.sts-float[data-feedback-unit]')))
  396 |         .filter(el => el.dataset.feedbackUnit === String(f.unit)).map(el => Number(el.dataset.feedbackLane)));
  397 |       const lane = [0, 1, 2, 3].find(index => !used.has(index)) ?? 0;
  398 |       const [dx, dy] = [[-38, 0], [38, 0], [-20, -32], [20, -32]][lane];
  399 |       span.dataset.feedbackLane = String(lane);
  400 |       const x = r.left - ovR.left + r.width / 2 + dx;
  401 |       const y = r.top - ovR.top + r.height * (stk ? 0.12 : 0.34) + dy;
  402 |       span.style.left = Math.max(54, Math.min(ovR.width - 54, x)) + 'px';
  403 |       span.style.top = Math.max(35, Math.min(ovR.height - 35, y)) + 'px';
  404 |       ov.appendChild(span);
  405 |       if (damage && !reduced && span.animate) {
  406 |         span.classList.add('phys');   // 抑制 CSS 上飘动画，走抛体
  407 |         physicsFloat(span, { longLife: finisher || amt >= 10 });   // W5-04：终结/重击跳字加长寿命
  408 |         schedulePresentation(() => span.remove(), finisher || amt >= 10 ? 1200 : 900);
  409 |       } else {
  410 |         span.addEventListener('animationend', () => span.remove(), { once: true });
  411 |         schedulePresentationMs(() => span.remove(), 1400);   // CSS 动画不按倍速缩短，兜底也保持原时长
  412 |       }
  413 |       await globalHitStop(stopMs, signal);
  414 |       };
  415 |       const due = baseDelay + (f.delay || 0) + feedbackDelay(f.unit, perUnit, demoMs(FEEDBACK_DELTA_MS));   // 同单位多段按节拍错开
```

## P27

局内顶栏按钮、状态与移动同一组控件

原文件：`game/src/ui/run-top-bar.js`；原行：10–31、64–100。

```text
--- game/src/ui/run-top-bar.js:10 ---
   10 | export function configureRunTopBar(UI, actions) {
   11 |   configurations.set(UI, actions);
   12 |   const doc = actions.document || document;
   13 |   for (const id of ['btnHome', 'btnMute']) {
   14 |     const button = doc.getElementById(id);
   15 |     if (!button) continue;
   16 |     const bound = actionOwners.has(button);
   17 |     actionOwners.set(button, UI);
   18 |     if (bound) continue;
   19 |     button.addEventListener('click', event => {
   20 |       event.stopPropagation();
   21 |       const current = configurations.get(actionOwners.get(button));
   22 |       if (id === 'btnHome') current?.openLeaveMenu?.();
   23 |       else {
   24 |         const sound = current?.readSound?.();
   25 |         if (sound) sound.setMuted(!sound.muted);
   26 |         button.classList.toggle('muted', !!sound?.muted);
   27 |         button.setAttribute('aria-pressed', String(!!sound?.muted));
   28 |       }
   29 |       mounted.get(UI)?.syncMute();
   30 |     });
   31 |   }
--- game/src/ui/run-top-bar.js:64 ---
   64 |   const actions = doc.createElement('nav'); actions.className = 'run-top-actions'; actions.setAttribute('aria-label', '系统操作');
   65 |   const person = doc.createElement('div'); person.className = 'run-top-person';
   66 |   const resources = doc.createElement('div'); resources.className = 'run-top-resources';
   67 |   const secondary = doc.createElement('div'); secondary.className = 'run-top-secondary';
   68 |   const move = (id, parent, action) => {
   69 |     const node = doc.getElementById(id);
   70 |     if (node) { parent.append(node); if (action) node.dataset.runAction = action; }
   71 |     return node;
   72 |   };
   73 |   move('btnHome', actions, 'leave'); move('btnMute', actions, 'mute');
   74 |   move('heroAva', person, 'character'); move('hpHud', person);
   75 |   move('resHud', resources);
   76 |   const gold = resources.querySelector('.res-gold'), attack = resources.querySelector('.res-atk');
   77 |   if (gold) gold.dataset.runAction = 'gold';
   78 |   if (attack) attack.dataset.runAction = 'attack';
   79 |   move('expeditionChapter', secondary);
   80 |   const status = doc.createElement('div'); status.id = 'saveStatus'; status.className = 'save-status';
   81 |   status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
   82 |   status.innerHTML = '<span data-save-label>尚未保存</span><button type="button" data-run-action="retry" data-save-retry hidden>重试保存</button>';
   83 |   secondary.append(status);
   84 |   const detail = doc.createElement('section'); detail.className = 'run-top-detail'; detail.hidden = true;
   85 |   detail.setAttribute('role', 'dialog'); detail.setAttribute('aria-label', '远征状态说明');
   86 |   detail.innerHTML = '<h2></h2><p></p><button type="button" data-run-action="close">返回</button>';
   87 |   bar.append(actions, person, resources, secondary, detail);
   88 |   let returnFocus = null, releaseOwner = null, initialized = false;
   89 |   const closeDetail = () => {
   90 |     if (detail.hidden) return;
   91 |     detail.hidden = true; releaseOwner?.(); releaseOwner = null;
   92 |     returnFocus?.setAttribute('aria-expanded', 'false');
   93 |     if (returnFocus?.isConnected) returnFocus.focus({ preventScroll:true });
   94 |   };
   95 |   const getActions = () => configurations.get(UI);
   96 |   const controller = {
   97 |     bar, game:null, battle:null,
   98 |     syncStats() {
   99 |       const stats = controller.battle;
  100 |       if (!stats) return;
```

## P28

地图线性符号中的同形多义分支

原文件：`game/src/core/renderer.icons.js`；原行：16–48。

```text
--- game/src/core/renderer.icons.js:16 ---
   16 | function drawTacticalIcon(ctx, type, cx, cy, u, color) {
   17 |   const c = color || '#d7e6e8';
   18 |   ctx.save(); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = Math.max(1.4, 1.9 * u); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
   19 |   const s = 8 * u;
   20 |   switch (type) {
   21 |     case 'battle':
   22 |       ctx.beginPath(); ctx.moveTo(cx-s,cy-s); ctx.lineTo(cx+s,cy+s); ctx.moveTo(cx+s,cy-s); ctx.lineTo(cx-s,cy+s); ctx.stroke(); break;
   23 |     case 'coin': case 'wood': case 'rations': case 'chest': case 'key':
   24 |       ctx.beginPath(); ctx.moveTo(cx,cy-s-2*u); ctx.lineTo(cx+s+2*u,cy); ctx.lineTo(cx,cy+s+2*u); ctx.lineTo(cx-s-2*u,cy); ctx.closePath(); ctx.stroke();
   25 |       ctx.beginPath(); ctx.moveTo(cx-3*u,cy); ctx.lineTo(cx+3*u,cy); ctx.stroke(); break;
   26 |     case 'fire': case 'emergencyExit': case 'extraction': case 'entrance':
   27 |       ctx.beginPath(); ctx.moveTo(cx,cy-s-2*u); ctx.lineTo(cx+s,cy+s); ctx.lineTo(cx-s,cy+s); ctx.closePath(); ctx.stroke();
   28 |       ctx.beginPath(); ctx.moveTo(cx,cy+s); ctx.lineTo(cx,cy-s/2); ctx.stroke(); break;
   29 |     case 'shop':
   30 |       ctx.strokeRect(cx-s,cy-2*u,s*2,10*u); ctx.beginPath(); ctx.moveTo(cx-s-2*u,cy-2*u); ctx.lineTo(cx+s+2*u,cy-2*u); ctx.moveTo(cx,cy-2*u); ctx.lineTo(cx,cy+8*u); ctx.stroke(); break;
   31 |     case 'altar': case 'event':
   32 |       ctx.beginPath(); ctx.arc(cx,cy,7*u,0,TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx,cy-4*u); ctx.lineTo(cx,cy+4*u); ctx.moveTo(cx-3*u,cy+1*u); ctx.lineTo(cx+3*u,cy+1*u); ctx.stroke(); break;
   33 |     case 'boss':
   34 |       ctx.beginPath(); ctx.moveTo(cx,cy-s); ctx.lineTo(cx+s,cy); ctx.lineTo(cx,cy+s); ctx.lineTo(cx-s,cy); ctx.closePath(); ctx.stroke(); ctx.fillRect(cx-1.3*u,cy-1.3*u,2.6*u,2.6*u); break;
   35 |     case 'blank': { // 内容已消耗：空心圆与短横，保留可通行地点。
   36 |       ctx.lineWidth = Math.max(1.2, 1.5 * u);
   37 |       ctx.beginPath(); ctx.arc(cx, cy, s, 0, TAU); ctx.stroke();
   38 |       ctx.beginPath(); ctx.moveTo(cx - 3 * u, cy); ctx.lineTo(cx + 3 * u, cy); ctx.stroke();
   39 |       break;
   40 |     }
   41 |     default:
   42 |       ctx.beginPath(); ctx.arc(cx,cy,6*u,0,TAU); ctx.stroke();
   43 |   }
   44 |   ctx.restore();
   45 | }
   46 | 
   47 | export { drawTacticalIcon };
   48 | 
```

## P29

卡片姿态服务接管与领取副本动画层

原文件：`game/css/card-state-motion.css`；原行：1–22。

```text
--- game/css/card-state-motion.css:1 ---
    1 | /* The motion service owns transforms while a reward/bag card is being browsed. */
    2 | body #overlay .card .reward-replica .reward-unit .reward-card[data-card-state-motion="true"],
    3 | body [data-card-state-motion="true"].bag-tile.card-face {
    4 |   transition-property: opacity, filter, box-shadow;
    5 |   transform-origin: center;
    6 | }
    7 | .reward-acquisition-card {
    8 |   position: fixed; z-index: 10020; pointer-events: none;
    9 |   margin: 0; padding: 0; border: 0; background: none;
   10 |   transform-origin: center; overflow: visible;
   11 | }
   12 | .reward-acquisition-body {
   13 |   width: 100%; height: 100%; position: relative; transform-origin: center;
   14 |   animation: rewardAcquisitionLift var(--reward-flight-duration,340ms) linear both;
   15 | }
   16 | .reward-acquisition-body > .hs-card { width: 100%; height: 100%; max-width: none; }
   17 | /* A small lift makes ownership legible; shrink mainly during the approach. */
   18 | @keyframes rewardAcquisitionLift {
   19 |   0% { transform: translateY(0) scale(1); opacity: 1; }
   20 |   30% { transform: translateY(-22px) scale(.96); opacity: 1; }
   21 |   65% { transform: translateY(-14px) scale(.58); opacity: .9; }
   22 |   100% { transform: translateY(0) scale(.12); opacity: .12; }
```

## P30

底板及已接管选择项的背景退让

原文件：`game/css/selection-state-motion.css`；原行：1–31。

```text
--- game/css/selection-state-motion.css:1 ---
    1 | /* Move only the selected control's paint; layout, hit targets and glass stay authored. */
    2 | [data-selection-motion] { position: relative; isolation: isolate; }
    3 | [data-selection-motion] > .selection-state-plate {
    4 |   position: absolute; top: 0; left: 0; z-index: -1; pointer-events: none;
    5 |   border-radius: 6px; opacity: 0;
    6 |   background: linear-gradient(140deg, color-mix(in srgb, currentColor 45%, transparent), #2c616da3);
    7 |   box-shadow: inset 0 1px 0 #d9f5ec40, inset 0 -2px #c9b477a6, 0 4px 12px #071a2526;
    8 | }
    9 | [data-selection-motion="zone"] > .selection-state-plate {
   10 |   background: linear-gradient(140deg, #669aa96b, #30616ba3);
   11 |   box-shadow: inset 2px 0 var(--bag-gold), inset 0 1px 0 #d5f5ef38, 0 4px 12px #061b2533;
   12 | }
   13 | [data-selection-motion="settings"] > .selection-state-plate {
   14 |   border-radius: 2px;
   15 |   background: linear-gradient(100deg, color-mix(in srgb, currentColor 23%, transparent), color-mix(in srgb, currentColor 6%, transparent));
   16 |   box-shadow: inset 3px 0 currentColor, inset 0 1px 0 #e8f3ff21, inset 0 -1px 0 #03080e33, 0 8px 22px #0205094d;
   17 | }
   18 | body #overlay [data-selection-motion] > :is(.bag-rz.on,.bag-pill.on,.settings-tab[aria-selected="true"]) {
   19 |   background: transparent !important; box-shadow: none !important;
   20 | }
   21 | body #overlay [data-selection-motion="settings"]::before { display: none; }
   22 | body #overlay [data-selection-motion] > :is(.bag-rz,.bag-pill,.settings-tab) {
   23 |   transition-property: color, border-color;
   24 |   transition-duration: var(--motion-change,160ms);
   25 |   transition-timing-function: var(--motion-ease-enter,cubic-bezier(.22,1,.36,1));
   26 | }
   27 | body.reduce-motion #overlay [data-selection-motion] > :is(.bag-rz,.bag-pill,.settings-tab) { transition: none; }
   28 | @media (prefers-reduced-motion: reduce) {
   29 |   body #overlay [data-selection-motion] > :is(.bag-rz,.bag-pill,.settings-tab) { transition: none; }
   30 | }
   31 | 
```
