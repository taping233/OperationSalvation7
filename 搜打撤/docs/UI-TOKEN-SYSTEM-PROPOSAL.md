# UI Token/变体体系提案（UI-TOKEN-SYSTEM-PROPOSAL）

文档状态：09-29 的候选方案，实施范围需按当前 UI 问题和文件归属确定。参考 [shadcn/ui](https://github.com/shadcn-ui/ui) 的语义变量、项目内组件源码和变体矩阵组织方式；视觉与保留项按[现行视觉规范](production/art/VISUAL-BIBLE.md)核对。

下方重复统计来自当时的 `docs/evidence/jscpd-2026-09-29/`，选题前重新确认对应文件与重复块。

## 现状问题（jscpd 实证）

| 重复 | 行数 | 根因 |
|---|---|---|
| card-v3.css ⇄ winter.css | 109（单块 85） | 卡面组件结构被主题皮整段复制，变量化只做了 `--cf3` 等个别色 |
| page-ach⇄upgrade / shop / events⇄rewards | ~93 | 弹层页头/关闭钮/列表/按钮各页各抄 |
| 硬编码色值散布 | — | `#f2854a`/`#f5c542`/`#0d1116` 等直接写在规则里，主题无法整体换肤 |

## 目标架构：三层分离

```
tokens.css          语义变量层（唯一真源，主题只覆盖值）
page-base.css       弹层/页面骨架层（结构+变体矩阵，无主题色）
hs-card 骨架段      卡面结构（布局/层级/尺寸，色彩全走 var()）
card-v3 / winter    主题层：只写 token 覆盖 + 主题特有演出（渐变/描边纹理）
```

### 第 1 层：tokens.css 语义变量（shadcn 命名法适配）

两级：**语义层**（组件只准用这层）→ **品牌层**（具体色值，语义层引用）。

```css
:root {
  /* 语义层（组件只用这些） */
  --surface: var(--brand-deep);        /* 面板底 */
  --surface-2: var(--brand-deep-2);    /* 次级面板 */
  --border: var(--brand-line);         /* 常规描边 */
  --text: var(--brand-text);           /* 主文本 */
  --text-dim: var(--brand-text-dim);   /* 次文本 */
  --accent: var(--brand-gold);         /* 强调/货币/选中 */
  --danger: var(--brand-ember);        /* 危险/失败 */
  --ok: var(--brand-leaf);             /* 成功/可走 */
  /* 状态派生 */
  --overlay-scrim: rgba(0,0,0,.55);
}
:root[data-theme='winter'] { /* 冬季皮只在这里覆盖值，不改结构 */ }
```

品牌层色值从现有规则里收编（示例映射，迁移时全量盘点）：`#f5c542→--brand-gold`、
`#f2854a→--brand-ember`、`#0d1116→--brand-deep`、`#c9d3da→--brand-text`。
**口径**：组件规则里出现裸十六进制色=违规（lint 可查，后续可加 stylelint 规则守卫）。

### 第 2 层：page-base.css 骨架 + 变体矩阵（cva 思路 vanilla 化）

`ov-btn` 变体矩阵（制式化后新页面只许引用，禁止再抄样式）：

| | `--md`（默认） | `--sm` |
|---|---|---|
| `ov-btn`（默认） | 常规动作 | 紧凑行内 |
| `ov-btn ok`（确认） | 主确认金 | — |
| `ov-btn danger`（危险） | 破坏性/放弃 | — |

页头/关闭钮/列表行/统计条（`.ov-stats`/`ds-k`/`ds-v` 族）同抽入 base。
**状态约定**（shadcn data-state 形制）：弹层容器 `data-state="open|closed"`、
按钮 `data-loading`/`disabled` 属性驱动样式——CSS 只认状态属性，不认 JS 临时类名。
注意与既有 `inert` 隔离机制（soudache-inert-overlay-isolate-quirk）兼容：骨架层
统一在 `data-state=open` 时挂 inert 排除名单逻辑，别再各页手写。

### 第 3 层：主题层收敛

winter.css / card-v3.css 改写后只包含：token 覆盖 + 该主题特有演出（纹理/描边风格/动画）。
85 行级重复消失的判定：**结构选择器在主题文件中出现 0 次**。

## 迁移三步（每步独立可验收，jscpd 对账）

1. **建 tokens.css + 收编色值**：只加不改行为，页面视觉零变化（diff 验证渲染一致）；
2. **page-base 骨架层**：page 系 5 文件改引用，预期消 ~93 行（jscpd 对账）；
3. **hs-card 骨架+主题分离**：card-v3/winter 改写，预期消 109 行（结构选择器 0 出现）。

## 边界与风险

- **不碰游戏演出层**：doom-panel/battle 演出动画不走此体系（演出=资产，非制式）；
- **避开 CSS 热点**：等照相馆（expedition-library.css/cardslib）验收收官后动工；
- **ui-scale 兼容**：CSS 变量与 zoom 缩放无交互，无风险；
- **收益声明**：结构重复 -202 行 + 新主题/新页面的边际成本从「抄一套」降为「写覆盖」；
- 迁移全程按[归档的规格流程](archive/SPEC-PROCESS.md)档二规格走（跨域 CSS 改动，符合其触发阈值）。
