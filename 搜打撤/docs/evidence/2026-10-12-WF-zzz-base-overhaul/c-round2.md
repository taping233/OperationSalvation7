# C线第二轮交付

状态：C-R1至C-R4的授权实现与定向检查完成，文件冻结；待主会话原生成功/失败领取及当前窗口视觉复测。

依据：`visual-review-round1.md`及round1内08-rewards-before、09-reward-result-mismatch、07-collection、10-build原生截图。本线读取截图后修订，不将测试通过视为视觉验收。

## 修订

- **C-R1**：`game/src/hub/hub.reward-feedback.js`取消capture里的queueMicrotask。root capture仅保存该Event的领取前快照；稳定的ovBody在UI.init原动作委派之后注册一份bubble反馈监听，同一事件原委派执行/重建收藏区后才检查同slot、此前未领取→实际claimed、真实资源/卡牌/卡背差量。事件记录读后删除，弱集合防重复绑定；没有poll、重复执行、命令替换或保存改动。失败仍为真实尚未领取并保留原UI.log原因；确认与回执内Esc只关闭。
- **C-R2**：`game/css/base-archive-facilities-v12.css`内可执行的领取/扩建/卡背应用采用暖金`#e2c891`与深字`#172a35`；分类选中保留冷青，禁用和次级查看不改为执行主色。
- **C-R3**：`game/src/hub/hub.archive-v3.js`首页副标题改为已收藏，仅保留一份收藏室房间名；`game/src/hub/hub.collection-v4.js`详情查看改为次级按钮，自有CSS限制其内容宽度、48逻辑px最低高度和合理padding。
- **C-R4**：建设自有CSS取消确认组的margin-top:auto，当前→扩建后、材料、持有/需要、缺口和确认按相邻阅读组排列，详情区域可滚动。材料表用全可用宽度、数量右对齐，不再把标签缩为脚注。
- 与A对齐仅基地字号变量：label19、body22、title30逻辑px，在已知2/3外壳缩放对应约12.67、14.67、20屏幕px。奖励来源/状态、材料持有需要、收藏字段和回执去向沿同一合同。未修改全局游戏字号或外壳缩放。

## 接入合同

`bindRewardFeedback({root,base,meta,cards,ui})`仍在自有`bindArchiveV3`调用。ui.el.ovBody为既有动作委派容器，回执监听要求UI.init的原委派已注册；缺ui时仅在root已有#ovBody祖先上绑定。原`game.hub.js`与`UI.init`均只读。父壳不需要额外钩子。

## 检查及边界

- 自有c回执行为测试：exit0，4项通过。前三项改用实际DOM祖先ovBody委派顺序，覆盖marker/实际差量、失败原提示、确认/Esc、slot保护与重复监听。新增一项强制capture中的微任务立即checkpoint，并在原ovBody动作中重建archive，要求在原委派前没有回执、之后显示真实木材×2。该定向实验复现旧方案错误判定的条件，但不替代真实浏览器输入。
- `npx vitest run tests/hub-archive-v3.test.js tests/hub-upgrade-render.test.js tests/collection-room.test.js --reporter=dot`：exit0，27项通过。
- 3个本轮变更JS逐项`node --check`：exit0；2个CSS以现有PostCSS解析：exit0。
- 本轮未改`hub.facilities.js`的数值与原材料/容量命令；未写父壳或其他线属地。未浏览器/服务/build/全量/安装/提交/删除。

主会话需原生重测：成功一次出现已领取和真实木材增量；仓库不足或保存失败只显示尚未领取、目标仍可领取与原真实原因；确认/Esc返回同房间；暖金动作、收藏页头、详情按钮及建设条件组在1280×720的最终缩放和层叠下可读。

## 失败原因邻接补充

主会话原生复测指出原UI.log藏在基地覆盖层之后。仅修改自有helper和委派测试：capture记录ui.el.log已有节点身份，同一ovBody原委派完成后只读取本次新增warn节点的实际textContent，原文转义显示在尚未领取panel；没有新warn时不复制旧日志、不推测仓库或保存原因。原日志保留。确认/Esc语义、所有布局与其他文件冻结不变。

补充后自有委派测试exit0、6项通过，新增本次真实错误显示及无新错误不复制旧错误两项；helper的node --check exit0。最终指纹更新在c-round2-source.json，等待主会话一次原生成功与仓库满复测。

## Esc层级补充

主会话原生成功已确认口粮24→26、待领5→4及“已领取/口粮×2/基地资源”。随后原生Esc发现父overlay捕获返回处理器先于panel冒泡监听执行，导致跳回已收藏且回执仍在。

仅修改自有helper与必要测试：移除panel冒泡Esc处理，模块只注册一次window捕获监听，用WeakRef定位当前仍连接、未hidden/aria-hidden/inert的收藏室回执；该回执Esc先关闭并阻断父overlay返回，不调用命令、不改子页或计数。输入法组合/keyCode229及存在真实可见cardZoom时让路；没有当前回执时不拦截。弱引用避免离开/重建房间后保留旧DOM，关闭即清空当前引用。

自有委派测试exit0、8项通过；新增父overlay已有capture返回处理器时只关闭回执、子页/资源不变，以及组合输入/上层cardZoom让路两项。helper语法exit0。最终helper SHA256：`2E46754D4B6C20246F2B07A59D8E33955C6B34754A8946F885D83ACBA02C2845`。布局与其他源码保持冻结，等待主会话原生Esc与仓库满复测。

最终建设样式尾项：按主会话round2/06-build.png反馈，仅将选中设施的次级容量/单位small设为深青`#24424b`、opacity1，未选中灰字及所有布局不变。PostCSS解析exit0，未重复JS/业务测试。最终CSS SHA256：`7650E75BFF794A9CB5DAAFDAB299BE3A2758BB66BC26F87EDB87FE8335D26C5A`。

## 无前台日志的满仓事实补充

主会话最终原生成功/实际差量/Esc已通过；满仓slot2领取实际卡牌奖励失败时，待领和资源未变，但当前UI.el.log为null，原log函数直接return，无法取得原始错误文本。

仅在无本次新增原警告、真实未领取的情况下读取现行容量事实：stashRoom()精确为0，当前目标仍达成且奖励卡牌确实存在（收藏里程碑只核实真实可随机获得的传说候选或实际宠物蛋存在），才能显示“仓库当前剩余0格；卡牌奖励需要入库，尚未入库；整理后勤或扩建后重试”。只使用至少一格的可核实需求，不重建随机选择、批量数量或领取逻辑；剩余空间非0、纯资源、未达成或卡牌不可核实均不补容量原因。不推测保存原因，原命令与数值仍只读。

自有委派测试exit0、12项通过，追加无日志时0格真实卡、纯资源不误标、空间足够不误标、卡牌不存在不误标四项；helper语法exit0。最终helper SHA256更新为`F21F144B61023E3C302861E5AD3A7DD83D211C881E82B5F69870011247A14283`，CSS与其他布局不变。待主会话仅复测满仓场景。
