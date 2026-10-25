# 2026-10-23 复审时的当前源码摘录

D01–D07补充已变化的冻结摘录；D08–D11补充图标与牌堆接线。只读采集，行号以记录指纹对应版本为准，不代表新设计已实装。

<a id="d01"></a>
## D01 · game/css/settings-navigation.css

对应冻结摘录 P04；SHA256 `68943d0e4a3f8465f749055fad40d01d997de41a7a8195fb57e79472a92afb53`

原行号 125–153：

```text
125:   min-height: 84px; padding: 16px 28px; margin: 0 0 8px;
126:   background: linear-gradient(105deg, rgba(125,135,145,.22), rgba(60,70,81,.24));
127:   border: 1px solid #d9e6ef21; border-radius: 4px;
128:   box-shadow: inset 0 1px 0 #ecf4ff12, inset 0 -1px 0 #03080e33, 0 3px 8px #02060926;
129:   color: #e7edf3; font-size: var(--ui-text-body); animation: none;
130:   transition: background .15s ease, border-color .15s ease, box-shadow .15s ease;
131: }
132: #overlay .settings-tabbed .chk:hover {
133:   background: linear-gradient(105deg, rgba(136,154,171,.3), rgba(65,79,93,.36));
134:   border-color: #c8dbe34d;
135:   box-shadow: inset 0 1px 0 #edf5ff21, 0 7px 18px #02060940;
136: }
137: #overlay .settings-tabbed .chk:has(input[type="checkbox"]:checked) {
138:   border-right-color: rgba(var(--settings-tint),.35);
139: }
140: #overlay .settings-tabbed .settings-group .chk:has(input:focus-visible) {
141:   border-color: #bdcfdf80;
142:   background: linear-gradient(105deg, rgba(136,154,171,.3), rgba(65,79,93,.36));
143:   box-shadow: inset 0 0 0 1px #bdcfdf26, 0 5px 14px #02060940;
144: }
145: #overlay .settings-tabbed .chk::before,
146: #overlay .settings-tabbed .chk::after { display: none; }
147: #overlay .settings-tabbed .chk > .settings-row-copy,
148: #overlay .settings-tabbed .vol > span { display: block; flex: 1; min-width: 0; }
149: #overlay .settings-tabbed .settings-row-copy,
150: #overlay .settings-tabbed .vol > span { font-weight: 500; letter-spacing: .4px; }
151: #overlay .settings-tabbed .chk input[type="checkbox"] {
152:   appearance: none; position: relative; flex: 0 0 48px;
153:   width: 48px; height: 26px; margin: 0;
```

原行号 190–206：

```text
190: }
191: #overlay .settings-tabbed .hint { color: #95a8b9; line-height: 1.9; font-size: var(--ui-text-label); }
192: #overlay .pg.settings-tabbed .btn-row .mini-btn {
193:   padding: var(--ui-space-2) var(--ui-space-4); font-size: var(--ui-text-label); letter-spacing: 1px; line-height: 1.5;
194: }
195: #overlay .settings-tabbed :is(.mini-btn,.ov-btn) {
196:   padding: var(--ui-space-2) var(--ui-space-4); min-height: var(--ui-control-compact); background: #91a9bc21;
197:   border: 1px solid #c2d4e136; border-radius: 4px;
198:   color: #dde7ee; box-shadow: inset 0 1px 0 #eff6ff0d, 0 5px 14px #02050940; font-size: var(--ui-text-label);
199:   clip-path: none; transition: background .15s ease, border-color .15s ease, box-shadow .15s ease;
200: }
201: #overlay .settings-tabbed :is(.mini-btn,.ov-btn):hover { background: #abc1d237; }
202: #overlay .settings-tabbed :is(.mini-btn,.ov-btn):active {
203:   transform: translateY(1px); box-shadow: inset 0 2px 5px #02050940;
204: }
205: #overlay .settings-tabbed .settings-records .mini-btn {
206:   display: flex; align-items: center; justify-content: space-between;
```

原行号 239–260：

```text
239:   outline: 2px solid rgb(var(--settings-tint)); outline-offset: 3px;
240: }
241: /* 首次入场由 surface-motion 展开导航和玻璃框，分类切换只展开内容。 */
242: body:not(.reduce-motion) #overlay .settings-tabbed .settings-content {
243:   animation: none;
244: }
245: body:not(.reduce-motion) #overlay .settings-tabbed[data-settings-motion="change"] .settings-panel:not([hidden]) .settings-panel-head {
246:   animation: settingsContentIn var(--home-ui-change) var(--settings-ease) backwards;
247: }
248: body:not(.reduce-motion) #overlay .settings-tabbed[data-settings-motion="change"] .settings-panel:not([hidden]) :is(.chk,.btn-row,.hint) {
249:   animation: settingsContentIn var(--home-ui-change) var(--settings-ease) calc(var(--settings-order, 0) * var(--motion-stagger,35ms)) backwards;
250: }
251: @keyframes settingsContentIn {
252:   from { opacity: 0; transform: translateY(7px); }
253:   to { opacity: 1; transform: translateY(0); }
254: }
255: body.reduce-motion #overlay .settings-tabbed *,
256: body.reduce-motion #overlay .settings-tabbed *::before,
257: body.reduce-motion #overlay .settings-tabbed *::after { animation: none !important; transition: none !important; }
258: @media (prefers-reduced-motion: reduce) {
259:   #overlay .settings-tabbed *,
260:   #overlay .settings-tabbed *::before,
```

<a id="d02"></a>
## D02 · game/src/battle/view/battle.aim.js

对应冻结摘录 P07；SHA256 `d58df8312df233a28e6febce010a132adb79e1d0a09eda8139a3cbaa64ee8e8b`

原行号 245–269：

```text
245:       || snapshot.infusing || snapshot.discovering || snapshot.choosing || snapshot.handSelecting
246:       || snapshot.pendingItem || snapshot.slamPending || snapshot.dartPending
247:       || snapshot.viewingGrave || snapshot.viewingDeck || snapshot.viewingBag || snapshot.deckSelection
248:       || snapshot.pendingTarget?.uid !== a.snap.pendingTarget?.uid) return false;
249:     const oldHand = a.snap.hand || [], newHand = snapshot.hand || [];
250:     if (oldHand.length !== newHand.length || oldHand.some((entry, i) => handUid(entry) !== handUid(newHand[i]))) return false;
251:     const entry = findCard(a.uid);
252:     return !!entry && (targetSide(entry.card) || 'any') === a.side;
253:   }
254:   function resumeAimAfterRender(snapshot) {
255:     const a = aim;
256:     if (!a) return;
257:     if (!a.el.isConnected || !a.stage?.isConnected || !a.targetSession?.isCurrent()) { cancelAim(); return; }
258:     const stage = /** @type {BattleElement} */ (UI.el.ovBody?.querySelector('.battle-stage'));
259:     const entry = findCard(a.uid);
260:     if (!stage || !a.el.isConnected || !stage.contains(a.el) || a.el.dataset.uid !== a.uid || !entry) { cancelAim(); return; }
261:     if (a.moved) a.el.classList.add('aim-lift'); // updateHand 会重写 className
262:     const baseRect = aimBaseRect(a.el);
263:     if (a.slotLayout !== aimSlotLayout(a.el)
264:       || (a.baseRect && ['left', 'top', 'width', 'height'].some(key => Math.abs(baseRect[key] - a.baseRect[key]) > 6))) {
265:       cancelAim(); // 手牌槽位或尺寸变化时，旧的跟手原点不再可靠
266:       return;
267:     }
268:     a.baseRect = baseRect;
269:     a.targetSession?.cancel();
```

