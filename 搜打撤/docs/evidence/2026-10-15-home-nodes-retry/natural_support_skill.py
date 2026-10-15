from pathlib import Path
root = Path('C:/Users/太平/.codex/skills/arknights-node-icons')
path = root / 'SKILL.md'
text = path.read_text(encoding='utf-8')
old = '- 黑色圆形承托维持整套外观：能读出完整圆形，边缘仅轻微柔化或局部渐隐，不能随主体拉成长条、叶形、椭圆或碎块。圆内近黑、低对比，主体与局部光可略越圆边，圆外透明；不画粗黑描边、亮色圆环或矩形按钮框。'
new = '- 维持原板的近黑、整体近圆承托：圆形关系可辨，边缘自然起伏、局部缺失或融入色晕；不要求几何正圆、完整等距圆周或标准圆盘。它不能变成随主体拉伸的长条、叶形底，也不能成为硬边圆按钮、厚描边或亮色全环；主体与局部光可略越边，外缘渐隐到透明。'
assert text.count(old) == 1
path.write_text(text.replace(old, new, 1), encoding='utf-8')
path = root / 'references/prompt-guide.md'
text = path.read_text(encoding='utf-8')
old = '近黑承托保持清楚黑色圆形、边缘轻柔，圆外透明留白'
new = '近黑承托整体近圆、边缘自然起伏并局部融入光晕，不能画成几何正圆盘，外缘透明留白'
assert text.count(old) == 1
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Restored reference-based natural near-round support, not geometric disk')
