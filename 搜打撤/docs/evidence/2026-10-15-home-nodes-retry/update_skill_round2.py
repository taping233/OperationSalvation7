from pathlib import Path

root = Path('C:/Users/太平/.codex/skills/arknights-node-icons')
path = root / 'SKILL.md'
text = path.read_text(encoding='utf-8')
anchor = '## 生成与迭代'
addition = '''## 主体先成立，再加环境

设计时先检查不依赖暗底、光晕和点线装饰的主体剪影：是否能读出任务含义，是否有可记住的整体轮廓与内部空隙。识别不能只靠零件清单；现代入口不靠门框、门板、按钮逐件堆出一张建筑小插画。概括不能损失对象的基本辨识。

深色主体与近黑承托要有足够的明度或色相区分，重要轮廓不能大面积融掉；可让次要边缘隐去，不让亮边残余变成另一个符号。光从主体某个局部发生，受光面、亮边与外晕应连成一个重点，避免门内一束光、门外另一盏灯各自争抢。暗底仍只承托主体，不能凭完整外轮廓成为大块涂抹底板。

这一检查适用于形体、明暗和光源组织；不要求交付额外黑白图或固定测试步骤。先按原板判断是否成立，再参考认可图，候选不因规则齐全而自动达标。

'''
assert text.count(anchor) == 1
assert '## 主体先成立，再加环境' not in text
path.write_text(text.replace(anchor, addition + anchor, 1), encoding='utf-8')
path = root / 'references/prompt-guide.md'
text = path.read_text(encoding='utf-8')
text += '\n- 主体融底或像零件拼装：先去掉提示中的材质、设备结构与装饰清单，重设计能独立识别的整体剪影和内部开口；让主体主要色面与近黑底拉开，仅少量边缘消隐。\n- 光源分裂：把受光面、亮边和外晕集中在同一主体局部；减少独立悬浮亮团，不通过照亮整块暗底获得可见性。\n'
path.write_text(text, encoding='utf-8')
print('Updated silhouette, separation and attached-light guidance')
