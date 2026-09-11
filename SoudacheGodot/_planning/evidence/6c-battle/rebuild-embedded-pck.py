# -*- coding: utf-8 -*-
"""以「当前世代导出」的 exe 为基座重建嵌入 pck（结构 1:1 镜像基座）：
- 基座 pck 结构 = 导入管线布局（.import 元数据 + .godot/imported/ 编译产物）+ project.binary + src 脚本桩 + .godot 缓存
- project.binary / src/ 桩 / .godot/ 沿用基座字节；data/** assets/** scenes/** 用磁盘当前内容覆盖/新增
- assets/** 的 .import 元数据随磁盘直装，并解析 [remap] path= 把 .godot/imported/ 编译产物一并从磁盘直装
  （不再依赖基座 .godot/ 是否新鲜；ogg/mp3 无 raw 直载能力，必须走导入产物，wav/png/ttf 同管线无害）
- [6c→C] 已回收：旧版在此处给 assets/sfx/battle/*.ogg 添加 assets/sfx/ 扁平别名 raw 条目以绕开
  GameAudio 基准路径缺 battle/ 段的缺口——C 线批次 7a-fix 已修基准路径并改为导入产物装载，别名段移除
- [批次 8] project.binary（Godot 4.7 ECFG 格式）补丁：application/config/name 与 application/config/version
  与 export_presets.cfg 对齐（基座烙的是 0.51.0+「的的」旧名；dotnet/project/assembly_name 不动——
  data_SoudacheGodot_windows_x86_64 目录查找只依赖 assembly_name，改中文名不影响 .NET 装配装载）。幂等。
用法：python rebuild_pck3.py <base_exe> <out_exe> [pe_override]
  [批次 8] pe_override（可选）= rcedit 盖章后的 PE 文件。**实测结论：此路不通**——rcedit 只保留
  PE section 表覆盖的字节、会截掉 overlay 里的新 pck；即便用「盖章 PE + 追加新 pck」重组合，
  盖章 PE 的 exe 启动仍报「Couldn't load project data」（疑 rcedit 重写资源树丢失嵌入 pck 标记）。
  同名对照实验：原 PE+补丁 pck、原 PE+无补丁 pck 均正常，盖章 PE±补丁均失败。
  exe 文件图标因此保持 Godot 默认（file icon），窗口/任务栏图标走 pck 内 brand-mark png 正常；
  真正的 exe 图标盖章留给未来在装有编辑器的机器上跑一次正式 export（export_presets.cfg 已配 app.ico）。
"""
import struct, hashlib, os, glob, sys, re

PROJ = r'D:/素材/代号柒/SoudacheGodot'
BASE = sys.argv[1] if len(sys.argv) > 1 else (PROJ + r'/build/windows/升格会的的冬日猜想.exe.old')
OUT = sys.argv[2] if len(sys.argv) > 2 else (BASE + '.new')
PE_OVERRIDE = sys.argv[3] if len(sys.argv) > 3 else ''
ALIGN = 4
SEP = chr(92)

# 批次 8：运行时项目名/版本（与 export_presets.cfg / project.godot 保持一致；旧值见 patch 函数）
PROJECT_NAME = '升格会的冬日猜想'
PROJECT_VERSION = '0.53.3'


def patch_project_binary(blob):
    """ECFG 格式：'ECFG' magic + u32 条目数 + 逐条目 [u32 klen][key][u32 vlen][value]。
    value = [u32 type][payload]；type 4=String([u32 len][bytes][pad4])。只重写 name/version 两条。"""
    if blob[:4] != b'ECFG':
        print('project.binary: not ECFG magic, skip patch')
        return blob
    count = struct.unpack_from('<I', blob, 4)[0]
    cur = 8
    entries = []
    for _ in range(count):
        klen = struct.unpack_from('<I', blob, cur)[0]; cur += 4
        key = blob[cur:cur + klen].decode('utf-8'); cur += klen
        vlen = struct.unpack_from('<I', blob, cur)[0]; cur += 4
        entries.append((key, blob[cur:cur + vlen])); cur += vlen
    assert cur == len(blob), 'ECFG parse overrun: %d != %d' % (cur, len(blob))

    def str_value(s):
        raw = s.encode('utf-8')
        pad = (4 - len(raw) % 4) % 4
        return struct.pack('<II', 4, len(raw)) + raw + b'\0' * pad

    overrides = {'application/config/name': PROJECT_NAME, 'application/config/version': PROJECT_VERSION}
    out = [b'ECFG', struct.pack('<I', count)]
    changed = []
    for key, val in entries:
        if key in overrides:
            new = str_value(overrides[key])
            if new != val:
                changed.append('%s -> %s' % (key, overrides[key]))
            val = new
        out.append(struct.pack('<I', len(key.encode('utf-8'))) + key.encode('utf-8'))
        out.append(struct.pack('<I', len(val)) + val)
    if changed:
        print('project.binary patch:', '; '.join(changed))
    return b''.join(out)


data = open(BASE, 'rb').read()
n = len(data)
ds = struct.unpack_from('<Q', data, n - 12)[0]
pck_start = n - ds - 12
vmaj, vmin, vpat = struct.unpack_from('<III', data, pck_start + 8)
flags, file_base = struct.unpack_from('<IQ', data, pck_start + 0x14)
diroff = struct.unpack_from('<Q', data, pck_start + 0x20)[0]