原行号 494–555：

```text
494:   function startAim(e, el, kind) {
495:     if (e.button !== 0 || e.isPrimary === false || e.isComposing) return;
496:     if (/** @type {BattleElement} */ (document.querySelector('#overlay .bt-hand-detail'))) return;
497:     const snap = getSnapshot();
498:     const { busy, infusing, discovering, choosing } = snap;
499:     syncSubmittedCardPoses();
500:     if (busy || infusing || discovering || choosing || aim || submittedCards.has(el.dataset.uid)) return;
501:     const uid = el.dataset.uid;
502:     // 09-20 老板：砸击改拖动释放——按钮无卡牌 uid，喂伪卡复用
503:     // 药水式非跟手指向（红箭头 + 敌人高亮 + 伤害预览）；能量门槛由按钮 disabled 承担
504:     // 2026-10-02 老板：伪卡按当前职业技能取文案与数值（战士猛击预览=攻击力）；
505:     // 无目标技能（法师搜刮/牧师圣疗）不支持拖拽——点击立即生效
506:     const isSlam = kind === 'slam';
507:     const skill = isSlam ? slamSkillOf() : null;
508:     if (isSlam && !skill.needsTarget) return;
509:     const entry = isSlam ? { card: { name: skill.name, desc: skill.aimDesc,
510:       dmg: skill.kind === 'attack' ? (snap.player?.atk || 0) : (skill.dmg || 0) } } : findCard(uid);
511:     if (!entry) return;
512:     cancelClickSelection();
513:     const side = (kind === 'potion' || isSlam) ? 'enemy' : (targetSide(entry.card) || 'any');   // null = 无目标招式：拖到中间空地即可
514:     // Default pointer and keyboard submissions share the same infusion entry.
515:     const playBlockedReason = !isSlam && kind !== 'potion'
516:       ? cardPlayBlockedReason(uid, side === 'self' ? 'self' : undefined) : '';
517:     const isCard = kind !== 'potion' && !isSlam;
518:     const vr = UI.el.overlay.getBoundingClientRect();
519:     const r = el.getBoundingClientRect();
520:     const returning = isCard && returningCards.get(el);
521:     const originalTransform = returning ? returning.originalTransform : el.style.transform;
522:     const originalTransition = returning ? returning.originalTransition : el.style.transition;
523:     if (returning) returningCards.delete(el);
524:     aim = {
525:       uid, card: entry.card, side, el, kind: kind || 'card',
526:       fieldPlayable: isCard && (side === 'self' || isAreaEffect(entry.card) || isRandomEnemyEffect(entry.card)),
527:       pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY,
528:       playBlockedReason, reasonShown: false,
529:       ax: r.left + r.width / 2 - vr.left, ay: r.top - vr.top + 6,
530:       sx:e.clientX, sy:e.clientY, moved:isCard, hover:null, leftDown:true,
531:       snap, vr,   // pointermove 复用；战场重绘后会更新为新快照和 rect
532:       // 指向卡过出牌线进 target；无目标卡过线进 multi。
533:       follow: isCard, mode: 'drag',
534:       restCenter: { cx: r.left + r.width / 2, cy: r.top + r.height / 2, h: r.height },
535:       stage: el.closest('.battle-stage'),
536:       playY: isCard ? playZoneY(e.clientY) : -1,
537:       hasLeftCancel: false, hasEnteredPlay: false,
538:       originalTransform, originalTransition, originalInert:returning ? returning.originalInert : el.inert,
539:       targetMode:'release', motion:returning ? { ...returning.motion }
540:         : { x:r.left + r.width / 2, y:r.top + r.height / 2, scale:1 },
541:       reducedMotion: !!SDT.Motion?.reduceMotion?.(),
542:     };
543:     aim.targetSession = makeAimTargetSession(aim);
544:     if (isCard) {
545:       aim.baseRect = aimBaseRect(el);
546:       aim.slotLayout = aimSlotLayout(el);
547:       el.style.transition = 'none';
548:       el.inert = true;
549:       el.classList.add('aim-lift');
550:       paintCardPose(aim);
551:       SDT.Sound.sfx('cardSelect');
552:     }
553:     // 手牌节点随 ovBody 重绘短暂脱离文档；捕获放在常驻 overlay 上，拖动才不会被打断。
554:     aim.captureHost = isCard ? UI.el.overlay : el;
555:     if (aim.captureHost?.setPointerCapture) {
```

原行号 627–660：

```text
627:   function stepMotionFrame(now) {
628:     motionFrame = 0;
629:     const delta = motionTime ? Math.max(0, (now - motionTime) / 1000) : 1 / 60;
630:     motionTime = now;
631:     if (aim) aimPointerFrame(delta);
632:     returningCards.forEach((record, el) => {
633:       if (!el.isConnected || UI.el.overlay.hidden || !record.stage?.isConnected || SDT.Motion?.reduceMotion?.()) { finishCardReturn(el, record); return; }
634:       const base = cardLayoutBase(el), target = {
635:         x:base.x + record.rest.x * base.scale, y:base.y + record.rest.y * base.scale, scale:record.rest.scale,
636:       };
637:       if (advanceCardPose(record, target, delta, base)) finishCardReturn(el, record);
638:     });
639:     if (aim || returningCards.size) ensureMotionFrame();
640:     else motionTime = 0;
641:   }
642:   // 指针事件只采样；同一条显示帧时钟推进起拖、停靠及回手牌动画。
643:   function moveAim(e) {
644:     if (!aim || e.pointerId !== aim.pointerId) return;
645:     aim.lastX = e.clientX;
646:     aim.lastY = e.clientY;
647:     if (!aim.moved && Math.hypot(e.clientX - aim.sx, e.clientY - aim.sy) < PICKUP_DISTANCE) return;
648:     if (!aim.moved) {
649:       aim.moved = true;
650:       aim.el.classList.add('aim-lift');
651:     }
652:     ensureMotionFrame();
653:   }
654:   function aimPointerFrame(delta = 0) {
655:     const a = aim;
656:     if (!a) return;
657:     if (!a.el.isConnected || !a.stage?.isConnected || !a.targetSession?.isCurrent()) { cancelAim(); return; }
658:     if (!a.follow && !a.moved) return;
659:     const eX = a.lastX, eY = a.lastY;
660:     const vr = a.vr;   // 重绘后由 resumeAimAfterRender 更新；帧内复用以免频繁读布局
```

原行号 873–891：

