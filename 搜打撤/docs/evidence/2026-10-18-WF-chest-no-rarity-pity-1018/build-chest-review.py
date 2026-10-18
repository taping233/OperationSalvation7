from pathlib import Path

root = Path(__file__).resolve().parents[3]
html = (root / 'game/dev/small-chest-review.html').read_text(encoding='utf-8')
changes = [
    ('小箱随机一张 · 真实控制器隔离验证', '取消宝箱稀有度保底 · 真实控制器隔离验证'),
    ('真实生成 / 隔离存档', '全古朴受控抽卡 / 隔离存档'),
    ('<button id="full">', '<button id="large">大箱</button><button id="boss">首脑箱</button><button id="full">'),
    ("const cards=['冰刺','冰封千里','火球']", "const cards=['冰刺','冰封千里','火球','寒霜','冰墙']"),
    ("rarity:'稀有',cost:1", "rarity:'古朴',cost:1"),
    ("pickOfRarity:()=>cards[0]", "pickOfRarity:()=>({...cards[0],id:'unexpected-upgrade',name:'不应出现的保底牌',rarity:'史诗'})"),
    ("kind:mode==='medium'?'medium':'small'", "kind:['medium','large','boss'].includes(mode)?mode:'small'"),
    ("['small','class','medium','full','legacy']", "['small','class','medium','large','boss','full','legacy']"),
    ("scenario('small');", "scenario('medium');"),
]
for before, after in changes:
    assert before in html, before
    html = html.replace(before, after, 1)
html = html.replace('small-one-r2', 'no-rarity-pity-1018')
(root / 'game/dev/chest-no-pity-review.html').write_text(html, encoding='utf-8')
print('chest-no-pity-review.html generated')
