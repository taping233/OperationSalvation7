# player-9 当前独立审图结论

已逐张查看本轮全部22张2560×1440 PNG及legacy/native两张规则区100%像素crop。依据为player-9当前输出，未用旧passed替代看图。只读源码检查涵盖CjkNativeLayout、InlineIconText的测量/绘制接入与局部Cjk启用入口；未运行Unity/CUA、未改生产。

## 当前结果

在这22图覆盖范围内，**没有新增的确证P1/P2图片缺陷**。此前独立报告的以下实际问题已在新图关闭：

- 卡规则不再只有“选择 2”一行，长中文片段按可用宽度自然折行；当前crop未见滚动条盖半字。native字形仍清楚，未通过放大整个卡面或改写原始文案绕过问题。
- Guide0不再行首单独逗号，Guide2不再末行单独句号；Guide3的“提供9格资源”连续自然排版。
- 六章标题、lead、两列图文、图注、页脚完整；展开后的两处规则说明均可见，布局没有重叠或被页脚截断。
- Guide原图阅读当前显示完整原图与关闭键；局内Guide无共享HUD叠加。
- 祭坛、闸门上部context碰撞关闭，共享header中央仍显示区域/层数；正文和按钮未被重新排版挤压。
- 普通battle/pile/pile-reader/pile-return四图中，牌库标题无此前黑色遇敌提示条；reader里共享HUD隐藏，退出reader后在pile恢复。返回战斗按钮仍清晰可见。
- startup、title、settings、photo当前图未发现新增大段文本遮挡。photo未纳入本次Cjk局部启用范围，不能据其一般断行风格推断本次Cjk失败。

## 代码侧判断

新实现不再依赖U+200B。InlineIconText使用同一原生TextGenerator、实际raster scale测量advance，以当前rect宽度生成换行，再用同一scale绘制。CjkNativeLayout保留rich tag字节，icon按不可分unit处理，并根据新增换行修正icon.characterIndex；普通ASCII单词与中文标点禁则在Allowed中处理。当前局部启用没有修改Photo link span的全局索引机制。此判断未发现明确新副作用，不扩大为全部富文本/全部卡牌无条件通过。

## 验证边界与尚未入本轮包的修改

- player-9仍是当前窗口单尺寸实绘，不覆盖全部玩家流程、所有卡牌、存档分支或敌人动画。battle里的敌方是标注“受控敌人”的白块构造fixture，不能当真实敌人材质/演出验收。
- trace有constructed-player-wheel，target为guide-article-scroll、delta=-3；展开后一张图确实已滚动。它是原生滚动消费者的构造事件证据，不是本复核者执行的OS鼠标滚轮。
- 密度对照中规则viewport出现自适应宽差：legacy内容较短无bar、native内容更长有bar。此类源CSS允许的滚动条自适应不应误标为文案或字号改变。
- 主会话刚改的clip pivot左对齐、AB仅比较外层scroll host不变量，尚未重建进入player-9；本报告不把它们宣称为新图已验。
- root后续真实FilmFlow/Pile/Journey/Frames验证由其各自结果覆盖；本审图不代替这些流程与输入验证。

独立当前图片复核可收官；无新的生产修改建议。
