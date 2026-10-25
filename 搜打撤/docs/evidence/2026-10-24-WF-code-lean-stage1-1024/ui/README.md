# 第一阶段 UI 展示精简

本片修改 `game/src/ui/menu-settings.js` 和 `game/src/hub/hub.archive-v3.js`。设置页共用开关、滑条 HTML 与输入类型守卫；收藏室奖励和里程碑共用记录行、领奖卡片模板。输入回调传递原 input，按原位置重新读取 checked/value；音量模板按原两处分别读取服务端口；奖励页保留 rows/records 两轮元数据读取。

扣除新增 helper 后，运行源码 LF 规范化 UTF-8 字节减少 2466，Acorn 非注释 token 减少 116，物理行增加 3。未用压行获得减量。两份默认回归测试增加 14269 字节、3409 token，单独列于 `changes.json`，不计入运行源码收益。未删除文件，未提交。

## 验证

- 默认回归两文件直接 import 真实模块，使用服务端口 fixture 与固定公开行为断言，共 15 测；不读取缓存、文件或生成快照，不复制实现模板。干净检出仅需正常项目依赖。
- 设置覆盖 10 开关初值与正反向回执、2 滑条 0/37/100、无效冒泡目标、持久化/声音/动态/返回回执；另覆盖音量 getter 两次读取、服务回调重入改变 checked/value 后继续读取，以及先解析声音服务、再读取滑条值的原顺序。
- 收藏室覆盖奖励/里程碑空、未达成、待领取、已领取，文本及属性 escaping，记录切换和 aria 状态、详情节点与焦点保留、无效索引；计数服务反例锁定 collMsNeed 四次读取及两轮输出顺序。
- 最终定向 5 文件 37 测通过：两份新回归、menu-pages-slices、menu-return-chain、hub-archive-v3。目标 ESLint 与 Acorn 解析通过。
- 原 10 例精确 HTML/DOM/回执旧源差分完整保留于 `differential-settings.vitest.js`、`differential-archive.vitest.js`。它们位于 docs 且以 .vitest.js 结尾，不进入默认 tests/**/*.test.js；仅手动运行时依赖父会话冻结缓存。最终修正后手动差分 2 文件 10 测再次通过。
- 手动复现命令：`node node_modules/vitest/vitest.mjs run --config docs/evidence/2026-10-24-WF-code-lean-stage1-1024/ui/differential.config.mjs --reporter=dot`。完整旧源仍只保留父会话缓存，不复制进证据。
- 当前窗口游戏实页由父会话统一验证；本片未启动服务、未操作浏览器，未运行 build 或全量测试。

## 大块候选核对

已扫描全部授权 15 个运行文件。现有 jscpd（最低 45 token）检测只剩 3 个精确克隆、35 行，报告位于 `node_modules/.cache/lean-stage1-1024/ui-clones/jscpd-report.json`：

- `game.cardslib.page.js` 原 435–440 与 453–458：空闲追加/同步补齐尾部都认领、观察节点；前者按 deadline 和页面任务代次取消，后者按目标卡索引同步补齐。共同尾部仅约 6 行，新 helper 成本接近收益，未强行抽象。
- `game.menu.pages.js` 41–63 与 `menu-slots.js` 11–14：依赖注入参数列表与工厂形参相同，是接口契约，不删除接口。
- `menu-slots.js` 297–302 与 314–319：覆盖重开与删除档位的确认后清档共用尾部，但返回路径、启动流程、异步守卫各异，且本片保留存档语义边界。

另行核对的主要大块：照相馆整页/网格挂载、关闭资源释放、选片台局部刷新；收藏卡/人物卡池筛选；卡背/成就详情刷新；仓库特写动作。照相馆网格挂载顺序不同（局部先导航后观察，整页先观察后导航），恢复滚动/焦点与选中动作各异；选片台保留现有按钮节点而其他详情替换 HTML。收藏卡和人物卡池已经共用 `card-browser`、状态筛选、选中、懒卡面与翻页实现，其差异是计数文案、空态、选中与声音回执。仓库特写的唯一堆、二次确认签名、写入互斥和过期页守卫属于功能约束，未在展示精简中重写。

没有再发现可在本属地内大幅净减、同时无需改动行为或跨属地依赖的生命周期模板。未把此前已有 card-browser、reward、discovery、container 共享计入本次收益。
