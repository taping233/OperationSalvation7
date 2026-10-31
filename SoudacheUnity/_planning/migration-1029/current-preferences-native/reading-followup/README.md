# 大字卡特写：源行为与最小候选

当前结论：源要求卡牌说明**内部滚动**。首帧看不到后半正文不等同于遗漏内容；必须实测当前原生内层 ScrollRect 是否能到文案末尾。Root 明确解锁后已安装本目录通过私有类型检查的候选，生产现已重新冻结；最终 SHA 见 `production-freeze.json`。

## 源证据

- `game/index.html:54` 加载 `card-layout-selected.css`，该文件 105–110 行的 `.hsc-desc` 为 `flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:#69818d transparent`。
- 同文件 286 行的 `.reading-large #cardZoom .hsc-desc` 只将字号改为 `26px!important`，没有自动缩字或按正文扩高整卡。
- `card-zoom-controller.js` 经 `createCardZoomContent`，普通模式创建 `.cz-reading-layout > .cz-card > cardHTML(card,'lg')`，渲染后的正文写入 `.cz-card .hsc-desc`；照片分支使用独立 `.cz-photo-rules`，不在本轮修复范围。
- `review-ui.css:8` 定义 `.cz-reading-layout` 的横向布局；没有取消 `.hsc-desc` 内滚。
- 普通特写 `cover-details.css:31–32` 另有整个弹层的 `overflow-y:auto`，处理整体内容超过可用高度的情况。它不能替代正文内滚。
- `inventory-zoom.css` 为整个两栏容器保留外滚、资料栏 `.inventory-zoom-effect` 内滚，左侧仍是同一 `.hsc-desc`；右侧 `.inventory-zoom-rules` 的独立字号未受 reading-large 覆盖。

## 当前原生与候选

`CardFace.BuildCopy` 已给说明建立 `RectMask2D`、竖向 `ScrollRect`、`ContentSizeFitter.PreferredSize`，透明 Image 接受滚轮和拖动。`CurrentRewardCardZoom` 复用它，现有 `ScrollDescription` 默认 true。截图 `reading-card-zoom` 尚未做末尾滚动输入，不能单凭被 mask 的首帧确定滚动失效。

私有 `CardFace.cs.candidate` 仅为这条既有内滚补上源要求的薄滚动条（透明轨道、`#69818d` 滑块、内容未溢出自动隐藏），限定在已有 cardZoom/inventory-zoom/reward-cardZoom 祖先。复用 ScrollRect，不更改正文/整卡字号、卡宽卡高、奖卡动作栏、照片规则或普通手牌。薄条宽 6 个 native 逻辑单位，是对 CSS `thin` 的原生适配；不声称源规定了这个数值。

未修改 `CurrentRewardCardZoom`，没有新增外滚层或设计另一种大字模式。原有行距值也未在这次缺陷跟进中扩大变更。

## 原生待验（受理会话）

先在未变更生产上检查血毒双镖：找到放大卡 `copy-content/rules` 的 ScrollRect，记录 content.rect.height 与 viewport.rect.height；对 rules 的实际命中区域发送滚轮/拖动，确认 content.anchoredPosition.y 改变，滚到底后截图包含完整最后一句。程序设置 verticalNormalizedPosition=0 可作为布局辅助证据，但不能替代真实输入。

若原有内滚可用，修复定性为缺少滚动可见提示；候选补齐源 thin scrollbar。若原有内滚不可用，先记录 raycast 命中、首个事件接收者与 scroll/content 位置，定位后再作必要修复，不能把 thin scrollbar 当作已证明的滚动功能修复。

实施前必须由 Root 明确解锁，并匹配 `receipt.json` 的生产 SHA。`typecheck_candidate.py` 只替换本次私有编译输入中的 CardFace，不改生产，不写共享 compile，不调用 Unity。
