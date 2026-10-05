# 全游戏 UI 覆盖盘点（源码基线）

时点：2026-10-05 00:58–01:05（UTC+8）。依据为现行源码、CSS 挂载链及当天活账；没有运行游戏、浏览器、测试、lint、build 或解析验证。

老板最新令“今天改过的不要再改”已纳入：前一工作时段 10-04 认可页面与今日其他会话完成/在途页均保护。此清单记录尚未动手的基线，后续本任务新 CSS 的挂载和完成状态由主代理另记。

盘点 107 项（含状态分支、通用层、隐藏遗留）；近期已改保护 34 项；源码有入口且未保护、未被排除的目标 59 项，其中开发控制台为辅助 UI。另 14 项为隐藏或排除，其中 5 项不可达/可达未证实/演示，9 项为老板新令明确排除的研究所系列。**条目数不是独立屏幕数；不存在实页通过结论。**

## 冻结边界

- 已认可锚点：主页、制作名单、设置、选档、选人、指南、照相馆及照片背签、留言及写留言、跑局数据。现行 cover 文件及登记共同确认，保留其视觉。统一加载页另由 10-04-WF-feedback-1004/README.md:10/:36 与 task.json 明确记载已制作，本轮补冻，secondary 新规则已剔除。
- 基地外壳、出发封面、仓库、口袋、宠物、人物、商店、升级、收藏及卡背已在 hub-cover 系中设计；整页冻结。商店/升级/收藏原本只算“部分”现已按老板最新指令整页保护，细节不满意不再算缺口。
- 地图 renderer/expedition-map/map-cover、成就 gallery/详情、home-menu-motion 返回修复仍为其他会话在途，禁止覆盖。
- 尚未设计的仓库弹窗与确认层使用 .stash-shell 或 data-act 的独立根，可以补齐；必须不改变 #hubMain 父页。

## 最容易漏掉的域

1. .cls-pool-page 角色卡池虽不在 character-cover 的 .cls2-page 根，但 10-04 feedback-r5 已重排，10-05 WF-character-pool-cover 正在继续改造；现行 expedition-roster.css 已挂 character-pool-cover / character-view-motion。此项补冻，不由本任务覆盖。
2. #cardZoom:not(.cz-photo) 普通卡牌大图不在 photo-studio-cover 的照片根；只重塑承托、备注与提示，保留卡面。
3. #exMain.result-pg 撤离整理不是 #hubMain，原基地 cover 不覆盖它。
4. 研究所大门、备战、线路/奖励、符文法阵、祭坛、商店、保存重试、三页通关和行动结算已按老板新令全部排除。首次入口和父子层级仅保留盘点，不实施。
5. #cardGet/#legendGet 直接挂 body 的获得演出，以及 .term-tip、.page-loading、#exitScr 不走普通 page 壳。
6. 共用三级说明、锦囊/珍珠盒、献祭、战斗发现/抉择/支付、牌库/墓地/道具、存档结算重试、导入导出表单不能漏掉。

## 挂载与保护事实

- game/index.html 静态引入 page-*；ui-scale.css → title-p0.css，expedition-roster.css → character-cover.css，expedition-map.css → map-cover.css。
- page-settings.css → settings-cover.css + inbox-cover.css；page-slot-select.css → slots-cover.css；page-hub.css → hub-cover.css → arrival/deploy/collections/stash/personnel/motion；page-deploy.css → departure-cover.css。
- photo-studio-unified.css（由 game.cardslib.page.js 引入）→ photo-studio-cover.css；title-achievements.css 由 game.menu.js 引入；page-loading.css 由 page-loading.js 引入。
- 09-24 的 page-* / expedition-* 文件是旧增量层，存在文件本身不等于已接受新的浅纸蓝金体系；以真实根是否进入当前 cover 与现行记录共同判断。
- CARD_DESIGNER_WRITES_ENABLED=false；openCardDesigner 与导入卡牌都自行返回照相馆。制作坊/卡牌导入不算待实现。开发模式“导出工具”的卡牌/备注导出仍有入口。
- 当前 renderHub 没有房间场景分支；openBaseHub("home") 转 deploy，预设入口已移除。旧房间/预设代码仅记遗留，不恢复入口。

## 覆盖矩阵

父级通过稳定 id 关联；根选择器为源码锚点，:has 表示可用于样式定域的组合。source 中行号仅为盘点定位，随并行编辑可能变化。已保护项不进入目标数。

