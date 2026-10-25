# Repeated icon consumers

492 matched lines; 105 files. Static candidates; not every branch is runtime verified.

## archive

- `game/src/hub/game.bag.settle.js:120` UI.log(\`[[icon:archive]] ${why}：<b>${moved.length}</b> 张卡牌进入消耗区，复原后可再用\`, 'sys');
- `game/src/hub/game.bag.settle.js:171` <span class="at-node"><span class="at-ico">[[icon:archive]]</span><b>多开箱</b></span>
- `game/src/hub/game.bag.settle.js:352` UI.log(\`[[icon:archive]] 事件奖励：<b>${esc(loot.text)}</b>\`, 'loot');
- `game/src/hub/game.bag.settle.js:356` UI.log(\`[[icon:archive]] 事件奖励：<b>${esc(loot.text)}</b>\`, 'loot');
- `game/src/hub/game.bag.settle.js:445` UI.log(\`[[icon:archive]] 战利品掉落：${SDT.Chests.dropText(all)}\`, 'loot');
- `game/src/hub/game.hub.pages.js:264` if (B.stashRoom() + 1 < 5) { UI.log(\`[[icon:archive]] 仓库空位不足 4 格（现 ${B.stashRoom()}；拆包另释放 1 格）——先卖出或扩建仓库再拆包\`, 'warn'); return; }
- `game/src/hub/game.hub.runtime.js:307` UI.log(\`[[icon:archive]] 仓库扩建完成：容量 <b>${B.stashCap()}</b> 张（- [[icon:wood]]×${MAP.rules.stashUpgradeWood}）\`, 'ok');
- `game/src/hub/game.hub.runtime.js:325` else if (r === 'full') UI.log(\`[[icon:archive]] 仓库容量不足（${B.stashUsed()}/${B.stashCap()} 张），先卖出或升级仓库\`, 'warn');
- `game/src/hub/game.hub.runtime.js:357` else if (r && /** @type {typeof r & {why?:string,cost?:number}} */ (r).why === 'full') UI.log(\`[[icon:archive]] ${r.msg}\`, 'warn');
- `game/src/hub/hub.facilities.js:12` { id: 'stash', icon: 'archive', name: '基地仓库', unit: '格', have: base.stashCap(), max: rules.stashMax, slots: rules.stashUpgradeSlots, cost: rules.stashUpgradeWood, can: base.canUpgradeStash(), act: 'upStash', note: '卡牌每张、符文每块各占一个仓库格。' },
- `game/src/run/chests.js:327` if (out.some(c => c.isClass)) UI.log('[[icon:archive]] 出现黑色<b>职业宝箱</b>——只掉落职业卡牌！', 'loot');
- `game/src/run/chests.js:526` UI.showOverlay('[[icon:archive]] 奖励总览', chestRewardFrameHTML({ overview:overviewHTML() }), 'chest', {
- `game/src/run/chests.js:580` UI.showOverlay(\`[[icon:archive]] 开启${K.name}\`, chestRewardFrameHTML({ overview:overviewHTML(), picker:opening, label:'开启宝箱' }), 'chest');
- `game/src/run/chests.js:682` UI.showOverlay(\`[[icon:archive]] ${cur.battleSummary ? '搜刮！战斗胜利 · ' : '收获 · '}${cur.isClass ? '职业·' : ''}${K.name} · 第 ${idx} / ${queue.length}\`, body, 'chest');
- `game/src/run/game-session-departure.js:183` if (loaded) log(\`[[icon:archive]] 从基地仓库携带 <b>${loaded}</b> 张卡牌出征\`, 'loot');
- `game/src/run/game-session-restoration.js:176` readUI().log('[[icon:archive]] 已恢复揭晓的宝箱奖励，内容与已领取进度不变', 'ok');
- `game/src/run/game.run.altar.js:832` UI.log(\`[[icon:archive]] ${label}：<b>${saved.count}</b> 张已放入仓库（仓库余 ${B.stashRoom()} 格）\`, 'loot');
- `game/src/run/game.run.scenes.js:499` UI.log(\`[[icon:archive]] ${text || '回收了' + SDT.Chests.dropText(chests)}\`, 'loot');
- `game/src/run/game.run.scenes.js:539` UI.log(\`[[icon:archive]] 获得卡牌【<b>${esc(tpl.name)}</b>】\`, 'loot');
- `game/src/ui/extraction-rewards-view.js:40` return \`<div class="exr-capacity"><div><span>[[icon:archive]] 仓库容量</span><strong>${used}<small> / ${cap} 张</small></strong></div><div class="exr-meter" role="meter" aria-label="仓库容量" aria-valuemin="0" aria-valuemax="${cap}" aria-valuenow="${used}"><i style="width:${percent}%"></i></div><p>${room ? \`还能入库 <b>${room}</b> 张\` : '仓库已满'}</p></div>\`;
- `game/src/ui/extraction-rewards-view.js:84` <div class="exr-card-scroll"><div class="exr-card-grid">${remaining ? cardGrid(remainingCards, { cardHTML, rarityOf, action: 'exInspect', pending: true, room, broughtByName }) : \`<div class="exr-empty"><span>[[icon:archive]]</span><h3>${saved ? '卡牌已妥善入库' : '本次没有待入库卡牌'}</h3></div>\`}</div>
- `game/src/ui/extraction-rewards-view.js:89` <div class="exr-sidebar-scroll"><section class="exr-resource-block"><h3>[[icon:archive]] 资源已入库</h3>${resourcesHTML(wood, rations)}</section>
- `game/src/ui/extraction-rewards-view.js:112` <div class="exr-card-scroll"><div class="exr-card-grid">${savedCards.length ? cardGrid(savedCards, { cardHTML, rarityOf, action: 'exDoneInspect' }) : '<div class="exr-empty"><span>[[icon:archive]]</span><h3>本次没有卡牌入库</h3></div>'}</div></div>
- `game/src/ui/extraction-rewards-view.js:115` <section class="exr-resource-block"><h3>[[icon:archive]] 资源已入库</h3>${resourcesHTML(net.wood ?? 0, net.rations ?? 0)}</section>
- `game/src/ui/fire-rest-view.js:14` <button type="button" class="fire-rest-option${restoreUsed ? ' is-used' : ''}" data-act="fireRestore" data-fire-preview="${esc(restoreLabel)} · 消耗区 ${restorable} 张可复原" aria-describedby="fire-effect-preview"${restoreUsed || !restorable || !fits ? ' disabled' : ''}><span class="fire-option-icon" aria-hidden="true">[[icon:archive]]</span><span class="fire-option-copy"><b>复原卡牌</b><small>${esc(restoreLabel)}</small></span><span class="fire-option-arrow" aria-hidden="true">${restoreUsed ? '✓' : '→'}</span></button>
- `game/src/ui/menu-slots.js:126` UI.log(\`[[icon:archive]] 已进入 <b>档位 ${slot}</b>（基地与进度独立保存到该档位）\`, 'sys');
- `game/data/achievements.json:63` "icon": "[[icon:archive]]",
- `game/data/map.json:350` "icon": "[[icon:archive]]",
- `game/data/map.json:359` "icon": "[[icon:archive]]",
- `game/data/scenes.json:46` "icon": "[[icon:archive]]",
- `game/css/page-shop.css:237` 图标由 game.hub.pages.js 内联 [[icon:coin]]/[[icon:archive]] 提供） */

## arrow

- `game/src/battle/core/battle.core.js:159` grow:   { icon: '[[icon:arrow]]', name: '军威',     desc: '每个回合结束时攻击力 +2' },
- `game/src/battle/core/battle.enemy-intent.js:6` dragon: ['[[icon:demon]]', '攻击·阶段效果'], general: ['[[icon:arrow]]', '攻击·回合末强化'],
- `game/src/battle/core/battle.enemy-phase.domain.js:381` instanceRuntime.G.log(\`[[icon:arrow]] <b>军威</b>：<b>${esc(foe.name)}</b> 攻击力增至 <b>${foe.atk}</b>\`, 'warn');
- `game/src/battle/core/battle.enemy-phase.domain.js:406` if (amount) instanceRuntime.G.log(\`[[icon:arrow]] <b>${esc(foe.name)}</b> 的攻击力恢复 ${amount} 点（现 ${foe.atk}）\`, foe.dead ? 'dim' : 'sys');
- `game/src/battle/core/battle.resolution.domain.js:305` log(\`[[icon:arrow]] <b>${esc(foe.name)}</b> 满足增伤条件，伤害增加（${before} → ${foeDamage}）\`, 'sys');
- `game/src/battle/core/battle.resolution.domain.js:452` if (i === 0) log(\`[[icon:arrow]] <b>${esc(foe.name)}</b> 血量过半，伤害增加 ${halfB[1]}%（→ ${foeDmg}）\`, 'sys');
- `game/src/battle/core/combat.factory.js:19` atkDown: { name: '攻击降低', icon: '[[icon:arrow]]', stack: false, desc: '持续期间攻击力降低，到期归还' },
- `game/src/battle/effects/effect-steps.audit.js:33` log(\`[[icon:arrow]] <b>夺取攻击</b>：${esc(t.name)} 攻击力 -${n}，你的攻击力 +${n}\`, 'sys');
- `game/src/battle/effects/effect-steps.damage.js:136` log(\`[[icon:arrow]] <b>${esc(t.name)}</b> 攻击力降低 ${m[2]} 点（当前 ${t.atk}）\`, 'sys');
- `game/src/battle/effects/effect-steps.m2.domain.js:125` deps.log(\`[[icon:arrow]] <b>${deps.esc(card.name)}</b>：${deps.esc(t.name)} 没有可偷取的攻击力\`, 'dim');
- `game/src/battle/effects/effect-steps.m2.domain.js:132` deps.log(\`[[icon:arrow]] <b>${deps.esc(card.name)}</b>：偷取 <b>${deps.esc(t.name)}</b> ${stolen} 点攻击力（${duration} 回合后归还）\`, 'sys');
- `game/src/hub/game.container-store.view.js:28` <div class="ov-btns"><button type="button" class="ov-btn ok" data-act="${prefix}Back" data-cancel="true" aria-label="收好${title}，返回背包">[[icon:arrow]] 返回背包</button></div></footer>
- `game/src/run/game.nest.js:269` ${here ? '[[icon:flag]] ' : done ? '[[icon:check]] ' : next ? '[[icon:arrow]] ' : ''}${i + 1}. ${esc(cell.name)}</button>\`;
- `game/src/ui/term-definitions.js:16` atkDown: { name: '攻击降低', icon: 'arrow', text: '持续期间攻击力降低，到期归还实际扣减的攻击力。' },
- `game/src/ui/term-definitions.js:38` grow:       { name: '军威',     icon: 'arrow',   text: '该敌人每个回合结束时攻击力 +2。' },

## bag

- `game/src/battle/bag/battle.bag.domain.js:137` instanceRuntime.G.log(\`[[icon:bag]] 使用道具【<b>${esc(card.name)}</b>】\`, 'sys');
- `game/src/battle/bag/battle.bag.domain.js:186` instanceRuntime.G.log(\`[[icon:bag]] 使用道具【<b>${esc(card.name)}</b>】${target ? \`→ ${esc(target.name)}\` : ''}\`, 'sys');
- `game/src/battle/bag/battle.bag.domain.js:369` instanceRuntime.G.log(\`[[icon:bag]] 使用道具【<b>${esc(card.name)}</b>】${target ? \`→ ${esc(target.name)}\` : ''}\`, 'sys');
- `game/src/battle/view/battle.overlays.js:139` showBattleDecision(\`${snapshot.opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · [[icon:bag]] 战斗背包\`, \`
- `game/src/hub/bag-container-pages.js:85` UI.log(\`[[icon:bag]] 背包放不下：本次整叠还需 ${result.delta} 格，请先腾出空间；珍珠盒额外格仅收资源卡\`, 'warn');
- `game/src/hub/bag-container-pages.js:160` UI.log(\`[[icon:bag]] 背包放不下：本次整叠还需 ${result.delta} 格（现 ${result.used}/${result.limit} 格），先腾出空间\`, 'warn');
- `game/src/hub/bag-container-pages.js:166` UI.log(\`[[icon:bag]] 【<b>${esc(stack.card.name)}</b>】×${stack.count} 从珍珠盒取出，回到背包\`, 'ok');
- `game/src/hub/bag-legacy-use.js:48` if (capacityWarning) UI.log(\`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()}），无法复原\`, 'warn');
- `game/src/hub/game.bag.js:387` UI.showOverlay('[[icon:bag]] 背包', markup, 'bagpage');
- `game/src/hub/game.bag.settle.js:173` <span class="at-node"><span class="at-ico">[[icon:bag]]</span><b>常逛商店</b></span>
- `game/src/hub/game.hub.depart.js:207` const capacityHtml = \`[[icon:bag]] 已装 <b>${slots}/${preview.capacity}</b> 格${full ? ' · 背包已满' : \` · 余 ${preview.capacity - slots} 格\`}\`;
- `game/src/hub/game.hub.depart.js:324` deployHint = \`[[icon:bag]] 背包格数已满（${B2.bagCap()} 格）——先移出其他卡牌，或回基地用木材扩建背包。\`;
- `game/src/hub/game.hub.runtime.js:285` UI.log(\`[[icon:bag]] 背包扩建完成：容量 <b>${B.bagCap()}</b> 格（- [[icon:wood]]×${MAP.rules.bagUpgradeWood}）\`, 'ok');
- `game/src/hub/hub.facilities.js:11` { id: 'bag', icon: 'bag', name: '出征背包', unit: '格', have: base.bagCap(), max: rules.bagMax, slots: 1, cost: rules.bagUpgradeWood, can: base.canUpgradeBag(), act: 'upBag', note: '永久增加出征背包容量，每次出征均生效。' },
- `game/src/run/chests.js:487` footer:\`<span data-card-receive-anchor="bag" aria-label="背包容量">[[icon:bag]] ${G.bagCapacityText?.() || \`${G.usedSlots()}/${G.bagCap()} 格\`}</span>${returnNotice ? '<button type="button" class="cqo-button" data-act="chestRetrySave">重试保存</button>' : ''}\`,
- `game/src/run/chests.js:660` const footer = \`<span class="reward-capacity">[[icon:bag]] ${G.bagCapacityText?.() || \`${G.usedSlots()}/${G.bagCap()} 格\`}</span>${returnNotice ? '<button type="button" class="reward-bag" data-act="chestRetrySave">重试保存</button>' : ''}${!finished ? \`<button type="button" class="reward-bag${noneFit ? ' is-primary' : ''}" data-act="chestOpenBag">整理背包</button>\` : ''}${!finished && !cur.leaveConfirm ? \`<details class="reward-secondary-options"><summary>其他操作</summary><button type="button" class="reward-bag danger" data-act="chestSkip" data-cancel="false">放弃剩余卡牌</button></details>\` : ''}${capacityNote && !finished && !cur.leaveConfirm ? \`<span class="reward-capacity-note" role="status">${esc(capacit
- `game/src/run/event-card-choice.js:82` foot:\`<span class="reward-capacity">[[icon:bag]] ${esc(capacity)}</span>
- `game/src/run/game.run.altar.js:229` UI.log('[[icon:bag]] 当前补给未领取，请整理背包后再试', 'warn');
- `game/src/run/game.run.altar.js:342` if (!sacrificeCards('道具').length) { UI.log('[[icon:bag]] 背包里没有道具卡可供献祭', 'warn'); return; }
- `game/src/run/game.run.altar.js:344` if (!game.usedPocket.length || !restorableN) { UI.log('[[icon:bag]] 消耗区里没有可复原的卡牌——先去战斗吧', 'warn'); return; }
- `game/src/run/game.run.altar.js:357` if (sacrificeCards().length < 3) { UI.log('[[icon:bag]] 背包卡牌不足 3 张，无法激活祭坛', 'warn'); return; }
- `game/src/run/game.run.scenes.js:535` UI.log(\`[[icon:bag]] 背包放不下（${game.bagCapacityText?.() || \`${usedSlots()}/${bagCap()} 格\`}${tpl.type !== '资源' ? '；新普通牌需通用空格，同名未满仍可叠放' : ''}），【${esc(tpl.name)}】未领取，请整理背包后重试\`, 'warn');
- `game/src/run/game.run.scenes.js:631` if (!game.canReceiveCard(card)) { UI.log(\`[[icon:bag]] 背包放不下（${game.bagCapacityText?.() || \`${usedSlots()}/${bagCap()} 格\`}），无法复原\`, 'warn'); SDT.Sound.sfx('deny'); return; }
- `game/src/run/game.run.shop.js:428` <button class="shop-bag-btn" data-act="shopOpenBag" title="打开背包整理卡牌">[[icon:bag]] 整理背包</button>
- `game/src/run/game.run.shop.js:484` <button class="shop-bag-btn" data-act="shopOpenBag" title="打开背包整理卡牌">[[icon:bag]] 背包</button>
- `game/src/run/game.run.shop.js:679` UI.log(\`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格；装备每张占 1 格，其他同名每格最多叠 3 张，堆满后另占一格），买不下这张卡\`, 'warn');
- `game/src/run/game.run.shop.js:690` publish(() => UI.log(\`[[icon:bag]] 购买卡牌【<b>${esc(name)}</b>】（- ${price} 币，剩 ${game.coins}）\`, 'coin'));
- `game/src/run/game.run.shop.js:714` UI.log(\`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格；初始攻击每格最多叠 3 张，堆满后另占一格），补充不了\`, 'warn');
- `game/src/run/game.run.shop.js:725` publish(() => UI.log(\`[[icon:bag]] 补充初始攻击 ×1（- ${price} 币，剩 ${game.coins} · 本站还可补 ${slot.shaReplenish} 张）\`, 'coin'));
- `game/src/run/game.session.bag.js:73` UI.log(\`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格，可在基地用木材扩建），无法获得 <b>${tpl.name}</b>\`, 'warn');
- `game/data/achievements.json:14` "icon": "[[icon:bag]]",
- `game/data/achievements.json:73` "icon": "[[icon:bag]]",
- `game/data/scenes.json:16` "icon": "[[icon:bag]]",

## book

- `game/src/ui/menu-feedback.js:36` document.getElementById('sugHead').innerHTML = readIcons().rich('[[icon:book]] 记录试玩反馈');
- `game/src/ui/menu-feedback.js:115` <span class="sugin-mark">${done ? '[[icon:check]]' : '[[icon:book]]'}</span>
- `game/src/ui/menu-feedback.js:167` <header class="pg-head"><h2>[[icon:book]] 留言信箱</h2><span class="pg-spacer"></span><button class="mini-btn" data-act="sugExportAll" title="导出全部待处理和已完成留言到一个 JSON 文件" disabled>全部导出</button></header>
- `game/src/ui/menu-settings.js:59` <h3 class="set-h">[[icon:book]] 留言信箱</h3>

## broom

- `game/src/hub/game.notes.js:190` UI.showOverlay('[[icon:broom]] 清空全部备注', \`

## cards

- `game/src/e2.snapshot.qa.js:53` CARD_BACKS: [{ id: 'classic', name: '行囊粗布', icon: 'cards', from: '默认卡背' }] });
- `game/src/battle/bag/battle.bag.domain.js:245` instanceRuntime.G.log(\`[[icon:cards]] 抽了 ${got} 张牌\`, 'sys');
- `game/src/battle/bag/battle.bag.domain.js:288` instanceRuntime.G.log(\`[[icon:cards]] <b>${esc(card.name)}</b>：抽取传说卡【<b>${esc(got.name)}</b>】${got.type === '道具' ? '置入道具栏' : '置入手牌'}\`, 'loot');
- `game/src/battle/bag/battle.equipment.domain.js:192` instanceRuntime.G.log(\`[[icon:cards]] 【${esc(e.card.name)}】需要先有一张手牌可选，技能次数未消耗\`, 'warn');
- `game/src/battle/bag/battle.equipment.domain.js:217` instanceRuntime.G.log(\`[[icon:cards]] <b>${esc(e.card.name)}</b>：随机获取 ${got.length} 张卡牌${got.length ? \`（${got.map(esc).join('、')}）\` : ''}\`, 'loot');
- `game/src/battle/bag/battle.slam-skill.js:13` '法师': { kind: 'acquire',  name: '搜刮', icon: 'cards',  cost: 1, needsTarget: false,
- `game/src/battle/core/battle.core.js:403` G.log(\`[[icon:cards]] 开发者：获得【${esc(card.name)}】（当前战斗临时卡）\`, 'sys');
- `game/src/battle/core/battle.core.js:419` G.log(\`[[icon:cards]] 开发者：抽了 <b>${n}</b> 张牌\`, 'sys');
- `game/src/battle/core/battle.draw.domain.js:46` instanceRuntime.G.log(\`[[icon:cards]] 【${esc(card.name)}】尚未满足施放条件，保留在手牌中\`, 'warn');
- `game/src/battle/core/battle.draw.domain.js:183` if (moved && instanceRuntime.G?.battleActive) instanceRuntime.G.log(\`[[icon:cards]] 从牌库抽取 ${moved} 张【${esc(type)}】牌\`, 'sys');
- `game/src/battle/core/battle.engine.factory.domain.js:191` if (n > 0 && instanceRuntime.unyieldRune) { const g = drawCards(1); instanceRuntime.G.log('[[icon:cards]] <b>不屈符文</b>：受到伤害，抽 ' + g + ' 张牌', 'sys'); }
- `game/src/battle/core/battle.engine.factory.domain.js:509` instanceRuntime.G.log(\`[[icon:cards]] <b>阿猫的礼物</b>：获得【<b>${esc(o ? o.card.name : '?')}</b>】置入手牌（战斗内临时卡，战后消散）\`, 'loot');
- `game/src/battle/core/battle.engine.factory.domain.js:598` instanceRuntime.G.log(\`[[icon:cards]] <b>法师锦囊</b>：从背包 pouch 载入 ${entry.card._pouch.length} 张法术\`, 'sys');
- `game/src/battle/core/battle.exec-play.domain.js:341` instanceRuntime.G.log(\`[[icon:cards]] <b>${esc(card.name)}</b>：本牌是最后一张手牌，效果触发 ${recastTimes} 次\`, 'sys');
- `game/src/battle/core/battle.exec-play.domain.js:350` instanceRuntime.G.log(\`[[icon:cards]] <b>${esc(card.name)}</b>：本牌是最后一张手牌，效果再触发 ${replay.times} 次\`, 'sys');
- `game/src/battle/core/battle.exec-play.domain.js:428` instanceRuntime.G.log(\`[[icon:cards]] 【${esc(card.name)}】保留在手牌中（无法用于注能）\`, 'sys');
- `game/src/battle/core/battle.exec-play.domain.js:432` instanceRuntime.G.log(\`[[icon:cards]] 手牌已满，【${esc(card.name)}】回到弃牌堆\`, 'sys');
- `game/src/battle/core/battle.legacy-resolution.domain.js:42` log(\`[[icon:cards]] <b>${esc(card.name)}</b>：置入 ${put} 张随机卡牌（手牌 ${handSize}/6）${spells ? \`，其中 ${spells} 张法术回复 ${healAmount} 血\` : ''}\`, 'loot');
- `game/src/battle/core/battle.legacy-resolution.domain.js:56` log(\`[[icon:cards]] <b>${esc(card.name)}</b>：当前没有符合本场战斗规则的随机卡牌\`, 'warn');
- `game/src/battle/core/battle.legacy-resolution.domain.js:66` log(\`[[icon:cards]] <b>${esc(card.name)}</b>：随机获得 ${uids.length} 张临时卡牌（下个回合开始时消耗）\`, 'loot');
- `game/src/battle/core/battle.lifecycle.domain.js:317` instanceRuntime.G.log(\`[[icon:cards]] 随身 <b>${instanceRuntime.hand.length}</b> 张战斗卡直接入手；另有 <b>99</b> 张本场临时初始攻击牌库，仅由抽牌效果取牌，开局与每回合不固定抽牌 · 每回合固定 <b>${instanceRuntime.maxEnergy}</b> 费\`, 'sys');
- `game/src/battle/core/battle.lifecycle.domain.js:437` ? \`[[icon:cards]] <b>牌盒即牌库</b>：${instanceRuntime.drawPile.length} 张 · 开局抽 ${R().battleStartDraw} · 每回合开始抽 ${R().battleTurnDraw} · 每回合固定 <b>${instanceRuntime.maxEnergy}</b> 费\`
- `game/src/battle/core/battle.lifecycle.domain.js:438` : \`[[icon:cards]] 牌库编成：${instanceRuntime.opts.directBossStart ? '自动编入' : '自选'} ${instanceRuntime.sel.size} 张非道具卡 + 初始攻击 ×${shas.length} = <b>${instanceRuntime.drawPile.length}</b> 张 ·
- `game/src/battle/core/battle.resolution.domain.js:652` ? \`[[icon:cards]] <b>${esc(card.name)}</b>：牌库上限在开战前编组阶段生效，战斗中 +${operation.n} 不追溯扩容\`
- `game/src/battle/core/battle.resolution.domain.js:653` : \`[[icon:cards]] <b>${esc(card.name)}</b>：普通战斗不使用 BOSS 编组上限，牌库上限 +${operation.n} 不改变本场牌数\`, 'dim');
- `game/src/battle/core/battle.resolution.domain.js:691` log(\`[[icon:cards]] 本次入手 ${spellsGained} 张法术 → 回复 ${amount} 点生命\`, 'sys');
- `game/src/battle/core/battle.resolution.domain.js:760` log(\`[[icon:cards]] <b>${esc(card.name)}</b>：目标身负 ${kinds} 种诅咒，抽 ${kinds} 张牌\`, 'sys');
- `game/src/battle/core/battle.resolution.domain.js:766` log(\`[[icon:cards]] <b>${esc(card.name)}</b>：从牌库抽取 ${got} 张【${esc(want)}】牌\`, 'sys');
- `game/src/battle/core/battle.resolution.domain.js:770` log(\`[[icon:cards]] <b>${esc(card.name)}</b>：抽了 ${got} 张牌\`, 'sys');
- `game/src/battle/core/battle.resolution.domain.js:826` log(\`[[icon:cards]] <b>${esc(card.name)}</b>：抽了 ${got} 张牌\`, 'sys');
- `game/src/battle/core/battle.selection-flow.domain.js:175` instanceRuntime.G.log(\`[[icon:cards]] 手牌中没有${job.type ? \`「${esc(job.type)}」\` : ''}卡牌可选，该效果跳过\`, 'warn');
- `game/src/battle/core/battle.selection-flow.domain.js:190` instanceRuntime.G.log('[[icon:cards]] 跳过手牌选择，该效果未结算', 'warn');
- `game/src/battle/core/battle.selection-flow.domain.js:267` instanceRuntime.G.log(\`[[icon:cards]] 复制了手牌中的【<b>${esc(entry.card.name)}</b>】（置入手牌，原牌保留）\`, 'loot');
- `game/src/battle/effects/battle.acquire-operation.domain.js:68` else log(\`[[icon:cards]] <b>${esc(card.name)}</b>：牌库底没有可取的卡牌\`, 'dim');
- `game/src/battle/effects/battle.acquire-operation.domain.js:141` log(\`[[icon:cards]] <b>${esc(card.name)}</b>：获得 ${detail}${poolSuffix ? \`（${esc(label)}池）\` : ''}（战斗内临时卡，战后消散）\`, 'loot');
- `game/src/battle/effects/battle.discover-flow.js:217` output.log(\`[[icon:cards]] 其余的【<b>${esc(option.name)}</b>】置入手牌\`, 'loot');
- `game/src/battle/effects/card-semantic-operations.js:88` ports.log('[[icon:cards]] 当前没有符合本场战斗规则的随机卡牌', 'sys');
- `game/src/battle/effects/card-semantic-operations.js:95` ports.log('[[icon:cards]] 当前没有符合本场战斗规则的随机卡牌', 'sys');
- `game/src/battle/effects/card-semantic-operations.js:102` ports.log(\`[[icon:cards]] <b>${ports.esc(card.name)}</b>：获得【${ports.esc(selected.name)}】${operation.act === 'zeroCost' ? '（0 费）' : ''}\`, 'loot');
- `game/src/battle/effects/card-semantic-operations.js:162` ports.log(\`[[icon:cards]] <b>${ports.esc(card.name)}</b>：置入 ${put} 张随机卡牌（手牌 ${ports.getHandSize()}/${operation.untilHandN}）\`, 'loot');
- `game/src/battle/effects/effect-steps.audit.js:20` log(\`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：抽了 ${gotN} 张牌（手牌 ${getHandSize()} 张）\`, 'sys');
- `game/src/battle/effects/effect-steps.audit.js:76` log(\`[[icon:cards]] 牌库上限 +${m[1]}（BOSS 编组时生效）\`, 'sys');
- `game/src/battle/effects/effect-steps.damage.js:221` log(\`[[icon:cards]] 获得【<b>${esc(c.name)}</b>】，其费用已变为 0\`, 'loot');
- `game/src/battle/effects/effect-steps.deck.js:59` log(\`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：洗入后抽了 ${got} 张牌\`, 'sys');
- `game/src/battle/effects/effect-steps.deck.js:74` log(\`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：将 ${count} 张【${esc(tpl.name)}】置入手牌（战斗内临时卡，战后消散）\`, 'loot');
- `game/src/battle/effects/effect-steps.deck.js:93` log(\`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：获得 ${count} 张【${esc(tpl.name)}】（置入手牌）\`, 'loot');
- `game/src/battle/effects/effect-steps.kills.js:193` log(\`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：置入 ${put} 张随机卡牌（手牌达到 ${getHandSize()} 张），其中 ${spells} 张法术 → 回复 ${healedN * spells} 血\`, 'loot');
- `game/src/battle/effects/effect-steps.kills.js:195` log(\`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：置入 ${put} 张随机卡牌（手牌达到 ${getHandSize()} 张）\`, 'loot');
- `game/src/battle/effects/effect-steps.kills.js:209` log(\`[[icon:cards]] 复制了手牌中的【<b>${esc(tpl.card.name)}</b>】（置入手牌）\`, 'loot');
- `game/src/battle/effects/effect-steps.kills.js:288` if (got.length) log(\`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：随机获取 ${got.length} 张招式（${got.map(esc).join('、')}）\`, 'loot');
- `game/src/battle/effects/effect-steps.m1.domain.js:88` ? \`[[icon:cards]] ${name}：抽了 ${drawn} 张牌（直到手牌有 ${target} 张，当前 ${instanceRuntime.hand.length} 张）\`
- `game/src/battle/effects/effect-steps.m1.domain.js:89` : \`[[icon:cards]] ${name}：无牌可抽（目标手牌 ${target} 张，当前 ${instanceRuntime.hand.length} 张）\`, 'sys');
- `game/src/battle/effects/effect-steps.m2.domain.js:423` deps.log(\`[[icon:cards]] <b>${deps.esc(card.name)}</b>：复制了手牌中的【<b>${deps.esc(entry.card.name)}</b>】\`, 'loot');
- `game/src/battle/effects/effect-steps.recovery.js:40` log(\`[[icon:cards]] 从手牌选择 <b>${n}</b> 张${m.m[2] && m.m[2] !== '牌' ? m.m[2] : ''}牌打出\`, 'sys');
- `game/src/battle/effects/effect-steps.recovery.js:47` log(\`[[icon:cards]] 从手牌选择 <b>1</b> 张复制（原牌保留）\`, 'sys');
- `game/src/battle/effects/effect-steps.recovery.js:145` log(\`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：抽了 ${got} 张牌\`, 'sys');
- `game/src/battle/effects/effect-steps.rules.js:66` log('[[icon:cards]] 最后一张手牌条件：手牌已空时整卡效果触发 2 次（出牌结算判定）', 'sys');
- `game/src/battle/view/battle.overlays.js:90` showBattleDecision('[[icon:cards]] 剩余牌库', html, true, snapshot);
- `game/src/battle/view/battle.view.js:348` showBattleDecision(\`[[icon:cards]] ${paymentLabel}\`, battleHandSelectBodyHTML({ pool, handSelecting, cardHTML:(card,size) => SDT.Cards.cardHTML(card,size) }), 'discover', snapshot);
- `game/src/battle/view/battle.view.js:531` <div class="battle-hand-page-position" role="status" aria-live="polite"><span class="battle-control-icon" aria-hidden="true">[[icon:cards]]</span><span class="battle-control-value"><b>${handPage + 1}</b><span>/${handPages}</span></span></div>
- `game/src/cards/cards.js:204` { id: 'classic', name: '行囊粗布', icon: 'cards',   from: '默认卡背' },
- `game/src/cards/cards.view.js:146` if (drawN > 0) kwArr.push(\`<span class="kw-draw" title="从本场牌库抽 ${drawN} 张牌">${SDT.Icons.img('cards')}抽 ${drawN}</span>\`);
- `game/src/cards/mech-sentences.js:43` { k: 'drawTxt', label: '抽牌', icon: 'cards',  tpl: n => \`抽 ${n} 张牌。\`, sen: /抽\s*\d+\s*张牌[^。；;]*。?/, cnt: /抽\s*(\d+)\s*张牌/, max: 5 },
- `game/src/hub/bag-container-pages.js:51` UI.showOverlay('法师锦囊', containerStoreHTML({ title: '法师锦囊', icon: 'cards', prefix: 'pouch',
- `game/src/hub/bag-container-pages.js:71` UI.log(\`[[icon:cards]] 锦囊装不下整叠：已有 ${result.storedCount}/${result.capacity} 张，本次 ${result.count} 张\`, 'warn');
- `game/src/hub/bag-container-pages.js:77` UI.log(\`[[icon:cards]] 【<b>${esc(stack.card.name)}</b>】存入法师锦囊\`, 'ok');
- `game/src/hub/bag-container-pages.js:91` UI.log(\`[[icon:cards]] 【<b>${esc(stack.card.name)}</b>】已从锦囊取出\`, 'ok');
- `game/src/hub/game.bag.js:197` ${o.card.id === 'tt7-stratagem' ? '<button class="ov-btn ok" data-act="pouchStore">[[icon:cards]] 打开锦囊（存放法术 ×3）</button>' : ''}
- `game/src/hub/game.bag.js:286` if (card.id === 'tt7-stratagem' && !safeFlag) btns.push('<button class="ov-btn ok" data-act="pouchStoreZoom">[[icon:cards]] 打开锦囊（存放法术 ×3）</button>');
- `game/src/hub/game.bag.settle.js:151` UI.showOverlay('[[icon:cards]] 卡牌是消耗品', \`
- `game/src/hub/game.cardslib.designer.js:108` <h2>[[icon:cards]] 卡牌制作坊</h2>
- `game/src/hub/game.cardslib.designer.js:294` UI.log(\`[[icon:cards]] 卡牌【<b>${esc(card.name)}</b>】已${wasEditing ? '更新' : '收入照相馆'}\`, 'ok');
- `game/src/hub/game.hub.pages.js:266` if (!pool.length) { UI.log('[[icon:cards]] 卡牌库是空的，没有可获得的卡牌', 'warn'); return; }
- `game/src/hub/game.hub.pages.js:274` UI.log('[[icon:cards]] <b>经济卡包</b>：拆开获得 5 张随机卡牌（入卡牌仓库）', 'loot');
- `game/src/hub/game.hub.runtime.js:324` else if (r === 'sha') UI.log('[[icon:cards]] 初始牌「初始攻击」无需入库——每局自动携带，已直接消耗', 'dim');
- `game/src/hub/game.hub.runtime.js:350` UI.log(\`[[icon:cards]] 已装备卡背【<b>${bd ? bd.name : d.id}</b>】——背包翻面与牌库堆即刻生效\`, 'ok');
- `game/src/hub/hub.archive-v3.js:22` return [reward.wood ? \`[[icon:wood]] 木材 ×${reward.wood}\` : '', reward.rations ? \`[[icon:bread]] 口粮 ×${reward.rations}\` : '', reward.keys ? \`[[icon:key]] 钥匙 ×${reward.keys}\` : '', reward.card ? \`[[icon:cards]] ${esc(card?.name || '稀有卡牌')}\` : '', back ? \`[[icon:cards]] 卡背 · ${esc(back.name)}\` : ''].filter(Boolean).map(item => \`<span>${item}</span>\`).join('') || '<span>成就纪念</span>';
- `game/src/hub/meta.js:268` cards.forEach(c => parts.push(\`[[icon:cards]] 【${c.card.name}】\`));
- `game/src/hub/meta.js:271` parts.push(\`[[icon:cards]] 卡背【${bd ? bd.name : a.back}】\`);
- `game/src/run/event-card-choice.js:43` nodeShell({ tone:'event', asset:PRESENTATIONS[record.eventId].asset, icon:'[[icon:cards]]', title:'已领取，尚未保存',
- `game/src/run/event-card-choice.js:76` tone:'event', asset:spec.asset, icon:'[[icon:cards]]', title:spec.title, sub:spec.sub,
- `game/src/run/game-session-departure.js:172` log(\`[[icon:cards]] 随身携带初始牌【<b>初始攻击</b>】×${MAP.rules.starterSha}（不可入库 / 安全格）\`, 'sys');   // 2026-09-16 留言「初始不给火球」：欢迎语去掉火球（已不再发放）
- `game/src/run/game.nest.js:183` ${on ? '[[icon:check]]' : '[[icon:cards]]'} ${esc(s2.card.name)} ×${s2.count}${on ? '（已选）' : ''}</button>\`;
- `game/src/run/game.nest.js:449` if (pool.length) { const c = pool[ri(pool.length)]; game.cardBox.push({ ...c }); UI.log(\`[[icon:cards]] 宝箱开出【${esc(c.name)}】入牌盒\`, 'loot'); }
- `game/src/run/game.run.class-choice.page.js:110` <button class="ov-btn cls2-pool-btn" data-act="clsPool" ${sel ? '' : 'disabled'}>[[icon:cards]] 完整人物卡池（${poolCount(displaySel)} 张）</button>\`
- `game/src/run/game.run.class-choice.page.js:191` if (!c) return '<div class="pv-empty">[[icon:cards]]</div><p class="pv-hint">选择卡牌查看</p>';
- `game/src/run/game.run.dev.js:16` if (!game.ownedCards?.length) { UI.log('[[icon:cards]] 还没有随身卡牌，先开一局再试', 'warn'); return; }
- `game/src/run/game.run.events.js:519` UI.log('[[icon:cards]] 背包中没有可转换的招式或装备卡', 'warn');
- `game/src/run/game.run.events.js:658` UI.log('[[icon:cards]] 黑市货架无法生成完整的三张奖品', 'warn');
- `game/src/run/game.run.shop.js:483` <div class="shop-heading"><h2>[[icon:cards]] 收购台 ${UI.helpBtn('shopSell')}</h2></div>

## chart

- `game/src/agent/agent.data.js:134` UI.showOverlay('[[icon:chart]] 跑局数据', \`<div class="pg hub">${dataPanelHTML()}</div>\`, 'page');
- `game/src/ui/menu-data.js:31` try { title = readIcons().rich('[[icon:chart]] 跑局数据'); } catch { /* 图标宏失败退纯文字 */ }
- `game/src/ui/menu-settings.js:61` <h3 class="set-h">[[icon:chart]] 跑局数据</h3>

## crystal

- `game/src/battle/bag/battle.equipment.domain.js:78` instanceRuntime.G.log(\`[[icon:crystal]] 【${esc(card.name)}】光环生效：${aura.atk ? \`攻 +${aura.atk} \` : ''}${aura.spellPower ? \`法伤 +${aura.spellPower}\` : ''}\`, 'ok');
- `game/src/battle/bag/battle.equipment.domain.js:115` ? \`[[icon:crystal]] <b>${esc(e.card.name)}</b>：身负诅咒，条件加成生效（攻 +${want.atk}${want.sp ? \`，法伤 +${want.sp}\` : ''}）\`
- `game/src/battle/bag/battle.equipment.domain.js:132` ? \`[[icon:crystal]] <b>${esc(e.card.name)}</b>：身负诅咒，条件加成生效（攻 +${want.atk}${want.sp ? \`，法伤 +${want.sp}\` : ''}）\`
- `game/src/battle/core/battle.core.js:161` aegis:  { icon: '[[icon:crystal]]', name: '元素庇幕', desc: '偶数回合减免所有伤害（破甲可克制）' },
- `game/src/battle/core/battle.core.js:428` G.log('[[icon:crystal]] 开发者：所有敌人被冰冻 2 回合', 'sys');
- `game/src/battle/core/battle.damage.domain.js:42` readState().G.log(\`[[icon:crystal]] ${seg || ''}<b>${esc(foe.name)}</b> 的元素庇幕展开：伤害被完全减免！（破甲可击碎）\`, 'warn');
- `game/src/battle/core/battle.damage.domain.js:88` readState().G.log(\`[[icon:crystal]] 【${esc(eq.card.name)}】对冰冻目标伤害 +${vsFreeze}\`, 'sys');
- `game/src/battle/core/battle.enemy-intent.js:7` orc_boss: ['[[icon:tools]]', '双击并施加诅咒'], element_boss: ['[[icon:crystal]]', '攻击·偶数回合庇幕'],
- `game/src/battle/core/battle.enemy-intent.js:15` return { kind, icon: '[[icon:crystal]]', label: '蓄力·下回合行动', damage: null, hits: 1 };
- `game/src/battle/core/battle.enemy-intent.js:18` return { kind, icon: '[[icon:crystal]]', label: '蓄力·首回合不攻击', damage: null, hits: 1 };
- `game/src/battle/core/battle.enemy-intent.js:21` return { kind, icon: '[[icon:crystal]]', label: skip === 'frozen' ? '冰冻·无法行动' : '已退场', damage: null, hits: 1 };
- `game/src/battle/core/battle.enemy-phase.domain.js:215` instanceRuntime.G.log(\`[[icon:crystal]] <b>${esc(a.name)}</b> 被冰冻，无法行动\`, 'sys');
- `game/src/battle/core/battle.enemy-phase.domain.js:253` instanceRuntime.G.log(\`[[icon:crystal]] <b>${esc(foe.name)}</b> 蓄力完毕，下回合行动\`, 'sys');
- `game/src/battle/core/battle.enemy-phase.domain.js:257` instanceRuntime.G.log(\`[[icon:crystal]] <b>${esc(foe.name)}</b> 蓄力（偶数回合才会攻击）\`, 'sys');
- `game/src/battle/core/battle.enemy-phase.domain.js:261` instanceRuntime.G.log(\`[[icon:crystal]] <b>${esc(foe.name)}</b> 第一回合蓄力，不会攻击\`, 'sys');
- `game/src/battle/core/battle.enemy-phase.domain.js:265` instanceRuntime.G.log(\`[[icon:crystal]] <b>${esc(foe.name)}</b> 被冰冻，无法行动！\`, 'sys');
- `game/src/battle/core/battle.engine.factory.domain.js:542` if (instanceRuntime.sealUnlocked) { instanceRuntime.G.log(\`[[icon:crystal]] 【${esc(name)}】已处于解锁状态（跳过重复结算）\`, 'dim'); return; }
- `game/src/battle/core/battle.engine.factory.domain.js:546` instanceRuntime.G.log(\`[[icon:crystal]] <b>元素符印解锁</b>：法伤 +2，抽了 ${got} 张牌\`, 'ok');
- `game/src/battle/core/battle.resolution.domain.js:224` log(\`[[icon:crystal]] <b>${esc(card.name)}</b>：本牌在手期间已注能 ${infusedCount} 张，伤害 +${infusedCount * operation.perInfusedInHand}\`, 'sys');
- `game/src/battle/core/battle.resolution.domain.js:246` log(\`[[icon:crystal]] <b>${esc(card.name)}</b>：法伤加成 ×${operation.spellPowerMul}（额外 +${power * (operation.spellPowerMul - 1)}）\`, 'sys');
- `game/src/battle/core/battle.resolution.domain.js:413` log(\`[[icon:crystal]] <b>${esc(card.name)}</b>：本牌在手期间已注能 ${infusedCount} 张，伤害 +${infusedCount * +inhandM[1]}\`, 'sys');
- `game/src/battle/core/battle.resolution.domain.js:536` log(\`[[icon:crystal]] ${names} 被冰冻 ${operation.duration} 回合（无法行动）\`, 'sys');
- `game/src/battle/core/combat.factory.js:13` freeze:  { name: '冰冻', icon: '[[icon:crystal]]', stack: false, desc: '1 回合无法行动' },
- `game/src/battle/core/combat.factory.js:27` spellUp:    { name: '法术强化', icon: '[[icon:crystal]]', value: true, desc: '法术伤害 +N（本场战斗）' },
- `game/src/battle/effects/battle.status-operations.domain.js:227` log(\`[[icon:crystal]] <b>祝福·法伤增加</b>：法术伤害 +${amount}（${durLabel}，当前加成 ${pstat.status.spellUp}）\`, 'ok');
- `game/src/battle/effects/effect-steps.curse.js:81` if (t0) log(\`[[icon:crystal]] ${esc(t0.name)} 此前已受过伤，冰冻未生效\`, 'dim');
- `game/src/battle/effects/effect-steps.curse.js:96` if (targets.length) { log(\`[[icon:crystal]] 全体敌人被冰冻 ${n} 回合（无法行动）\`, 'sys'); ctx.did = true; }
- `game/src/battle/effects/effect-steps.curse.js:100` if (targets.length) { log(\`[[icon:crystal]] ${targets.map(t => esc(t.name)).join('、')} 被冰冻 ${n} 回合（无法行动）\`, 'sys'); ctx.did = true; }
- `game/src/battle/effects/effect-steps.curse.js:101` } else if (ctx.curseTarget) { combat.addCurse(ctx.curseTarget, 'freeze', n); log(\`[[icon:crystal]] <b>${esc(ctx.curseTarget.name)}</b> 被冰冻 ${n} 回合（无法行动）\`, 'sys'); ctx.did = true; }
- `game/src/battle/effects/effect-steps.curse.js:156` log(\`[[icon:crystal]] <b>祝福·法伤增加</b>：法术伤害 +${m[1]}（${ctx.durOv ? ctx.durOv + ' 回合' : '本场战斗'}，当前加成 ${ctx.pstat.status.spellUp}）\`, 'ok');
- `game/src/battle/effects/effect-steps.damage.js:148` log(\`[[icon:crystal]] <b>${esc(t.name)}</b> 的冰冻延长 ${m[1]} 回合（剩 ${t.status.freeze} 回合）\`, 'sys');
- `game/src/battle/effects/effect-steps.damage.js:150` log(\`[[icon:crystal]] 目标未被冰冻，延长无效\`, 'dim');
- `game/src/battle/effects/effect-steps.gates.js:40` log(\`[[icon:crystal]] <b>${esc(ctx.card.name)}</b> 已解锁（累计注能 ${fuels}/${need} 张）\`, 'ok');
- `game/src/battle/effects/effect-steps.gates.js:42` log(\`[[icon:crystal]] <b>${esc(ctx.card.name)}</b> 未解锁：累计注能 ${fuels}/${need} 张\`, 'dim');
- `game/src/battle/effects/effect-steps.gates.js:54` ? \`[[icon:crystal]] <b>${esc(ctx.card.name)}</b>：当前身负诅咒，条件加成已生效\`
- `game/src/battle/effects/effect-steps.kills.js:142` log(\`[[icon:crystal]] <b>${esc(ctx.curseTarget.name)}</b> 无法行动（冰冻 1 回合）\`, 'sys');
- `game/src/battle/effects/effect-steps.kills.js:263` log(\`[[icon:crystal]] <b>${esc(ctx.card.name)}</b>：选择一张注能卡，使其无需注能\`, 'sys');
- `game/src/battle/effects/equipment-semantic-operations.js:64` runtime.G.log(\`[[icon:crystal]] <b>装备解锁</b>：法伤 +${rule.spellPower}，抽了 ${drawn} 张牌\`, 'ok');
- `game/src/battle/view/battle.layers.js:308` title="开始注能(${infN})，点击手牌选择材料">[[icon:crystal]] 注能${infN}</button>\`
- `game/src/battle/view/battle.layers.js:962` ? [{ icon: '[[icon:crystal]]', label: '冰冻·无法行动', damage: null, kind: 'frozen' }]
- `game/src/battle/view/battle.layers.js:995` setSection(parts.stats, sig, 'stats', \`${attackStat}${immune ? '<span class="sts-stat">[[icon:crystal]] 庇幕免伤中</span>' : ''}\`);
- `game/src/cards/cards.data.js:46` { id: 'tt-token-gold', name: '员工通行证B', cost: 1, rarity: '稀有', type: '道具', desc: '抽取 1 张传说卡。', value: 5 }, // 照片重辨：手写为「传说卡」（[[icon:crystal]]传），非「传统卡」
- `game/src/cards/cards.data.js:54` // 「射击」左上角 free = 0 费；[[icon:crystal]] 为手绘的类别记号，稀有度按效果强度代拟。
- `game/src/cards/cards.data.js:80` // 卡名前 [[icon:crystal]] 数量 = 稀有度记号（1 古朴 / 2 稀有 / 3 史诗）。
- `game/src/cards/cards.data.js:185` // 角标「[[icon:crystal]] 字」多数取卡名/效果用字（彩/木/水/金/传），唯烟雾弹 [[icon:crystal]]稀 与效果
- `game/src/cards/cards.data.js:286` // 角标 [[icon:crystal]][[icon:crystal]]/[[icon:crystal]] 照录为稀有/古朴；「5[[icon:coin]]/8[[icon:coin]]」为币值（右下盾形数字同值）。
- `game/src/cards/cards.js:209` { id: 'altar',   name: '核心星轨', icon: 'crystal', from: '成就「净化征服者」' },
- `game/src/cards/cards.rules.js:44` fixed:  { name: '固定', icon: '[[icon:crystal]]', fmt: (n) => \`${n}\`,  tip: 'n ＝ 固定伤害，不受任何加成' },
- `game/src/cards/cards.view.js:151` : \`注能(${infN})：打出时需先选择 ${infN} 张手牌消耗才能发动\`)}">${SDT.Icons.img('crystal')}注能 ${infN}</span>\`);
- `game/src/cards/mech-sentences.js:27` { k: 'freeze',  label: '冰冻', icon: 'crystal', tpl: n => \`附加冰冻，持续 ${n} 回合。\`, sen: /附加冰冻[^。；;]*。?/, cnt: /持续\s*(\d+)\s*回合/, max: 3 },
- `game/src/cards/mech-sentences.js:36` { k: 'spellUp', label: '法伤+', icon: 'crystal',  tpl: n => \`法伤 +${n}。\`, sen: /法伤\s*\+\s*\d+[^。；;]*。?/, cnt: /法伤\s*\+\s*(\d+)/, max: 5 },
- `game/src/core/game-map-selection.js:149` if (altarE) lines.push('[[icon:crystal]] 污染核心入口');
- `game/src/hub/game.hub.pages.js:253` else UI.log('[[icon:crystal]] 仓库里没有宠物蛋了', 'warn');
- `game/src/hub/game.notes.js:57` if (altarE) info.push('[[icon:crystal]] 污染核心入口');
- `game/src/hub/meta.js:132` if (m.reward.egg) parts.push(\`[[icon:crystal]] 宠物蛋 ×${m.reward.egg}\`);
- `game/src/run/game.run.altar.js:531` UI.showOverlay('[[icon:crystal]] 选择要献祭的卡牌', \`
- `game/src/run/game.run.altar.js:624` UI.log('[[icon:crystal]] 献祭了 3 张卡牌——紧急信标充能完毕', 'sys');
- `game/src/run/game.run.events.js:679` UI.log(\`[[icon:crystal]] 获得员工通行证A碎片（${game.fragments}/2，集齐 2 枚可合成员工通行证A，兑换一张能力卡）\`, 'loot');
- `game/src/run/game.run.events.js:852` UI.log(\`[[icon:crystal]] 修鞋铺送了你一枚员工通行证A碎片（${game.fragments}/2）\`, 'loot');
- `game/src/ui/term-definitions.js:12` freeze:  { name: '冰冻', icon: 'crystal', text: '1 回合无法行动。' },
- `game/src/ui/term-definitions.js:19` spellUp:    { name: '法术强化', icon: 'crystal',  text: '法术伤害 +N，持续到本场战斗结束。' },
- `game/src/ui/term-definitions.js:40` aegis:      { name: '元素庇幕', icon: 'crystal', text: '该敌人偶数回合减免所有伤害；「破甲」可克制。' },
- `game/data/achievements.json:43` "icon": "[[icon:crystal]]",
- `game/data/achievements.json:137` "icon": "[[icon:crystal]]",
- `game/data/achievements.json:236` "icon": "[[icon:crystal]]",
- `game/data/pets.json:12` { "id": "penguin", "name": "小企鹅咕嘎", "icon": "crystal", "desc": "携带效果：安全格 +2（2-6 格 → 4-8 格）", "effect": { "safeBonus": 2 } }
- `game/data/scenes.json:102` "icon": "[[icon:crystal]]",
- `game/index.html:248` <div class="warmup-head"><span class="warmup-spark" aria-hidden="true">❄</span>首用资源准备中 <b id="warmupNum">0/0</b></div>

## door

- `game/src/core/game-map-selection.js:108` UI.log('[[icon:door]] 领完入城补给后才能前往其他地点', 'warn');
- `game/src/core/game-map-selection.js:147` if (eIdx >= 0) lines.push(\`[[icon:door]] 出生入口：${loc.layer.entranceNames[eIdx]}\`);
- `game/src/core/game-map-selection.js:148` if (door) lines.push(\`[[icon:door]] 环间门${door.reverse ? '（返回）' : ''}${door.exit ? ' / 撤离出口' : ''} ⇄ ${readState().game.layerData[door.toLayer]?.name || '下一层'}\`);
- `game/src/hub/game.hub.runtime.js:274` UI.log('[[icon:door]] 宝藏大门已在酝酿——特殊关卡制作中，敬请期待', 'sys');
- `game/src/hub/game.notes.js:55` if (eIdx >= 0) info.push(\`[[icon:door]] 出生入口：${ld.entranceNames[eIdx]}\`);
- `game/src/hub/game.notes.js:56` if (door) info.push(\`[[icon:door]] 环间门${door.exit ? '（撤离出口）' : ''} ⇄ ${game.layerData[door.toLayer]?.name || '下一层'}\`);
- `game/src/run/game.nest.js:121` UI.log('[[icon:door]] 大门开启——基地解锁了新的远征目标', 'loot');
- `game/src/run/game.run.altar.js:266` tone: 'door', icon: '[[icon:door]]', title: '层间闸门',
- `game/src/run/game.run.flow.js:40` if (entrySupplyGate(game)) { UI.log('[[icon:door]] 领完入城补给后才能前往其他地点', 'warn'); return false; }
- `game/data/scenes.json:93` "icon": "[[icon:door]]",

## exit

- `game/src/hub/game.bag.settle.js:330` UI.log('[[icon:exit]] 首脑已击破——第四层的<b>终局撤离点</b>已解锁，可无条件撤离', 'loot');
- `game/src/run/game.nest.js:514` UI.log('[[icon:exit]] 你献祭了整个牌盒——紧急撤出研究所', 'sys');
- `game/src/run/game.nest.js:681` UI.showOverlay('[[icon:exit]] 正在整理研究所撤离', '<p class="ov-note">正在保存带回符文与研究所结算……</p>', true);
- `game/src/run/game.nest.js:724` UI.log('[[icon:exit]] <b>研究所撤离成功！</b>符文与战利品已运回基地', 'ok');
- `game/src/run/game.nest.js:750` UI.showOverlay('[[icon:exit]] 经典生命研究所 · 行动结算', \`
- `game/src/run/game.run.altar.js:199` cards:complete ? '<div class="entry-reward-complete"><span class="entry-complete-symbol" aria-hidden="true">[[icon:exit]]</span><p>补给已领齐</p><button type="button" class="entry-complete-confirm" data-act="clsEntryContinue"><span aria-hidden="true">✓</span> 继续探索</button></div>' : cards().map((card, i) => supply.taken.includes(i) ? '' : card ? \`<article class="reward-unit"><button class="reward-card" data-act="clsEntryCard" data-i="${i}" aria-label="放大查看${escAttr(card.name)}">${SDT.Cards.cardHTML(card)}</button><div class="entry-reward-label">${esc(card.name)}</div><div class="entry-reward-amount"><span>×</span>1</div><button type="button" class="reward-claim" data-act="entrySupplyTake" data-i="
- `game/src/run/game.run.altar.js:635` tone: 'exit', icon: '[[icon:exit]]', title: '终局撤离点',
- `game/src/run/game.run.altar.js:916` UI.log(\`<b>[[icon:exit]] ${wasClear ? '首脑突破，撤离成功！' : '撤离成功！'}</b>共 ${r.actions ?? 0} 次行动；\` +
- `game/src/run/game.run.flow.js:119` if (path.length > 1) UI.log('[[icon:exit]] 已沿路线抵达，共经过 ' + path.length + ' 格', 'dim');
- `game/src/run/game.run.flow.js:222` UI.log('[[icon:exit]] 该节点已完成结算，现已变为普通节点', 'dim');
- `game/src/ui/reward-scene-view.js:7` return \`<button type="button" class="reward-exit ${escAttr(extraClass)}" data-act="${escAttr(act)}"><span class="reward-exit-icon" aria-hidden="true">[[icon:exit]]</span><span>${esc(label)}</span></button>\`;
- `game/data/achievements.json:5` "icon": "[[icon:exit]]",
- `game/data/achievements.json:191` "icon": "[[icon:exit]]",
- `game/data/scenes.json:111` "icon": "[[icon:exit]]",

## folder


## gem

- `game/src/battle/bag/battle.bag.domain.js:48` if (cnt) instanceRuntime.G.log(\`[[icon:gem]] 复原 ${cnt} 张消耗牌，回到手牌\`, 'ok');
- `game/src/battle/core/battle.engine.factory.domain.js:409` instanceRuntime.G.log('[[icon:gem]] <b>冰冻符文</b>：冰冻 1 名角色，抽 ' + got + ' 张牌', 'ok');
- `game/src/battle/core/battle.setup-mechanics.domain.js:71` instanceRuntime.G.log('[[icon:gem]] <b>研究所符文</b>生效：' + instanceRuntime.nestRunes.map(r => esc(r.name + '（' + r.attrs.join('') + '）')).join('、'), 'ok');
- `game/src/hub/bag-container-pages.js:125` UI.showOverlay('珍珠盒', containerStoreHTML({ title: '珍珠盒', icon: 'gem', prefix: 'pearl',
- `game/src/hub/bag-container-pages.js:145` UI.log(\`[[icon:gem]] 珍珠盒放不下了（${result.storedCount}/${result.capacity} 张）——先取出一些\`, 'warn');
- `game/src/hub/bag-container-pages.js:151` UI.log(\`[[icon:gem]] 【<b>${esc(stack.card.name)}</b>】×${stack.count} 存入珍珠盒——腾出 1 个背包格\`, 'ok');
- `game/src/hub/bag-legacy-use.js:51` ? \`[[icon:gem]] 使用【<b>${esc(card.name)}</b>】：复原了消耗区中的 <b>${count}</b> 张卡牌\` + (remaining && usedSlots() >= bagCap() ? \`（背包已满，剩 ${remaining} 张留在消耗区）\` : '')
- `game/src/hub/bag-legacy-use.js:52` : \`[[icon:gem]] 使用【<b>${esc(card.name)}</b>】：复原了消耗区中的至多 <b>2</b> 张卡牌\`;
- `game/src/hub/game.bag.drag.js:173` UI.log('[[icon:gem]] 珍珠盒只收资源卡（木材/口粮/钥匙/货币等）', 'warn');
- `game/src/hub/game.bag.drag.js:181` UI.log(\`[[icon:gem]] 珍珠盒放不下了（${storedN}/${cap} 张）——先取出一些\`, 'warn');
- `game/src/hub/game.bag.drag.js:187` UI.log(\`[[icon:gem]] 【<b>${esc(stack.card.name)}</b>】×${stack.count} 已拖入珍珠盒——腾出 1 个背包格\`, 'ok');
- `game/src/hub/game.bag.js:196` ${o.card.id === 'tt2-pearlbox' ? '<button class="ov-btn ok" data-act="pearlStore">[[icon:gem]] 存入 / 取出资源卡</button>' : ''}
- `game/src/hub/game.bag.js:285` if (card.id === 'tt2-pearlbox') btns.push('<button class="ov-btn ok" data-act="pearlStoreZoom">[[icon:gem]] 打开珍珠盒</button>');
- `game/src/hub/game.bag.rules.js:217` report(\`[[icon:gem]] 复原了消耗区中的 <b>${count}</b> 张卡牌${restored.length ? \`：${restored.map(esc).join('、')}\` : ''}\` +
- `game/src/run/game.nest.js:285` if (game.nestRunes.length >= cap) { UI.log('[[icon:gem]] 符文背包已满（' + cap + ' 块）', 'warn'); return; }
- `game/src/run/game.nest.js:288` UI.log(\`[[icon:gem]] 带走了【${esc(r2.name)}】（${r2.attrs.join('')}·${r2.rarity}）\`, 'loot');
- `game/src/run/game.nest.js:313` UI.log(\`[[icon:gem]] 定向大符文箱：获得 ${received} 块【${at}】属性符文${received < 3 ? \`，背包已满散失 ${3 - received} 块\` : ''}\`, 'loot');
- `game/src/run/game.nest.js:433` UI.log('[[icon:gem]] 战胜所主：BOSS 宝箱 ×2 · 定向大符文箱 ×1', 'loot');
- `game/src/run/game.nest.js:467` UI.log(\`[[icon:gem]] ${spec.name}：+${coins} 币 · 3 块符文已显形，回推进页选择 1 块\`, 'loot');
- `game/src/run/game.nest.js:476` UI.log(\`[[icon:gem]] ${spec.name}：+${coins} 币 · ${got.join('、') || '空'}\`, 'loot');
- `game/src/run/game.nest.js:494` if (game.nestRunes.length >= cap) { UI.log('[[icon:gem]] 符文背包已满（' + cap + ' 块）', 'warn'); return; }
- `game/src/run/game.nest.js:584` if (act === 'rune' && game.nestRunes.length >= cap) { UI.log('[[icon:gem]] 符文背包已满（' + cap + ' 块）', 'warn'); return; }
- `game/src/run/game.nest.js:588` if (act === 'rune') { game.nestRunes.push(slot.rune); UI.log(\`[[icon:gem]] 购入符文【${esc(slot.rune.name)}】\`, 'coin'); }
- `game/src/run/game.run.altar.js:391` UI.log(\`[[icon:gem]] 献上 2 枚员工通行证A碎片（剩 ${game.fragments}）——获得本职业能力卡【<b>${esc(card.name)}</b>】；<b>祭坛苏醒了</b>\`, 'loot');
- `game/src/run/game.run.resources.js:55` UI.log(\`[[icon:gem]] 物资格：带走了【<b>${esc(cards[i].name)}</b>】\`, 'loot');
- `game/data/achievements.json:182` "icon": "[[icon:gem]]",
- `game/data/achievements.json:218` "icon": "[[icon:gem]]",
- `game/data/achievements.json:227` "icon": "[[icon:gem]]",

## helmet

- `game/src/battle/core/battle.setup-mechanics.domain.js:62` instanceRuntime.G.log('[[icon:helmet]] <b>封印破除——化为深渊主宰·妲莉薇特！打出她，旧日再临。</b>', 'ok');
- `game/src/battle/view/battle.layers.js:793` player.myClass && SDT.Art.has(player.myClass) ? (SDT.Art.battleArt ? SDT.Art.battleArt(player.myClass) : SDT.Art.classArt(player.myClass)) : SDT.Icons.img('helmet'));
- `game/src/cards/cards.rules.js:28` TYPE_ICON: { '武术': '[[icon:swords]]', '法术': '[[icon:sparkles]]', '生物': '[[icon:paw]]', '道具': '[[icon:flask]]', '装备': '[[icon:shield]]', '事件': '[[icon:question]]', '能力卡': '[[icon:helmet]]', '资源': '[[icon:wood]]' },
- `game/src/run/game.nest.js:541` UI.log('[[icon:helmet]] 祭坛赐下英雄卡与职业卡（入牌盒）', 'loot');

## home

- `game/src/ui/extraction-rewards-view.js:120` <footer class="exr-footer"><div class="exr-finish-note"><b>本次收获已保存</b><span>仓库 ${stashUsed}/${stashCap} · 图鉴 ${collectionCount}</span></div><button type="button" class="exr-button exr-primary" data-act="goBase">[[icon:home]] 返回基地 <span aria-hidden="true">→</span></button></footer>
- `game/data/achievements.json:119` "icon": "[[icon:home]]",
- `game/data/achievements.json:155` "icon": "[[icon:home]]",

## hourglass

- `game/src/battle/bag/battle.bag.domain.js:207` instanceRuntime.G.log(\`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】效果将每回合开始生效\`, 'sys');
- `game/src/battle/bag/battle.bag.domain.js:385` instanceRuntime.G.log(\`[[icon:hourglass]] 【${esc(card.name)}】已使用：下回合开始时获得1张0费随机招式\`, 'sys');
- `game/src/battle/core/battle.enemy-phase.domain.js:128` instanceRuntime.G.log(\`[[icon:hourglass]] <b>额外回合</b>：敌人被钉在原地，你再次行动！（第 ${instanceRuntime.turn} 回合）\`, 'ok');
- `game/src/battle/core/battle.enemy-phase.domain.js:153` instanceRuntime.G.log('[[icon:hourglass]] <b>时空符文</b>：牌库已空——额外回合！（本局限一次）', 'ok');
- `game/src/battle/core/battle.enemy-phase.domain.js:397` if (instanceRuntime.timeRune) instanceRuntime.G.log('[[icon:hourglass]] <b>时光符文</b>：你的增益状态在时光中凝固（不递减）', 'sys');
- `game/src/battle/core/battle.resolution.domain.js:206` log(\`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】延迟效果将在下个回合开始结算\`, 'sys');
- `game/src/battle/core/battle.resolution.domain.js:735` log(\`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】护甲 -${operation.decayAtTurnEnd} 点（下个回合开始生效）\`, 'sys');
- `game/src/battle/core/battle.selection-flow.domain.js:334` instanceRuntime.G.log(\`[[icon:hourglass]] <b>${esc(ref.name)}</b> 展开：${esc(parts.turnStart.map(it => it.text).join('；'))}（每回合开始生效）\`, 'sys');
- `game/src/battle/core/battle.selection-flow.domain.js:356` if (parts2.turnStart.length) instanceRuntime.G.log(\`[[icon:hourglass]] <b>两回合后</b>：未选择的【${esc(ref2.name)}】也将展开\`, 'sys');
- `game/src/battle/core/battle.turn-start.js:25` readState().G.log(\`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】${esc(it.text)}（下个回合开始${repeat ? (left ? \`起共 ${left} 次\` : '起每回合') : ''}生效）\`, 'sys');
- `game/src/battle/core/battle.turn-start.js:89` readState().G.log(\`[[icon:hourglass]] <b>回合开始时</b>：【${esc(q.cardName)}】${esc(q.text)}\`, 'sys');
- `game/src/battle/effects/battle.discover-flow.js:264` output.log(\`[[icon:hourglass]] 发现：【<b>${esc(card.name)}</b>】每回合开始费用 -${costDecayPerTurn}\`, 'sys');
- `game/src/battle/effects/battle.discover-flow.js:267` output.log(\`[[icon:hourglass]] 发现：【<b>${esc(card.name)}</b>】每回合开始费用 -1\`, 'sys');
- `game/src/battle/effects/battle.discover-flow.js:283` output.log(\`[[icon:hourglass]] <b>江湖救急</b>：置入的 ${tempUids.length} 张临时卡将在下个回合开始时消耗\`, 'sys');
- `game/src/battle/effects/battle.triggers.m2.domain.js:64` if (points.has('onTurnStart')) log(\`[[icon:hourglass]] <b>回合开始时</b>：【${esc(card.name)}】持续效果已登记\`, 'sys');
- `game/src/battle/effects/effect-steps.audit.js:98` log(\`[[icon:hourglass]] <b>${esc(ctx.card.name)}</b>：获得 1 个额外回合（敌人不会行动）\`, 'ok');
- `game/src/battle/effects/effect-steps.gates.js:71` log(\`[[icon:hourglass]] <b>${esc(ctx.card.name)}</b>：每个回合开始失去 ${m[1]} 点生命\`, 'sys');
- `game/src/battle/effects/effect-steps.m2.domain.js:176` deps.log(\`[[icon:hourglass]] <b>${deps.esc(card.name)}</b>：获得 1 个额外回合（敌人不会行动）\`, 'ok');
- `game/src/battle/effects/effect-steps.rules.js:34` log(\`[[icon:hourglass]] <b>回合开始时</b>：【${esc(ctx.card.name)}】${esc(m[1])}（下个回合开始起每回合生效）\`, 'sys');
- `game/src/hub/game.bag.js:346` if (!refreshOnly) UI.log(\`[[icon:hourglass]] 当前动作进行中（${game.state}），稍候再打开背包\`, 'warn');

## info

- `game/src/run/game.run.altar.js:745` ? '<p>撤离已成功，整理快照尚未确认写入。请重试保存后继续。</p><p class="ov-note">[[icon:info]] 撤离前的局面已保存——若反复失败，可以退出游戏重新进入，会回到撤离前的位置，不会重复扣卡。</p>'
- `game/src/run/game.run.altar.js:746` : '<p>撤离前的进度未保存，整理尚未开始。请检查存储空间或档位冲突后重试。</p><p class="ov-note">[[icon:info]] 此时退出会回到上一次成功保存的位置。</p>';
- `game/src/run/game.session.death.js:170` UI.log('[[icon:info]] 测试结算仅更新内存，没有写入基地存档', 'sys');
- `game/src/ui/menu-leave.js:130` if (token.ephemeral) UI.log('[[icon:info]] 测试结算仅更新内存，没有写入基地存档', 'sys');

## lantern

- `game/src/cards/mech-sentences.js:44` { k: 'discover', label: '发现', icon: 'lantern', tpl: n => \`发现 ${n} 张卡牌。\`, sen: /发现\s*\d*\s*张?\s*(?:传说)?(?:卡牌|牌|卡)[^。；;]*。?/, cnt: /发现\s*(\d+)\s*张?\s*(?:传说)?(?:卡牌|牌|卡)/, max: 3 },
- `game/src/hub/game.cardslib.designer.js:167` <p class="dmg-hint" style="margin:-6px 0 22px">[[icon:lantern]] 点击叠加，满次后移除；可补写效果描述。</p>
- `game/src/hub/game.cardslib.designer.js:181` <p class="dmg-hint">[[icon:lantern]] 保存于本浏览器；可在商店和战斗中出现。</p>
- `game/src/run/game.run.scenes.js:408` <span class="ps-lantern">[[icon:lantern]]</span>

## mouse

- `game/src/hub/game.cardslib.designer.js:116` <p class="stage-hint">[[icon:mouse]] 移动鼠标旋转</p>

## notes

- `game/src/core/game-map-selection.js:160` if (note) lines.push(\`[[icon:notes]] ${note}\`);
- `game/src/run/event-lifecycle.js:57` eventNodeShell({ tone:'event', icon:'[[icon:notes]]', title:'事件进度尚未保存',
- `game/src/run/event-lifecycle.js:107` nodeShell({ tone:'event', icon:'[[icon:notes]]', title:'正在进入事件',
- `game/src/run/event-lifecycle.js:145` nodeShell({ tone:'event', icon:'[[icon:notes]]', title:'事件载入未完成',
- `game/src/run/game.run.events.js:86` eventNodeShell({ tone:'event', icon:'[[icon:notes]]', title:'此处事件暂不可用',
- `game/src/run/game.run.events.js:130` nodeShell({ tone: 'event', asset: 'story-last-lamp', icon: '[[icon:notes]]', title: '最后一盏引路灯',
- `game/src/run/game.run.events.js:198` nodeShell({ tone: 'event', asset: 'story-last-lamp', icon: '[[icon:notes]]', title: '最后一盏引路灯',
- `game/src/run/game.run.events.js:732` UI.log('[[icon:notes]] 校工把配送凭据塞进你的手里：“交给下一家店的行商，两格货物算我的账。”','sys'); }) },
- `game/src/run/game.run.events.js:783` if (result) UI.log(\`[[icon:notes]] ${esc(result)}\`, 'sys');
- `game/src/run/shop-commission.js:71` try { UI.log('[[icon:notes]] 配送凭据已交付：两格商品免费，金色边框标记，可整理背包后领取。','loot'); } catch { /* The saved receipt remains authoritative. */ }

## pen

- `game/src/hub/game.bag.js:142` if (result.code === 'protected') UI.log('[[icon:pen]] 初始牌「初始攻击」不可丢弃', 'warn');
- `game/src/hub/game.notes.js:63` UI.showOverlay('[[icon:pen]] 编辑结点备注', \`
- `game/src/ui/card-zoom-content.js:14` <span class="cz-note-tag">[[icon:pen]] ${esc(noteLabel)}</span>
- `game/src/ui/card-zoom-content.js:19` <span class="cz-note-tag">[[icon:pen]] ${esc(noteLabel)}</span>

## plate

- `game/src/battle/core/battle.engine.factory.domain.js:571` instanceRuntime.G.log(\`[[icon:plate]] <b>${esc(card.name)}</b>：击杀敌人，+${+armorM[1] * kills} 甲（当前 ${instanceRuntime.pdef.armor}）\`, 'ok');
- `game/src/battle/core/battle.resolution.domain.js:713` log('[[icon:plate]] 护甲将按你选中的发现牌价格结算', 'sys');
- `game/src/battle/core/battle.resolution.domain.js:726` log(\`[[icon:plate]]获得 ${amount} 点护甲\`, 'sys');
- `game/src/battle/core/battle.resolution.domain.js:817` log(\`[[icon:plate]]获得 ${+(card.armor || 0)} 点护甲\`, 'sys');
- `game/src/battle/core/combat.factory.js:30` reduce:     { name: '减伤', icon: '[[icon:plate]]', value: true, desc: '每次受到的伤害 -N（真实伤害除外）' },
- `game/src/battle/effects/battle.discover-flow.js:254` output.log(\`[[icon:plate]] <b>挖宝</b>：【${esc(card.name)}】价格 ${price} → 获得 ${price} 点护甲（当前 ${armor}）\`, 'sys');
- `game/src/battle/effects/battle.status-operations.domain.js:229` log(\`[[icon:plate]] <b>祝福·减伤</b>：每次受到的伤害 -${amount}（${durLabel}）\`, 'ok');
- `game/src/battle/effects/effect-steps.audit.js:112` log(\`[[icon:plate]] <b>珍珠盒</b>：持有即扩容背包 9 格（扩格仅收资源卡），无需打出\`, 'sys');
- `game/src/battle/effects/effect-steps.curse.js:191` log(\`[[icon:plate]] <b>祝福·减伤</b>：每次受到的伤害 -${n}（本场战斗）\`, 'ok');
- `game/src/battle/effects/effect-steps.kills.js:114` log(\`[[icon:plate]] 护甲衰减：-${n} 点（当前 ${ctx.pdef.armor}）\`, 'warn');
- `game/src/battle/effects/effect-steps.m2.domain.js:270` deps.log(\`[[icon:plate]] <b>${deps.esc(card.name)}</b>：击杀敌人，+${onKill.armor * kills} 甲\`, 'sys');
- `game/src/battle/effects/effect-steps.recovery.js:97` log(\`[[icon:plate]] 获得 ${n} 点护甲${mul > 1 ? '（防御符文翻倍）' : ''}\`, 'sys'); ctx.did = true;
- `game/src/cards/cards.view.js:154` if (armN > 0) kwArr.push(\`<span class="kw-armor" title="获得 ${armN} 点护甲">${SDT.Icons.img('plate')}甲 ${armN}</span>\`);
- `game/src/cards/mech-sentences.js:37` { k: 'reduce',  label: '减伤', icon: 'plate',    tpl: n => \`减伤 ${n}。\`, sen: /减伤\s*\d*[^。；;]*。?/, cnt: /减伤\s*(\d+)/, max: 5 },
- `game/src/hub/game.cardslib.designer.js:161` <span class="dmg-hint" style="margin:0 4px 0 14px">[[icon:plate]] 护甲</span>
- `game/src/ui/term-definitions.js:22` reduce:     { name: '减伤',     icon: 'plate',    text: '每次受到的伤害 -N（真实伤害除外）。' },

## play

- `game/src/audio/sfx-audition.js:142` const play = element('button', '▶ 试听', 'card-play');
- `game/src/audio/sfx-review.js:69` const controls = element('div', null, 'card-controls'), play = element('button', '▶ 试听', 'play-button');
- `game/src/battle/core/battle.damage.domain.js:119` readState().G.log(\`[[icon:play]] <b>${esc(card.name)}</b> → ${esc(foe.name)}：${isTrue || abreakOn ? '真伤/破甲，' : ''}击碎 <b>${loss}</b> 颗心（余 ${Math.max(0, foe.hp)} 心）\`, 'sys');
- `game/src/battle/core/battle.damage.domain.js:139` readState().G.log(\`[[icon:play]] <b>${esc(card.name)}</b>${seg || ''} → ${esc(foe.name)}：造成 <b>${r.dealt}</b> 点${Combat.TYPE_NAME[type]}\` +
- `game/src/battle/core/battle.resolution.domain.js:492` log(\`[[icon:play]] 对手身负诅咒：【${esc(card.name)}】额外施放 ${cast}/${sm[1]} 次\`, 'sys');
- `game/src/battle/core/battle.resolution.domain.js:854` if (!did && !skillOnly && !suppressText) log(\`[[icon:play]] <b>${esc(card.name)}</b>：该效果在 M1 后续实装（占位）\`, 'dim');
- `game/src/battle/effects/effect-steps.audit.js:46` log(\`[[icon:play]] <b>${esc(ctx.card.name)}</b>：对全体敌人造成 <b>${price}</b> 点固定伤害（按抽到卡牌的价格）\`, 'sys');
- `game/src/battle/effects/effect-steps.damage.js:35` log(\`[[icon:play]] <b>${esc(ctx.card.name)}</b>：第 ${i + 1}/${count} 段${label || ''} → <b>${esc(target.name)}</b>（${dealt} 点）\`, 'sys');
- `game/src/battle/effects/effect-steps.damage.js:62` log(\`[[icon:play]] <b>${esc(ctx.card.name)}</b>：第 ${i + 1}/${times} 段 → <b>${esc(t.name)}</b>（${dealt} 点）\`, 'sys');
- `game/src/battle/effects/effect-steps.damage.js:67` log(\`[[icon:play]] <b>${esc(ctx.card.name)}</b> → 随机敌人 ×${hits}：造成 <b>${total}</b> 点${combat.TYPE_NAME[type]}\`, 'sys');
- `game/src/battle/effects/effect-steps.damage.js:104` log(\`[[icon:play]] <b>${esc(ctx.card.name)}</b> → ${targets.map(t => esc(t.name)).join('、')}：造成 <b>${total}</b> 点${combat.TYPE_NAME[type]}\`, 'sys');

## pocket

- `game/src/cards/cards.js:207` { id: 'vault',   name: '仓廪木纹', icon: 'pocket',  from: '成就「仓廪充实」' },
- `game/src/hub/game.bag.settle.js:157` <span class="at-node"><span class="at-ico">[[icon:pocket]]</span><b>消耗区</b></span>
- `game/src/hub/game.bag.settle.js:165` <span class="at-node"><span class="at-ico">[[icon:pocket]]</span><b>复原后可再用</b></span>
- `game/src/run/game-session-departure.js:186` log(\`[[icon:pocket]] 出发整理：基地消耗区已清空（${departure.dispersedPocketCount} 张未复原的卡牌消散了）\`, 'dim');
- `game/src/run/game.run.altar.js:727` UI.log(\`[[icon:pocket]] 撤离结算：消耗区 <b>${totalPocketCount}</b> 张逐张以 1/3 概率结算；实际带回 ${pocket.keptCount} 张待复原，散失 ${pocket.lostCount} 张${pocket.ruleLost ? \`（含初始攻击/职业卡 ${pocket.ruleLost} 张不可带回）\` : ''}\`, 'sys');
- `game/src/ui/extraction-rewards-view.js:33` return \`<section class="exr-pocket"><div class="exr-pocket-heading"><h3>[[icon:pocket]] 待复原</h3><p class="exr-pocket-count"><b>${pocketKept}</b><small> 张</small></p></div>

## pouch


## save

- `game/src/hub/game.cardslib.designer.js:111` <button class="hs-btn gold" data-act="saveCard">[[icon:save]] ${editingCard ? '保存修改' : '保存卡牌'}</button>
- `game/src/ui/menu-leave.js:43` <button type="button" class="leave-run-save" data-act="leaveSave"${slot ? '' : ' disabled'}>[[icon:save]] 保存并退出</button>

## scroll


## shield

- `game/src/battle/core/battle.damage.domain.js:35` readState().G.log(\`[[icon:shield]] <b>风暴之手</b>庇护着 <b>${esc(foe.name)}</b>——伤害被完全偏转\`, 'warn');
- `game/src/battle/core/battle.enemy-phase.domain.js:148` instanceRuntime.G.log(\`[[icon:shield]] <b>${esc(f.name)}</b> 切换免疫：${picked.join('、')}\`, 'warn');
- `game/src/battle/core/battle.enemy-phase.domain.js:356` instanceRuntime.G.log('[[icon:shield]] <b>圣洁符文</b>：回合结束获得 ' + n + ' 点护甲（' + instanceRuntime.pdef.armor + '）', 'sys');
- `game/src/battle/core/battle.engine.factory.domain.js:760` ? \`[[icon:shield]] 本回合免疫：诅咒「${Combat.CURSE_META[key] ? Combat.CURSE_META[key].name : key}」被抵抗\`
- `game/src/battle/core/battle.engine.factory.domain.js:761` : \`[[icon:shield]] 深渊主宰的威压：诅咒「${Combat.CURSE_META[key] ? Combat.CURSE_META[key].name : key}」被免疫\`, 'ok');
- `game/src/battle/core/battle.engine.factory.domain.js:765` instanceRuntime.G.log(\`[[icon:shield]] 圣洁符文：前 3 回合免疫诅咒（「${Combat.CURSE_META[key] ? Combat.CURSE_META[key].name : key}」被抵抗）\`, 'ok');
- `game/src/battle/core/battle.exec-play.domain.js:381` instanceRuntime.G.log('[[icon:shield]] <b>旧日再临</b>：诅咒无法侵染深渊主宰', 'ok');
- `game/src/battle/core/battle.exec-play.domain.js:394` instanceRuntime.G.log('[[icon:shield]] <b>邪能护体</b>：本回合免疫所有伤害与诅咒效果', 'ok');
- `game/src/battle/core/battle.resolution.domain.js:731` log('[[icon:shield]] 格挡：本回合所受伤害降为 1', 'sys');
- `game/src/battle/core/battle.setup-mechanics.domain.js:115` if (instanceRuntime.nestRunes.some(r => r.kind === 'holy')) instanceRuntime.G.log('[[icon:shield]] <b>圣洁符文</b>：前 3 回合免疫诅咒，回合结束 +4 甲', 'ok');
- `game/src/battle/effects/battle.status-operations.domain.js:233` log(\`[[icon:shield]] <b>闪避</b>：接下来 ${amount} 次攻击将被完全避开${amount > 1 ? '（各消耗 1 层）' : ''}${durNote}\`, 'ok');
- `game/src/battle/effects/effect-steps.damage.js:325` log(\`[[icon:shield]] <b>闪避</b>：接下来 ${n} 段伤害将被完全避开${n > 1 ? '（各消耗 1 层）' : ''}\`, 'ok');
- `game/src/battle/effects/effect-steps.m2.domain.js:207` deps.log(\`[[icon:shield]] <b>${deps.esc(card.name)}</b>：免疫诅咒\`, 'ok');
- `game/src/battle/effects/effect-steps.recovery.js:103` run: (ctx, m) => { ctx.pdef.shield += +m[1]; log(\`[[icon:shield]] 获得 ${m[1]} 点护盾\`, 'sys'); ctx.did = true; },
- `game/src/battle/effects/effect-steps.recovery.js:110` log('[[icon:shield]] 格挡：本回合所受伤害降为 1', 'sys');
- `game/src/cards/cards.rules.js:28` TYPE_ICON: { '武术': '[[icon:swords]]', '法术': '[[icon:sparkles]]', '生物': '[[icon:paw]]', '道具': '[[icon:flask]]', '装备': '[[icon:shield]]', '事件': '[[icon:question]]', '能力卡': '[[icon:helmet]]', '资源': '[[icon:wood]]' },
- `game/src/cards/mech-sentences.js:38` { k: 'shield',  label: '护盾', icon: 'shield',   tpl: n => \`获得 ${n} 点护盾。\`, sen: /获得\s*\d+\s*点?\s*护盾[^。；;]*。?/, cnt: /获得\s*(\d+)\s*点?\s*护盾/, max: 9 },
- `game/src/cards/mech-sentences.js:39` { k: 'guard',   label: '格挡', icon: 'shield',   tpl: () => \`本回合所受伤害降为 1。\`, sen: /本回合所受伤害降为[^。；;]*。?/, max: 1 },
- `game/src/ui/battle-hud-info.js:16` + (pdef.shield ? \`<span class="sts-stat">[[icon:shield]] 盾 ${pdef.shield}</span>\` : '')

## skip


## sparkles

- `game/src/battle/bag/battle.bag.domain.js:231` instanceRuntime.G.log(\`[[icon:sparkles]] 获得祝福（${esc(key)}）\`, 'ok');
- `game/src/battle/bag/battle.bag.domain.js:278` instanceRuntime.G.log(\`[[icon:sparkles]] <b>${esc(card.name)}</b> 觉醒：获得本职业能力卡【<b>${esc(got.name)}</b>】\`, 'loot');
- `game/src/battle/bag/battle.equipment.domain.js:64` instanceRuntime.G.log(\`[[icon:sparkles]] 【${esc(card.name)}】开战效果在穿戴时补发（战斗中装配）\`, 'sys');
- `game/src/battle/bag/battle.equipment.domain.js:174` instanceRuntime.G.log(\`[[icon:sparkles]] <b>${esc(e.card.name)}</b> 主动技能发动\`, 'ok');
- `game/src/battle/bag/battle.equipment.domain.js:205` instanceRuntime.G.log(\`[[icon:sparkles]] <b>${esc(e.card.name)}</b> 主动技能：注能(${need})，随机获取 3 张卡牌\`, 'ok');
- `game/src/battle/bag/battle.equipment.domain.js:229` instanceRuntime.G.log(\`[[icon:sparkles]] <b>${esc(e.card.name)}</b> 主动技能：${esc(text)}\`, 'ok');
- `game/src/battle/core/battle.enemy-phase.domain.js:478` expired.forEach(k => instanceRuntime.G.log(\`[[icon:sparkles]] ${esc(who)} 的<b>${meta(k).name}</b>效果结束了\`, 'dim'));
- `game/src/battle/core/battle.engine.factory.domain.js:184` instanceRuntime.G.log(\`[[icon:sparkles]] <b>致命一击被挡下！</b>（死亡保险剩余 ${instanceRuntime.deathSave} 次，本回合无敌）\`, 'ok');
- `game/src/battle/core/battle.engine.factory.domain.js:454` instanceRuntime.G.log(\`[[icon:sparkles]] <b>法力奔涌</b>（第 ${i + 1}/${n} 发）：对 <b>${esc(t.name)}</b> 释放随机法术【<b>${esc(spell.name)}</b>】（默认已注能）\`, 'loot');
- `game/src/battle/core/battle.engine.factory.domain.js:791` instanceRuntime.G.log(\`[[icon:sparkles]] <b>致命一击被挡下！</b>（死亡保险剩余 ${instanceRuntime.deathSave} 次，本回合无敌）\`, 'ok');
- `game/src/battle/core/battle.exec-play.domain.js:279` if (effCost !== card.cost) instanceRuntime.G.log(\`[[icon:sparkles]] <b>费用变化</b>：【${esc(card.name)}】按 <b>${effCost}</b> 费打出（原 ${card.cost} 费）\`, 'sys');
- `game/src/battle/core/battle.exec-play.domain.js:359` instanceRuntime.G.log(\`[[icon:sparkles]] <b>元素风暴</b>：这张法术额外施放 1 次\`, 'sys');
- `game/src/battle/core/battle.exec-play.domain.js:398` instanceRuntime.G.log('[[icon:sparkles]] <b>旧日再临</b>：所有可注能与必须注能的招式，均视为已注能', 'ok');
- `game/src/battle/core/battle.resolution.domain.js:346` log(\`[[icon:sparkles]] <b>${esc(card.name)}</b>：${operation.recast.on === 'kill' ? '击杀敌人' : '本牌是最后一张手牌'}，再施放${operation.recast.times > 1 ? \` ${operation.recast.times} 次\` : '一次'}\`, 'sys');
- `game/src/battle/core/battle.resolution.domain.js:500` log(\`[[icon:sparkles]] <b>${esc(card.name)}</b>：击杀敌人，再施放一次\`, 'sys');
- `game/src/battle/core/battle.setup-mechanics.domain.js:103` if (picked.length) instanceRuntime.G.log('[[icon:sparkles]] <b>光 ' + n + '</b>：洗入传说招式 ' + picked.join('、') + '（均为 0 费）', 'ok');
- `game/src/battle/core/battle.setup-mechanics.domain.js:112` instanceRuntime.G.log('[[icon:sparkles]] <b>变身符文</b>：从 2 种随机形态中选择 1 张释放', 'sys');
- `game/src/battle/core/battle.turn-effects.domain.js:25` readState().G.log('[[icon:sparkles]] 持续规则：你的所有招式（武术与法术）均按 <b>1</b> 费打出', 'ok');
- `game/src/battle/core/battle.turn-effects.domain.js:28` readState().G.log('[[icon:sparkles]] 持续规则：你的所有武术均按 <b>1</b> 费打出', 'ok');
- `game/src/battle/core/battle.turn-effects.domain.js:31` readState().G.log('[[icon:sparkles]] 持续规则：你的所有法术均按 <b>1</b> 费打出', 'ok');
- `game/src/battle/core/combat.factory.js:29` immune:     { name: '免疫伤害', icon: '[[icon:sparkles]]', timed: true, desc: '不受到任何伤害' },
- `game/src/battle/core/combat.factory.js:34` cosmosForm: { name: '宇宙形态', icon: '[[icon:sparkles]]', flag: true, desc: '本局对战所有卡牌变为 1 费' },
- `game/src/battle/effects/battle.card-inspection.domain.js:200` state.game.log(\`[[icon:sparkles]] <b>交换费用</b>：【${esc(a.card.name)}】费用变为 <b>${costA}</b>，【${esc(b.card.name)}】费用变为 <b>${costB}</b>\`, 'sys');
- `game/src/battle/effects/battle.status-operations.domain.js:216` log(\`[[icon:sparkles]] <b>祝福·免疫伤害</b>：${turns} 回合内不受到任何伤害\`, 'ok');
- `game/src/battle/effects/effect-steps.curse.js:166` log(\`[[icon:sparkles]] <b>${esc(ctx.card.name)}</b>：本场战斗免疫 ${m[1]} 次致命伤害（触发后该回合无敌）\`, 'ok');
- `game/src/battle/effects/effect-steps.curse.js:181` log(\`[[icon:sparkles]] <b>祝福·免疫伤害</b>：${n} 回合内不受到任何伤害\`, 'ok');
- `game/src/battle/effects/effect-steps.curse.js:219` log('[[icon:sparkles]] <b>祝福·宇宙形态</b>：本局对战内，所有卡牌变为 1 费', 'ok');
- `game/src/battle/effects/effect-steps.kills.js:47` log(\`[[icon:sparkles]] <b>元素风暴</b>：下一张法术将施放 ${m[1]} 次\`, 'ok');
- `game/src/battle/effects/effect-steps.m1.domain.js:41` deps.log(\`[[icon:sparkles]] ${name}：净化清除了身上的 ${cleared.map(k => deps.combat.CURSE_META[k].name).join('、')}\`, 'ok');
- `game/src/battle/effects/effect-steps.m1.domain.js:43` deps.log(\`[[icon:sparkles]] ${name}：净化——身上没有诅咒，干干净净\`, 'ok');
- `game/src/battle/effects/effect-steps.m2.domain.js:191` deps.log(\`[[icon:sparkles]] <b>${deps.esc(card.name)}</b>：本场可注能招式均视为已注能\`, 'ok');
- `game/src/battle/effects/effect-steps.m2.domain.js:224` deps.log(\`[[icon:sparkles]] 持续规则：你的所有招式（武术与法术）均按 <b>1</b> 费打出\`, 'ok');
- `game/src/battle/effects/effect-steps.m2.domain.js:229` deps.log(\`[[icon:sparkles]] 持续规则：你的所有武术均按 <b>1</b> 费打出\`, 'ok');
- `game/src/battle/effects/effect-steps.m2.domain.js:234` deps.log(\`[[icon:sparkles]] 持续规则：你的所有法术均按 <b>1</b> 费打出\`, 'ok');
- `game/src/battle/effects/effect-steps.m2.domain.js:248` deps.log(\`[[icon:sparkles]] <b>${deps.esc(card.name)}</b>：下一张法术施放 2 次\`, 'ok');
- `game/src/battle/effects/effect-steps.recovery.js:120` ? \`[[icon:sparkles]] 净化：清除了身上的 ${cleared.map(k => combat.CURSE_META[k].name).join('、')}\`
- `game/src/battle/effects/effect-steps.recovery.js:121` : '[[icon:sparkles]] 净化：身上没有诅咒，干干净净', 'ok');
- `game/src/battle/effects/random-blessings.js:33` log(\`[[icon:sparkles]] ${esc(name)}获得<b>祝福·${esc(pick.name)}</b>（随机祝福，优先未获得）\`, 'ok');
- `game/src/battle/view/battle.layers.js:281` ? (effCost === 0 ? \`（[[icon:bolt]] 当前按 0 费打出）\` : \`（[[icon:sparkles]] 费用变化：按 ${effCost} 费打出）\`)
- `game/src/battle/view/battle.layers.js:1002` + (echoMark ? \`<span class="bt-affix">[[icon:sparkles]] 契约回响 ${+echoMark.amount || 2}</span>\` : '')
- `game/src/cards/cards.rules.js:28` TYPE_ICON: { '武术': '[[icon:swords]]', '法术': '[[icon:sparkles]]', '生物': '[[icon:paw]]', '道具': '[[icon:flask]]', '装备': '[[icon:shield]]', '事件': '[[icon:question]]', '能力卡': '[[icon:helmet]]', '资源': '[[icon:wood]]' },
- `game/src/cards/cards.rules.js:43` spell:  { name: '法术', icon: SDT.Icons.img('sparkles'), fmt: (n) => \`${n}'\`, tip: "n' ＝ n + 法伤加成" },
- `game/src/cards/mech-sentences.js:34` { k: 'immune',  label: '免疫伤害', icon: 'sparkles', tpl: n => \`免疫伤害，持续 ${n} 回合。\`, sen: /免疫伤害[^。；;]*。?/, cnt: /持续\s*(\d+)\s*回合/, max: 3 },
- `game/src/cards/mech-sentences.js:40` { k: 'purify',  label: '净化', icon: 'sparkles', tpl: () => \`净化。\`, sen: /净化[^。；;]*。?/, max: 1 },
- `game/src/hub/bag-legacy-use.js:101` UI.log(\`[[icon:sparkles]] 使用【<b>${esc(card.name)}</b>】：获得传说卡【<b>${esc(got.name)}</b>】\`, 'loot');
- `game/src/hub/bag-legacy-use.js:114` UI.log(\`[[icon:sparkles]] 使用【<b>${esc(card.name)}</b>】觉醒：获得本职业能力卡【<b>${esc(got.name)}</b>】\`, 'loot');
- `game/src/hub/bag-token-craft-plan.js:6` success: '[[icon:sparkles]] 合成成功：3 张员工通行证B → 1 张<b>员工通行证A</b>',
- `game/src/hub/bag-token-craft-plan.js:11` success: '[[icon:sparkles]] 合成成功：员工通行证A + 2 枚碎片 → 1 张<b>员工通行证A</b>（使用后获取本职业能力卡）',
- `game/src/hub/base-state.js:20` collection: {}, // 收藏图鉴 [卡牌id] => { name, rarity, ts }（[[icon:sparkles]]收藏中的物品）
- `game/src/hub/game.bag.rules.js:231` report(\`[[icon:sparkles]] 使用【<b>${esc(card.name)}</b>】：获得${legendary ? '传说卡' : '本职业能力卡'}【<b>${esc(got.name)}</b>】\`, 'loot');
- `game/src/hub/game.hub.pages.js:23` // 特殊收藏品：传说卡与桌游珍宝——[[icon:sparkles]]收藏后完成对应成就
- `game/src/hub/game.hub.pages.js:165` ? \`[[icon:sparkles]] 已保护【<b>${esc(card.name)}</b>】（卡牌保留，不获得人物经验）${special ? '（特殊收藏品）' : ''}\`
- `game/src/hub/game.hub.pages.js:166` : \`[[icon:sparkles]] 已取消【<b>${esc(card.name)}</b>】的保护，图鉴收录保留\`, now ? 'loot' : 'dim');
- `game/src/hub/meta.js:170` const msg = \`[[icon:sparkles]] 领取职业收藏奖励【收藏 ${collMsNeed(m)} 张】：${collRewardText(m)}\`;
- `game/src/hub/meta.js:230` SDT.UI.log(\`[[icon:sparkles]] 职业收藏进度达成 <b>${collMsNeed(m)} / ${collTotal()}</b>\` +
- `game/src/run/game.nest.js:484` UI.showOverlay('[[icon:sparkles]] 符文法阵', \`
- `game/src/run/game.nest.js:503` UI.log(\`[[icon:sparkles]] 献祭 3 张卡牌，符文法阵赐下【${esc(r.name)}】（${r.attrs.join('')}）\`, 'loot');
- `game/src/run/game.nest.js:552` UI.log(\`[[icon:sparkles]] 【${esc(r.name)}】属性 ${old} → ${r.attrs.join('')}\`, 'loot');
- `game/src/run/game.run.scenes.js:643` UI.log(\`[[icon:sparkles]] 【<b>${esc(card.name)}</b>】已复原，回到背包\`, 'ok');
- `game/src/ui/term-definitions.js:21` immune:     { name: '免疫伤害', icon: 'sparkles', text: '不受到任何伤害。' },
- `game/src/ui/term-definitions.js:26` cosmosForm: { name: '宇宙形态', icon: 'sparkles', text: '本局对战所有卡牌变为 1 费。形态是开关型祝福，本局对战常驻。' },
- `game/data/achievements.json:200` "icon": "[[icon:sparkles]]",
- `game/css/battle.css:330` /* 击杀文字欢呼（替代 👍✌️✨ emoji）：小号金色， stkPop 弹出 */

## tools

- `game/src/agent/agent.console.js:99` UI.log('[[icon:tools]] LLM 配置已保存（仅本机 localStorage）', 'sys');
- `game/src/agent/agent.console.js:134` UI.log(\`[[icon:tools]] 快捷进入【${page?.name || d.page}】成功（去向已打开，与 Alt+${page?.key || '?'} 同入口）\`, 'sys');
- `game/src/agent/agent.data.js:126` UI.log('[[icon:tools]] 跑局记录已清空', 'sys');
- `game/src/battle/bag/battle.equipment.domain.js:51` instanceRuntime.G.log(\`[[icon:tools]] 装配【<b>${esc(card.name)}</b>】（${instanceRuntime.equipped.length}/${equipCap()} 件）${equipSkillText(card) ? '——主动技能已就绪' : ''}\`, 'ok');
- `game/src/battle/core/battle.card-play.domain.js:172` else if (check.reason.code === 'EQUIPMENT_FULL') readState().G.log(\`[[icon:tools]] 最多同时装配 <b>${check.cap}</b> 件装备（已装配 ${check.worn} 件）——本场无法再穿戴\`, 'warn');
- `game/src/battle/core/battle.core.js:160` frenzy: { icon: '[[icon:tools]]', name: '狂乱',     desc: '每回合攻击两次，每次附加 1 层流血或中毒' },
- `game/src/battle/core/battle.enemy-intent.js:7` orc_boss: ['[[icon:tools]]', '双击并施加诅咒'], element_boss: ['[[icon:crystal]]', '攻击·偶数回合庇幕'],
- `game/src/battle/core/combat.factory.js:15` abreak:  { name: '破甲', icon: '[[icon:tools]]', stack: false, desc: '2 回合内无法减免伤害' },
- `game/src/battle/effects/effect-steps.curse.js:117` if (ctx.curseTarget) { combat.addCurse(ctx.curseTarget, 'abreak', n); log(\`[[icon:tools]] <b>${esc(ctx.curseTarget.name)}</b> 破甲 ${n} 回合（无法减免伤害——元素庇幕失效）\`, 'sys'); ctx.did = true; }
- `game/src/cards/mech-sentences.js:29` { k: 'abreak',  label: '破甲', icon: 'tools',   tpl: () => \`附加破甲。\`, sen: /附加破甲[^。；;]*。?/, max: 1 },
- `game/src/run/game-session-departure.js:26` if (effect.extraSha) log(\`[[icon:tools]] <b>变形机器人</b>：起始背包额外增加 <b>2 张【初始攻击】</b>（共 ${shaN} 张）\`, 'ok');
- `game/src/run/game.run.dev.js:24` UI.log(\`[[icon:tools]] 开发者：强制进入 BOSS 战【${esc(b.name)}】\`, 'sys');
- `game/src/run/game.run.dev.js:43` UI.log('[[icon:tools]] 开发者：强制进入遭遇战', 'sys');
- `game/src/run/game.run.dev.js:60` UI.log('[[icon:tools]] 开发者：已开一局<b>测试局</b>（不占档位、不写存档）', 'sys');
- `game/src/run/game.run.dev.js:76` UI.log(\`[[icon:tools]] 开发者：跳转节点【<b>${label}</b>】\`, 'sys');
- `game/src/run/game.run.dev.js:246` UI.showOverlay('[[icon:tools]] 开发者控制台', \`
- `game/src/run/game.run.events.js:830` UI.log(\`[[icon:tools]] 闪金之锤一击制敌（${foe.name}）！+2 币\`, 'coin');
- `game/src/run/game.run.events.js:835` UI.log(\`[[icon:tools]] 闪金之锤重击 <b>${esc(foe.name)}</b>（-5 血），战斗打响！\`, 'warn');
- `game/src/run/game.run.events.js:857` tone: 'event', icon: '[[icon:tools]]', title: '修鞋铺 · 修整行装',
- `game/src/ui/equipment-info.js:16` const art = \`<span class="sts-equip-art" aria-hidden="true">${image || '[[icon:tools]]'}</span>\`;
- `game/src/ui/term-definitions.js:14` abreak:  { name: '破甲', icon: 'tools',   text: '2 回合内无法减免伤害。' },
- `game/src/ui/term-definitions.js:39` frenzy:     { name: '狂乱',     icon: 'tools',   text: '该敌人每回合攻击两次，每次附加 1 层流血或中毒。' },
- `game/data/map.json:368` "icon": "[[icon:tools]]",
- `game/data/pets.json:10` { "id": "robot", "name": "变形机器人", "icon": "tools", "desc": "携带效果：起始背包中增加 2 张「初始攻击」", "effect": { "extraSha": 2 } },
- `game/index.html:257` <div class="td-head"><span>[[icon:tools]] 节点测试</span></div>

## trash

- `game/src/hub/game.bag.js:146` UI.log(\`[[icon:trash]] 已丢弃【<b>${esc(card.name)}</b>】×1（无法取回）\`, 'warn');
- `game/src/hub/game.cardslib.page.js:950` UI.log(\`[[icon:trash]] 已删除卡牌【<b>${esc(card ? card.name : '')}</b>】\`, 'warn');
- `game/src/ui/menu-slots.js:322` UI.log(\`[[icon:trash]] 已删除【档位 ${d.slot}】的存档（含基地数据）\`, 'warn');

## upload

- `game/src/hub/game.cardslib.designer.js:307` UI.showOverlay('[[icon:upload]] 导出卡牌', \`
- `game/src/hub/game.cardslib.page.js:785` const editorTools = game.devMode ? \`<button class="hs-btn studio-edit-toggle${libEditMode ? ' on' : ''}" data-act="libEditMode" aria-pressed="${libEditMode}">${libEditMode ? '收起工具' : '导出工具'}</button>${libEditMode ? \`<button class="hs-btn" data-act="exportCards">[[icon:upload]] 导出</button>${CARD_DESIGNER_WRITES_ENABLED ? '<button class="hs-btn gold" data-act="newCard">＋ 制作新卡</button><button class="hs-btn" data-act="importCards">[[icon:download]] 导入</button>' : ''}\` : ''}\` : '';
- `game/src/hub/game.notes.js:119` UI.showOverlay('[[icon:upload]] 导出格子备注', \`