```text
873:   function cancelAim() {
874:     const a = aim;
875:     aim = null;
876:     if (!a) return;
877:     aimPlayedAt = Date.now(); // 取消后吞掉本次按压可能产生的合成 click
878:     finishAim(a, true);
879:     clearThoughtBubble();
880:   }
881:   function onAimPointerCancel(e) { if (aim && e.pointerId === aim.pointerId) cancelAim(); }
882:   function onAimLostCapture(e) {
883:     if (aim && e.pointerId === aim.pointerId && (!aim.follow || aim.leftDown)) cancelAim();
884:   }
885:   function onAimVisibilityChange() {
886:     if (!document.hidden) return;
887:     // A background tab must not retain an invisible return tween or stale pointer capture.
888:     cancelAim();
889:     returningCards.forEach((record, el) => finishCardReturn(el, record));
890:     if (motionFrame) cancelAnimationFrame(motionFrame);
891:     motionFrame = 0; motionTime = 0;
```

<a id="d03"></a>
## D03 · game/src/battle/view/battle.layers.js

对应冻结摘录 P09；SHA256 `8ec40bace4cc9e5d9786c52ea40ea30c8e432a4bea77a00f49e7dac9aa414157`

原行号 114–137：

```text
114:   // 状态角标：祝福（绿）+ 诅咒（红）——2026-09-11 架构批次 1 自 battle.core 外迁（纯视图函数）
115:   // compact（敌方名牌收纳，迭代评审 09-20）：总数>4 时退化为「图标+层数」——纯图标会丢层数（美术岗复核口径）；
116:   // 玩家名牌不传 compact，维持原样。09-20 老板：词条触摸讲解——data-term 交 term-tips.js 弹自绘讲解框
117:   // （系统 title 已被 game.boot 全局移除，触屏也无效），讲解框自带全名+全文，compact 不再需要分叉文案
118:   function statusChips(status, opts) {
119:     const compactAll = !!(opts && opts.compact);
120:     const activeBuffs = Combat.BUFFS.filter(k => (status[k] || 0) > 0);
121:     const activeCurses = Combat.CURSES.filter(k => (status[k] || 0) > 0);
122:     const compact = compactAll && (activeBuffs.length + activeCurses.length) > 4;
123:     const buffs = activeBuffs.map(k => {
124:       const m = Combat.BUFF_META[k];
125:       const v = m.timed ? ` ${status[k]}回合` : (m.flag ? '' : ` ${status[k]}`);
126:       const label = compact ? `${status[k]}${m.timed ? '回合' : ''}` : `${m.name}${v}`;
127:       return `<span class="bt-buff b-${k}" data-term="${k}">${m.icon} ${label}</span>`;
128:     });
129:     const curses = activeCurses.map(k => {
130:       const m = Combat.CURSE_META[k];
131:       const txt = m.stack ? `${m.name} ${status[k]}` : `${m.name} ${status[k]}回合`;
132:       const label = compact ? (m.stack ? `${status[k]}` : `${status[k]}回合`) : txt;
133:       return `<span class="bt-curse c-${k}" data-term="${k}">${m.icon} ${label}</span>`;
134:     });
135:     return buffs.concat(curses).join(' ');
136:   }
137:   const curseChips = statusChips;   // 兼容旧调用名
```

原行号 741–750：

```text
741:     else slot.appendChild(np);
742:     return parts;
743:   }
744:   // 差分工具：html 变了才重写 innerHTML
745:   function setSection(el, sig, key, html) {
746:     if (sig[key] === html) return;
747:     sig[key] = html;
748:     el.innerHTML = SDT.Icons.rich(html);
749:   }
750:   // Compare live DOM values so retained or externally changed nodes stay authoritative.
```

原行号 797–807：

```text
797:     setUnitHP(selfParts, sig, player.hp, player.maxHp, !sig.init);
798:     if (selfParts.armor.hidden !== !(pdef.armor > 0)) selfParts.armor.hidden = !(pdef.armor > 0);
799:     const armorText = `甲 ${pdef.armor || 0}`;
800:     if (selfParts.armor.textContent !== armorText) selfParts.armor.textContent = armorText;
801:     setUnitAttribute(selfParts.armor, 'aria-label', `护甲 ${pdef.armor || 0}`);
802:     // 常驻显示合计，强化来源可聚焦查看；护甲已在生命栏旁显示。
803:     setSection(selfParts.stats, sig, 'stats', playerCombatStatsHTML(player, pdef, pstat.status));
804:     setSection(selfParts.chips, sig, 'chips', curseChips(pstat.status) + (snapshot.playerEffects || []).map(effect =>
805:       `<span class="bt-buff" tabindex="0" data-player-effect="${escAttr(effect.key)}" data-term="${escAttr(effect.key)}" data-ui-tip data-ui-tip-title="${escAttr(effect.name)}" data-ui-tip-text="${escAttr(effect.description)}" data-ui-tip-note="${escAttr(effect.duration)}">[[icon:${escAttr(effect.icon)}]] ${esc(effect.name)} ${esc(effect.duration)}</span>`).join(' '));
806:     // 状态挂件（P2）：玩家自己被冰冻时同样点亮常驻状态光
807:     selfUnit.classList.toggle('fx-frozen', (pstat.status.freeze || 0) > 0);
```

原行号 992–1004：

```text
992:       const simpleAttack = intents.length === 1 && intents[0].label === '攻击'
993:         && intents[0].damage === Math.max(0, f.atk || 0) && intents[0].hits === 1 && !intents[0].bleedBonus;
994:       const attackStat = simpleAttack ? '' : `<span class="sts-stat">[[icon:swords]] 攻 ${f.atk}${f.affix === 'frenzy' ? '×2' : ''}</span>`;
995:       setSection(parts.stats, sig, 'stats', `${attackStat}${immune ? '<span class="sts-stat">[[icon:crystal]] 庇幕免伤中</span>' : ''}`);
996:       // 反馈1021·10：状态诅咒/祝福与词缀之外，标记类负面状态此前一个角标都不出——
997:       // 腐化之种（deathBurst）与灵魂契约（damageEcho / soulContractMarked）在运行时被
998:       // 明确当作「已标记」参与结算，视图却只认 rotSeedMarked，敌人身上看不出挂了什么。
999:       const echoMark = f.damageEcho || (f.soulContractMarked ? { amount: 2 } : null);
1000:       setSection(parts.chips, sig, 'chips', (aff ? `<span class="bt-affix" data-term="${f.affix}">${aff.icon} ${aff.name}</span>` : '')
1001:         + (f.rotSeedMarked || f.deathBurst ? '<span class="bt-affix" title="死亡时，对所有敌人造成等同于此时中毒层数的真实伤害">[[icon:skull]] 腐化标记</span>' : '')
1002:         + (echoMark ? `<span class="bt-affix">[[icon:sparkles]] 契约回响 ${+echoMark.amount || 2}</span>` : '')
1003:         + curseChips(f.status, { compact: true }));
1004:       sig.init = true;
```

<a id="d04"></a>
## D04 · game/css/battle-stage.css

对应冻结摘录 P10；SHA256 `c0d2aa6aa74b7d0a62ca83e8e2adbae94b41b55bb138253add89e0443a4161df`

原行号 66–85：