d = data[pck_start + diroff:pck_start + ds]
count = struct.unpack_from('<I', d, 0)[0]
cur = 4
old_entries = {}
for _ in range(count):
    plen = struct.unpack_from('<I', d, cur)[0]; cur += 4
    path = d[cur:cur + plen].rstrip(b'\0').decode('utf-8'); cur += plen
    off, size = struct.unpack_from('<QQ', d, cur); cur += 16
    cur += 16 + 4
    old_entries[path] = data[pck_start + file_base + off:pck_start + file_base + off + size]
print('base pck: start=%d size=%d entries=%d' % (pck_start, ds, len(old_entries)))

KEEP_OLD_PREFIX = ('project.binary', 'src/', '.godot/')
files = {}
for path, blob in old_entries.items():
    if path.startswith(KEEP_OLD_PREFIX):
        files[path] = blob
if 'project.binary' in files:
    files['project.binary'] = patch_project_binary(files['project.binary'])  # 批次 8：名/版本对齐
# data/assets/scenes 以磁盘为唯一权威（基座里的旧资产条目——尤其历史实验性别名/导入产物——一律不保留）
for path in [p for p in old_entries if p.startswith(('data/', 'assets/', 'scenes/'))]:
    old_entries.pop(path, None)

disk_paths = []
for g in ['data/**', 'assets/**', 'scenes/**', '.godot/uid_cache.bin']:
    for p in glob.glob(os.path.join(PROJ, g), recursive=True):
        if os.path.isfile(p):
            rel = os.path.relpath(p, PROJ).replace(SEP, '/')
            if '/imported/' in '/' + rel:
                continue
            disk_paths.append(rel)
disk_paths = sorted(set(disk_paths))

added = replaced = 0
for rel in disk_paths:
    with open(os.path.join(PROJ, rel), 'rb') as f:
        blob = f.read()
    if rel in files:
        replaced += 1 if files[rel] != blob else 0
    else:
        added += 1
    files[rel] = blob
print('disk files:', len(disk_paths), 'added', added, 'replaced', replaced)

# assets/** 的 .import 元数据已在磁盘直装列表里；再解析其 [remap] path=，把 .godot/imported/
# 编译产物一并从磁盘直装（ogg/mp3 等无 raw 加载器的资源靠它才能在导出环境 Load 出真流）。
products = 0
missing_products = []
for rel in disk_paths:
    if not rel.startswith('assets/') or not rel.endswith('.import'):
        continue
    with open(os.path.join(PROJ, rel), 'r', encoding='utf-8') as f:
        m = re.search(r'^path="([^"]+)"', f.read(), re.M)
    if not m:
        missing_products.append(rel + ' (no [remap] path)')
        continue
    product = m.group(1)
    if not product.startswith('res://'):
        missing_products.append(rel + ' (non-res path: ' + product + ')')
        continue
    prod_rel = product[len('res://'):].replace('/', os.sep)
    prod_path = os.path.join(PROJ, prod_rel)
    if not os.path.isfile(prod_path):
        missing_products.append(rel + ' -> ' + product + ' (not on disk)')
        continue
    with open(prod_path, 'rb') as f:
        files[prod_rel.replace(os.sep, '/')] = f.read()
    products += 1
print('imported products installed:', products)
for m_ in missing_products:
    print('  product not installed:', m_)

assert 'project.binary' in files and 'scenes/main.tscn' in files

HEADER = 0x70
names = sorted(files.keys())
blob_parts = []
offsets = {}
pos = 0
for path in names:
    b = files[path]
    blob_parts.append(b)
    pad = (-len(b)) % ALIGN
    blob_parts.append(b'\0' * pad)
    offsets[path] = (pos, len(b))
    pos += len(b) + pad
data_section = b''.join(blob_parts)

dir_parts = [struct.pack('<I', len(names))]
for path in names:
    pb = path.encode('utf-8')
    plen = len(pb) + 1
    plen += (-plen) % ALIGN
    dir_parts.append(struct.pack('<I', plen))
    dir_parts.append(pb + b'\0' * (plen - len(pb)))
    off, size = offsets[path]
    dir_parts.append(struct.pack('<QQ', off, size))
    dir_parts.append(hashlib.md5(files[path]).digest())
    dir_parts.append(struct.pack('<I', 0))
directory = b''.join(dir_parts)

header = b'GDPC' + struct.pack('<IIIIIQ', 4, vmaj, vmin, vpat, flags, HEADER) + struct.pack('<Q', HEADER + len(data_section))
header += b'\0' * (HEADER - len(header))

new_pck = header + data_section + directory
file_image = data[:pck_start]
if PE_OVERRIDE:
    with open(PE_OVERRIDE, 'rb') as f:
        file_image = f.read()  # rcedit 盖章 PE（含旧 pck section 陈旧字节，运行时被 footer 定位的新 pck 覆盖）
    print('pe override image:', len(file_image), 'bytes from', PE_OVERRIDE)
new_exe = file_image + new_pck + struct.pack('<Q', len(new_pck)) + b'GDPC'
open(OUT, 'wb').write(new_exe)
print('new pck size:', len(new_pck), 'files:', len(names), '-> ', OUT)
