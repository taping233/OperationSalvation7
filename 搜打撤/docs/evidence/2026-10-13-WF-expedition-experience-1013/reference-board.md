# 真实实机参考板

本板用于按真实游戏界面复刻信息架构、排版和状态层级。素材清单见 `reference-board-sources.json`；目前 11 张，地图 2、事件 2、奖励 2、商店 3、战斗 2，全部记录源页面与原图链接。参考只供设计与验收，不作为本作生产素材。

## 已核实的复刻规则

1. 地图、事件、奖励、商店沿用固定的顶部状态与底部工具位置，中间只承担当前决策。
2. 地图节点以统一图标和短标签为单位；当前路线高对比，未选分支降权。节点选择不额外变成平行的路线目录。
3. 事件使用左侧场景/短叙事、右侧纵向选项；成本和结果直接位于动作标题附近。
4. 奖励卡按物品、名字、效果、领取的顺序；离开位于独立区域。任选其一与分别领取按本作规则明确标注。
5. 商店采用稳定商品网格、固定价格基线、独立刷新和离开；售罄原位反馈。
6. 战斗中央展示局面，常驻数值和系统操作贴边，局部反馈靠近目标。塔防具体布局不替换本作牌战规则。
7. 以灰黑承托内容，限制同时出现的强调色；通过明度、间距、字号和空间分区表达层级。
8. 卡牌玩法以杀戮尖塔的固定手牌/能量/结束回合位置为补充；物品卡直接承载读牌信息，关键词在邻近位置解释，商品价格保持统一基线。
9. 先复制已经看见的区域比例、对齐、分组和操作位置，再把本作内容填入；每个实施区域对应清单中的具体参考图，不能用泛泛的“方舟风格”代替构图依据。

## 证据与动态边界

- 首批五张均已在 Codex 内置浏览器中打开原图并直接观察；来自公开实机截图，没有 AI 参考图。
- 后续六张由网页检索/官方商店页面定位原图，下载到本地证据后用 `view_image` 直接观察。本輪内置浏览器返回 `Browser is not available`，没有改用外部浏览器。
- 每条 `observations` 只陈述图内可见事实；`adaptation` 是本作对应区域的实施目标。
- `motionVerified: false` 表示该图不能证明动画、加载时序、购买后的停留或转场行为。静态参考板不把推测写成动态观察结论。
- 商店图片左下红框属于攻略标注，事件图片外围含模拟器窗口；复刻时只取游戏内布局。
- 官方英文说明页本轮正文不可读，因此未把该页面当作可见实机证据。

## 本地参考副本

这些文件仅用于证据和参考板；源链接仍以 JSON 为准。下载方式为 `Invoke-WebRequest` 读取公开原图，未经修改。

| 条目 | 本地相对路径 |
| --- | --- |
| 选中节点详情 | `reference-images/arknights-is6-node-detail.png` |
| 杀戮尖塔事件 | `reference-images/slay-the-spire-event.jpg` |
| 杀戮尖塔奖励 | `reference-images/slay-the-spire-rewards.png` |
| 杀戮尖塔完整商店 | `reference-images/slay-the-spire-shop.jpg` |
| 杀戮尖塔牌战 | `reference-images/slay-the-spire-official-2.jpg` |
| 杀戮尖塔商品阅读态 | `reference-images/slay-the-spire-official-6.jpg` |

`reference-images/slay-the-spire-rewards.png` 为 1,453,995 字节，超过 1 MB，不进入 git。SHA256：`B4D2C0373C438EF5692D894D30D968B9E9F50D089BE1825B51D5E146FB32458C`；从 JSON 的 `slay-the-spire-reward.imageUrl` 获取。

另保留已查看但未选入板的截图：`slay-the-spire-map.jpg`（存在 ModTheSpire 标记，不作为原版地图布局主依据）、`slay-the-spire-official-1.jpg`（敌方回合特效静帧）、`slay-the-spire-official-3.jpg`（初始角色对话）、`slay-the-spire-official-5.jpg`（卡牌图鉴，超出本板正式流程主范围）。不把这些备选图混入复刻结论。
