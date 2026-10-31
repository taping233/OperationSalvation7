# player-7 定向续查

只读核对SourceTextLayout.WrapCjk及其CardFace/Guide/generic调用，并实际查看native规则crop、altar、door、Guide0/2/3；按主会话要求此处收尾，未声称独立看完全部20图。

- **context碰撞在新图关闭。** 祭坛和闸门顶部返回/静音/头像无区域文字重叠，中央共享header保留完整区域/层数。CurrentNodeScene仅共享header Visible时隐藏context，header缺席仍保留。该修改如实作为源残留碰撞适配记录。
- **P2折行仍开。** native规则crop第一行仍只有“选择 2”；Guide0仍有行首逗号，Guide2仍有孤立句号与长词段搬行。不是旧构建或图片判断失误：player7 trace规则实际文本含46个U+200B，但生成行首仍在“选择 2”之后。
- **零宽断点方案没有实现预期。** WrapCjk原字节保留rich tags、ASCII icon token不被拆，InlineIconParser在转换后重新计算字符索引；未发现这次局部调用直接改变Photo link span旧索引的风险。但原生TextGenerator不按U+200B提供预期断行，静态安全不能替代功能效果。主会话已确认该方案不算修复，将由专人按实际TextGenerator宽度实现展示层断行。
- 后续真实新图还需复核：原始文案不变、富标签和icon对应、标点禁则、随当前宽度与字号正确重排、卡规则滚到底、Guide0/2/3无异常短行。

本报告未覆盖player7新增battle/pile/reader/return四图；主会话已交由其作者按源复核HUD与战斗提示穿透。
