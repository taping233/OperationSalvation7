# 第二轮：地图定位按钮旧声明清理

已收拢一个控件组件：`#topBtns #btnLocate`。删除 `winter.css` 中 9 条已被后续同选择器完整覆盖的声明，保留最终规则的位置、选择器和 `!important` 优先级，没有新增覆盖层或删除文件。`expedition-map.css` 仅修正一处已失效的历史说明。

依据为当前 `game/index.html` 的真实顺序：第 22 行 `winter.css` → 第 24 行 `expedition-map.css` → 第 41 行 `page-expedition-hud.css`。以下原位置均取本批操作前源码；所列规则均不处于媒体或支持条件中。

| 原位置 | 原选择器与删除项 | 保留来源 |
| --- | --- | --- |
| `winter.css:506` | `#topBtns #btnLocate`：`position:fixed`、`right:16px` | `expedition-map.css:102` 同选择器的 `position:static!important`、`right:auto!important`。 |
| `winter.css:507` | `#topBtns #btnLocate`：`background:#1f2124`、`color:#dedfe0` | `page-expedition-hud.css:127、129` 同选择器的最终背景与文字色。 |
| `winter.css:508` | `#topBtns #btnLocate`：`width:44px`、`height:44px` | `expedition-map.css:102` 同选择器的 `width:40px`、`height:40px`。 |
| `winter.css:509` | `#topBtns #btnLocate:hover`：`background:#2b2e31`、`color:#ffffff` | `page-expedition-hud.css:133–135` 同 hover 选择器的最终背景与文字色。 |
| `winter.css:882` | `#topBtns #btnLocate`：`bottom:calc(142px + 12px + 82px)!important` | `expedition-map.css:102` 同选择器、同重要级别且后加载的 `bottom:auto!important`。 |

去掉空的 hover 分支后，将仅余基础声明的内层 `&` 收回原选择器中。定位按钮的点击处理、F 键能力、可见性选择器、按压态以及最终位置/尺寸声明保持原样；没有根据类名搜索结果删除动态规则。

操作前原字节：`css-before/round2-locate-winter.css`、`css-before/round2-locate-expedition-map.css`。本批依据源码和相关 diff 阅读实施；按老板要求未运行测试、浏览器、HTTP、lint、类型检查、构建或验证脚本。之前的 HUD 检查不代表本批已验收。
