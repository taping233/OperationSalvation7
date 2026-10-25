# 插画节点公共组件实装

2026-10-25，老板授权将已确认事件模板接入正式游戏，宝箱、入城补给与火堆共用。当前实现完成，未提交，未运行 build。

老板后续指出奖励页不应套用。当前已撤掉开箱后、战斗后和入城补给领取页的共享布局，恢复独立奖励界面；事件、火堆、入城说明和宝箱开启选项保留。最新验证见 [范围修正](reward-boundary-correction.md)。以下保留首次实装的历史与验证。

## 首次实装行为（范围已修正）

- `illustrated-node.js` / `illustrated-node.css` 维护左叙事、右决策、局部滚动与页脚边界；复用已确认 v4 底板，标题在石墨带内下移 8px，选项使用不同的简洁低透明 SVG 虚影。
- `node-scene-view.js` 接入事件、火堆、入城说明与物资点。多项事件由 `event-choice-selection.js` 维护唯一的项内确认键；再次点击同项或 Esc 清空选择，确认转发原动作，单项直接执行。
- 火堆回复/复原保留原禁用条件与动作；奖励页显式传入 `scene` 接入入城和宝箱，保留原卡面、容量、回执更新和领取控制器。多箱总览复用相同的选项底板。
- `game/event-template.html` 直接调用正式组件，提供事件、火堆、入城、宝箱、多箱和长列表样例，不连接玩家存档。旧开发候选素材保留，不再被模板引用。
- 清除奖励容器原有尺寸隔离，避免卡牌区域折为 0 高；共用底板明确重置旧按钮伪元素尺寸与旋转，避免退化为小菱形。

## 验证

- `tests.json`：13 个文件，122 项通过，包括事件确认、原动作单次转发、火堆容量与禁用条件、稳定卡面回执、宝箱点击/队列/容量、contracts 和 architecture-boundaries。
- `entry-fire-flows.json`：按入城/补给/火堆名称筛选的实际控制器流程 2 项通过，64 项未运行。两批共 124 项通过。
- 所改运行代码、组件、预览模块和测试 ESLint 通过；定向 diff 空白检查通过。新增底板 selected asset audit 通过，全局清单错误 0，历史警告 569。
- 当前 Codex 内置浏览器、当前窗口 1280×720。模板直接使用正式视图；确认项内位置、不同虚影、长列表末项滚动、火堆、入城原卡面、多箱总览均复核。浏览器未见控制台错误。
- `/dev/chest-no-pity-review.html` 使用真实宝箱控制器和隔离内存存档：中箱三选一后显示已入背包/其余放弃；满包显示整理背包并保留奖励，腾出空间后恢复“收下”。`chest-controller.png` / `chest-full.png` 为真实控制器证据。
- `event-selected.png`、`fire.png`、`entry.png`、`boxes.png`、`long-selected.png` 为正式视图的隔离内容证据。没有宣称在玩家真实对局存档中完成入城或火堆操作；没有切换窗口尺寸。

## 扩展检查的既有失败

扩展 8 个文件 70 项中有 10 项失败，涉及旧奖励统计文案、旧静态 CSS 解析断言、终局撤离异步断言、旧遭遇编组断言。用临时 Vite 内存变换关闭此次事件/奖励共享布局后，对相同 4 个失败文件再跑：43 项通过，原 10 项仍失败，名称与断言相同。工作树没有回滚。见 `baseline-comparison.json` / `known-failures.json`；本任务没有改对应旧 CSS、撤离事务和遭遇规则。临时对照配置保留在 `.tmp/illustrated-baseline.vitest.config.mjs`，不纳入交付。

## 资产与现场

运行底板 `game/assets/ui/illustrated-node/choice-winter-v1.webp`，58660 字节，SHA256 `1a8e7b34e8ecfc80cc39e3b9049979f9ebc20afb5ddbff513d60927129dcbc92`。来源与指纹复核见 `asset-receipt.json`。仅更新 chests/scenes 两个已审阅消费者的 LF 指纹，未改变资产排除规则。未创建或停止服务，沿用主线 5200。
