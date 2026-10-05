"""Generate the five 2026-09-23 Vite home icons with official painterly v1.2."""
import argparse
import json
import sys
import time
import zipfile
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '搜打撤' / 'tools'))
from nai_gen import ENDPOINT, build_payload  # noqa: E402
from nai_style import build_prompt, build_uc  # noqa: E402

OUT = ROOT / '.tmp' / 'nai' / 'output' / 'home-icons-v12-20260923'
BASE = ('single isolated flat 2D game menu icon, strong instantly readable silhouette, '
        'centered emblem with generous empty transparent margins, restrained hand-painted texture, '
        'broad solid color shapes, crisp cutout edges, no ground plane, no setting, no frame. ')
JOBS = {
    'explore-sword': ('A long black sword laid horizontally from left to right, the blade very dark charcoal with a narrow cold steel edge; one continuous ribbon of golden wind curves around the blade and hilt, a few small golden sparks. The sword is unmistakably horizontal and remains the dominant shape.', 'black, antique gold'),
    'workshop-staff': ('A single slender purple sorcerer staff pointing upward at a slight diagonal; a compact bright violet flame burns at its top, violet and muted brass details on the shaft. The staff and its flame make one simple silhouette.', 'deep violet, pale lilac, brass'),
    'achievement-shield': ('One sturdy dark steel shield in front of a small stacked campfire made of three short burning logs; the orange flames rise just above and around the shield, compact and easy to recognize. No people and no extra weapons.', 'charcoal steel, ember orange, warm gold'),
    'photo-orb-book': ('A clear spherical glass orb enclosing one open old book, the pages plainly visible through the glass; a slim circular rim and just two cool highlights define the globe. The book remains the focus.', 'slate blue, ivory paper, muted gold'),
    'settings-gear': ('One bold cold steel gear wheel with eight thick teeth, a small six-point snowflake engraved in its circular center and two tiny brass accent marks; simple mechanical silhouette.', 'gunmetal blue, frosted silver, antique gold'),
}
UC = build_uc('opaque background, solid background, scenery, landscape, tabletop, pedestal, border, badge frame, banner, words, letters, numbers, logo, duplicate icon, multiple panels, photorealism, 3d render, bevel, heavy depth of field')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('names', nargs='+', choices=JOBS)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    token = next((line.strip() for line in (ROOT / '.tmp' / 'nai' / 'token.txt').read_text(encoding='utf-8').splitlines() if line.strip() and not line.lstrip().startswith('#')), '')
    if not token:
        raise SystemExit('NAI token missing')
    for index, name in enumerate(args.names):
        if index:
            time.sleep(46)
        description, palette = JOBS[name]
        prompt = build_prompt(BASE + description + f' Limited palette: {palette}.', 'Transparent background, isolated icon cutout with alpha.')
        payload = build_payload(prompt, UC, width=1024, height=1024)
        payload['parameters']['straight_alpha'] = True
        out = OUT / f'{name}.png'
        payload_path = OUT / f'{name}.payload.json'
        zip_path = OUT / f'{name}.zip'
        payload_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
        command = ['curl', '--noproxy', '*', '-sS', '--ssl-no-revoke', '--max-time', '240',
                   '-H', f'Authorization: Bearer {token}', '-H', 'Content-Type: application/json',
                   '-w', '%{http_code}', '-o', str(zip_path), '--data-binary', f'@{payload_path}', ENDPOINT]
        result = subprocess.run(command, capture_output=True, text=True)
        status = result.stdout.strip()
        print(f'{name}: HTTP {status}; seed={payload["parameters"]["seed"]}', flush=True)
        if status == '403':
            raise SystemExit('NAI HTTP 403: token expired; stopped')
        if status == '429':
            raise SystemExit('NAI HTTP 429: cool down 15 minutes; stopped')
        if status not in ('200', '201'):
            raise SystemExit(f'NAI generation failed: HTTP {status}: {result.stderr[:200]}')
        with zipfile.ZipFile(zip_path) as archive:
            out.write_bytes(archive.read(archive.namelist()[0]))
        from PIL import Image
        with Image.open(out) as image:
            image.load()
            print(f'{name}: {image.size}, mode={image.mode}, alpha={image.getchannel("A").getextrema() if image.mode == "RGBA" else "none"}', flush=True)

if __name__ == '__main__':
    main()