```text
66: #overlay .battle-stage.sts .sts-me>.sts-unit-vitals{width:264px;max-width:none}
67: #overlay .battle-stage.sts .sts-ally>.sts-unit-vitals{width:180px}
68: #overlay .battle-stage.sts .sts-stats{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:4px 10px;margin-top:0;font-size:22px;color:#eef2ef;line-height:1.3}
69: #overlay .battle-stage.sts .sts-stats>.sts-stat{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-size:20px}
70: #overlay .battle-stage.sts .sts-stat>span{font-size:18px;color:#bfd2dc}
71: #overlay .battle-stage.sts .sts-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;font-size:18px}
72: #overlay .battle-stage.sts .sts-equips{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;font-size:18px}
73: #overlay .battle-stage.sts .sts-equip{background:#192e3bbd;color:#d1dce3;padding:3px 6px;border:1px solid #a4bdca30;cursor:help}
74: #overlay .battle-stage.sts .sts-intent{position:absolute;bottom:calc(100% + 20px);left:50%;translate:-50% 0;display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;width:auto;max-width:none;padding:8px 12px;margin:0;border:1px solid #a7c1cb66;border-radius:0;background:var(--battle-glass);backdrop-filter:blur(14px);color:#ffc3ac;box-shadow:none;font-size:24px;font-weight:600;line-height:1.35;cursor:help;z-index:11}
75: #overlay .battle-stage.sts .sts-nameplate:has(>.sts-stats:empty):has(>.sts-chips:empty)>.sts-intent{padding:0;margin:0;border-top:0}
76: #overlay .battle-stage.sts .bt-intent-part{display:inline-grid;grid-template-columns:26px minmax(0,1fr);align-items:center;gap:3px 7px;max-width:100%;white-space:normal}
77: #overlay .battle-stage.sts .bt-intent-short{display:contents}
78: #overlay .battle-stage.sts .bt-intent-action{grid-column:2;white-space:nowrap}
79: #overlay .battle-stage.sts .bt-intent-part+.bt-intent-part{margin-left:0}
80: #overlay .battle-stage.sts .bt-intent-detail{display:none;position:absolute;top:calc(100% + 10px);left:-12px;right:-12px;max-height:240px;overflow:auto;box-sizing:border-box;padding:12px;border:1px solid var(--battle-line);border-radius:4px;background:#142733fa;color:#d9e5eb;box-shadow:0 8px 20px #08152152;font-size:20px;font-weight:400;line-height:1.45;white-space:normal}
81: #overlay .battle-stage.sts .sts-intent:is(:hover,:focus-visible,.is-open) .bt-intent-detail{display:block}
82: #overlay .battle-stage.sts .sts-intent:is(:hover,:focus-visible,.is-open){color:#ffdbc9}
83: #overlay .battle-stage.sts .sts-intent .ic{flex:none;width:26px;height:26px}
84: #overlay .battle-stage.sts .can-target:not(.dead){cursor:crosshair}
85: #overlay .battle-stage.sts .drag-over:not(.dead){outline:none}
```

原行号 170–202：

```text
170: #overlay .battle-stage.sts>.sts-topbar>.bt-potions{position:relative;grid-column:1;grid-row:2;top:auto;left:0;transform:none;z-index:13;display:flex;gap:8px;align-items:center;max-width:420px;margin:0;padding:0;background:none;border:0}
171: #overlay .battle-stage.sts .bt-potion{position:relative;display:flex;gap:8px;align-items:center;padding:10px 14px;border:1px solid #ffffff66;background:#090c10;color:#fff;font-size:18px;cursor:pointer}
172: #overlay .battle-stage.sts .bt-potion.off{opacity:.5;cursor:default}
173: #overlay .battle-stage.sts .bt-potions-label{font-size:12px;color:#fff;background:#090c10;border-color:#ffffff66;text-shadow:none}
174: #overlay .battle-stage.sts .bt-potion .bt-potion-n{color:#fff}
175: #overlay .battle-stage.sts .ic{width:1.2em;height:1.2em;object-fit:contain;vertical-align:middle}
176: #overlay .battle-stage.sts button:focus-visible,#overlay .battle-stage.sts [role="button"]:focus-visible{outline:2px solid #d2eef5;outline-offset:3px}
177: @media(prefers-reduced-motion:reduce){#overlay .battle-stage.sts .bt-card,#overlay .battle-stage.sts .sts-hp-main,#overlay .battle-stage.sts .sts-hp-ghost{transition:none}}
178: 
179: /* Printed card names remain part of the shared face; battle adds no duplicate strip. */
180: #overlay .battle-stage.sts .bt-card[data-hand-state="selected"]{outline:2px solid #c8e8f0;outline-offset:3px}
181: 
182: #overlay .battle-stage.sts .bt-slot:has(.click-selected){z-index:95}
183: #overlay .battle-stage.sts .bt-card.click-selected:not(.aim-lift){transform:translateY(0)}
184: #overlay .battle-stage.sts[data-phase="enemy"] .bt-turn-forecast{visibility:hidden}
185: 
186: /* Blur is limited to fixed controls; dragged cards and the painted world stay sharp. */
187: #overlay .battle-stage.sts :is(.sts-encounter,.sts-options>summary,.sts-tactics,.bt-pile,.bt-slam-btn,.sts-unit-vitals){backdrop-filter:blur(14px) saturate(115%);box-shadow:var(--battle-glass-shadow)}
188: /* The left resource column is unframed; local scope leaves the right-side controls intact. */
189: body #overlay .card.battle .battle-stage.sts .sts-resource-dock :is(.sts-hud-l>.bt-pile,.bt-hand-page,.sts-energy-wrap){border:0;border-radius:0;background:none;box-shadow:none;backdrop-filter:none;clip-path:none;color:#e6eeea}
190: body #overlay .card.battle .battle-stage.sts .sts-resource-dock .sts-hud-l .bt-pile>:is(b,.bt-pile-cap){color:inherit}
191: body #overlay .card.battle .battle-stage.sts .sts-resource-dock{--battle-resource-icon:48px;--battle-resource-number:36px}
192: body #overlay .card.battle .battle-stage.sts .sts-resource-dock :is(.sts-hud-l>.bt-pile,.sts-energy,.battle-hand-page-position){display:grid;grid-template-columns:var(--battle-resource-icon) minmax(0,1fr);align-items:center;column-gap:14px;width:100%;min-height:54px;box-sizing:border-box;padding:0;font-size:var(--battle-resource-copy);line-height:1.2;text-align:left}
193: body #overlay .card.battle .battle-stage.sts .sts-resource-dock :is(.bt-pile-cap){font-size:var(--battle-resource-copy);font-weight:400;font-style:normal;line-height:1.2}
194: body #overlay .card.battle .battle-stage.sts .sts-resource-dock .sts-hud-l>.bt-pile>b{grid-column:2;grid-row:1;font-size:var(--battle-resource-number);font-weight:600;line-height:1.2;text-align:right}
195: body #overlay .card.battle .battle-stage.sts .sts-resource-dock .sts-hud-l>.bt-pile>.bt-pile-cap{grid-column:2;grid-row:1}
196: body #overlay .card.battle .battle-stage.sts .sts-resource-dock :is(.battle-control-icon,.bt-pilecard){align-self:center;display:grid;place-items:center;flex:none;width:var(--battle-resource-icon);height:var(--battle-resource-icon);margin:0;object-fit:contain}
197: body #overlay .card.battle .battle-stage.sts .sts-resource-dock .bt-pilecard{grid-column:1;grid-row:1}
198: body #overlay .card.battle .battle-stage.sts .sts-resource-dock .bt-pilecard .hs-back{width:34px;height:48px;margin:0}
199: body #overlay .card.battle .battle-stage.sts .sts-resource-dock .battle-control-icon .ic{width:100%;height:100%;object-fit:contain}
200: body #overlay .card.battle .battle-stage.sts .sts-resource-dock .battle-control-value{display:inline-flex;align-items:baseline;justify-content:flex-end;white-space:nowrap;font-size:var(--battle-resource-number);line-height:1.2;font-variant-numeric:tabular-nums}
201: body #overlay .card.battle .battle-stage.sts .sts-resource-dock .battle-control-value>b{font:600 var(--battle-resource-number)/1.2 var(--font-ui,sans-serif)}
202: body #overlay .card.battle .battle-stage.sts .sts-resource-dock .battle-control-value>span{font-size:20px;color:#a8c0ca}
```

