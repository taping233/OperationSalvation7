from pathlib import Path
root = Path(__file__).resolve().parents[3]
art = root / 'docs/production/art'
current = art / 'ART-STYLE-V1.md'
snapshot = root / 'docs/evidence/2026-10-18-default-art-style/previous-style.md'
previous = snapshot.read_text(encoding='utf-8')
previous = previous.replace('2026-10-16 老板指定本轮上传的全身图与局部细节图为游戏默认画风，并明确保留头发和裙子的块面笔触。', '2026-10-18老板明确恢复2026-10-16双图块面厚涂为项目默认；保留头发与裙子的结构性块面笔触，只删不合理的碎细节。恢复决定见[修订记录](../../evidence/2026-10-18-roster-unified/revision.md)。')
current.write_text(previous, encoding='utf-8')
changes = {
 'ART-DIRECTION-BRIEF.md': [('2026-10-18 老板指定的第一张精修立绘', '2026-10-18老板恢复的10-16双图块面厚涂'), ('控制精修层次、材质细节与硬软边', '保留结构性笔触、材质区别与硬软边'), ('2026-10-18 精修图', '2026-10-16双图块面厚涂')],
 'VISUAL-BIBLE.md': [('采用 2026-10-18 老板指定的第一张精修立绘', '采用2026-10-18老板恢复的10-16双图块面厚涂'), ('默认精修画法', '默认块面画法'), ('精修二次元半厚涂](ART-STYLE-V1.md)', '双图块面厚涂](ART-STYLE-V1.md)')]
}
for name, pairs in changes.items():
 p = art / name
 text = p.read_text(encoding='utf-8')
 for before, after in pairs:
  assert before in text, before
  text = text.replace(before, after)
 p.write_text(text, encoding='utf-8')
print('Default restored; prior evidence preserved')
