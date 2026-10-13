# 无精致版动画基准修订

当前阶段：基准立绘修订；四动作尚未从此基准生成，尚未接入运行帧。

老板选择的源图为 `game/art-source/characters/wu-sprites-refined-20261010/base-user-selected.png`。同目录 `base-face-clean.png` 已被老板以“杂色反而更多了”否定，不作为后续动作基准。`base.png` 是早期未采用候选。`base-sword-120cm.png` 保留脸周修改前的输入。

剑长按整剑120厘米、人物170厘米提出生成约束；仅视觉比例调整，尚无透视测量依据。脸周修改清理刘海与鬓发的细碎灰褐色、眼周杂色，保留朝右的脸型和视线。内置 image_gen 的完整提示见 [face-clean-prompt.txt](face-clean-prompt.txt)。

前次自查判断“脸周发色更统一”未获得老板认可；老板指出杂色增多，不能视作通过。读取确认前次输出为1536×1024 RGBA、alpha范围0–254。透明边缘和周围软色光晕尚未作为游戏资产验收，本轮未接入游戏、未跑构建或游戏实页。

最新候选为 `game/art-source/characters/wu-sprites-refined-20261010/base-face-two-tone.png`。本次直接重画银发色块，减少刘海与马尾的内部碎线、亮条和灰斑。视觉复看可见马尾改成连续银白主面与浅灰阴影，脸周发束内部纹理减少，视线继续朝右。老板尚未确认，不记为通过。第一次生成网络失败，第二次缩短提示后使用同一内置通道成功；完整提示见 [face-two-tone-prompt.txt](face-two-tone-prompt.txt)。

后续决定：老板要求停止沿用修补版本，直接重新生成，并明确肤色问题指腿部，不需要对脸部增加肉色处理。`base-face-two-tone.png` 同样弃用；新生成仅以原立绘为人设和衣服参考，战斗朝向、腿部肤色、简化马尾和120厘米整剑长度由文字说明。双参考首个新生成候选仍出现剑过长、马尾碎线，不采用。

新基准已从原立绘PNG参考重新生成，文件 `base-fresh.png`。单独缩短剑后为 `base-fresh-sword.png`。老板对缩剑后的新图反馈“大腿过于肥，其他没啥问题”，当前仅继续调整指定大腿，待明确指画面右侧还是人物自身右腿。生成提示见 [fresh-base-prompt.txt](fresh-base-prompt.txt)，局部剑长提示见 [fresh-sword-prompt.txt](fresh-sword-prompt.txt)。新基准仍未接入游戏。

老板已明确需收窄的是画面右侧、剑刃经过的大腿。首次局部修订在若干采样行仅减少约3像素外轮廓，幅度不足，继续定向修改。老板另指出透明底受到污染；现有RGBA中的灰色和肉色光晕属于背景残留，不能仅凭存在透明通道认定透明底合格。后续需单独清除背景残留并视觉检查。

来源与校验值见 [baseline-receipt.json](baseline-receipt.json)。大于1MB源图在自有目录忽略，不进Git；来源为老板本机附件或内置 image_gen 生成目录，按收据路径复制留存。未提交。
