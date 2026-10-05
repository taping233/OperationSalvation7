import soundfile as sf
import numpy as np
import subprocess, os, shutil, hashlib, json
from scipy.signal import resample_poly

BASE = '.'
MAT = 'docs/evidence/2026-09-30-sfx-alternatives/C-cc0-action/materials'
JIN = 'docs/evidence/2026-10-04-sfx-opensource/sources/music-jingles/Audio'
EV = 'docs/evidence/2026-10-04-sfx-opensource'

# (target, source_path, dur_target_sec or None=keep, rms_target_db)
PLAN = [
    ('hit-1',        f'{MAT}/rubberduck-breaks/bfh1_metal_hit_02.ogg', 0.55, -17.5),
    ('hit-2',        f'{MAT}/rubberduck-breaks/bfh1_hit_07.ogg',       0.46, -17.5),
    ('hit-3',        f'{MAT}/rubberduck-breaks/bfh1_metal_hit_04.ogg', 0.41, -17.5),
    ('hit-4',        f'{MAT}/rubberduck-breaks/bfh1_hit_10.ogg',       0.30, -17.5),
    ('hurt-1',       f'{MAT}/rubberduck-rpg/creature_hurt_01.ogg',     0.62, -17.3),
    ('hurt-2',       f'{MAT}/rubberduck-rpg/creature_hurt_02.ogg',     0.68, -17.3),
    ('parry-1',      f'{MAT}/vehicle-tinysized/sfx-cc0/sword-clash-03.wav', 0.17, -19.6),
    ('parry-2',      f'{MAT}/vehicle-tinysized/sfx-cc0/sword-clash-05.wav', 0.13, -19.6),
    ('curse-1',      f'{MAT}/rubberduck-rpg/spell_01.ogg',             0.22, -21.4),
    ('curse-2',      f'{MAT}/rubberduck-rpg/spell_fire_07.ogg',        0.22, -21.4),
    ('heal-1',       f'{MAT}/vehicle-tinysized/sfx-cc0/vial-glass-uncork-01.wav', 0.50, -27.5),
    ('heal-2',       f'{MAT}/vehicle-tinysized/sfx-cc0/water-pour-01.wav',       0.60, -27.5),
    ('heal-3',       f'{MAT}/vehicle-tinysized/sfx-cc0/water-drop-01.wav',       0.35, -27.5),
    ('chestshake-1', f'{MAT}/vehicle-tinysized/sfx-cc0/cloth-pouch-shake-02.wav', 0.32, -37.8),
    ('chestshake-2', f'{MAT}/vehicle-tinysized/sfx-cc0/bottle-pills-shake-01.wav', 0.28, -37.8),
    ('chestburst-1', f'{MAT}/rubberduck-breaks/bfh1_wood_breaking_03.ogg', 0.49, -25.8),
    ('chestburst-2', f'{MAT}/rubberduck-breaks/bfh1_breaking_02.ogg',      0.54, -25.8),
    ('chestburst-3', f'{MAT}/rubberduck-breaks/bfh1_glass_breaking_02.ogg', 0.39, -25.8),
    ('reveal-1',     f'{MAT}/rubberduck-rpg/item_gem_01.ogg',          0.25, -32.1),
    ('reveal-2',     f'{MAT}/rubberduck-rpg/item_gem_03.ogg',          0.29, -32.1),
    ('reveal-3',     f'{MAT}/rubberduck-rpg/item_gem_04.ogg',          0.59, -32.1),
    ('legend-1',     f'{JIN}/Hit jingles/jingles_HIT01.ogg',           0.51, -16.5),
    ('legend-2',     f'{JIN}/Hit jingles/jingles_HIT03.ogg',           0.75, -16.5),
    ('legend-3',     f'{JIN}/Hit jingles/jingles_HIT07.ogg',           0.28, -16.5),
    ('victory-1',    f'{JIN}/Hit jingles/jingles_HIT02.ogg',           0.52, -16.6),
    ('victory-2',    f'{JIN}/Hit jingles/jingles_HIT05.ogg',           0.61, -16.6),
    ('defeat-1',     f'{JIN}/Steel jingles/jingles_STEEL00.ogg',       1.00, -15.1),
]