<a id="d05"></a>
## D05 · game/css/card-layout-selected.css

对应冻结摘录 P11；SHA256 `6e862d463e31292e1fff586f5ac5f50d13a344683ab38452bafe7d79c1835cef`

原行号 1–20：

```text
1: /* Shared card face. Hosts own width, placement, selection and drag behaviour only. */
2: /* Painted frame artwork is the card edge. Hosts must never add a rectangular rim,
3:    including hover, focus, selection and acquisition states. Keep border space so
4:    removing its paint does not change the card's placement or hit target. */
5: body :is(.hs-card,.bt-card,.bag-tile.card-face,.reward-card,.sac-card,.dep-card,
6:   .battle-pile-card,.infusion-card-face,
7:   .lib-cardwrap:not(.studio-photo),.reward-acquisition-arrival,
8:   :has(> .hs-card[data-card-layout="split"])) {
9:   outline:none!important; border-color:transparent!important; box-shadow:none!important;
10: }
11: body :is(.hs-card,.bt-card,.bag-tile.card-face,.reward-card,.sac-card,.dep-card,
12:   .battle-pile-card,.infusion-card-face,
13:   .lib-cardwrap:not(.studio-photo),:has(> .hs-card[data-card-layout="split"])):focus-visible {
14:   filter:brightness(1.08);
15: }
16: @font-face {
17:   font-family: 'Card Oxanium';
18:   src: url('../assets/fonts/oxanium-latin-700-normal.woff2') format('woff2');
19:   font-weight: 700; font-display: swap;
20: }
```

原行号 114–122：

```text
114: .hs-card[data-card-layout="split"] .hsc-desc .d-num { color: var(--paper-pigment); font-weight: 700; }
115: .hs-card[data-card-layout="split"] .hsc-desc .d-term { color: inherit; font-weight: 400; }
116: .hs-card[data-card-layout="split"] .hsc-desc .d-term[data-term] { color: var(--card-copy-term); font-weight: 600; }
117: .hs-card[data-card-layout="split"] .hsc-desc .d-kw { color: var(--card-copy-keyword); font-weight: 700; }
118: .hs-card[data-card-layout="split"] .hsc-desc:focus-visible { outline: 1px solid #b8d4e0; outline-offset: 2px; }
119: .hs-card[data-card-layout="split"] .hsc-desc .bt-rulehint { display: block; margin-top: .35em; color: #805511; font-weight: 700; }
120: .hs-card[data-card-layout="split"] .hsc-type {
121:   position: absolute; inset: 53% 2px auto; transform: translateY(-50%); z-index: 6;
122:   height: 10.77cqw; display: flex; align-items: center; justify-content: center;
```

<a id="d06"></a>
## D06 · game/src/battle/view/battle.vfx.js

对应冻结摘录 P26；SHA256 `63173629e67355a31031b512b4bae2969f13cba3f7b53f4466644d3bb31fc12b`

原行号 248–263：

```text
248:   function spawnFloats(body, baseDelay = 0) {
249:     const list = takeFloats();
250:     const supportAction = takeCardAction(body, list);
251:     if (supportAction) playUnitFrames(supportAction);
252:     if (!list.length) return;
253:     const ov = UI.el.overlay;
254:     const ovR = uiRect(ov);   // 布局口径：飘字/贴图定位
255:     const perUnit = {};   // #19：同单位多段伤害错峰呈现
256:     const damageBeatCounts = new Map();
257:     let previousDue = 0;
258:     const stagedHealth = new Set();
259:     list.forEach((f) => {
260:       if (f.hpBefore == null) return;
261:       const key = String(f.unit);
262:       damageBeatCounts.set(key, (damageBeatCounts.get(key) || 0) + 1);
263:     });
```

原行号 379–413：

```text
379:           span.appendChild(label);
380:         }
381:         span.appendChild(document.createTextNode(f.text));
382:       }
383:       // 活跃文字占用四个相邻槽位；多段结算仍沿原队列，不以动画结束阻塞规则。
384:       const used = new Set(Array.from(/** @type {NodeListOf<BattleElement>} */ (ov.querySelectorAll('.sts-float[data-feedback-unit]')))
385:         .filter(el => el.dataset.feedbackUnit === String(f.unit)).map(el => Number(el.dataset.feedbackLane)));
386:       const lane = [0, 1, 2, 3].find(index => !used.has(index)) ?? 0;
387:       const [dx, dy] = [[-38, 0], [38, 0], [-20, -32], [20, -32]][lane];
388:       span.dataset.feedbackLane = String(lane);
389:       const x = r.left - ovR.left + r.width / 2 + dx;
390:       const y = r.top - ovR.top + r.height * (stk ? 0.12 : 0.34) + dy;
391:       span.style.left = Math.max(54, Math.min(ovR.width - 54, x)) + 'px';
392:       span.style.top = Math.max(35, Math.min(ovR.height - 35, y)) + 'px';
393:       ov.appendChild(span);
394:       if (damage && !reduced && span.animate) {
395:         span.classList.add('phys');   // 抑制 CSS 上飘动画，走抛体
396:         physicsFloat(span, { longLife: finisher || amt >= 10 });   // W5-04：终结/重击跳字加长寿命
397:         schedulePresentation(() => span.remove(), finisher || amt >= 10 ? 1200 : 900);
398:       } else {
399:         span.addEventListener('animationend', () => span.remove(), { once: true });
400:         schedulePresentationMs(() => span.remove(), 1400);   // CSS 动画不按倍速缩短，兜底也保持原时长
401:       }
402:       await globalHitStop(stopMs, signal);
403:       };
404:       const due = baseDelay + (f.delay || 0) + feedbackDelay(f.unit, perUnit, demoMs(FEEDBACK_DELTA_MS));   // 同单位多段按节拍错开
405:       const gap = Math.max(0, due - previousDue);
406:       previousDue = Math.max(previousDue, due);
407:       enqueueFeedback(async signal => {
408:         if (!body.isConnected) return;   // 弹层重建已换 ovBody：旧节点全零矩形，残余反馈直接丢弃（防错位闪现在左上角）
409:         const isSelf = f.unit === 'self';
410:         const allyI = isSelf ? null : (/^ally:(\d+)$/.exec(String(f.unit)) || [])[1];
411:         const fig = isSelf
412:           ? /** @type {BattleElement} */ (body.querySelector('#btSelf .sts-figure'))
413:           : allyI != null
```