| id / 页面 | 父级 / 入口 | 真实根 / 关键控件 | 源码 | 现行样式 | 状态 / 本轮边界 |
|---|---|---|---|---|---|
| home · 主页 | — / 启动 / showTitle | `#title.home-composed`；.home-plate / .home-tool / .home-wordmark | game/index.html;game/src/ui/game.menu.js | title-p0.css;home-menu-motion.css | 保护 · 已设计；保留；home-menu-motion 返回修复在途 |
| credits · 制作名单 | home / #mCredits | `#homeCredits.home-credits-dialog`；dialog / 三行名单 | game/index.html;game/src/ui/title-credits.js | title-p0.css | 保护 · 已设计；保留 |
| settings · 设置 | home / #mSettings / openSettings | `.pg.settings-page`；.settings / .chk / range / select / 清空操作 | game/src/ui/game.menu.js:893 | settings-cover.css via page-settings.css | 保护 · 已设计；保留 |
| inbox · 留言信箱 | home / #mInbox / openSuggestionInbox | `.pg.settings-page.sugin-page`；#sugBox / 筛选 / 卡片操作 | game/src/ui/game.menu.js:350 | inbox-cover.css via page-settings.css | 保护 · 已设计；保留 |
| feedback · 写留言 / 编辑反馈 | inbox / 新留言 / 修改 | `#sugLayer .sug-panel`；#sugText / #sugSteps / #sugExpected / #sugActual / #sugSaveBtn | game/index.html;game/src/ui/feedback.local.js | inbox-cover.css | 保护 · 已设计；保留 |
| guide · 生存指南 | home / #mGuide / btnHelp | `.beginner-guide`；.bg-layout / 目录 / SVG图示 / 翻页 | game/src/ui/beginner-guide.js;game/src/ui/game.menu.js:420 | beginner-guide.css | 保护 · 已设计；保留；六章导航/翻页/图示已源码核对 |
| achievements · 成就陈列室 | home / #mAch | `.achievement-gallery`；.ag-summary / .ag-grid / .ag-categories / .ag-filters / .ag-view | game/src/ui/achievement-gallery.js;game/src/ui/game.menu.js:445 | title-achievements.css（game.menu.js import） | 保护 · 在途；WF-ach-blank-dismiss；禁止覆盖 |
| achievement-detail · 奖章详情 | achievements / [data-gallery-item] | `.ag-detail / .ag-detail-backdrop`；.ag-detail-content / [data-gallery-dismiss] | game/src/ui/achievement-gallery.js:53 | title-achievements.css | 保护 · 在途；WF-ach-blank-dismiss；禁止覆盖 |
| slots · 五档选档 | home / #mStart / openSlotPicker | `.pg.slot-page`；.slot-deck / .slot-card / .slot-card-cta / .slot-card-ops | game/src/ui/game.menu.js:566 | slots-cover.css via page-slot-select.css | 保护 · 已设计；保留 |
| slot-errors · 坏档 / 恢复错误 / 覆盖删除确认 | slots / enterSlot / overwriteSlot / delSlot | `#slotRestoreError / .slot-card-ops .arm`；[data-act=overwriteSlot] / [data-act=delSlot] | game/src/ui/game.menu.js:583 | slots-cover.css（沿页内状态） | 保护 · 已设计；无独立弹层；不可更改恢复或删除逻辑 |
| data · 跑局数据 | settings / openDataPageUi / Alt+9 | `.pg.data-tuned`；.data-pg-head / .doom-stats / .dt-* / 导出清空 | game/src/ui/game.menu.js;game/src/agent/agent.data.js | page-datapage.css（含10-04新体系追加） | 保护 · 已设计；保留 |
| photo · 照相馆 | home / #btnCardLib / openCardLibrary | `.pg.card-library-page.studio-unified`；.studio-index-layout / .lib-grid / .library-inspector / 筛选 | game/src/hub/game.cardslib.page.js:589 | photo-studio-unified.css > photo-studio-cover.css | 保护 · 已设计；保留 |
| photo-detail · 照片大图与背签 | photo / libInspect | `#cardZoom.cz-photo`；.cz-photo-layout / .cz-photo-paper / .cz-photo-info / .cz-close | game/src/ui/ui.js:164 | photo-studio-cover.css;photo-studio-mounts.css;photo-studio-craft.css | 保护 · 已设计；保留；与普通卡牌放大分开 |
| character · 全屏选人 | departure / openClassChoice | `.pg.cls2-page`；.cls2-panel / .cls2-fullart / .cls2-faces / .cls2-confirm | game/src/run/game.run.altar.js:128 | character-cover.css via expedition-roster.css | 保护 · 已设计；保留 |
| character-pool · 角色卡池档案 | character / clsPool | `.pg.cls-pool-page`；.pool-main / .pool-side / .pool-catalog / .pool-filters / #poolGrid / .pool-pager | game/src/run/game.run.altar.js:270 | expedition-roster.css 原 feedback-r5 pool 规则；现已 import character-pool-cover.css / character-view-motion.css | 保护 · 在途；来源：docs/evidence/2026-10-04-WF-feedback-r5/README.md + PARALLEL-REGISTRY.md:16 WF-character-pool-cover。禁止本任务覆盖 |
| hub · 全屏远征基地外壳 | slots / openBaseHub | `#hubMain.pg.hub.hub-cover`；.hub-head / .hub-tabs / .hub-page | game/src/hub/game.hub.js:164 | hub-cover.css via page-hub.css | 保护 · 在途；WF-hub-cover；避让 |
| hub-deploy · 基地出发封面 | hub / hubTab=deploy | `#hubMain.hub-deploy`；.deploy-* / #btnDeploy / #btnNest | game/src/hub/game.hub.depart.js:hubDeployHTML | hub-cover-deploy.css;hub-cover.css | 保护 · 在途；WF-hub-cover；避让 |
| departure · 出发整备 | hub-deploy / deploy / openDepartPrep | `#depMain.departure-cover`；.dep-storage / .dep-filters / #depPool / #depBag / .pet-strip / 确认出发 | game/src/hub/game.hub.depart.js:149 | departure-cover.css via page-deploy.css | 保护 · 已设计；保留；与 hubDeployHTML 域分开 |
| hub-stash · 仓库总页 / 卡牌仓库 | hub / hubTab=stash | `#hubMain.hub-stash`；.warehouse-* / .stash-* / 卡牌分页 | game/src/hub/game.hub.pages.js:hubStashHTML | hub-stash-cover.css;hub-cover-collections.css | 保护 · 在途；WF-hub-cover；避让 |
| hub-pocket · 仓库消耗口袋 | hub-stash / hubStashView=pocket | `#hubMain.hub-stash .warehouse-panel`；.pk-row / 复原按钮 / 口袋分页 | game/src/hub/game.hub.pages.js:hubStashHTML | hub-stash-cover.css | 保护 · 在途；WF-hub-cover；避让 |
| hub-pets · 仓库宠物 | hub-stash / hubStashView=pets | `#hubMain.hub-stash .pet-sec`；.pet-row / selPet / hatch入口 | game/src/hub/game.hub.pages.js:hubPetsHTML | hub-stash-cover.css;hub-cover-collections.css | 保护 · 在途；WF-hub-cover；避让 |
| stash-card · 仓库卡牌 / 收藏品详情 | hub-stash / openStashItem | `.ov-shell.stash-shell[data-index="03"]`；.stash-pop-card / 收藏 / 卖出 one/all / stashBack | game/src/hub/game.hub.pages.js:295 | page-stash.css;overlays.css（不在 #hubMain 新 cover 域） | 待覆盖；cover-hub 或主代理 details；需明确唯一归属 |
| stash-egg · 宠物蛋孵化详情 | hub-stash / openStashItem 宠物蛋 | `.ov-shell.stash-shell[data-index="01"]`；hatchEgg / stashBack / .ov-stats | game/src/hub/game.hub.pages.js:206 | page-stash.css;overlays.css | 待覆盖；cover-hub |
| stash-material · 仓库材料卡使用 | hub-stash / openStashItem 材料 | `.ov-shell.stash-shell[data-index="02"]`；matUseOne / matUseAll / stashBack | game/src/hub/game.hub.pages.js:237 | page-stash.css;overlays.css | 待覆盖；cover-hub |
| stash-raw · 木材 / 口粮储备说明 | hub-stash / openRawItem | `.ov-shell.stash-shell[data-index="04"]`；.ov-stats / .ov-note / stashBack2 | game/src/hub/game.hub.pages.js:413 | page-stash.css;overlays.css | 待覆盖；cover-hub |
| stash-confirm · 仓库使用 / 卖出确认 | stash-card / confirmStashAction / confirmMatAction | `#overlay.fx-glass .card:has([data-act="stashConfirmOk"],[data-act="matConfirmOk"])`；stashConfirmCancel / stashConfirmOk / matConfirmCancel / matConfirmOk | game/src/hub/game.hub.pages.js:259;game/src/hub/game.hub.pages.js:280 | overlays.css;winter.css | 待覆盖；cover-hub / cover-system 基础 |
| hub-shop · 基地商店 | hub / hubTab=shop | `#hubMain.hub-shop`；.shop-shelf / .shelf-item / .shop-price-tag / shopBuy | game/src/hub/game.hub.pages.js:hubShopHTML | hub-cover-collections.css（已命中 shelf-item）；page-shop.css | 保护 · 已设计/冻结；老板最新令冻结此前同款改造整页；不补修或重设计 |
| hub-upgrade · 基地扩建 / 宠物升级 | hub / hubTab=upgrade | `#hubMain.hub-upgrade`；.hub-upgrade-layout / .up-card / .up-cap / .base-bar / .pet-row | game/src/hub/game.hub.pages.js:hubUpgradeHTML | hub-cover-collections.css（已命中 up-card/up-cap/pet-row）；page-upgrade.css | 保护 · 已设计/冻结；老板最新令冻结此前同款改造整页；不补修或重设计 |
| hub-personnel · 基地人物档案 / 外观选择 | hub / hubTab=classes | `#hubMain.hub-classes`；.person-tabs / .person-layout / .person-portrait / .person-details / .person-skins | game/src/hub/game.hub.pages.js:hubClassesHTML | hub-personnel-cover.css | 保护 · 在途；WF-hub-cover；避让 |
| hub-collection · 基地成就收藏总页 | hub / hubTab=ach | `#hubMain.hub-ach`；.collection-command / .collection-tabs / .collection-panel | game/src/hub/game.hub.pages.js:hubAchHTML | hub-cover-collections.css | 保护 · 在途；WF-hub-cover 主页避让；cover-hub 只补空缺 |
| hub-collection-cards · 人物卡收藏 / 里程碑 | hub-collection / hubCollectionView=cards | `#hubMain.hub-ach .coll-group`；.coll-cards / .coll-slot / .coll-ms-list / .coll-ms / claimColl / collZoom | game/src/hub/game.hub.pages.js:hubAchHTML | hub-cover-collections.css;page-ach.css | 保护 · 已设计/冻结；老板最新令冻结此前同款改造整页；不补修或重设计 |
| hub-collection-ach · 基地成就记录 / 领取 | hub-collection / hubCollectionView=ach | `#hubMain.hub-ach .ach-list`；.ach-row / claimAch / 已领取与未解锁状态 | game/src/hub/game.hub.pages.js:hubAchHTML | hub-cover-collections.css;page-ach.css | 保护 · 已设计/冻结；老板最新令冻结此前同款改造整页；不补修或重设计 |
| hub-backs · 卡背图鉴 / 装备卡背 | hub-collection / hubCollectionView=backs | `#hubMain.hub-ach .back-grid`；.back-card / .back-thumb / .back-lock / selBack / 锁定与当前卡背 | game/src/hub/game.hub.pages.js:hubAchHTML | hub-cover-collections.css;page-ach.css | 保护 · 已设计/冻结；老板最新令冻结此前同款改造整页；不补修或重设计 |
| map · 城市探索地图 | departure / 确认出发 / 继续存档 | `#viewport > canvas#game`；#sidebar / #expeditionChapter / #topBtns / #resHud / #hpHud / #bagBtnFloat | game/index.html;game/src/core/renderer.js;game/src/ui/hud.js;game/src/run/expedition.view.js | map-cover.css via expedition-map.css;page-expedition-hud.css | 保护 · 在途；地图 renderer / expedition-map / map-cover；禁止覆盖 |
| pickup · 金币 / 木材 / 口粮拾取 | map / openPickup / 对应格 | `.node-pg.sc-pickup .node-panel`；.pick-search / .ps-ground / .gain-big / pickupGo | game/src/run/game.run.scenes.js:185 | scenes.css;page-events.css;expedition-rewards.css | 待覆盖；cover-run |
| safe · 安全地带 | map / openSafeArea | `.node-pg.sc-safe .node-panel`；.blank-safe-gain / .gain-big / blankSafeDone | game/src/run/game.run.scenes.js:237 | scenes.css;page-events.css | 待覆盖；cover-run |
| fire · 营火休整 / 复原 | map / openFireRest / restPocketCards | `.node-pg.sc-fire .node-panel`；.fire-restore-hand / .fire-restore-card / restoreOne / fireDone | game/src/run/game.run.scenes.js:323;game/src/run/game.run.altar.js:45 | scenes.css;page-events.css | 待覆盖；cover-run |
| airdrop · 物资投放点 | map / airdrop 格 | `.node-pg.sc-event`；.evt-opt / scene-ops | game/src/run/game.run.flow.js:195 | scenes.css;page-events.css | 待覆盖；cover-run |
| story · 最后一盏引路灯 / 章节 / 记录失败 | map / story相关格 | `.node-pg.sc-event`；.story-* / .evt-opt / 重试与离开 | game/src/run/game.run.flow.js:316;:378;:415 | scenes.css;page-events.css | 待覆盖；cover-run；多阶段同壳 |
| events · 普通事件 / 黑市 / 修鞋铺 | map / openEvent 流程 | `.node-pg.sc-event .node-panel`；.evt-opt / .evt-sts-desc / .scene-ops | game/src/run/game.run.flow.js:462;:644;:845 | scenes.css;page-events.css | 待覆盖；cover-run；事件数据只决定文案与选项 |
| event-choice · 药摊 / 装备征用二级选卡 | events / openEventCardChoice | `.node-pg.sc-event .event-choice-hand`；.event-choice-card / eventCardPick | game/src/run/game.run.flow.js:539 | page-events.css;expedition-rewards.css | 待覆盖；cover-run |
| event-recode · 故障重编二级选卡 | events / openEventRecode | `.node-pg.sc-event .event-choice-hand`；.event-choice-card.picked / eventRecodePick / eventRecodeGo | game/src/run/game.run.flow.js:580 | page-events.css;expedition-rewards.css | 待覆盖；cover-run |
| start-supply · 选人后启程补给 | character / clsGrantGo 前 | `.node-pg.sc-event`；.bt-hand / .evt-opt / clsGrantGo | game/src/run/game.run.altar.js:440 | scenes.css;page-events.css | 待覆盖；cover-run |
| door · 环间门 | map / openDoorModal | `.node-pg.sc-door`；.evt-opt / goDoor / doorShop | game/src/run/game.run.altar.js:465 | scenes.css;page-events.css | 待覆盖；cover-run |
| altar · 污染祭坛 | map / openAltarRitual | `.node-pg.sc-altar`；.evt-opt / altarOn3 / altarItemRestore / altarFragHero | game/src/run/game.run.altar.js:501 | scenes.css;page-events.css | 待覆盖；cover-run |
| altar-reward · 祭坛回赠 / 复原 / 碎片不可用 | altar / openAltarReward / 回赠分支 | `.node-pg.sc-altar`；.evt-opt / altarRewardRestore / altarRewardLoot / 返回 | game/src/run/game.run.altar.js:535;:553;:587;:602 | scenes.css;page-events.css | 待覆盖；cover-run |
| boss-gate · 首脑巢穴封印 / 决战入口 | altar / openBossGate | `.node-pg.sc-altar`；.evt-opt / fightBoss / bossLeave | game/src/run/game.run.altar.js:627;:653 | scenes.css;page-events.css | 待覆盖；cover-run；战斗编组另列 |
| sacrifice · 祭坛 / 撤离献祭选卡 | altar / openBagSacrifice | `#overlay .card:has(.sac-card)`；.bt-hand / .sac-card / sacPick / sacConfirm / sacCancel | game/src/run/game.run.altar.js:686 | overlays.css;winter.css;expedition-rewards.css | 待覆盖；cover-run 或主代理 secondary |
| extract-entry · 紧急 / 终局 / 停用撤离点 | map / openEmergencyModal | `.node-pg.sc-exit`；.evt-opt / payExit / stayHere | game/src/run/game.run.altar.js:731;:741;:769;:778 | scenes.css;page-events.css | 待覆盖；cover-run |
| extract-sort · 撤离整理入库 | extract-entry / renderExtractStash | `#exMain.pg.hub.result-pg`；.result-* / .dep-* / exStash / exAll / exSmart / exFinish | game/src/run/game.run.altar.js:928 | expedition-rewards.css;page-rewards-bag-help.css;hub.css | 待覆盖；cover-run；不是 #hubMain，别误判基地 cover 已覆盖 |
| extract-retry · 撤离整理待恢复 | extract-sort / showExtractionRetry | `#overlay .card.page:has([data-act="extractRetry"])`；.pg.hub / .ov-note / extractRetry | game/src/run/game.run.altar.js:868 | hub.css;overlays.css | 待覆盖；cover-run + cover-system 基础 |
| extract-done · 撤离成功 / 首脑突破结算 | extract-sort / showExtractDone | `.node-pg.sc-exit`；.result-* / 物资与损失回执 / goBase / again | game/src/run/game.run.altar.js:1040 | scenes.css;expedition-rewards.css;page-events.css | 待覆盖；cover-run |
| loot-search · 开箱搜索演出 | map / chests.renderSearch | `#overlay .card.chest .pick-search`；.chest-prop.ps-chest / .ps-ground / .ps-tip | game/src/run/chests.js:256 | experience-loot.css;expedition-rewards.css;page-rewards-bag-help.css | 待覆盖；cover-run；素材沿用 |
| loot-reveal · 开箱 / 战后奖励 / 选一张 | loot-search / chests.render | `#overlay .card.chest`；.loot-manifest / .loot-capacity / .chest-reveal / .bt-hand / .chest-ops | game/src/run/chests.js:360 | experience-loot.css;expedition-rewards.css;page-rewards-bag-help.css | 待覆盖；cover-run；卡面保留 |
| run-shop · 局内战术补给站 | map / openShop | `.shop-pg.node-pg.sc-shop`；.shop-board-grid / .shop-slot / .shop-sellpost / .shop-resources | game/src/run/game.run.shop.js:248 | expedition-shop.css;page-shop.css | 待覆盖；cover-run |
| run-sell · 局内收购台 | run-shop / openSell | `.shop-pg.node-pg.sc-shop:has(.sell-desk)`；.sell-ledger / .sell-catalog / .sell-item / sellCard | game/src/run/game.run.shop.js:294 | expedition-shop.css;page-shop.css | 待覆盖；cover-run；与基地商店不同 |
| bag · 全屏局内背包 | map / B / #bagBtnFloat / shopOpenBag | `#overlay .card.bag-page .bag-view`；.bag-head / .bag-layout / .bag-grid / .bag-side-card / .pk-* / .bag-close | game/src/hub/game.bag.js:648 | expedition-inventory.css;page-rewards-bag-help.css;winter.css | 待覆盖；主代理 secondary；保留拖拽/翻面几何 |
| bag-drop · 丢弃卡牌确认 | bag / 拖出页面 / confirmDrop | `#overlay.fx-glass .glass-panel`；.glass-note / 确认与返回 | game/src/hub/game.bag.js:279 | overlays.css;winter.css | 待覆盖；主代理 system/details |
| bag-pouch · 法师锦囊收存 | bag / showPouch | `#overlay .card:has([data-act="pouchBack"])`；.bt-hand / pouchPut / pouchTake / pouchBack | game/src/hub/game.bag.js:381 | overlays.css;winter.css | 待覆盖；主代理 secondary |
| bag-pearl · 珍珠盒资源收存 | bag / showPearlBox | `#overlay .card:has([data-act="pearlBack"])`；.bt-hand / pearlPut / pearlTake / pearlBack | game/src/hub/game.bag.js:459 | overlays.css;winter.css | 待覆盖；主代理 secondary |
| bag-consumable-help · 卡牌是消耗品提醒 | bag / game.bag.settle 提醒 | `#overlay .card.discover:has(.ammo-teach)`；.ammo-teach / .at-col / .at-flow / .at-node / ammoTeachOk | game/src/hub/game.bag.settle.js:142 | overlays.css | 待覆盖；主代理 system |
| help · 各页二级说明 | map / UI.helpBtn / showHelp | `#overlay .card:has(.help-body)`；.help-body / .help-item / helpBack | game/src/ui/overlay.js:28 | page-rewards-bag-help.css;winter.css | 待覆盖；主代理 system；bag/shop/shopSell/extract 共用 |
| card-zoom · 普通卡牌详情 / 收藏卡大图 | bag / UI.showCardZoom 非photo | `#cardZoom:not(.cz-photo)`；.cz-card / .cz-note / .cz-foot / .cz-hint / .cz-close | game/src/ui/ui.js:201 | cards.css;winter.css（photo-cover 仅cz-photo） | 待覆盖；主代理 details；保留卡面 |
| terms · 词条讲解浮框 | card-zoom / 悬停术语 / touch | `.term-tip`；图标 / 标题 / 说明 | game/src/ui/term-tips.js:81 | overlays.css:503 | 待覆盖；主代理 details |
| notes · 格子备注编辑 | map / 编辑备注 | `#overlay .card:has(#ovNote)`；#ovNote / 保存取消 | game/src/hub/game.notes.js:63 | overlays.css | 待覆盖；主代理 system |
| notes-export · 格子备注导出 | notes / 导出 | `#overlay .card:has(#ovExport)`；#ovExport / 复制 / 返回 | game/src/hub/game.notes.js:117 | overlays.css | 待覆盖；主代理 system；与卡牌导出共享ID |
| notes-import · 格子备注导入 | notes / 导入 | `#overlay .card:has(#ovImport)`；#ovImport / 合并或覆盖 / 返回 | game/src/hub/game.notes.js:143 | overlays.css | 待覆盖；主代理 system；与卡牌导入共享ID |
| notes-clear · 清空备注确认 | notes / 清空全部备注 | `#overlay .card:has([data-act="doClear"])`；.ov-stats / doClear / closeTools | game/src/hub/game.notes.js:187 | overlays.css | 待覆盖；主代理 system |
| leave · 保存离局 / 放弃确认 | map / #btnHome / openLeaveMenu | `#overlay .card:has([data-act="leaveSave"])`；.ov-note / leaveSave / leaveAbandon.arm / leaveCancel | game/src/ui/game.menu.js:743 | overlays.css;motion-transitions.css | 待覆盖；主代理 system |
| abandon · 放弃结算 | leave / abandonRun | `#overlay .card:has([data-act="toTitle"])`；.doom-loot / .doom-cards / .ov-stats / goBase / toTitle | game/src/ui/game.menu.js:802 | overlays.css | 待覆盖；cover-run |
| death · 撤离失败结算 | battle / doDeath | `#overlay.fx-doom .doom-panel`；.doom-stats / .doom-loss-row / .doom-loot / .doom-btns | game/src/run/game.session.death.js:162 | overlays.css;winter.css;expedition-rewards.css | 待覆盖；cover-run |
| terminal-retry · 死亡 / 放弃终局保存重试 | death / terminal settlement失败 | `#overlay .card:has([data-act="retryTerminalDeath"],[data-act="retryAbandon"])`；.ov-note / retryTerminalDeath / retryAbandon | game/src/ui/terminal-settlement.js:36 | overlays.css | 待覆盖；主代理 system + cover-run |
| battle · 战斗主界面 | map / Battle.start / Battle.render | `.battle-stage.sts`；.sts-topbar / .sts-arena / .sts-hud / .sts-hand / .sts-tactics | game/src/battle/view/battle.view.js:377 | battle.css;expedition-battle.css;page-battle-ui.css;winter.css | 待覆盖；主代理 battle-shell；保留战区/卡面/VFX/判定热区 |
| boss-deck · 首脑战编组牌库 | boss-gate / bossSelect | `#overlay .card:has([data-act="bossGo"])`；.bt-hand / bossSel / .bs-count / bossGo / bossCancel | game/src/battle/view/battle.overlays.js:38 | overlays.css;expedition-battle.css;winter.css | 待覆盖；主代理 secondary |
| battle-choice · 战斗抉择 | battle / choosing state | `#overlay .card.discover .choice-list`；.choice-opt / btChoicePick | game/src/battle/view/battle.view.js:234 | overlays.css;page-battle-ui.css | 待覆盖；主代理 secondary |
| battle-hand-payment · 战斗选手牌 / 注能 / 支付 | battle / handSelecting state | `#overlay .card.discover:has([data-act="btPickHand"])`；.bt-hand / btPickHand / btPickHandSkip | game/src/battle/view/battle.view.js:266 | overlays.css;page-battle-ui.css | 待覆盖；主代理 secondary；内联.bt-infuse另属battle-shell |
| battle-discover · 战斗发现卡牌 | battle / discovering state | `#overlay .card.discover:has([data-act="btDiscover"])`；.bt-hand / btDiscover | game/src/battle/view/battle.view.js:280 | overlays.css;page-battle-ui.css | 待覆盖；主代理 secondary |
| battle-settings · 战斗设置 | battle / btSettings | `.bt-settings`；#btSetMusic / #btSetSfx / #btSetShake / #btSetPace / btSettingsBack | game/src/battle/view/battle.view.js:442 | overlays.css;page-battle-ui.css | 待覆盖；主代理 system |
| battle-grave · 战斗墓地 | battle / btGrave | `#overlay .card:has([data-act="btGraveBack"])`；.bt-gy-list / .bt-gy-row / btGraveBack | game/src/battle/view/battle.overlays.js:76 | overlays.css;page-battle-ui.css | 待覆盖；主代理 secondary |
| battle-deck · 战斗牌库 | battle / btDeck | `#overlay .card:has([data-act="btDeckBack"])`；.bt-gy-list / .bt-gy-row / btDeckBack | game/src/battle/view/battle.overlays.js:107 | overlays.css;page-battle-ui.css | 待覆盖；主代理 secondary |
| battle-bag · 战斗背包道具 | battle / btBag | `.battle-bag`；.battle-bag-slot / btUseItem / 返回战斗 | game/src/battle/view/battle.overlays.js:158 | overlays.css;page-battle-ui.css | 待覆盖；主代理 secondary |
| battle-settle-retry · 战后奖励未保存重试 | battle / settlement failed | `#overlay .card.discover:has([data-act="battleSettleRetry"])`；.ov-btns / battleSettleRetry | game/src/hub/game.bag.settle.js:67 | overlays.css | 待覆盖；主代理 system |
| run-transition · 进入节点 / 出发短过场 | map / showRunTransition | `.scene.flow-transition:not([data-presentation="base-arrival"])`；.flow-eyebrow / .flow-title / .flow-detail / .flow-line / .flow-hint | game/src/run/game.run.scenes.js:134 | scenes.css | 待覆盖；cover-run；不得覆盖 base-arrival |
| hub-arrival · 进入基地过场 | slots / showRunTransition base-arrival | `.flow-transition[data-presentation="base-arrival"] .hub-arrival-card`；.flow-* / .hub-arrival-card | game/src/run/game.run.scenes.js:134 | hub-arrival.css via hub-cover.css | 保护 · 在途；WF-hub-cover；避让 |
| nest-gate · 研究所大门钥匙确认 | hub-deploy / nestDeploy 首次 | `#overlay .card:has([data-act="labOpen"])`；.ov-note / .ov-stats / labOpen / labBack | game/src/run/game.nest.js:112 | overlays.css;winter.css | 老板明确排除；老板明确排除（user_excluded=true；非近期已改冻结），保留现行入口和父子层级 |
| nest-prep · 研究所备战 / 符文槽 | nest-gate / enterNestPrep | `#overlay .card:has([data-act="nestGo"])`；nestPick* / nestRune* / nestGo / nestBack | game/src/run/game.nest.js:155 | overlays.css;winter.css | 老板明确排除；老板明确排除（user_excluded=true；非近期已改冻结），保留现行入口和父子层级 |
| nest-map · 研究所线性路线 / 奖励选择 | nest-prep / renderNestMap | `#overlay .card:has([data-act^="nestCell"])`；nestCell* / nestPickRune* / nestBox* | game/src/run/game.nest.js:237 | overlays.css;winter.css | 老板明确排除；老板明确排除（user_excluded=true；非近期已改冻结），保留现行入口和父子层级 |
| nest-circle · 符文法阵 | nest-map / openRuneCircle | `#overlay .card:has([data-act="rcBack"])`；rc0..4 / rcBox / rcBack | game/src/run/game.nest.js:393 | overlays.css;winter.css | 老板明确排除；老板明确排除（user_excluded=true；非近期已改冻结），保留现行入口和父子层级 |
| nest-altar · 研究所祭坛 | nest-map / openNestAltar | `#overlay .card:has([data-act="naBack"])`；naHero / naReroll / naBack | game/src/run/game.nest.js:420 | overlays.css;winter.css | 老板明确排除；老板明确排除（user_excluded=true；非近期已改冻结），保留现行入口和父子层级 |
| nest-shop · 研究所神秘商店 | nest-map / openNestShop | `#overlay .card:has([data-act="nsBack"])`；.set-h / nsC* / nsK* / nsR* / nsBack | game/src/run/game.nest.js:461 | overlays.css;winter.css | 老板明确排除；老板明确排除（user_excluded=true；非近期已改冻结），保留现行入口和父子层级 |
| nest-extract-save · 研究所撤离未保存 / 正在保存 | nest-map / doNestExtract 分支 | `#overlay .card:has([data-act="nestExtractRetry"])`；.ov-note / .ov-stats / nestExtractRetry；保存中仅文本 | game/src/run/game.nest.js:522;:568 | overlays.css;winter.css | 老板明确排除；老板明确排除（user_excluded=true；非近期已改冻结），保留现行入口和父子层级 |
| lab-ending · 研究所通关三页演出 | nest-extract-save / playLabEnding | `#labEnding`；.lab-end-page / .lab-end-art / .lab-end-text / .lab-end-skip | game/src/run/lab.ending.js:36 | lab-ending.css | 老板明确排除；老板明确排除（user_excluded=true；非近期已改冻结），保留现行入口和父子层级 |
| nest-result · 研究所行动结算 | lab-ending / showLabSettlement | `#overlay .card:has([data-act="labScoreBack"])`；.ov-stats / .ov-note / labScoreBack | game/src/run/game.nest.js:637 | overlays.css;winter.css | 老板明确排除；老板明确排除（user_excluded=true；非近期已改冻结），保留现行入口和父子层级 |
| loading · 页面加载提示 | photo / runPageLoading | `.page-loading`；.page-loading-copy / .page-loading-track | game/src/ui/page-loading.js:29 | page-loading.css（JS import） | 保护 · 已设计/冻结；来源 docs/evidence/2026-10-04-WF-feedback-1004/README.md:10/:36 与 task.json:15/:19，本轮 secondary 覆盖已剔除 |
| exit · 退出后的重新进入页 | home / quitGame 网页分支 | `#exitScr`；#mBack / h2 / 说明 | game/index.html:304;game/src/ui/game.menu.js:830 | base.css;winter.css | 待覆盖；主代理 system |
| tooltip-log · 悬停提示 / 行动记录 / 资源预热 | map / UI.showTooltip / UI.log / boot | `#tooltip / #logPanel / #warmupTip`；.log-toggle / #log / .warmup-track | game/index.html;game/src/ui/hud.js;game/src/ui/cinematics.js | base.css;expedition-map.css;title-p0.css | 保护 · 冻结/混合；地图HUD/log在途和主页warmup已改，全部避让；#tooltip 未确定是否今天单独改过，单列保护待协调 |
| designer · 自定义卡牌设计器 | photo / 设计器 / 新建 / editCard | `.pg.cdes`；.cdes-stage / .cdes-row / #cardName / #cardDesc / #cardNote / 机制chips | game/src/hub/game.cardslib.designer.js:104 | page-cardforge.css;winter.css | 隐藏/不可达；CARD_DESIGNER_WRITES_ENABLED=false；openCardDesigner 直接返回照相馆，不恢复 |
| designer-export · 卡牌导出 | photo / 开发者模式 → 导出工具 → exportCards | `#overlay .card:has(#ovExport)`；#ovExport / 复制 / 返回 | game/src/hub/game.cardslib.designer.js:307 | overlays.css | 待覆盖；主代理 system |
| designer-import · 卡牌导入 | designer / importCards | `#overlay .card:has(#ovImport)`；#ovImport / 追加或覆盖 / 返回 | game/src/hub/game.cardslib.designer.js:333 | overlays.css | 隐藏/不可达；CARD_DESIGNER_WRITES_ENABLED=false；不恢复 |
| dev-console · 开发者控制台四页签 | settings / 开发者模式 / Ctrl+L | `#overlay .card.discover:has(.devc-topbar)`；.devc-topbar / .devc-tabs / 调试 / Agent / 数据 / 快捷键 | game/src/run/game.run.dev.js:171;game/src/agent/agent.console.js | overlays.css;page-datapage.css（只有 data-tuned 根才新） | 辅助待覆盖；主代理 system；保留能力与隐藏守卫，不做行为变化 |
| hidden-home · 旧基地房间布置与编辑器 | hub / renderHomeScene（当前renderHub无调用） | `#homeSceneHost / .home-scene`；.home-scene__stage / .home-scene__editor / 家具与展示位 | game/src/hub/game.hub.js:83;game/src/home/home.scene.js | home-scene.css | 隐藏/可达未证实；不恢复入口；不默认视作运行遗漏 |
| hidden-preparation · 收藏目标与出征预设 | hub-deploy / openPreparationPanel（入口已从封面移除） | `.preparation-shell / #preparationRoot`；.preparation-module / .prep-goals / .prep-presets | game/src/hub/game.hub.js:50;game/src/hub/preparation.view.js | preparation.css | 隐藏/可达未证实；不恢复入口；仅保留残留说明 |
| demo · 演示与验收宿主页 | — / dev.html / dev/* / QA / ?commDemo=1 | `#commDemoPanel / QA roots`；独立demo UI | game/src/ui/comm-feed.js;game/dev.html;game/dev/* | 独立验收样式 | 排除；不属于当前玩家正式界面；不能作为实页证据 |
| gain-card · 卡牌获得 / 传说揭晓 | events / UI.showCardReward / showLegendGet | `#cardGet / #legendGet`；.lg-beam / .lg-kicker / .lg-card / .lg-name / .lg-reason / .lg-hint | game/src/ui/cinematics.js:36;:82 | winter.css:404 | 待覆盖；主代理 details/secondary；保留卡面/时长/队列与点击 |
| boss-intro · 首脑登场 / 开战装备闪现 | battle / battle start | `.boss-intro / .bt-start-equip-flash`；.boss-intro-inner / .boss-intro-tag / .boss-intro-title / .bt-start-equip-label | game/src/battle/view/battle.view.js:100;:620 | battle.css | 待覆盖；主代理 battle-shell；只视觉承托与字体，不改演出时序 |
| photo-note-edit · 照片背签编辑 | photo-detail / 直接编辑照片背签 | `#cardZoom.cz-photo .cz-note.editable`；.cz-note-input / .cz-note-status；240ms 自动保存，无单独保存/取消页 | game/src/ui/ui.js:125 | photo-studio-cover.css;photo-studio-unified.css | 保护 · 已设计；保留；与已改照片详情共域 |
| photo-note-export · 导出照片备注 | photo / 开发者模式 → 导出工具 → exportNotes | `.library-tools [data-act="exportNotes"]`；原地下载JSON，UI.log反馈；无独立弹层 | game/src/hub/game.cardslib.page.js:604 | photo-studio-cover.css | 保护 · 已设计；保留；不是新的三级页 |

## 建议推进顺序

先补高频独立界面（局内背包、节点/商店/开箱、撤离整理）与共享小窗；随后覆盖城市战斗附属页；最后补独立获取演出、词条、退出及开发辅助壳。研究所全系列排除；角色卡池、统一加载页等此前改过的界面冻结。本矩阵仍为任务编辑基线，不将本任务刚新增的待验收 CSS 反计为冻结项。

研究所共用分支也须避让：game.nest.js:302 以 {isBoss:true,nest:{runes}} 进入通用战斗系统，所以 .battle-stage.sts、战斗设置/牌库/墓地/抉择/发现/支付、首脑登场及战斗卡牌大图的研究所分支同样不在授权范围。它们保留城市分支 target_this_task，不整页移出；当前 battle.view.js:377 只有 data-boss，没有研究所独有 DOM 标记，不能仅凭 .battle-stage 或 .card.discover 泛覆盖来宣称避让成功。主代理统筹共用壳，盘点代理不改源码。

本代理仅写 inventory.md / inventory.json；没有改运行代码、CSS、资产或台账。
