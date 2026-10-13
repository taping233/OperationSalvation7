# 实际卡牌视觉调研与重新设计

老板否决首版四款排版，指出没有按要求搜集其他卡牌游戏设计。本轮补齐实际卡图参考，再重做三款中性色结构样板，正式卡牌外观仍待老板选择。

## 可查看产物

- [真实参考板](http://127.0.0.1:5200/card-design-references/)：6款游戏、12份官方图片/动图/实机截图，每项有原图、来源与结构拆解，支持点击放大。
- [重新设计样板](http://127.0.0.1:5200/card-design-options-v2.html)：01轻薄立体框（LoR角位与边沿层次）、02完整信息框（MTG连续分区）、03大画面徽章框（SNAP大名称与数字角位）。每版旁边明确参考对象。无题材主题，现有原画与卡牌字段不改。
- 获取脚本game/card-design-references/collect.mjs，全部具体URL、大小、SHA256在sources.json。单文件超过1MB的6份参考由同目录.gitignore排除，按manifest路径与URL可重新获取，未进入git。

## 研究结果

| 游戏及官方来源 | 具体参考 | 观察与采用范围 |
|---|---|---|
| [万智牌官方预览](https://magic.wizards.com/en/news/announcements/a-first-look-at-wilds-of-eldraine) | Talion标准框/无边框、Cruel Somnophage展示框 | 名称轨、图窗、类型轨、规则底板形成连续结构；无边框仍有清楚牌签和规则区域。本轮02采用连续分区。 |
| [LoR官方Data Dragon](https://developer.riotgames.com/docs/lor) | Lux、Garen、Deny正面图，来自7_10_0公开卡牌数据 | 边沿有亮面/暗侧/内沿，费用及攻防在角位；单位和法术的画窗轮廓不同。本轮01采用薄边和角位。 |
| [MARVEL SNAP官方媒体](https://marvelsnap.com/media/) | Captain Marvel变体展示图 | 角色与外框前后交叠，大名称具强轮廓，费用与力量固定角位。本轮03采用名称/数字主次；本项目效果文字保留在卡内。 |
| [炉石官方卡图](https://hearthstone.blizzard.com/en-us/news/24267727/) | Elise随从、Unleash the Crocolisks法术 | 画窗、曲面名称牌与效果底板连成实体；不同卡类轮廓不同。保留参考，不采用木雕、龙形题材装饰。 |
| [杀戮尖塔2官方](https://www.megacrit.com/press-kits/slay-the-spire-2/) / [开发展示](https://megacrit.com/news/2024-11-07-neowsletter-issue-4/) | 实机截图、品质展示动图 | 标题、费用、图窗、类别和效果区位置稳定；手牌和悬停卡使用同一体系。 |
| [Balatro官网](https://www.playbalatro.com/) | Joker卡牌图 | 大形与高对比在少量元素下维持识别；仅作简化参考，不引入像素风。 |

以上为实际图片观察与设计判断，不代表复制第三方游戏框图。新样板所有框、轨、徽章均由本项目HTML/CSS/SVG制作。

## 验证与状态

2026-10-10，Codex内置浏览器，当前窗口，无尺寸覆盖：参考板12图全部naturalWidth>0；新样板全部图片加载，青龙化身长文案规则区clientHeight/scrollHeight分别75/75、98/98、71/71，无截字和横向溢出；真实点击样本切换通过，两页error零条。截图reference-board.png / options-v2.png。

collect.mjs通过node --check，新样板内嵌脚本通过new Function解析，实页模块参考板加载通过；自有diff检查通过。无正式游戏逻辑变化，本轮未跑Vitest、未build、未提交、未新建服务。PENDING39更新到新候选，原卡牌美术留言仍待完成。

下载脚本初次将中文URL路径当作未解码pathname，参考下载到百分号编码路径；随后核对10项manifest后移到当前中文目标目录，并改用fileURLToPath。目录内图片、来源与SHA均已核实，初次创建的空父目录未删除。
