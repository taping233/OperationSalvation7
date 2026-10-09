# 人设库（character-bible）

本库维护五角色的身份、参考来源与待定背景。角色数据见 `game/src/core/characters.js`，画风方向见[美术简报](../production/art/ART-DIRECTION-BRIEF.md)，接入要求见[视觉规范](../production/art/VISUAL-BIBLE.md)。

## 使用方式

- 人设以选人界面为准：角色数据源 `game/src/core/characters.js`（id / 名字 / 职业），立绘 `game/assets/portraits/full/`。具体视觉认可范围见[视觉规范](../production/art/VISUAL-BIBLE.md)。
- 旧 Danbooru 人设文字已于 2026-09-09 全部删除，**禁止引用或恢复**。
- 每个角色一页，页面分两块：**外观锚点**（美术出图用）+ **性格与背景**（剧情写作用）。
- 标注「待定稿」的字段 = 老板尚未提供素材，任何人不得擅自推断填充；老板改稿后及时回写本库。
- 角色身份、指定参考图的服装与姿态、画风方向分别核对；场景或卡面小样的确认范围以该任务记录为准。历史画师串、赛璐璐用词和旧姿态不自动拼入新配方。

## 角色索引

| 角色 | id | 职业 | 立绘 | 人设状态 |
|---|---|---|---|---|
| [无](wu.md) | wu | 侠客 | [ref-images/wu.webp](ref-images/wu.webp) | 外观锚点与选人立绘已更新（2026-10-09 老板确认）；性格背景待老板提供 |
| [常无欲](changwuyu.md) | changwuyu | 降临者 | [ref-images/changwuyu.webp](ref-images/changwuyu.webp) | 角色参考见本页现行段；卡面工作状态查对应任务，性格背景待老板提供 |
| [白塔](baita.md) | baita | 法师 | [ref-images/baita.webp](ref-images/baita.webp) | **外观锚点已定稿并入库**（09-19 painterly 全身立绘，老板授权 Friday 定锚点）；性格背景待老板提供 |
| [黑像](heixiang.md) | heixiang | 战士 | [ref-images/heixiang.webp](ref-images/heixiang.webp) | **外观锚点已定稿并入库**（09-12 白底喝咖啡赛璐璐大图验收）；性格背景待老板提供 |
| [星月](xingyue.md) | xingyue | 牧师 | [ref-images/xingyue.webp](ref-images/xingyue.webp) | **外观锚点已定稿并入库**（09-12 赛璐璐大图验收）；性格背景待老板提供 |

## 参考图说明

`ref-images/` 是五张运行立绘的参考副本。10-09 本轮核对，它们与 `game/assets/portraits/full/` 对应文件逐字节相同，证据见[本轮记录](../evidence/2026-10-09-WF-doc-system-art-cards-1009/README.md)。后续替换时核对实际引用和副本状态，不把这一时点结论永久当作同步保证。

无的立绘与参考副本于2026-10-09同步替换；当前锚点见[无](wu.md)，替换与验收见[本轮记录](../evidence/2026-10-09-wu-roster-portrait/README.md)。
