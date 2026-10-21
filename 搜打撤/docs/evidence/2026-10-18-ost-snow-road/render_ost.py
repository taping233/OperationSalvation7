"""Deterministic OST motion design; existing Pillow, numpy and FFmpeg only."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
ROOT = PROJECT.parent
OUT = ROOT / 'output/ost-snow-road-1018'
OUT.mkdir(parents=True, exist_ok=True)
ART = PROJECT / 'game/assets/reconstruction/wallpaper-snow-road-1016.webp'
AUDIO = PROJECT / 'game/assets/music-demo/01-title-frostglass-v12.ogg'
VIDEO = OUT / '代号柒_霜窗回声_OST_1080p.mp4'
W, H, FPS = 1920, 1080, 30
WHITE = (238, 244, 246)
CYAN = (167, 210, 225)
MUTED = (180, 198, 211)
FONTS = Path('C:/Windows/Fonts')


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def tracked(draw, xy, text, fnt, fill, spacing=3):
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=fnt, fill=fill)
        x += draw.textlength(char, font=fnt) + spacing
    return x


def smooth(a, b, x):
    x = max(0, min(1, (x-a)/(b-a)))
    return x*x*(3-2*x)


raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(AUDIO),
    '-ar', '16000', '-ac', '1', '-f', 'f32le', 'pipe:1'])
pcm = np.frombuffer(raw, dtype='<f4')
DURATION = len(pcm)/16000
N = math.ceil(DURATION*FPS)
BARS = 76
freqs = np.fft.rfftfreq(2048, 1/16000)
edges = np.geomspace(75, 7200, BARS+1)
bands = [np.where((freqs >= edges[i]) & (freqs < edges[i+1]))[0] for i in range(BARS)]
window = np.hanning(2048)
levels = np.zeros((N, BARS))
for i in range(N):
    start = int(i*16000/FPS)-1024
    chunk = pcm[max(0, start):max(0, start)+2048]
    if len(chunk) < 2048:
        chunk = np.pad(chunk, (0, 2048-len(chunk)))
    spectrum = np.abs(np.fft.rfft(chunk*window))
    levels[i] = [np.sqrt(np.mean(spectrum[b]**2)) if len(b) else 0 for b in bands]
levels = np.log1p(levels*8)
levels /= max(np.percentile(levels, 99), 0.001)
levels = np.clip(levels, 0, 1)
for i in range(1, N):
    mix = np.where(levels[i] > levels[i-1], .55, .13)
    levels[i] = levels[i-1]*(1-mix)+levels[i]*mix

source = Image.open(ART).convert('RGB')
sw, sh = source.size
# Broad darkening under the typography, with the character left at source contrast.
xx = np.linspace(0, 1, W)[None, :]
yy = np.linspace(0, 1, H)[:, None]
shade = np.maximum(0, 1-xx/.70)*(.25+.10*yy)
shade += .26*np.maximum(0, (yy-.71)/.29)
shade += .06*np.maximum(0, (.11-yy)/.11)
shade_rgba = np.zeros((H, W, 4), dtype=np.uint8)
shade_rgba[:, :, :3] = (9, 18, 29)
shade_rgba[:, :, 3] = (np.clip(shade, 0, .55)*255).astype(np.uint8)
shade_img = Image.fromarray(shade_rgba, 'RGBA')

cn = font('msyhl.ttc', 83)
small_cn = font('msyh.ttc', 19)
latin = font('bahnschrift.ttf', 20)
tiny = font('bahnschrift.ttf', 15)
counter = font('bahnschrift.ttf', 21)
brand = font('msyh.ttc', 25)
type_layer = Image.new('RGBA', (W, H))
d = ImageDraw.Draw(type_layer)
tracked(d, (105, 64), '代号柒', brand, WHITE, 5)
d.line((232, 70, 232, 94), fill=(205, 224, 233, 100), width=1)
tracked(d, (254, 75), 'ORIGINAL SOUNDTRACK', tiny, MUTED, 3)
tracked(d, (1640, 76), 'OST  /  001', tiny, MUTED, 3)
d.line((108, 195, 149, 195), fill=CYAN, width=2)
tracked(d, (167, 184), '01   /   MAIN THEME', latin, CYAN, 3)
tracked(d, (101, 222), '霜窗回声', cn, WHITE, 12)
tracked(d, (108, 340), 'FROSTGLASS ECHOES', latin, WHITE, 6)
d.line((108, 395, 147, 395), fill=(185, 213, 228, 140), width=1)
d.text((164, 380), '首页主题曲', font=small_cn, fill=MUTED)
tracked(d, (108, 866), 'NOW PLAYING', tiny, MUTED, 3)
tracked(d, (108, 1018), 'CODENAME VII', tiny, MUTED, 3)
tracked(d, (1582, 1018), 'ORIGINAL MUSIC', tiny, MUTED, 3)

rng = np.random.default_rng(1018)
particles = []
for layer, count in [(0, 60), (1, 27), (2, 10)]:
    for _ in range(count):
        particles.append((layer, float(rng.uniform(0, W)), float(rng.uniform(0, H)),
            float(rng.uniform(.7, 1.5)), float(rng.uniform(0, 2*math.pi))))


def frame(t):
    phase = t/DURATION
    zoom = 1.008+.022*(.5-.5*math.cos(2*math.pi*phase))
    bw, bh = sw/zoom, sh/zoom
    left = (sw-bw)*(.55+.10*math.sin(2*math.pi*phase))
    top = (sh-bh)*.44
    image = source.resize((W, H), Image.Resampling.BICUBIC,
        box=(left, top, left+bw, top+bh)).convert('RGBA')
    image = Image.alpha_composite(image, shade_img)
    snow = Image.new('RGBA', (W, H))
    sd = ImageDraw.Draw(snow)
    for layer, x0, y0, factor, p in particles:
        speed = (13, 29, 57)[layer]*factor
        x = (x0-t*speed*.40+12*math.sin(t*.23+p)+100) % (W+200)-100
        y = (y0+t*speed) % (H+100)-50
        r = (.75, 1.35, 2.5)[layer]*factor
        # Keep large flakes away from the face and the primary title.
        atten = .35 if x > 1500 and y < 600 else 1
        a = int((65, 100, 100)[layer]*atten*(.7+.3*math.sin(t*.35+p)**2))
        sd.ellipse((x-r, y-r, x+r, y+r), fill=(232, 243, 252, a))
    image = Image.alpha_composite(image, snow)
    ui = type_layer.copy()
    ud = ImageDraw.Draw(ui)
    idx = min(int(t*FPS), N-1)
    for k, value in enumerate(levels[idx]):
        x = 109+k*9
        height = 3+value*34
        ud.rounded_rectangle((x, 944-height, x+3, 944), radius=1,
            fill=(*CYAN, int(100+value*135)))
    played = '%02d:%02d' % (int(t)//60, int(t)%60)
    total = '%02d:%02d' % (int(DURATION)//60, int(DURATION)%60)
    ud.text((109, 959), played, font=counter, fill=WHITE)
    ud.text((177, 961), '/  '+total, font=tiny, fill=MUTED)
    ud.line((108, 998, 1812, 998), fill=(208, 225, 236, 65), width=1)
    endx = 108+1704*min(phase, 1)
    ud.line((108, 998, endx, 998), fill=(*CYAN, 235), width=2)
    ud.ellipse((endx-3, 995, endx+3, 1001), fill=WHITE)
    # Music phrases gently breathe the tiny recording-status light.
    pulse = int(130+80*np.mean(levels[idx]))
    ud.ellipse((1798, 79, 1804, 85), fill=(*CYAN, pulse))
    intro = smooth(.6, 3.4, t)
    ui.putalpha(ui.getchannel('A').point(lambda a: int(a*intro)))
    image = Image.alpha_composite(image, ui).convert('RGB')
    fade = smooth(0, 1.6, t)*(1-smooth(DURATION-3.0, DURATION, t))
    if fade < .999:
        image = Image.blend(Image.new('RGB', (W, H), (5, 10, 17)), image, fade)
    return image


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render():
    command = ['ffmpeg', '-hide_banner', '-y', '-f', 'rawvideo', '-pixel_format', 'rgb24',
        '-video_size', f'{W}x{H}', '-framerate', str(FPS), '-i', 'pipe:0', '-i', str(AUDIO),
        '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        '-threads', '4', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
        '-af', f'afade=t=in:st=0:d=0.6,afade=t=out:st={DURATION-3:.6f}:d=3',
        '-t', f'{DURATION:.6f}', '-movflags', '+faststart', '-metadata', 'title=代号柒 · 霜窗回声',
        '-metadata', 'comment=Homepage wallpaper and current title BGM; original motion design.', str(VIDEO)]
    start = time.time()
    with (OUT/'encode.log').open('w', encoding='utf-8') as log:
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=log)
        try:
            for i in range(N):
                process.stdin.write(frame(i/FPS).tobytes())
                if i % 300 == 0:
                    print(json.dumps({'frame': i, 'total': N, 'elapsed': round(time.time()-start, 1)}), flush=True)
            process.stdin.close()
            if process.wait() != 0:
                raise RuntimeError('FFmpeg encoding failed; see encode.log')
        except BaseException:
            process.kill()
            process.wait()
            raise
    report = {'video': str(VIDEO.relative_to(ROOT)), 'bytes': VIDEO.stat().st_size,
        'sha256': digest(VIDEO), 'duration_seconds': DURATION, 'frames': N,
        'dimensions': [W, H], 'fps': FPS, 'render_seconds': round(time.time()-start, 1),
        'inputs': [{'path': str(p.relative_to(ROOT)), 'sha256': digest(p)} for p in [ART, AUDIO]],
        'design': ['single-source slow camera drift', 'three-depth snow', '76 FFT-driven spectral bars',
            'Chinese/English track typography', 'elapsed time and progress', 'intro/outro fades'],
        'references': ['https://www.youtube.com/watch?v=Yy_E2_3YNh0',
            'https://www.youtube.com/watch?v=J9wcfTVUZNE'],
        'acquisition': 'Run python docs/evidence/2026-10-18-ost-snow-road/render_ost.py --render from 搜打撤; uses existing local FFmpeg/Pillow/numpy. No downloaded third-party assets.'}
    (HERE/'render-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--render', action='store_true')
    args = parser.parse_args()
    for t in [12, 48, 88]:
        frame(t).save(OUT/f'preview-{t:02d}.jpg', quality=93)
    if args.render:
        render()
    else:
        print(json.dumps({'preview': str(OUT), 'duration': DURATION, 'frames': N}))
