# 战斗注能与发现布局实施

状态：实现与定向检查完成，待父会话以当前窗口内置浏览器复核。未启动服务、浏览器、构建，未提交、清理或删除文件。

## 改动与取舍

- 注能不再进入独立 decision 目录表单。`battle.view.js` 保留当前 `battle-stage`、`sts-hand`，按每张实际 UID 投影候选，已选 UID 从下方手牌移入上方独立已选区；点已选卡撤回同一 UID。
- 主卡使用现行卡框与字体，卡面常显。选材更新复用主卡卡面 DOM，长规则滚动位置保留；不再折叠主卡或以加减按钮作为主要选牌操作。
- 每张候选和已选卡显示同名副本序号、总数、同名已选数。前九张使用稳定的实际 UID 数字快捷键；超过普通九叠手牌页的候选在同一手牌横向滚动区显示。
- 战场退暗保留单位、血量和意图。背景战斗控件局部 inert，手牌和已选区仍可操作。确认未满时禁用；资源消费仍全部交给现有命令。取消、确认、直接打出和撤回绑定场次、来源 UID、selectionId、当前 workspace DOM 身份。
- 既有手牌退场会保留 240 ms 残影。本模式移除已离开逻辑槽的残影，避免同一 UID 同时出现在候选区和已选区；返回普通手牌同步清掉选材投影残影。
- 发现保持现有输入就绪、350 ms 门、单次提交和跳过规则。候选居中横排，生命周期与费用说明分开；卡牌专属注能/装备说明移到选择按钮外，卡面本身保持直接选择。未增加确认步骤。
- 使用现有 1920×1080 游戏布局坐标及全局等比缩放。本子任务未主动检查其他尺寸；父会话当前窗口原生 1280×720 的实际呈现仍待复核。

## 参考的本地尖塔实现

- `NPlayerHand.cs:956` 的 `SelectCards`：保留战场与手牌，选择模式增加退暗背板并显示提示。
- `NSelectedHandCardContainer.cs:76`、`:88`、`:106`：独立已选卡容器居中横排，点卡撤回。
- `NChooseACardSelectionScreen.cs:251`、`:269`、`:344`：居中横排候选，说明与卡面分工，保留 350 ms 输入门。

参考路径位于 `D:/素材/杀戮尖塔2源码/sts2-decompiled/`，仅借鉴构图和选择表现，未复制卡框或字体。

## View 接线

- `infusionHandCards(entries, infusion)` 只做视图投影，不改 hand、picked 或有效卡牌数值。普通手牌继续使用原有分组和稳定槽；注能只把投影切成单 UID。
- `renderInfusionSelection(...)` 在 `updateHand(...)` 之后运行；普通战斗时清理 workspace 和局部锁定。`focusedHandUid` 让键盘焦点随已选卡进入撤回按钮，撤回后回到同 UID 卡面。
- 已按流程代理接口读取 `infusing.selectionId`、`infusing.targetIndex`：初次命中的有效目标存在时使用直接继续文案，失效目标仍由领域命令复检。
- 道具已接 `createBattlePotionUse({ UI, getSnapshot, commands })`；普通渲染 `sync(stage,snapshot,potions)`，`btPotion` 调 `open(uid)` 并保留松手抑制；旧 tooltip 节点、旧键盘/说明监听及自用 pointerdown 直接使用已移除。敌方 pointerdown 指向拖动保留。off 图标含 UID 和可访问查看入口；前景保护包含 `.bt-potion-use`；HMR 调 `dispose()`。
- 未修改 aim、selection-ui、core、runtime、全局主题 CSS、数据或流程登记。父会话接管 `battle.view.js` 与其余本任务文件的后续集成。

## 实际检查

| 检查 | 结果 | 退出码 |
| --- | --- | --- |
| `npm run test:target -- tests/battle-infusion-action-layout.test.js tests/battle-infusion-material-state.test.js tests/sts2-cast-layout-1021.test.js` | 3 文件、51 例通过；最终一轮含主卡 DOM/规则滚动保留 | 0 |
| `npm run test:target -- tests/contracts.test.js tests/architecture-boundaries.test.js tests/sts2-hand-selection-contract.test.js tests/battle-discover-retained-feedback.test.js tests/battle-selection-ui.test.js` | 5 文件、106 例通过 | 0 |
| `node node_modules/typescript/bin/tsc --noEmit -p jsconfig.runtime.json --pretty false` | 全域 runtime 类型检查通过 | 0 |
| 自有 4 个 JS 源文件及修改/新增测试的目标 ESLint | 通过 | 0 |
| 自有路径 `git diff --check` | 通过；只输出既有 CRLF→LF 提示 | 0 |

过程中的旧“目录组卡加减/折叠主卡”测试失败已迁移为实际 UID 同屏契约。改为原位手牌后，旧数字键监听会响应 Ctrl/Alt 数字和 contenteditable；本模式捕获阻断游戏快捷键传播，同时保留浏览器和文本输入默认行为，相关回归已通过。

道具代理另报接线集成 5 文件、72 例通过，其命令/证据由该代理交付，本文不把它计为本代理亲自运行。

## 差异与字节指纹

- `layout-source.diff`：自有六个源/CSS 文件相对父会话 `.tmp/sts2-cast-ui-1021-before` 字节快照生成的文本差异；含本代理获授权的道具 view 接线。每个 `git diff --no-index` 的退出码为 0 或 1，1 表示存在差异，未当作检查失败。
- `layout-sha256.json`：六个源/CSS 文件、修改的既有测试、新增专属测试及 source diff 的 SHA256。测试不在父会话该快照中，未将其声称为快照相对差异。
- source diff SHA256：`cbb4eeb4d26c903457444c4273ae50b79bf44cda57878dec3971b62eb6d70966`。

## 未验项

当前窗口实页的主卡可读性、意图/血量是否仍清楚、上下两区及确认按钮是否重叠、横向滚动与真实鼠标/键盘输入、发现退暗和道具弹层实际层级由父会话统一验证。未运行全量 Vitest、完整多配置 typecheck 或 build，未作性能改善结论。
