# 发现选卡公共焦点样式收口

已由 `bindDiscoverySelection` 接管的候选按钮，其焦点环统一由 `discovery-selection.css` 维护。战斗发现页保留10px焦点距离配置；其他公共发现保留6px默认距离，线宽与既有 `--discover-accent` 色彩保持原值。

## 替代关系与改动

| 现行来源 | 本轮收口 |
| --- | --- |
| `discovery-selection.css` 的 `button[data-discovery-option]:focus-visible` | 保持公共焦点环，距离通过 `--discovery-focus-offset` 读取，默认6px |
| `battle-discover.css` 的战斗发现候选焦点规则 | 移除重复的outline声明，仅在候选宿主配置10px距离 |
| `expedition-battle.css` 的通用 `.bt-card:focus-visible` | 已带 `data-discovery-option` 的候选交给公共入口；其他战斗选卡和牌堆继续使用原规则 |
| `card-layout-selected.css` 的通用卡牌宿主焦点规则 | 同样排除已接管的发现候选，其他卡牌宿主保持原规则 |

布局、卡宽、间距、主题变量和业务源码沿用现行实现。选中态继续由公共 `data-discovery-selected` 与 `aria-pressed` 驱动独立帧和标记；在途底栏继续由公共 `data-discovery-busy` 驱动。编组、献祭等其他选择方式保留各自状态样式。

## 状态

源码修改完成，待老板统一验收。本轮按约定未运行测试、lint、构建或浏览器，未新增测试。主会话统一维护占用与收官记录。
