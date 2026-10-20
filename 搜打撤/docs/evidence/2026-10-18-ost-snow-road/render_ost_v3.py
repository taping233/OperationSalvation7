"""User-directed dark blurred wallpaper and a rotating album disc."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import time

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
ROOT = PROJECT.parent
OUT = ROOT / 'output/ost-snow-road-1018'
ART = PROJECT / 'game/assets/reconstruction/wallpaper-snow-road-1016.webp'
AUDIO = PROJECT / 'game/assets/music-demo/01-title-frostglass-v12.ogg'
TITLE = OUT / '霜窗回声_手书字标_v3.png'
ARM = OUT / '蓝丝带手绘唱针_v4.png'
V4 = '--v4' in sys.argv
V5 = '--v5' in sys.argv
VERSION = 5 if V5 else 4 if V4 else 3
VIDEO = OUT / f'霜窗回声_唱片演示_v{VERSION}_1080p.mp4'
W, H, FPS = 1920, 1080, 30
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(AUDIO),
    '-ar', '16000', '-ac', '1', '-f', 'f32le', 'pipe:1'])
DURATION = len(raw)/4/16000
N = math.ceil(DURATION*FPS)
mono = np.frombuffer(raw, dtype='<f4')
energy = np.array([np.sqrt(np.mean(mono[int(i*16000/FPS):int((i+1)*16000/FPS)]**2)) for i in range(N)])
energy = np.clip(energy/max(float(np.percentile(energy, 96)), .001), 0, 1)
for i in range(1, N):
    energy[i] = energy[i-1]*.94+energy[i]*.06
source = Image.open(ART).convert('RGB')
original = source.resize((W, H), Image.Resampling.LANCZOS)
if V5:
    # Reframe the road's vanishing point to the disc axis, excluding the background face.
    original = source.crop((130, 95, 1250, 725)).resize((W, H), Image.Resampling.LANCZOS)
blur = 10 if V5 else 11 if V4 else 38
background = ImageEnhance.Color(original).enhance(.65 if V5 else .72).filter(ImageFilter.GaussianBlur(blur))
background = Image.blend(Image.new('RGB', (W, H), (10, 20, 35)), background, .36 if V5 else .34)
yy, xx = np.mgrid[0:H, 0:W]
radius = ((xx-W/2)/(W*.63))**2+((yy-H*.46)/(H*.85))**2
vignette = np.zeros((H, W, 4), dtype=np.uint8)
vignette[:, :, 3] = (np.clip(radius*.35, 0, .6)*255).astype(np.uint8)
background = Image.alpha_composite(background.convert('RGBA'), Image.fromarray(vignette, 'RGBA'))
shade = Image.new('RGBA', (W, H))
sd = ImageDraw.Draw(shade)
sd.ellipse((620, 180, 1300, 845), fill=(0, 5, 13, 115))
background = Image.alpha_composite(background, shade.filter(ImageFilter.GaussianBlur(35)))

DISC_SIZE, LABEL_SIZE = 620, 574 if V5 else 500
PAD = 5
SIDE = DISC_SIZE+PAD*2
disc = Image.new('RGBA', (SIDE, SIDE))
d = ImageDraw.Draw(disc)
d.ellipse((PAD, PAD, SIDE-PAD-1, SIDE-PAD-1), fill=(17, 27, 39, 255),
    outline=(99, 124, 145, 220), width=2)
for inset in ([6, 12, 18] if V5 else range(6, 60, 4)):
    c = (47, 64, 79, 160) if inset % 8 else (27, 43, 58, 210)
    d.ellipse((PAD+inset, PAD+inset, SIDE-PAD-inset-1, SIDE-PAD-inset-1), outline=c, width=1)
# Preserve the original first wallpaper, using its right square for the album label.
sw, sh = source.size
label = source.crop((sw-sh, 0, sw, sh)).resize((LABEL_SIZE, LABEL_SIZE), Image.Resampling.LANCZOS)
label = ImageEnhance.Brightness(ImageEnhance.Color(label).enhance(.92)).enhance(.90 if V5 else .86)
mask = Image.new('L', (LABEL_SIZE, LABEL_SIZE))
ImageDraw.Draw(mask).ellipse((1, 1, LABEL_SIZE-2, LABEL_SIZE-2), fill=255)
label.putalpha(mask)
offset = (SIDE-LABEL_SIZE)//2
disc.alpha_composite(label, (offset, offset))
d = ImageDraw.Draw(disc)
d.ellipse((offset, offset, offset+LABEL_SIZE, offset+LABEL_SIZE), outline=(174, 198, 216, 120 if V5 else 190), width=1 if V5 else 2)
c = SIDE/2
hub = 9 if V5 else 15
d.ellipse((c-hub, c-hub, c+hub, c+hub), fill=(34, 47, 60, 255), outline=(172, 196, 213, 160), width=1)
d.ellipse((c-5, c-5, c+5, c+5), fill=(9, 18, 31, 255))
title = Image.open(TITLE).convert('RGBA')
box = title.getchannel('A').getbbox()
title = title.crop(box)
title.thumbnail((292, 110) if V5 else (350, 132), Image.Resampling.LANCZOS)
if V4:
    arm = Image.open(ARM).convert('RGBA')
    arm = arm.crop(arm.getchannel('A').getbbox())
    arm.thumbnail((280, 146), Image.Resampling.LANCZOS)
rng = np.random.default_rng(51018)
snowflakes = [(float(rng.uniform(0, W)), float(rng.uniform(0, H)),
    float(rng.uniform(5, 12)), float(rng.uniform(.55, 1.0)), float(rng.uniform(0, 6.28))) for _ in range(17)]


def smooth(a, b, x):
    x = max(0, min(1, (x-a)/(b-a)))
    return x*x*(3-2*x)


def frame(t):
    im = background.copy()
    if V5:
        paint = ImageDraw.Draw(im)
        for x0, y0, speed, radius, phase in snowflakes:
            x = (x0-t*speed*.25+6*math.sin(t*.15+phase)) % W
            y = (y0+t*speed) % H
            if 770 < x < 1150 and y > 800:
                continue
            base = im.getpixel((int(x), int(y)))
            alpha = .12+.10*math.sin(t*.3+phase)**2
            color = tuple(int(base[k]*(1-alpha)+(201, 223, 239)[k]*alpha) for k in range(3))+(255,)
            paint.ellipse((x-radius, y-radius, x+radius, y+radius), fill=color)
    rotating = disc.rotate(-t*6, Image.Resampling.BICUBIC, expand=False)
    im.alpha_composite(rotating, ((W-SIDE)//2, 461-SIDE//2))
    if V4:
        light = Image.new('RGBA', (650, 650))
        ld = ImageDraw.Draw(light)
        strength = float(energy[min(int(t*FPS), N-1)])
        ld.ellipse((12, 12, 637, 637), outline=(96, 165, 211, int(12+strength*30)), width=2)
        for offset in [0, 180]:
            angle = t*1.8+offset
            ld.arc((8, 8, 641, 641), angle, angle+16, fill=(144, 203, 236, int(40+strength*70)), width=1)
            theta = math.radians(angle+16)
            px, py = 325+316*math.cos(theta), 325+316*math.sin(theta)
            a = int(90+strength*70)
            ld.line((px-3, py, px+3, py), fill=(206, 232, 246, a), width=1)
            ld.line((px, py-3, px, py+3), fill=(206, 232, 246, a), width=1)
        im.alpha_composite(light, (W//2-325, 461-325))
        im.alpha_composite(arm, (1184, 144))
    if V5:
        accents = Image.new('RGBA', (SIDE, SIDE))
        ad = ImageDraw.Draw(accents)
        # Six road-dash marks follow the record; softly brighten every four bars (84 BPM).
        phrase = 4*4*60/84
        pulse = math.exp(-(t % phrase)/1.25)
        for k in range(6):
            angle = -48-t*6+k*4.2
            ad.arc((15, 15, SIDE-16, SIDE-16), angle, angle+2,
                fill=(167, 208, 234, int(40+110*pulse)), width=2)
        im.alpha_composite(accents, ((W-SIDE)//2, 461-SIDE//2))
    im.alpha_composite(title, ((W-title.width)//2, 815 if V5 else 843))
    im = im.convert('RGB')
    alpha = smooth(0, 2.2, t)*(1-smooth(DURATION-3.5, DURATION, t))
    if alpha < .999:
        im = Image.blend(Image.new('RGB', (W, H), (7, 13, 23)), im, alpha)
    return im


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def render():
    cmd = ['ffmpeg', '-hide_banner', '-y', '-f', 'rawvideo', '-pixel_format', 'rgb24',
        '-video_size', f'{W}x{H}', '-framerate', str(FPS), '-i', 'pipe:0', '-i', str(AUDIO),
        '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        '-threads', '4', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
        '-af', f'afade=t=in:st=0:d=0.6,afade=t=out:st={DURATION-3.5:.6f}:d=3.5',
        '-t', str(DURATION), '-movflags', '+faststart', '-metadata', 'title=霜窗回声', str(VIDEO)]
    start = time.time()
    with (OUT/f'encode-v{VERSION}.log').open('w', encoding='utf-8') as log:
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=log)
        print(json.dumps({'ffmpeg_pid': proc.pid, 'frames': N}), flush=True)
        try:
            for i in range(N):
                proc.stdin.write(frame(i/FPS).tobytes())
                if i % 600 == 0:
                    print(json.dumps({'frame': i, 'elapsed': round(time.time()-start, 1)}), flush=True)
            proc.stdin.close()
            if proc.wait() != 0:
                raise RuntimeError(f'Encoding failed; see encode-v{VERSION}.log')
        except BaseException:
            proc.kill()
            proc.wait()
            raise
    report = {'version': VERSION, 'video': str(VIDEO.relative_to(ROOT)), 'bytes': VIDEO.stat().st_size,
        'sha256': digest(VIDEO), 'duration_seconds': DURATION, 'dimensions': [W, H], 'fps': FPS,
        'frames': N, 'render_seconds': round(time.time()-start, 1),
        'inputs': [{'path': str(p.relative_to(ROOT)), 'sha256': digest(p)} for p in ([ART, AUDIO, TITLE, ARM] if V4 else [ART, AUDIO, TITLE])],
        'visible_text': ['霜窗回声'],
        'design': {'background': f'first-wallpaper road crop [130,95,1250,725], Gaussian blur 10px, 36% cool dim mix; no duplicate face' if V5 else f'same first wallpaper, Gaussian blur {blur}px, cool dim mix at 34%, vignette',
            'disc': f'620px disc, {LABEL_SIZE}px original-wallpaper circle label, clockwise 6 degrees/second; three rim grooves' if V5 else '620px vinyl rim, 500px original-wallpaper circle label, clockwise 6 degrees/second',
            'title': 'built-in image_gen isolated handwritten title, static below disc',
            'details': ['six road-dash marks softly pulse per four bars at 84BPM', '17 sparse background snowflakes', '292px handwritten title at y815', 'no tonearm'] if V5 else ['small tonearm with blue ribbon echoing the character', 'RMS music-driven blue rim', 'two small traveling frost glints'] if V4 else [],
            'removed': ['spectrum', 'progress', 'time', 'branding', 'English', 'bright white margins']+(['tonearm', 'duplicate background face'] if V5 else ['snow overlay'])},
        'acquisition': f'python docs/evidence/2026-10-18-ost-snow-road/render_ost_v3.py --render {"--v5" if V5 else "--v4" if V4 else ""}; existing local Pillow/numpy/FFmpeg'}
    (HERE/f'render-report-v{VERSION}.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in ['inputs', 'design']}, ensure_ascii=True), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--render', action='store_true')
    parser.add_argument('--v4', action='store_true')
    parser.add_argument('--v5', action='store_true')
    args = parser.parse_args()
    frame(60).save(OUT/f'v{VERSION}-poster.jpg', quality=94)
    if args.render:
        render()
    else:
        print(json.dumps({'poster': str(OUT/f'v{VERSION}-poster.jpg')}, ensure_ascii=True))