<a id="d07"></a>
## D07 · game/src/ui/run-top-bar.js

对应冻结摘录 P27；SHA256 `e8f8bf130135dd1d20f872f4c948e2c8a944d392780f544ebd20c872468e973f`

原行号 11–33：

```text
11: export function configureRunTopBar(UI, actions) {
12:   configurations.set(UI, actions);
13:   const doc = actions.document || document;
14:   for (const id of ['btnHome', 'btnMute']) {
15:     const button = doc.getElementById(id);
16:     if (!button) continue;
17:     const bound = actionOwners.has(button);
18:     actionOwners.set(button, UI);
19:     if (bound) continue;
20:     button.addEventListener('click', event => {
21:       event.stopPropagation();
22:       const current = configurations.get(actionOwners.get(button));
23:       if (id === 'btnHome') current?.openLeaveMenu?.();
24:       else {
25:         const sound = current?.readSound?.();
26:         if (sound) sound.setMuted(!sound.muted);
27:         button.classList.toggle('muted', !!sound?.muted);
28:         button.setAttribute('aria-pressed', String(!!sound?.muted));
29:       }
30:       mounted.get(UI)?.syncMute();
31:     });
32:   }
33:   mounted.get(UI)?.syncMute();
```

原行号 72–101：

```text
72: export function installRunTopBar(UI) {
73:   if (mounted.get(UI)?.bar.isConnected) return mounted.get(UI);
74:   const doc = UI.el?.viewport?.ownerDocument || document;
75:   const bar = doc.createElement('header');
76:   bar.id = 'runTopBar'; bar.className = 'run-topbar';
77:   bar.setAttribute('aria-label', '远征状态与系统');
78:   const actions = doc.createElement('nav'); actions.className = 'run-top-actions'; actions.setAttribute('aria-label', '系统操作');
79:   const person = doc.createElement('div'); person.className = 'run-top-person';
80:   const resources = doc.createElement('div'); resources.className = 'run-top-resources';
81:   const secondary = doc.createElement('div'); secondary.className = 'run-top-secondary';
82:   const move = (id, parent, action) => {
83:     const node = doc.getElementById(id);
84:     if (node) { parent.append(node); if (action) node.dataset.runAction = action; }
85:     return node;
86:   };
87:   move('btnHome', actions, 'leave'); move('btnMute', actions, 'mute');
88:   const optionsButton = doc.createElement('button');
89:   optionsButton.id = 'btnBattleOptions'; optionsButton.type = 'button'; optionsButton.hidden = true;
90:   optionsButton.innerHTML = '<span aria-hidden="true">☷</span><span>选项</span>';
91:   optionsButton.setAttribute('aria-expanded', 'false'); actions.append(optionsButton);
92:   optionsButton.setAttribute('aria-controls', 'battleOptionsMenu');
93:   move('heroAva', person, 'character'); move('hpHud', person);
94:   move('resHud', resources);
95:   const gold = resources.querySelector('.res-gold'), attack = resources.querySelector('.res-atk');
96:   if (gold) gold.dataset.runAction = 'gold';
97:   if (attack) attack.dataset.runAction = 'attack';
98:   move('expeditionChapter', person);
99:   const status = doc.createElement('div'); status.id = 'saveStatus'; status.className = 'save-status';
100:   status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
101:   status.innerHTML = '<span data-save-label>尚未保存</span><button type="button" data-run-action="retry" data-save-retry hidden>重试保存</button>';
```

<a id="d08"></a>
## D08 · game/src/core/icons-bitmap.js

对应冻结摘录 P24；SHA256 `f25ed965369102f88a84e11bcb4fa751c8e369944f97933580ef8396a04db37a`

原行号 8–53：

```text
8:   const ROOT = 'assets/ui/icons/';
9:   const NAMES = new Set('altar heart broken coin pouch sword swords bag dice upload download book cards home fire skull gem lantern key lock unlock crystal trash door exit tools pocket broom wood bread trophy paw map notes medal shield plate blood flask scroll save helmet question sparkles bolt recycle check cross arrow play skip hourglass gear pen folder archive mouse flag slime demon runner'.split(' '));
10:   const missingKeys = new Set();
11:   function reportMissing(kind, key) {
12:     const label = `${kind}:${String(key || '(empty)')}`;
13:     if (!missingKeys.has(label)) {
14:       missingKeys.add(label);
15:       console.error(`[SDT.Icons] missing bitmap: ${label}`);
16:     }
17:   }
18:   // W5-08（0926）：语义别名——chart/info 尚无专属位图，映射到现有位图消灭 missing bitmap
19:   // 空缺（跑局数据页头/终局结算提示）；零新素材，后续专属图出图后在此改指向即可。
20:   const ALIAS = { chart: 'archive', info: 'scroll' };
21:   function safe(name) { name = ALIAS[name] || name; if (NAMES.has(name)) return name; reportMissing('icon', name); return 'question'; }
22:   // 金币货币图标统一使用地图资源栏同源美术（2026-10-15 老板指示），不再走 icons/coin.png。
23:   const COIN_ART_URL = assetUrl('assets/ui/map-hud-1015/gold-is7-v2.webp');
24:   const ALTAR_ART_URL = assetUrl('assets/scenes/map-nodes/altar-symbol-1017-v2.webp');
25:   function url(name) { return safe(name) === 'altar' ? ALTAR_ART_URL : safe(name) === 'coin' ? COIN_ART_URL : assetUrl(`${ROOT}${safe(name)}.png`); }
26:   function img(name, cls, alt) { const n=safe(name); if(n==='altar') return `<span class="ic${cls?' '+esc(cls):''}" role="img" aria-label="${esc(alt||'祭坛')}" data-asset-key="icon-altar" style="position:relative;display:inline-block;overflow:hidden;filter:none"><img src="${url(n)}" alt="" draggable="false" loading="eager" decoding="async" style="position:absolute;left:-37.1%;top:-39.6%;width:171.3%;height:171.3%;max-width:none;max-height:none;object-fit:fill;filter:none"></span>`; return `<img class="ic${cls?' '+esc(cls):''}" src="${url(n)}" alt="${esc(alt||n)}" data-asset-key="icon-${esc(n)}" draggable="false" loading="eager" decoding="async">`; }
27: 
28:   const MAP = Object.create(null);
29:   const add = (name, codes) => codes.forEach(code => { MAP[String.fromCodePoint(code)] = name; });
30:   add('heart',[0x2764,0x1f49a,0x1f497,0x1f494,0x1f496,0x1f691]); add('coin',[0x1fa99,0x1f4b0,0x1f4b8]);
31:   add('sword',[0x1f5e1]); add('swords',[0x2694,0x1f3f9,0x1f3af]); add('bag',[0x1f392,0x1f6d2]); add('dice',[0x1f3b2]);
32:   add('upload',[0x1f4e4]); add('download',[0x1f4e5]); add('book',[0x1f4da]); add('cards',[0x1f3b4,0x1f0cf]); add('home',[0x1f3e0,0x1f3d5]);
33:   add('fire',[0x1f525,0x1f4a5]); add('skull',[0x1f480,0x2620,0x1faa6]); add('gem',[0x1f48e]); add('lantern',[0x1f4a1]);
34:   add('key',[0x1f511,0x1f5dd]); add('lock',[0x1f512]); add('unlock',[0x1f513]); add('crystal',[0x1f52e,0x1f537]);
35:   add('trash',[0x1f5d1]); add('door',[0x1f6aa]); add('exit',[0x1f681]); add('tools',[0x1f6e0,0x1f528,0x26d3,0x1f9f0]);
36:   add('pocket',[0x1f9f3,0x1f45d]); add('broom',[0x1f9f9]); add('wood',[0x1fab5,0x1f33f]); add('bread',[0x1f35e]); add('trophy',[0x1f3c6]);
37:   add('paw',[0x1f43e,0x1f415]); add('map',[0x1f5fa]); add('notes',[0x1f4dd]); add('medal',[0x1f396,0x1f3c5]);
38:   add('shield',[0x1f6e1]); add('plate',[0x1faa8]); add('blood',[0x1fa78]); add('flask',[0x1f9ea,0x2697]); add('scroll',[0x1f4dc]);
39:   add('save',[0x1f4be]); add('helmet',[0x1f9b8]); add('question',[0x2754,0x2753,0x1f50d]); add('sparkles',[0x2728,0x1f31f,0x1f30c,0x1f4ab,0x2b50]);
40:   add('bolt',[0x26a1]); add('recycle',[0x267b,0x1f504,0x1f500]); add('check',[0x2714,0x2705]); add('cross',[0x2715,0x274c,0x1f6ab,0x1f910]);
41:   add('arrow',[0x27a1,0x1f4c8,0x1f4c9]); add('play',[0x25b6]); add('skip',[0x23ed]); add('hourglass',[0x23f3,0x231b]);
42:   add('gear',[0x2699,0x1f50a,0x1f4e1]); add('pen',[0x2712,0x270e]); add('folder',[0x1f4c1]); add('archive',[0x1f5c2,0x1f5c3,0x1f4e6]);
43:   add('mouse',[0x1f5b1]); add('flag',[0x1f3f3]); add('slime',[0x1f47e]); add('demon',[0x1f479,0x1f608,0x1f409]); add('runner',[0x1f3c3,0x1f47b,0x1f4a8]);
44:   add('question',[0x26a0,0x267e,0x221e,0x1f4cc]); add('crystal',[0x2744]);
45: 
46:   const EMOJI_RE = /(?:[\uD83C-\uDBFF][\uDC00-\uDFFF](?:\uFE0F|\u200D[\s\S])?|[\u2300-\u27BF]\x75FE0?|[\u2B00-\u2BFF]\x75FE0?)/g;
47:   const ICON_TOKEN_RE = /\[\[icon:[a-z-]+\]\]/;
48:   function hasTokens(text) {
49:     EMOJI_RE.lastIndex = 0;
50:     return EMOJI_RE.test(text) || ICON_TOKEN_RE.test(text);
51:   }
52:   function rich(html) {
53:     if (!html) return html;
```

