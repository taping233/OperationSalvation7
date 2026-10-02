# Brogue CE：完整探索循环的源码阅读

2026-10-02；选择维护者公开的[社区仓库](https://github.com/tmewett/BrogueCE)，原作Brian Walker、CE维护者tmewett及贡献者。此次只选这一款，补原38条工具切片与2048缺少的地图、消耗品、资源风险及返程结局。C语言不妨碍阅读设计，但不代表其SDL/全局状态架构适合直接移植到Vite。

## 固定版本与实际拥有

[正式版本1.15.1](https://github.com/tmewett/BrogueCE/releases/tag/v1.15.1)，GitHub API release发布时间2026-02-12T22:34:53Z；标签直接指向commit **1ba4240b7a928ddf0ffb772717bf1d433cd63804**，不跟随master。

本地完整[源码ZIP](downloads/BrogueCE-v1.15.1-source.zip)来自[codeload固定提交](https://codeload.github.com/tmewett/BrogueCE/zip/1ba4240b7a928ddf0ffb772717bf1d433cd63804)。完整定义是该提交仓库归档的全部条目，含源码、平台目录、构建说明与包内资源；不含Git历史，不等于已安装SDL依赖的可运行发行包。另展开9个阅读文件；完整目录见[archive-inventory.json](archive-inventory.json)，逐文件size/SHA与获取方式见[download-manifest.json](download-manifest.json)。未build、运行、安装或亲玩，原始文件被library/.gitignore排除，归档>1MB不进Git。

## 源码和美术的许可边界

[根LICENSE](https://raw.githubusercontent.com/tmewett/BrogueCE/1ba4240b7a928ddf0ffb772717bf1d433cd63804/LICENSE.txt)为GNU Affero GPL v3，所读C源码头写明v3或后续版本。它是copyleft许可，不能把源码当成MIT工具随意拷入本项目；本次只研究系统方法，未批准直接复用代码或衍生发行。

[bin/assets/LICENSE.txt](https://raw.githubusercontent.com/tmewett/BrogueCE/1ba4240b7a928ddf0ffb772717bf1d433cd63804/bin/assets/LICENSE.txt)仅明确说明**tiles.png为CC BY-SA 4.0**、署名来源及其历史基础。若制作衍生图需满足归因、许可链接、修改说明与相同方式共享条款，见[官方许可说明](https://creativecommons.org/licenses/by-sa/4.0/)。这不是CC0，亦不覆盖Oryx另外出售的扩展包；icon.png、tiles.bin及其他资产未逐个完成复用授权核验。本次不提取美术候选、不渲染、不将任何素材投入游戏。

## 先读五条系统链

行号对应固定提交的原始文件。本地阅读文件均在downloads/readable/，下表在线链接定位原作者源码；函数名比行号更便于后续版本对照。

| 要回答的问题 | 阅读入口与已读范围 | 已核验行为 | 本项目可迁移方法（推论） |
| --- | --- | --- | --- |
| 地图何时生成、何时恢复？ | [RogueMain.c:startLevel，547及674–749](https://github.com/tmewett/BrogueCE/blob/1ba4240b7a928ddf0ffb772717bf1d433cd63804/src/brogue/RogueMain.c#L674) → [Architect.c:digDungeon，2877–2980](https://github.com/tmewett/BrogueCE/blob/1ba4240b7a928ddf0ffb772717bf1d433cd63804/src/brogue/Architect.c#L2877) → [initializeLevel，3764–3815](https://github.com/tmewett/BrogueCE/blob/1ba4240b7a928ddf0ffb772717bf1d433cd63804/src/brogue/Architect.c#L3764) | 首次进入用楼层seed生成、放楼梯和物品；已访问分支恢复楼层。地图加入湖泊时检查连通，生成/放楼梯有失败保护 | 区分节点生成、进入、重访；检查保证出口/目标可达的条件，别只看画面有路径 |
| 食物使用何时扣除、推进时间？ | [Items.c:eat，6681–6714](https://github.com/tmewett/BrogueCE/blob/1ba4240b7a928ddf0ffb772717bf1d433cd63804/src/brogue/Items.c#L6681) → [apply，6793–6843](https://github.com/tmewett/BrogueCE/blob/1ba4240b7a928ddf0ffb772717bf1d433cd63804/src/brogue/Items.c#L6793) | 食物有容量上限与浪费确认；成功消耗物品；取消返回，不走末尾回合结束 | 给消耗品写“验证→确认→生效→扣物→推进”的顺序表，取消和失败单独检查；不照搬营养值 |
| 生存压力怎样连接动作与资源供给？ | [Time.c:decrementPlayerStatus，1969–1980](https://github.com/tmewett/BrogueCE/blob/1ba4240b7a928ddf0ffb772717bf1d433cd63804/src/brogue/Time.c#L1969)；[playerTurnEnded，2219–2285](https://github.com/tmewett/BrogueCE/blob/1ba4240b7a928ddf0ffb772717bf1d433cd63804/src/brogue/Time.c#L2219)；[Items.c:物品供给，665–709](https://github.com/tmewett/BrogueCE/blob/1ba4240b7a928ddf0ffb772717bf1d433cd63804/src/brogue/Items.c#L665) | 回合消耗营养，饥饿耗生命；麻痹和持护符有例外；食物生成有随层深的保底逻辑 | 风险评估同时看消耗频率、回补分布和例外；随机掉落不应掩盖资源轨迹缺口 |
| 拿到目标是否等于已通关？ | [Movement.c:useStairs，2180–2220](https://github.com/tmewett/BrogueCE/blob/1ba4240b7a928ddf0ffb772717bf1d433cd63804/src/brogue/Movement.c#L2180) | 常规胜利要求持护符经首层出口上行；更深出口另走superVictory；普通楼梯是层转换 | 分开首脑击败、到达出口、成功撤离、结算完成，不让一个clear标志代替全过程证据 |
| 结算之后是否还允许回合变化？ | [RogueMain.c:gameOver，1203–1215](https://github.com/tmewett/BrogueCE/blob/1ba4240b7a928ddf0ffb772717bf1d433cd63804/src/brogue/RogueMain.c#L1203)；[victory，1218–1382](https://github.com/tmewett/BrogueCE/blob/1ba4240b7a928ddf0ffb772717bf1d433cd63804/src/brogue/RogueMain.c#L1218)；[Time.c，2246](https://github.com/tmewett/BrogueCE/blob/1ba4240b7a928ddf0ffb772717bf1d433cd63804/src/brogue/Time.c#L2246) | 胜利汇总金币/物品价值、发结局事件并置gameHasEnded；回合入口遇终局返回 | 结局文案、资产结算、事件与后续输入门禁分别验；静态函数存在不证明所有模式分支都正确 |

## 可执行的小实验与反例

下一轮先做一张不改游戏的**资源与结局轨迹表**：选同一规则版本的两条现有日志，逐决策记录楼层/节点、行动、血量、消耗品、战利品、是否允许撤离、是否结算；缺字段如实留空。再选一处使用消耗品的真实输入，核对取消/成功前后物品数与回合变化；完整四层验收把首脑、出口、整理结算、基地实收、终局后动作逐项对照。测试状态创建、真实输入或修改须沿当时授权执行，本研究未执行。

若资源一直充裕，不能仅因Brogue有饥饿就给本项目增加饥饿；若撤离只需短节点转移，不能照搬26层返程长度。Brogue没有本项目同样的卡牌构筑与局外基地，图形地图算法不能替代节点图设计。源码说明可以检查哪些系统边界，不能证明体验、平衡或性能已经适合本项目。先判断本项目哪个缺口真实存在，再决定是否借鉴。
