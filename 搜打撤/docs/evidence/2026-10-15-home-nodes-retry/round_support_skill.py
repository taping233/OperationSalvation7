from pathlib import Path
path = Path('C:/Users/太平/.codex/skills/arknights-node-icons/SKILL.md')
text = path.read_text(encoding='utf-8')
old = '- 暗圆低对比，边缘局部隐去，是环境而非轮廓完整的涂抹底板、硬黑边或按钮框。'
new = '- 黑色圆形承托维持整套外观：能读出完整圆形，边缘仅轻微柔化或局部渐隐，不能随主体拉成长条、叶形、椭圆或碎块。圆内近黑、低对比，主体与局部光可略越圆边，圆外透明；不画粗黑描边、亮色圆环或矩形按钮框。'
assert text.count(old) == 1
path.write_text(text.replace(old, new, 1), encoding='utf-8')
path = path.parent / 'references/prompt-guide.md'
text = path.read_text(encoding='utf-8')
text = text.replace('近黑承托部分消隐，外缘透明留白', '近黑承托保持清楚黑色圆形、边缘轻柔，圆外透明留白', 1)
path.write_text(text, encoding='utf-8')
print('Updated circular black support requirement')