<a id="d09"></a>
## D09 · game/src/battle/view/battle.piles.view.js

SHA256 `e4c3293af451170eac93c918a375b1d7214d761e398fb5d5663019aa6b00242b`

原行号 1–21：

```text
1: export const BATTLE_CONSUMED_LABEL = '消耗牌堆';
2: import { readConsumedPile } from '../bag/battle.consumed-pile.js';
3: export const consumedPileUids = snapshot => snapshot.consumedPile || readConsumedPile(snapshot);
4: 
5: /* 牌堆视图适配：只负责牌堆徽标 HTML，不参与牌堆逻辑。 */
6: 
7: function renderPileBadge({ className = '', dataAct = '', title = '', count = 0, cardBackHTML = '', suffix = '', cap = '' }, escAttr) {
8:   const safeTitle = typeof escAttr === 'function' ? escAttr(title) : title;
9:   // 数量附带牌堆名称；旧动作名仅用于兼容现有点击入口。
10:   const tag = dataAct ? 'button' : 'span';
11:   return `<${tag}${dataAct ? ` type="button" data-act="${dataAct}" aria-label="${safeTitle}"` : ''} class="bt-pile${className ? ` ${className}` : ''}"><span class="bt-pilecard" aria-hidden="true">${cardBackHTML}</span>${suffix}<b>${count}</b>${cap ? `<i class="bt-pile-cap">${cap}</i>` : ''}</${tag}>`;
12: }
13: 
14: function renderCombatPiles({ mode, drawCount, graveCount, pileTip, cardBackHTML, escAttr }) {
15:   const draw = renderPileBadge({ className:'clickable', dataAct:'btDeck', title:mode === 'boss' ? `牌库：${pileTip(drawCount)}（点击查看）` : `牌库：${drawCount.length} 张（仅抽牌效果取牌，回合开始不抽牌；点击查看）`, count:drawCount.length, cardBackHTML }, escAttr);
16:   const grave = renderPileBadge({ className:'clickable', dataAct:'btGrave', title:`${BATTLE_CONSUMED_LABEL}：${pileTip(graveCount)}（不自动洗回，仅由卡牌效果取回；点击查看）`, count:graveCount.length, cardBackHTML:`<span class="down">${cardBackHTML}</span>`, suffix:'[[icon:skull]] ', cap:BATTLE_CONSUMED_LABEL }, escAttr);
17:   return { draw, rest:grave };
18: }
19: 
20: export { renderCombatPiles };
21: 
```

<a id="d10"></a>
## D10 · game/src/battle/view/battle.overlays.js

SHA256 `d75a029d6fd44cae3428189dc76ddb3e05044e35461dbde539c22bdc061aabb3`

原行号 78–95：

```text
78:     const cards = consumedPileUids(snapshot).map(findCard).filter(Boolean);
79:     const { html, stacks } = battlePileBodyHTML({ cards, cardHTML:SDT.Cards.cardHTML, kind:'grave', isBoss:!!snapshot.opts.isBoss });
80:     showBattleDecision(`[[icon:skull]] ${BATTLE_CONSUMED_LABEL}`, html, true, snapshot);
81:     bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btGraveBack', closeGrave);
82:     bindBattleDecisionInspection({ UI, getSnapshot, cards:stacks.map(stack => stack.card), snapshot });
83:     UI.refresh(SDT.game);
84:   }
85: 
86:   // 两种战斗共用只读牌库网格；展示排序与实际抽牌顺序分离。
87:   function renderDeckPileView(snapshot) {
88:     const cards = snapshot.drawPile.map(findCard).filter(Boolean);
89:     const { html, stacks } = battlePileBodyHTML({ cards, cardHTML:SDT.Cards.cardHTML, kind:'deck', isBoss:!!snapshot.opts.isBoss });
90:     showBattleDecision('[[icon:cards]] 剩余牌库', html, true, snapshot);
91:     bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btDeckBack', closeDeckView);
92:     bindBattleDecisionInspection({ UI, getSnapshot, cards:stacks.map(stack => stack.card), snapshot });
93:     UI.refresh(SDT.game);
94:   }
95: 
```

<a id="d11"></a>
## D11 · game/css/base.css

SHA256 `7e5b5507e827ff0044dc9ec9681755f21e44975b26bcf33e5f5d39ac5d20f1d0`

原行号 114–120：

