# player-5 独立像素复核

实际查看全部7张2560×1440 PNG：startup、title、legacy/native卡牌、photo、settings、guide-0。另生成无缩放卡牌局部crop，以免展示工具缩小全图后掩盖字形差异。未启动Unity/CUA、未修改生产文件。此次整体取证在Guide翻章异常后失败，不能给全流程通过。

## Findings

### P1：Guide首章图文布局失效，翻章又发生异常

`player-5/player-guide-0.png` 已经显示实际布局错误：左侧插图偏到屏幕外，上部被页头截掉；原本应位于文章上部的章节heading/lead不可见；实机图注与编号说明也不可见。Trace中guide-shot的screenBounds为 minX=-269.97、maxY=1537.16，超出2560×1440 backbuffer和文章可视区。文章右侧步骤仍可读，因此不能将这张图归为“尚未入场”的统一隐藏状态。

直接相关代码为 `CurrentBeginnerGuide.Content.cs` 中 `GuideSticky.LateUpdate`：A.Box创建的figure保留默认中心pivot，LateUpdate直接把anchoredPosition置为(0,-travel)，丢失创建时的半宽/半高偏移，符合图像移出左侧的实测方向。源 `beginner-guide.css` 的.bg-illustration是位于左图列正常流中的sticky图；此错位没有源设计依据。

此外 `player-5/result.json` 已记录Guide翻章在 BuildArticle → CurrentArchiveUi.Surface 的NullReferenceException。首章画面错位与翻章异常应分别验证修复；修复异常不等于首章布局合格。

### P2：卡牌说明被右侧滚动条遮住字形

`player-card-native-density.png` 和 `player5-card-native-crop.png` 第一行末尾“第”的右半部被滚动条盖住。Trace首行真实文本为“选择 2 个目标（可以重复）：对第 ”，可排除原文只包含半个字的解释。

目标 `CardFace.cs` 的DescriptionScrollbar在rules viewport右侧占6逻辑单位（当前放大×Canvas后为12物理像素）；description左右offset仍为0，因此文字布局宽度包含滚动条下面的区域。源 `card-layout-selected.css:104-113` 使用原生overflow:auto薄滚动条，滚动条会占用文字可用宽度。应复核实际描述宽度和滚动条区域，不应扩大整张卡或改写原文绕过遮挡。

底部只显示部分描述本身尚不能当成文本丢失：源和目标均允许说明区域滚动。本轮没有说明滚到底的操作证据。

### P2：Guide首章出现源数据不存在的空feature面板

`player-guide-0.png` 右侧第三条步骤下面有空深色大块。现行源 `game/data/beginner-guide.json` 的prepare页，以及目标 `CurrentBeginnerGuide.json` 均没有feature；trace这块两个label的value均为空。源 `beginner-guide.js:48` 仅在page.feature存在时生成feature，不应展示空面板。主会话在本次审图期间已把目标判定收紧为feature存在且title/text至少一个非空，需新图确认面板已消失。

## 清晰度判断与限制

- 100%crop中native卡牌规则文字明显比legacy清楚，改善有实际像素依据。
- 同时发生了可见重排：legacy第二行从“个目标…”开始，native从“1 个目标…”开始；native行距更大，首帧可见行数减少。不能据此宣称新路径只提高采样而完全保留布局。
- legacy/native两个capture的trace均报告rules glyphDensity=2.0、transformDensity=1.5、requestedPixels=22，虽legacyGlyphDensity分别true/false。此对照metadata未反映所声称切换，需要核验记录时机，不能用相同两行证明切换正确。
- title/settings/photo在当前图片中主标题与控制文案可读，未发现相同等级的大段遮挡。照片馆说明存在不理想断行，但没有对照其实际文案排版源码，未扩张为新确定缺陷。
- startup图确实拍到departure城市破镜片头，未显示标题浮在片头上；单帧无法验证全段持续时间、取消边界或帧率。
- player-5尚无altar/door/局内guide PNG，前轮node-context与共享HUD相交问题继续未核，不以其他截图代替。

全部Findings已即时发送主会话。报告记录的是player-5输出；之后生产修复需要对应新图和新build证据。