SR = 48000
report = []
backup_dir = os.path.join(EV, 'originals-replaced-2026-10-04')
os.makedirs(backup_dir, exist_ok=True)
tmpdir = os.path.join(EV, 'work')
os.makedirs(tmpdir, exist_ok=True)

def trim_silence(x, thresh_db=-45.0):
    env = np.max(np.abs(x), axis=1)
    idx = np.where(env > 10 ** (thresh_db / 20))[0]
    if not len(idx):
        return x
    a, b = idx[0], idx[-1] + 1
    pad = int(0.003 * SR)
    return x[max(0, a - pad):min(len(x), b + pad)]

def rms_db(x):
    return 20 * np.log10(max(float(np.sqrt(np.mean(x ** 2))), 1e-9))

def peak_db(x):
    return 20 * np.log10(max(float(np.max(np.abs(x))), 1e-9))

for name, src, dur_t, rms_t in PLAN:
    dst = f'game/assets/sfx/battle/{name}.ogg'
    data, sr = sf.read(src, always_2d=True)
    if data.shape[1] == 1:
        data = np.repeat(data, 2, axis=1)
    elif data.shape[1] > 2:
        data = data[:, :2]
    # 重采样 48k
    if sr != SR:
        g = np.gcd(sr, SR)
        data = resample_poly(data, SR // g, sr // g, axis=0)
        data = np.ascontiguousarray(data)
    # 修 3dBFS 以上历史削波（StarNinjas 等母带过热）无：本方案未选削波源，保险限幅在后
    data = trim_silence(data)
    n_t = int(dur_t * SR)
    hard_cut = len(data) > n_t
    if hard_cut:
        data = data[:n_t]
    # 增益到 RMS 目标
    g_db = rms_t - rms_db(data)
    data = data * (10 ** (g_db / 20))
    # 峰值安全：超 -1 dBFS 则回落
    pk = float(np.max(np.abs(data)))
    limited = False
    if pk > 10 ** (-1 / 20):
        data = data * (10 ** (-1 / 20)) / pk
        limited = True
    # fade in 5ms / fade out 30ms（硬切 8ms）
    fi = int(0.005 * SR)
    fo = int((0.008 if hard_cut else 0.030) * SR)
    data[:fi] *= np.linspace(0, 1, fi)[:, None]
    data[-fo:] *= np.linspace(1, 0, fo)[:, None]
    # 旧件存证
    if os.path.exists(dst):
        shutil.copy2(dst, os.path.join(backup_dir, os.path.basename(dst)))
    tmp = os.path.join(tmpdir, name + '.wav')
    sf.write(tmp, data, SR, subtype='PCM_24')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp,
                    '-c:a', 'libvorbis', '-q:a', '5', '-ar', str(SR), '-ac', '2', dst], check=True)
    os.remove(tmp)
    new = sf.read(dst, always_2d=True)[0]
    sha = hashlib.sha256(open(src, 'rb').read()).hexdigest()[:16]
    report.append(dict(name=name, src=src.replace('\\', '/'), src_sha16=sha,
                       dur=round(len(new) / SR, 3), rms=round(rms_db(new), 1), peak=round(peak_db(new), 1),
                       gain_db=round(g_db, 1), hard_cut=hard_cut, limited=limited))

json.dump(report, open(os.path.join(EV, 'processing-report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for r in report:
    print(f"{r['name']:<13} dur={r['dur']:>6} rms={r['rms']:>6} peak={r['peak']:>5} gain={r['gain_db']:>6} cut={int(r['hard_cut'])} lim={int(r['limited'])}  {r['src']}")
