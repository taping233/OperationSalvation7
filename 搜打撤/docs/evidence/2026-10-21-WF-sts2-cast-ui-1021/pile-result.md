# 战斗牌库与消耗牌堆呈现整改

已将两个查看入口接到共用整卡网格：标题保留名称和总数，重复卡面显示数量角标，点卡沿用现有大卡阅读，底部只保留返回战斗。99 张相同初始攻击合并为一张整卡；同 ID 的费用、伤害、规则或强化数据不同则分开。原牌、原数组和 UID 未被修改。

本次使用 ui-art-overhaul 技能落实组件呈现整改；当前窗口实页由父会话验收。本子代理未启动服务、浏览器、构建或提交。

## 参考与适配

- 本地参考：`D:/素材/杀戮尖塔2源码/sts2-decompiled/MegaCrit.Sts2.Core.Nodes.Screens/NCardPileScreen.cs`。`OnPileContentsChanged`（225–237）先复制 `Pile.Cards.ToList()`，对抽牌堆副本按稀有度与 ID 排序后交给网格；`OnReturnButtonPressed` 关闭页面，`_ExitTree` 解除内容变化与关闭快捷键订阅。
- 本地参考：`MegaCrit.Sts2.Core.Nodes.Cards/NCardGrid.cs` 的 `SetCards`（830 起）复制展示集合，`UpdateGridPositions`（1039 起）以卡宽和间距居中排布；`OnHolderPressed` / `OnHolderAltPressed`（1069 / 1075）保留被操作卡槽并转发阅读动作。
- 我们保留现有共享卡框与 `UI.showCardZoom(card, {returnFocus})`。页面生命周期仍由 `bindBattlePageAction` 校验当前 DOM、可交互状态和战斗 token；没有复制尖塔的资源、规则或完整页面系统。
- 尖塔逐张呈现；本项目保留 99 张初始攻击的合并策略，以完整有效卡数据的稳定签名分组。展示副本按名称、类型、费用、ID 与签名排序，任何原牌序排列均得到相同展示顺序；HTML 不包含原位置或 UID，不能据此推断下一张抽牌。

## 精确改动

| 路径 | 本轮改动 |
| --- | --- |
| `game/src/battle/view/battle.pile-view.js` | 新共用模块。导出 `buildPileStacks(cards)` 与 `battlePileBodyHTML({cards,cardHTML,kind,isBoss?})`，返回新建的分组/UID 数组与 HTML，卡面引用只读。单处导入专属 CSS。 |
| `battle.decision-content.js` | 原 `battlePileBodyHTML` 改为再导出公共实现；供背包使用的 `pileDetailHTML` 与 `cardIdentityKey` 保留。 |
| `battle.overlays.js` | 两个实际查看入口改用 `btDecisionInspect` 和已有阅读绑定；移除旧常驻右栏与 `btInspectPile` 监听。 |
| `battle.decision-shell.js` | 仅牌堆标题显示总数；保留独立网格滚动；牌堆卡内 `[tabindex]` 设为 -1，整卡按钮是唯一卡槽 Tab 停点。其他流程标题与选择规则保留。 |
| `battle.view.js:369` | 仅在隐藏外置单位框的 guard 补上 `viewingDeck`。 |
| `game/css/battle-pile-view.css` | cast_layout 属地；本模块单处接入。280px 整卡、居中换行、网格独立滚动、固定返回、数量角标及牌堆专属轻退焦。 |

新增 `tests/sts2-pile-view-1021.test.js` 覆盖 99 UID、冻结数据、同 ID 有效变体、不同字段顺序的同卡合并、展示顺序独立于源顺序、最小空态、真实 UI 大卡阅读关闭后 DOM/滚动/焦点保留、返回原战场与旧回调失效。迁移已有 `battle-pile-readability`、`battle-decision-redesign`、`battle-hud-info` 和 `battle-infusion-action-layout` 的旧呈现契约，保留原领域断言。

父会话追加授权后，对 `tests/battle-hand-inspector.test.js` 先保存当前原字节，再只将原 1193 行总数断言从 `.battle-pile-summary` 迁移为 `.battle-pile-total === '2 张'`；其余注能、消耗 UID 与返回断言未改。原字节 SHA256：`fcba02d079d6a2b4a9b0497f84da1b23b2dce0416340da6edb750b53c777d9ab`。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npm.cmd run test:target -- tests/sts2-pile-view-1021.test.js tests/battle-pile-readability.test.js tests/battle-decision-redesign.test.js tests/battle-decision-lifecycle.test.js tests/battle-hud-info.test.js tests/battle-infusion-action-layout.test.js tests/sts2-consumed-pile.test.js` | 退出 0，7 文件 109 测试通过。 |
| `node node_modules/vitest/vitest.mjs run tests/contracts.test.js -t 'ESM 依赖方向\|架构守护\|HTML 只经 main.js' --reporter=dot` | 退出 0，8 通过、10 未选；新模块无循环依赖、反向依赖或页面装配缺失。 |
| `node node_modules/vitest/vitest.mjs run tests/battle-hand-inspector.test.js -t '普通战从空本场消耗牌堆到实际注能材料均可查看，返回保持战斗' --reporter=dot` | 退出 0，1 通过、96 未选；真实 BattleSession 注能材料进入消耗牌堆、阅读与返回契约通过。 |
| `node node_modules/typescript/bin/tsc --noEmit -p jsconfig.runtime.json --pretty false` | 退出 0。 |
| `node node_modules/eslint/bin/eslint.js` 后接本轮 5 个运行源文件与 6 个改动/新增测试文件 | 退出 0；追加迁移的 `battle-hand-inspector.test.js` 单独 lint 亦为 0。 |
| `git diff --check --` 本轮已有运行源文件与改动测试文件 | 退出 0；仅有已有 CRLF 的 Git 提示。 |

最初尝试把 `-t` 传给 `npm run test:target` 被该包装脚本拒绝，退出 1，未运行测试；随后使用上列原生 Vitest 的定向名称过滤成功。未运行全量测试或 build。

## 基线与交付

已有文件修改前原字节保存在 `.tmp/sts2-cast-ui-1021-pile-before/`；保留接班时他人未提交内容。`pile-own-baseline.patch` 是相对这份本轮基线的 JS/测试自有差分，不含 cast_layout 的 CSS。逐文件前后 SHA 与归属见 `pile-sha256.json`；其中 CSS 是接入时的观测 SHA。

- 自有差分 SHA256：`3fec2cc468742a17fc87bb9e63763f0401d4f3f78d3a114df9b783e6a81d326f`。
- 公共模块 SHA256：`ba210a433a4a6c578f7be65524c50a506b3b2ba429308b3bfe6ec338fd9b7ed7`。
- 新回归文件 SHA256：`f548293fc4cf22d026858c854ae3f54402cb41791d9ba2834d5be306dc5f2124`。

牌堆 JS 已冻结。清单中的 view/CSS 字节是本次冻结时观测；flow 后续获准在 view 迁移手牌切换按钮并保留 viewingDeck guard，最终集成字节以父会话最终 manifest 为准。当前窗口尺寸、卡面真实绘制、后景地图隔离与最终输入实页验收由父会话继续；父会话已将后景隔离问题交给 cast_layout，本子代理未对此扩大编辑范围。
