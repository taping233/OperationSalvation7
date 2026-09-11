# 把 mapData.js 里旧三环 layers/center 与几何工具迁到 game/design/fidelity.js（设计审阅稿自用）
import io, sys, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MAP = os.path.join(ROOT, 'game', 'src', 'mapData.js')
FID = os.path.join(ROOT, 'game', 'design', 'fidelity.js')
GEOM = os.path.join(os.path.dirname(__file__), 'head.geom.js')

def read(p):
    with io.open(p, encoding='utf-8', newline='') as f:
        return f.read().split('\n')

def write(p, lines):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write('\n'.join(lines))

map_lines = read(MAP)
start = next(i for i, l in enumerate(map_lines) if l.strip() == '// ---------- 三个环层 ----------')
end = next(i for i, l in enumerate(map_lines) if l.rstrip() == '};')
legacy = map_lines[start:end]           # 旧 layers + center 段
assert legacy[-1].strip() == '],', legacy[-1]

geom = read(GEOM)                        # 结点布局 / buildNodePositions / _hash / makeRing
while geom and geom[-1].strip() == '':
    geom.pop()

fixture = [
    '// ---------- 三环平面稿的历史几何（2026-09-09 五层生成器定版后游戏内已不再使用） ----------',
    '// 本页是旧三环布局的设计审阅稿，故自带一份数据与几何工具：数据迁自 mapData.js',
    '// （迁移时已同步 BOSS 改名），改动只影响本页，不进游戏包。',
    'const RINGS = {',
    '  // buildNodePositions 依赖的世界坐标基准（与 mapData.js 的 cols/rows/tile 相同）',
    '  cols: 30,',
    '  rows: 30,',
    '  tile: 48,',
    '',
] + geom + [''] + legacy + ['};', '']

# 1) mapData.js 去掉旧块
write(MAP, map_lines[:start] + map_lines[end:])

# 2) fidelity.js 换成自带 fixture
fid = read(FID)
text = '\n'.join(fid)
assert "import '../src/mapData.js';\n" in text
text = text.replace("import '../src/mapData.js';\n", '')
old_geo = "const M=window.SDT.MAP,counts=M.layers.map(l=>M.makeRing(l.inset).length),layout=M.buildNodePositions(counts);"
assert old_geo in text
new_geo = "const counts=RINGS.layers.map(l=>RINGS.makeRing(l.inset).length),layout=RINGS.buildNodePositions(counts);"
text = text.replace(old_geo, '\n'.join(fixture) + new_geo)
text = text.replace('M.layers[li].doors', 'RINGS.layers[li].doors')
text = text.replace('M.layers[li].cells', 'RINGS.layers[li].cells')
assert 'window.SDT.MAP' not in text
with io.open(FID, 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print('mapData.js lines:', len(map_lines), '->', len(read(MAP)))
print('fidelity.js bytes:', len(text.encode('utf-8')))
print('legacy block lines moved:', len(legacy))
