# 世界流程与 UI 分片审查

- 输入：本目录上级 `snapshot/`，冻结的 Vite 主线源码；包括上轮 4 项已修未提交改动。
- 范围：`assigned.json` 中 owner=world_ui、category=review-target 的 84 文件。
- 覆盖：19 deep、17 systematic、48 static-only（其中 43 CSS；另含旧 dev 入口、冻结研究所、素材元数据及 Ink 文本）。逐文件风险和限制见 `coverage.json`。
- 本分片只读产品源码；只写 world_ui 独占审查证据，未改产品/仓库 tests/共享台账，未提交/安装/启动服务/操作浏览器。

## 确认问题

| ID | 优先级 | 位置 | 触发与结果 |
|---|---|---|---|
| WORLD-001 | P2 | `game/src/run/game.run.scenes.js:200-202` | 拾取页开关背包后恢复页有领取按钮，但 skipSearch 提前返回，动作表已被关闭背包清空，按钮失效。 |
| WORLD-002 | P2 | `game/src/run/game.run.altar.js:45-61` | 火堆先回复/抽职业卡，继续旅程才消费格；开关背包可回 idle 且未消费格，再点脚下火堆重复收益，最后消费后重复收益落盘。 |
| WORLD-003 | P2 | `game/src/run/game.run.flow.js:523-547` | 装备征用令扣 3 币并消费格后，二级选卡页未登记返回钩子；开关背包丢选卡页，重进已消费，无卡可领。 |
| WORLD-004 | P2 | `game/src/ui/game.menu.js:1039` | 设置→留言库直接注册函数，动作 dataset 被误当 fromTitle 布尔值；返回去标题，未回设置。 |
| WORLD-005 | P3 | `game/index.html:373`（同类 358 行） | 启动兜底 `clearInterval(this)` 收到 Window 而非计时器 ID；失败条每 400ms 重建，关闭后再次出现；成功后也不停表。 |

完整调用链、预期/实际、影响与复现边界见 `findings.json`。优先级由本分片初判，根代理仍需独立复核、整合去重。

## 验证

已有本地 Node/Vitest/jsdom，显式独占配置，不读取默认构建 hooks；快照模块只导入执行不写回。

```text
node node_modules/vitest/vitest.mjs run --config docs/evidence/2026-09-30-full-repository-review/world_ui/repro.config.mjs --reporter=verbose
5 tests passed / 1 file
```

- 原样快照 scenes、altar、flow、menu、overlay、bag-return-hook；session、卡库/展示、事务端口为夹具。
- 背包关闭使用 `game.bag.js:233-254` 非宝箱分支的精确镜像，执行实际 hideOverlay 与实际钩子。故这些是模块级可复现证据，**不是完整背包 UI 或真实浏览器验收**；根代理可用实际 B 入口另验。
- 火堆职业卡概率夹具设 1，以确定性呈现重复发卡；实际 30% 等概率由 MAP 定义，重复回血不依赖概率。夹具最终保存 hp=31、ownedCards=3、visited=1，证明最后正常结算会保存重复收益。
- 装备征用令夹具固定事件和三件装备，调用真实 runEventDeck/evtChoice；9币→6币、visited=1，关背包/重进后 cards=0、再次保存6币。
- 启动脚本从冻结 index.html 原样读取，在独立 jsdom 执行，fake timer 回调 this 显式绑定 Window，匹配浏览器计时器回调；12秒后关闭条，400ms后条重现且计时器仍存活。
- 初次本地 Vitest 启动遇 sandbox `spawn EPERM`；之后使用获准的已有本地工具子进程执行，无安装和全局配置更改。最终有效结果见 `repro.log`。早期夹具路径/断言调试不作为产品失败证据。

## 静态和未核验边界

- CSS 43 文件 PostCSS 解析，输出规则/important/media/import 清单及尺寸、溢出、显隐、层叠、焦点、命中声明候选到 `css-static-scan.json`；结合 index 装配、overlay/浮动背包/卡牌大图/节点页风险片段读审。解析和定位不代表逐条视觉语义审阅。没有 computedStyle、真实窗口命中、颜色对比、素材像素或全部级联组合结论。
- 没有打开浏览器、切窗口尺寸、外部/headless 浏览器、构建或全量游戏验收。完整 4 层、玩家旧档、所有 UI×节点×背包×异步失败组合未穷举。
- home Pixi/房间校准仅静态流程读审；未创建 WebGL 上下文或判断家具画面像素。
- `game.nest.js` 与 `lab.ending.js` 研究所冻结遗留链按 static-only 记录。文档明确冻结、公开关卡制作中，未把直接调用冻结函数夹具结果报成活跃玩家 P1。
- 已发现但未确诊：宝箱 resourceOnly opts 未传播（需当前 chest/resource 合约）；研究所 next/nestPos 结算错位（冻结/公开可达未验）；复原容量判定与 canReceiveCard 特例差异（规则边界未定）。详见 findings.suspected。
- 上轮 F1-F4 不重复报告。PENDING #13/#19/#20、moveCancel IME known 由根代理统一收录。

## 覆盖定义

- deep：完成主要状态/调用链及失败、取消、重入、异步归属风险读审；有疑点时做模块复现或明确列未确诊。并非所有输入组合和全行动态执行。
- systematic：按功能、接口、状态/副作用、DOM或数据契约系统读审，但跨域依赖、真实环境或部分边界未深验。
- static-only：结构/声明/引用或冻结遗留风险静态检查；不能声称视觉体验、可达生产链路或完整业务验收。
- 本分片 84 文件都有条目；没有把搜索命中或测试通过当成全部逐行审查。