```text
114:   body.lobby #sidebar { display: none; }
115:   body.lobby #topBtns { display: none; }
116: 
117:   /* 位图图标统一尺寸 */
118:   .ic { width: 1.1em; height: 1.1em; vertical-align: -0.18em; }
119: 
120:   /* ---------------- 底部面板栏（原侧边栏终端） ---------------- */
```

原行号 167–173：

```text
167:   #topBtns > button:hover { color: #070809; background: var(--ak-white); }
168:   #topBtns #btnMute { font-size: 15px; }
169:   /* 静音状态用 class 切换两枚 SVG（hidden 属性对 SVG 不可靠） */
170:   #btnMute .ic-sound-off { display: none; }
171:   #btnMute.muted .ic-sound-on { display: none; }
172:   #btnMute.muted .ic-sound-off { display: block; }
173:   #topBtns #btnHome.exit-btn { border: none; }
```

原行号 244–247：

```text
244:     font-size: 12px; color: var(--sub); border: 1px solid var(--ak-line); border-left: 2px solid var(--ak-line-hi); border-radius: 0;
245:     padding: 5px 12px; background: rgba(8,9,11,.55); }
246:   .chip-mini .ic { width: 14px; height: 14px; vertical-align: -0.2em; }
247:   .chip-mini b { color: var(--ak-white); font-size: 14px; font-family: var(--font-num); font-weight: 700; }
```

<a id="d12"></a>
## D12 · game/src/battle/core/combat.factory.js

SHA256 `6316fc05cee543aec9d7bcf204252f77fb7a4d16ddbecb0e10769ade7d6a7825`

原行号 7–35：

```text
7:   // 诅咒状态表：bleed/poison 为叠层（无上限不衰减），其余为计时（共享回合钟：每回合结束统一递减）
8:   const COMBAT_HOOKS = {};   // 战斗层钩子（冰冻符文等）
9: const CURSES = ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'atkDown'];
10:   const CURSE_META = {
11:     bleed:   { name: '流血', icon: '[[icon:blood]]', stack: true,  desc: '每层使受到的攻击伤害 +1' },
12:     poison:  { name: '中毒', icon: '[[icon:skull]]', stack: true,  desc: '每层在回合结束时受到 1 点固定伤害' },
13:     freeze:  { name: '冰冻', icon: '[[icon:crystal]]', stack: false, desc: '1 回合无法行动' },
14:     silence: { name: '沉默', icon: '[[icon:cross]]', stack: false, desc: '1 回合技能无法生效（攻击除外）' },
15:     abreak:  { name: '破甲', icon: '[[icon:tools]]', stack: false, desc: '2 回合内无法减免伤害' },
16:     healban: { name: '禁疗', icon: '[[icon:heart]]', stack: false, desc: '2 回合内无法回复生命' },
17:     // M 批（2026-09-27）：攻击降低（割蚀「降低 2 攻，持续 3 回合」）——计时型共享回合钟；
18:     // 扣减量由战斗层挂诅咒时记在 target._atkDownAmount，到期由回合管线归还（影噬偷取同款）
19:     atkDown: { name: '攻击降低', icon: '[[icon:arrow]]', stack: false, desc: '持续期间攻击力降低，到期归还' },
20:   };
21: 
22:   // 祝福状态表（v0.20）：value=数值型（可叠加，本场战斗）；timed=计时型（共享回合钟递减）；
23:   // flag=开关型（本局对战常驻）
24:   const BUFFS = ['atkUp', 'spellUp', 'stealth', 'immune', 'reduce', 'dodge', 'swordForm', 'natureForm', 'cosmosForm'];
25:   const BUFF_META = {
26:     atkUp:      { name: '攻击强化', icon: '[[icon:swords]]', value: true, desc: '攻击伤害 +N（本场战斗）' },
27:     spellUp:    { name: '法术强化', icon: '[[icon:crystal]]', value: true, desc: '法术伤害 +N（本场战斗）' },
28:     stealth:    { name: '潜行', icon: '[[icon:runner]]', timed: true, desc: '无法成为被攻击对象；造成伤害会破除潜行' },
29:     immune:     { name: '免疫伤害', icon: '[[icon:sparkles]]', timed: true, desc: '不受到任何伤害' },
30:     reduce:     { name: '减伤', icon: '[[icon:plate]]', value: true, desc: '每次受到的伤害 -N（真实伤害除外）' },
31:     dodge:      { name: '闪避', icon: '[[icon:runner]]', value: true, desc: '避开下一段伤害（每层避开 1 段）' },
32:     swordForm:  { name: '剑仙形态', icon: '[[icon:sword]]', flag: true, desc: '回合开始时额外抽 1 张' },
33:     natureForm: { name: '满月形态', icon: '[[icon:wood]]', flag: true, desc: '回合开始时额外获得 1 点能量' }, // 2026-10-02 老板：形态更名「满月形态」（内部键 natureForm 保留）
34:     cosmosForm: { name: '宇宙形态', icon: '[[icon:sparkles]]', flag: true, desc: '本局对战所有卡牌变为 1 费' },
35:   };
```

<a id="d13"></a>
## D13 · game/src/ui/battle-hud-info.js

SHA256 `c34fd0b9534c99d539fe3a830018f1a2b2863d640d3477c5a508f4ea049a53b2`

原行号 1–21：

```text
1: import { escAttr } from '../core/shared.js';
2: import '../../css/battle-hud-clarity.css';
3: 
4: export function playerCombatStatValues(player, status = {}) {
5:   const atkBuff = status.atkUp || 0, spellBuff = status.spellUp || 0;
6:   const atk = (player.atk || 0) + atkBuff;
7:   const spell = (player.spellPower || 0) + spellBuff;
8:   return { atk, spell, atkBuff, spellBuff };
9: }
10: 
11: export function playerCombatStatsHTML(player, pdef, status) {
12:   const { atk, spell, atkBuff, spellBuff } = playerCombatStatValues(player, status);
13:   const stat = (label, icon, value, detail) => `<span class="sts-stat" tabindex="0" data-ui-tip data-ui-tip-title="${label}" data-ui-tip-text="${escAttr(detail)}">[[icon:${icon}]] ${label} ${value}</span>`;
14:   return stat('攻', 'swords', atk, `基础攻击 ${player.atk || 0}${atkBuff ? `，攻击强化 +${atkBuff}` : ''}`)
15:     + (spell > 0 ? stat('法伤', 'crystal', spell, `基础法伤 ${player.spellPower || 0}${spellBuff ? `，法术强化 +${spellBuff}` : ''}`) : '')
16:     + (pdef.shield ? `<span class="sts-stat">[[icon:shield]] 盾 ${pdef.shield}</span>` : '')
17:     + (pdef.guard ? '<span class="sts-stat">格挡中</span>' : '');
18: }
19: 
20: export function turnForecastHTML(forecast) {
21:   return `<p class="bt-turn-forecast${forecast.lethal ? ' lethal' : ''}" aria-live="polite"><span class="bt-forecast-damage">估算承伤 <b>${forecast.damage}</b></span><span class="bt-forecast-hp">余 <b>${forecast.hpAfter}</b> 生命</span>${forecast.lethal ? '<span class="bt-forecast-warning">可能致死</span>' : ''}</p>`;
```
