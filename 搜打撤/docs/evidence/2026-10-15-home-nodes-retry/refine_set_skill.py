from pathlib import Path
root = Path('C:/Users/太平/.codex/skills/arknights-node-icons')
path = root / 'SKILL.md'
text = path.read_text(encoding='utf-8')
old = '概括保留对象身份，允许联想，不要求把功能逐字翻译成常规书本、奖章、相机等UI符号。'
new = '概括保留对象身份，允许联想，但不牺牲功能线索：只读成普通植物、奇幻武器或机构标志时，应重设计。含义不能仅靠标题解释，也不要求逐字翻译成常规书本、奖章、相机等UI符号。'
assert text.count(old) == 1
text = text.replace(old, new, 1)
old = '避免光滑3D、斜面材质渲染、微缩建筑和导航应用宣传插画。'
new = '用颜色交界而非金属厚边、磨砂斜面或折纸三角分面塑形；避免光滑3D、装备材质渲染、微缩建筑和导航应用宣传插画。'
assert text.count(old) == 1
text = text.replace(old, new, 1)
old = '批量前比较各项是否只是同模板换物件；有主题差异但画法一致才继续。'
new = '批量前比较各项是否只是同模板换物件；有主题差异但画法一致才继续。展示板逐项筛选，不把“已生成”当作“符合画风”。老板认可的原稿保留原字节，除非本轮明确要求修改；修订未认可项不自动统一重绘已认可项。'
assert text.count(old) == 1
path.write_text(text.replace(old, new, 1), encoding='utf-8')
path = root / 'references/prompt-guide.md'
text = path.read_text(encoding='utf-8')
old = '- 形体空泛：补决定对象身份的开口、分叉或遮叠；不能用更多表面纹理填空。'
new = '- 形体空泛或功能失读：补决定身份与功能的开口、分叉、遮叠或调节关系；普通植物不能仅靠命名变成成就，法器不能仅靠命名变成设置。不能用表面纹理填空。'
assert text.count(old) == 1
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Updated functional cues, flat color shaping and accepted-source preservation')
