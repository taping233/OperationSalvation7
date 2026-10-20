"""Check the encoded deliverable, including full decode and source-audio agreement."""
import hashlib
import json
import sys
from pathlib import Path
import subprocess
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / 'output/ost-snow-road-1018'
V2 = '--v2' in sys.argv
V3 = '--v3' in sys.argv
V5 = '--v5' in sys.argv
VERSION = '-v5' if V5 else '-v3' if V3 else '-v2' if V2 else ''
VIDEO = OUT / ('霜窗回声_唱片演示_v5_1080p.mp4' if V5 else '霜窗回声_唱片演示_v3_1080p.mp4' if V3 else '霜窗回声_蓝白手书EP_v2_1080p.mp4' if V2 else '代号柒_霜窗回声_OST_1080p.mp4')
SOURCE = ROOT / '搜打撤/game/assets/music-demo/01-title-frostglass-v12.ogg'
probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams',
    '-show_format', '-of', 'json', str(VIDEO)], encoding='utf-8'))
v = next(s for s in probe['streams'] if s['codec_type'] == 'video')
a = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
assert (v['width'], v['height'], v['avg_frame_rate']) == (1920, 1080, '30/1')
assert v['codec_name'] == 'h264' and v['pix_fmt'] == 'yuv420p'
assert a['codec_name'] == 'aac' and a['channels'] == 2
assert abs(float(v['duration'])-float(a['duration'])) < .05
subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(VIDEO),
    '-f', 'null', '-'], check=True, capture_output=True)

def pcm(path):
    data = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path),
        '-vn', '-ar', '16000', '-ac', '1', '-f', 'f32le', 'pipe:1'])
    return np.frombuffer(data, dtype='<f4')

src, dst = pcm(SOURCE), pcm(VIDEO)
count = min(len(src), len(dst))
assert abs(len(src)-len(dst))/16000 < .05
assert np.isfinite(dst).all() and np.max(np.abs(dst)) < 1
corr = float(np.corrcoef(src[32000:count-64000], dst[32000:count-64000])[0, 1])
assert corr > .98, corr
samples = [0, 1, 12, 48, 88, 91.3]
contact = Image.new('RGB', (960, 3*290), '#0a1420')
draw = ImageDraw.Draw(contact)
for idx, sec in enumerate(samples):
    name = OUT/f'encoded{VERSION}-{sec:g}.jpg'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(sec), '-i', str(VIDEO),
        '-frames:v', '1', '-q:v', '2', str(name)], check=True, capture_output=True)
    im = Image.open(name).convert('RGB').resize((480, 270))
    x, y = (idx % 2)*480, (idx//2)*290
    contact.paste(im, (x, y))
    draw.text((x+8, y+273), f'{sec:05.1f}s', fill='white')
contact.save(OUT/f'encoded{VERSION}-contact-sheet.jpg', quality=90)
motion = None
if V3 or V5:
    f12 = np.asarray(Image.open(OUT/f'encoded{VERSION}-12.jpg').convert('RGB'), dtype=float)
    f48 = np.asarray(Image.open(OUT/f'encoded{VERSION}-48.jpg').convert('RGB'), dtype=float)
    change = np.abs(f12-f48)
    disc_change = float(change[250:650, 780:1140].mean())
    background_change = float(change[:100, :500].mean())
    title_change = float(change[815:925, 780:1140].mean()) if V5 else float(change[850:980, 780:1140].mean())
    background_luma = float(f12[:100, :500].mean())
    assert disc_change > 5 and background_change < 2 and title_change < 2
    assert background_luma < 90
    motion = {'disc_changes_between_12_and_48s': disc_change,
        'static_background_change': background_change, 'static_title_change': title_change,
        'background_mean_rgb_top_left': background_luma}
report = {'status': 'passed', 'full_av_decode': 'passed',
    'source_audio_correlation_excluding_fades': corr,
    'audio_duration': a['duration'], 'video_duration': v['duration'],
    'video_frames': v['nb_frames'], 'source_audio_seconds': len(src)/16000,
    'encoded_audio_sample_peak': float(np.max(np.abs(dst))),
    'samples_seconds': samples, 'visual_review': 'pending', 'motion': motion,
    'sha256': hashlib.sha256(VIDEO.read_bytes()).hexdigest(),
    'probe': probe}
(HERE/f'verification{VERSION}.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({k: val for k, val in report.items() if k != 'probe'}, ensure_ascii=False))
