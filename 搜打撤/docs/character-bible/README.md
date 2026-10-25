# 人设库（character-bible）

本库维护五角色的外观身份、参考来源，以及已确认的游戏剧情背景与人物关系。角色数据见 `game/src/core/characters.js`，画风方向见[美术简报](../production/art/ART-DIRECTION-BRIEF.md)，接入要求见[视觉规范](../production/art/VISUAL-BIBLE.md)。

## 使用方式

- 人设以选人界面为准：角色数据源 `game/src/core/characters.js`（id / 名字 / 职业），立绘 `game/assets/portraits/full/`。具体视觉认可范围见[视觉规范](../production/art/VISUAL-BIBLE.md)。
- 旧 Danbooru 人设文字已于 2026-09-09 全部删除，**禁止引用或恢复**。
- 每个角色一页，页面分两块：**外观锚点**（美术出图用）+ **性格与背景**（剧情写作用）。
- 标注「待定稿」的字段 = 老板尚未提供素材，任何人不得擅自推断填充；老板改稿后及时回写本库。
- 角色身份、指定参考图的服装与姿态、画风方向分别核对；场景或卡面小样的确认范围以该任务记录为准。历史画师串、赛璐璐用词和旧姿态不自动拼入新配方。

第一部的共同故事、玩家知情范围及王诩、季渊的使用方向统一见[第一部剧情设定](../production/design/STORY-PART-ONE.md)。游戏与小说按平行宇宙处理，未定字段继续保留为未定。

## 角色索引

| 角色 | id | 职业 | 立绘 | 人设状态 |
|---|---|---|---|---|
| [无](wu.md) | wu | 侠客 | [ref-images/wu.webp](ref-images/wu.webp) | 外观沿目标页现行锚点；10-25补救出星月、前代无家庭关系与当前知情边界 |
| [常无欲](changwuyu.md) | changwuyu | 降临者 | [ref-images/changwuyu.webp](ref-images/changwuyu.webp) | 外观沿目标页现行锚点；10-25补升格会身份、回收目标、平民态度与无的友谊 |
| [白塔](baita.md) | baita | 法师 | [ref-images/baita.webp](ref-images/baita.webp) | 外观沿目标页现行锚点；10-25补升格会首领身份、回收目标与前代无旧账 |
| [黑像](heixiang.md) | heixiang | 战士 | [ref-images/heixiang.webp](ref-images/heixiang.webp) | 外观沿目标页现行锚点；10-25补退出升格会、灰域身份、对白塔私仇与夺取目标 |
| [星月](xingyue.md) | xingyue | 牧师 | [ref-images/xingyue.webp](ref-images/xingyue.webp) | 外观沿目标页现行锚点；10-25补回城丧亲、能力觉醒、自责与救城动机 |

## 参考图说明

`ref-images/` 是五张运行立绘的参考副本。白塔于2026-10-20更新为1037×1516贝雷帽书卷版，运行图和副本逐字节一致，见[实装记录](../evidence/2026-10-20-roster-nai5-redo/baita-install-receipt.json)。其余四人沿用1024×1536版本，来源见[统一重绘记录](../evidence/2026-10-18-roster-reference-final/README.md)。后续替换仍须重新核对。

无的当前锚点见[无](wu.md)；10-09旧版来源见[历史记录](../evidence/2026-10-09-wu-roster-portrait/README.md)。
