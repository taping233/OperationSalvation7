# 珍珠盒存取界面可读性与原生按钮修复

已实现，未提交；当前任务释放源码编辑，真实窗口验收交父任务统一完成。

## 已核实的问题与范围

父任务真实截图：`../2026-10-16-WF-cloud-play-eight-hours/screenshots/75-pearl-storage-tiny-before.png`，1188×761 显示窗口、1920×1080 逻辑画布。旧界面沿用小字号通用样式且未指定弹层模式，远征中继承全屏居中 room 壳；存取候选是 `div[data-act]`，没有原生按钮语义。

本任务只修改：
- `game/src/hub/game.bag.js` 的 `openPearlStore()` 内 render、无障碍标记与重绘焦点
- `game/css/expedition-inventory.css` 末尾全部受 `.pearl-store` 限定的新样式
- `tests/pearl-storage-interface.test.js` 与本目录证据

保留同文件已有的 `decorateInventoryZoom` 等他属改动。未操作浏览器、服务、build、提交、真实存档或现场。

## 实现

- 复用现有远征 `battle-decision` 头部、可滚动内容区和固定页脚；使用现有 `bag` 模式避免继承 room 全屏卡壳
- 盒中/背包两栏；272 逻辑像素卡面，说明复用 `--card-copy-size:24px`，提示22px，返回按钮至少64px
- 按截图窗口的单次缩放比例计算，卡面宽约168px、说明约14.9px、提示约13.6px、返回按钮高约39.6px；这是CSS契约和缩放计算，尚未作为真实几何验收
- 存入/取出是 `button[type=button]`，明确标出卡名、张数、整叠动作；长规则卡面中的内嵌 tabindex 移除，避免嵌套焦点
- 取消按钮标为“收好珍珠盒，返回背包”，由共享取消探测处理 Esc；无需修改共享 overlay
- 存取后保留同一方向的候选焦点；该方向已无候选则聚焦返回，避免自动跳到相反动作
- 原“需要一个空背包格”提示改为“按所需背包空间整叠取出”，与现有整叠空间增量检查一致

存取动作、容量检查、整叠规则、保存与安全格保护未修改。`callback-integrity.json` 证明从 `bagAct('pearlPut'...)` 到 `openPearlStore()` 结束与 HEAD 字节相同（SHA256相同）。

## 实际验证

- 定向6文件89项通过：新界面专测9项、背包生命周期、既有整叠容量回归、bag架构、contracts、architecture-boundaries，见 `target-tests.log`
- `npm run check:syntax`：426源码通过，见 `syntax.log`
- `npm run typecheck`：8配置通过，见 `typecheck.log`
- ESLint：本任务JS和专测通过，见 `lint.log`
- `git diff --check`：任务源码和专测无空白错误
- `game.bag.js` 752行，保持现有 `<780` 架构门

专测使用 jsdom 原生按钮 DOM 与合成 `.click()`，并调用既有 Esc 处理方法；不声称已完成真实键盘或读屏器验收。专测还覆盖整叠容量拒收、普通存取、构造已有安全标记不变、重绘焦点、Esc仅回背包，以及返回后/再次开盒后旧回调均失效。

## 待父任务实页复验

1. 既有入口只允许打开普通背包里的珍珠盒；盒在安全格时先移回普通再开盒，本批未更改该行为
2. 打开盒子，确认双方候选、说明、整叠动作和返回按钮尺寸，检查列表内容可滚动而页脚保留
3. Tab/Shift+Tab 与 Enter/Space 存取，确认计数与焦点；检查无卡面内部焦点
4. Esc返回背包且仍在远征，再次开盒并存取、返回；检查无旧回调叠加
5. 复查父任务原有真实三把钥匙存盒/保护路径。当前真实现场由父任务掌握，本任务未变更

未运行build或项目全量；父任务统一执行R6集成验证。
