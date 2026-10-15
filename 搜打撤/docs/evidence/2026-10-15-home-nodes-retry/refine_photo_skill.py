from pathlib import Path

root = Path('C:/Users/太平/.codex/skills/arknights-node-icons')
path = root / 'SKILL.md'
text = path.read_text(encoding='utf-8')
old = '先看去掉暗底和特效后主体是否仍成立。轮廓有收放和疏密，颜色内部有明确明暗变化；'
new = '先看去掉暗底和特效后主体是否仍成立，也看它是否退化成规则旋转、等距重复的商标。一个核心形体不等于几何徽章；除主题确有需要，避免机械重复的等大瓣片，保留轻重、长短和疏密的差别。轮廓有收放和疏密，颜色内部有明确明暗变化；'
assert text.count(old) == 1
path.write_text(text.replace(old, new, 1), encoding='utf-8')
path = root / 'references/prompt-guide.md'
text = path.read_text(encoding='utf-8')
old = '- 像常规UI或宣传图：先改核心意象与整体轮廓，删独立物件、标记、环绕带；不能只补颗粒和暗盘。'
new = '- 像常规UI、商标或宣传图：先改核心意象与整体轮廓，删独立物件、标记、环绕带；机械旋转重复的瓣片改成有主次的形体，不能只补颗粒和暗盘。'
assert text.count(old) == 1
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Refined two existing paragraphs; no new rule section')
