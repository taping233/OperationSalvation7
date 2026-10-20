"""Anime EP revision: generated cover, quiet snowfall, no player UI."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import time

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
ROOT = PROJECT.parent
OUT = ROOT / 'output/ost-snow-road-1018'
ART = OUT / '霜窗回声_EP封面_v2.png'
AUDIO = PROJECT / 'game/assets/music-demo/01-title-frostglass-v12.ogg'
VIDEO = OUT / '霜窗回声_蓝白手书EP_v2_1080p.mp4'
W, H, FPS = 1920, 1080, 30
pcm = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(AUDIO),
    '-ar', '16000', '-ac', '1', '-f', 'f32le', 'pipe:1'])
DURATION = len(pcm)/4/16000
N = math.ceil(DURATION*FPS)
source = Image.open(ART).convert('RGB')
sw, sh = source.size
white = Image.new('RGB', (W, H), (246, 250, 253))
rng = np.random.default_rng(27018)
particles = [(float(rng.uniform(.35, 1)), float(rng.uniform(0, 1)),
    float(rng.uniform(.7, 1.4)), float(rng.uniform(0, 6.283)), int(i > 25)) for i in range(34)]


def smooth(a, b, x):
    x = max(0, min(1, (x-a)/(b-a)))
    return x*x*(3-2*x)


def frame(t):
    phase = t/DURATION
    # Only 0.8% camera travel; the four-character title stays within its quiet margin.
    zoom = 1+.008*(.5-.5*math.cos(math.pi*phase))
    bw, bh = sw/zoom, sh/zoom
    x = (sw-bw)*.55
    y = (sh-bh)*.40
    im = source.resize((W, H), Image.Resampling.BICUBIC, box=(x, y, x+bw, y+bh)).convert('RGBA')
    snow = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(snow)
    for x0, y0, factor, p, depth in particles:
        speed = (8+depth*11)*factor
        px = .34*W+((x0-.34)*W-t*speed*.33+5*math.sin(t*.18+p)) % (.66*W)
        py = (y0*H+t*speed) % (H+30)-15
        r = (.7+depth*.65)*factor
        # Preserve the face and the left handwritten title as calm focal points.
        a = (30 if px > 1500 and py < 650 else 60)+depth*12
        d.ellipse((px-r, py-r, px+r, py+r), fill=(246, 251, 255, a))
    im = Image.alpha_composite(im, snow).convert('RGB')
    opacity = smooth(0, 2, t)*(1-smooth(DURATION-3.5, DURATION, t))
    if opacity < .999:
        im = Image.blend(white, im, opacity)
    return im


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def render(seconds=None):
    duration = seconds or DURATION
    destination = OUT/'v2-motion-preview.mp4' if seconds else VIDEO
    start_at = 8 if seconds else 0
    args = ['ffmpeg', '-hide_banner', '-y', '-f', 'rawvideo', '-pixel_format', 'rgb24',
        '-video_size', f'{W}x{H}', '-framerate', str(FPS), '-i', 'pipe:0',
        '-ss', str(start_at), '-i', str(AUDIO), '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '4',
        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
        '-af', f'afade=t=in:st=0:d=0.6,afade=t=out:st={duration-3.5:.6f}:d=3.5',
        '-t', str(duration), '-movflags', '+faststart', '-metadata', 'title=霜窗回声', str(destination)]
    start = time.time()
    with (OUT/('encode-v2-preview.log' if seconds else 'encode-v2.log')).open('w', encoding='utf-8') as log:
        proc = subprocess.Popen(args, stdin=subprocess.PIPE, stderr=log)
        print(json.dumps({'ffmpeg_pid': proc.pid, 'frames': math.ceil(duration*FPS)}), flush=True)
        try:
            for i in range(math.ceil(duration*FPS)):
                proc.stdin.write(frame(start_at+i/FPS).tobytes())
                if i % 600 == 0:
                    print(json.dumps({'frame': i, 'elapsed': round(time.time()-start, 1)}), flush=True)
            proc.stdin.close()
            if proc.wait() != 0:
                raise RuntimeError('Encoding failed; see encode-v2.log')
        except BaseException:
            proc.kill()
            proc.wait()
            raise
    if seconds:
        return
    report = {'version': 2, 'video': str(VIDEO.relative_to(ROOT)), 'bytes': VIDEO.stat().st_size,
        'sha256': digest(VIDEO), 'duration_seconds': DURATION, 'dimensions': [W, H], 'fps': FPS,
        'frames': N, 'render_seconds': round(time.time()-start, 1),
        'inputs': [{'path': str(p.relative_to(ROOT)), 'sha256': digest(p)} for p in [ART, AUDIO]],
        'visible_text': ['霜窗回声'], 'design': 'Blue-white handwritten anime EP; broad pale negative space; no English, player controls, time, progress or spectrum; sparse snow and 0.8% slow camera travel.',
        'generation': 'Built-in image_gen edit using the first homepage wallpaper; full prompt and source in generated-assets-v2.json.',
        'acquisition': 'Run python docs/evidence/2026-10-18-ost-snow-road/render_ost_v2.py --render. Local existing Pillow/numpy/FFmpeg. Video and cover remain in ignored root output/.'}
    (HERE/'render-report-v2.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'design'}, ensure_ascii=True), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--render', action='store_true')
    args = parser.parse_args()
    for sec in [8, 48, 88]:
        frame(sec).save(OUT/f'v2-preview-{sec:02d}.jpg', quality=94)
    if args.render:
        render()
    else:
        print(json.dumps({'preview': str(OUT), 'visible_text': ['霜窗回声']}, ensure_ascii=True))
