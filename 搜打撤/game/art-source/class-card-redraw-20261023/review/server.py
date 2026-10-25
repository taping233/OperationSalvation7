"""Local-only card review with allowlisted images and durable per-card feedback."""
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone
from urllib.parse import urlsplit
import json, mimetypes, os, threading

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[3]
EVIDENCE = PROJECT / 'docs/evidence/2026-10-23-class-card-redraw'
DATA = EVIDENCE / 'feedback.json'
PORT = 5358
LOCK = threading.Lock()
RECEIPTS = json.loads((EVIDENCE / 'receipt.json').read_text('utf-8'))['items']
LATEST_FILE = EVIDENCE / 'round2/final-receipt.json'
LATEST = {x['card_id']: x for x in json.loads(LATEST_FILE.read_text('utf-8'))['items']} if LATEST_FILE.exists() else {}
CHARACTERS = ['无'] * 7 + ['黑像'] * 3 + ['白塔'] * 2 + ['常无欲'] * 4
CAREERS = {'无': '侠客', '黑像': '战士', '白塔': '法师', '常无欲': '降临者'}
SHOTS = ['剑旁侧脸与折返光弧 · 半身近景', '暗缝中的近刃与蓝眼 · 极近景', '单剑御空 · 低机位全身', '空披衣与脱身回眸 · 前近后远', '近箭带出远处箭雨 · 强透视', '遮挡负形中露眼与笑 · 脸肩特写', '越过肩甲看伏击 · 过肩近景', '拉紧护臂扣带 · 局部近景', '巨剑近扫与腰肩扭转 · 斜仰视', '双镖先后离手 · 半身强透视', '枝条回环、萌芽与再生 · 掌心特写', '残纸断开、符文跨页 · 物件透视', '暗壳破裂、火焰扩张 · 爆裂特写', '近火切入、远火绕肩 · 高斜视', '一核分裂为近中远三团 · 指尖近景', '极细射线切开厚重暗面 · 穿透特写']
CARDS = []
REVISED_SHOTS = {
    'tt7-imitate': '沿用近景构图，修顺头发与双镜片墨镜',
    'tt7-ghostblade': '近刃与蓝眼特写，修头发并补齐头饰',
    'tt7-swordimmortal': '原草稿御剑坐姿，修腿脚方向与人设',
    'tt7-goldencicada': '宽刃穿过空披衣，人物向侧面脱身',
    'tt7-meteorrain': '沿用草稿箭雨构图，清理脸部与头发',
    'tt7-sneak': '沿用草稿过肩伏击，露额头并修正人设',
    'tt7-whirlwind': '双手挥剑横扫两侧敌人，重做站姿与群攻',
    'tt7-bloodpoison': '保留双镖透视，清理多余色块',
    'tt7-burnharvest': '沿用草稿侧脸与掌心火焰，收简前景',
    'tt3-flame-storm': '沿用草稿远近火球，清理脏色块',
    'tt7-twinfireball': '保留草稿指尖构图，三颗球改为手绘火球',
    'tt3-nuke-ray': '保留斜向射线与暗面遮挡，减少碎裂细节',
}
IMAGES = {}
for i, item in enumerate(RECEIPTS):
    cid = item['card_id']
    nai, paint = '/images/nai/' + cid, '/images/paint/' + cid
    IMAGES[nai] = Path(item['nai'])
    current = LATEST.get(cid, item)
    revision = current.get('revision', 1)
    previous = '/images/previous/' + cid
    IMAGES[paint] = Path(current['webp'])
    IMAGES[previous] = Path(item['webp'])
    CARDS.append(dict(id=cid, name=item['name'], character=CHARACTERS[i], career=CAREERS[CHARACTERS[i]], shot=REVISED_SHOTS.get(cid, SHOTS[i]), nai=nai, paint=paint+'?v='+str(revision), previous=previous, revision=revision))
IDS = {c['id'] for c in CARDS}
TAGS = {'人设', '构图', '画风', '比例', '背景', '细节'}

def read_feedback():
    if not DATA.exists():
        return {}
    return json.loads(DATA.read_text('utf-8'))

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send(self, status, payload, mime='application/json; charset=utf-8'):
        body = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-store' if mime.startswith('application/json') else 'no-cache')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/api/cards':
            return self.send(200, CARDS)
        if path == '/api/feedback':
            with LOCK:
                return self.send(200, read_feedback())
        target = IMAGES.get(path)
        if target is None and path in ('/', '/index.html', '/style.css', '/app.js'):
            target = HERE / ('index.html' if path == '/' else path[1:])
        if target is None or not target.is_file():
            return self.send(404, {'error': 'Not found'})
        mime = mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
        if mime.startswith('text/') or mime in ('application/javascript',):
            mime += '; charset=utf-8'
        return self.send(200, target.read_bytes(), mime)

    def do_POST(self):
        if urlsplit(self.path).path != '/api/feedback':
            return self.send(404, {'error': 'Not found'})
        if self.headers.get('Origin') not in (None, 'http://127.0.0.1:5358', 'http://localhost:5358'):
            return self.send(403, {'error': 'Local origin required'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length < 120000:
                raise ValueError('Invalid length')
            item = json.loads(self.rfile.read(length))
            cid = item.get('card_id')
            if cid not in IDS or item.get('verdict') not in ('pending', 'keep', 'adjust', 'redesign'):
                raise ValueError('Invalid card or status')
            if item.get('preference', '') not in ('', 'nai', 'repaint', 'combine', 'neither'):
                raise ValueError('Invalid preference')
            notes, tags = item.get('notes', ''), item.get('tags', [])
            if not isinstance(notes, str) or len(notes) > 20000 or not isinstance(tags, list) or any(t not in TAGS for t in tags):
                raise ValueError('Invalid notes')
            clean = dict(verdict=item['verdict'], preference=item.get('preference', ''), notes=notes, tags=list(dict.fromkeys(tags)), updated_at=datetime.now(timezone.utc).isoformat())
            with LOCK:
                data = read_feedback()
                data[cid] = clean
                temporary = DATA.with_suffix('.pending')
                temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')
                os.replace(str(temporary), str(DATA))
            return self.send(200, clean)
        except (ValueError, TypeError, OSError) as error:
            return self.send(400, {'error': str(error)})

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    print(json.dumps(dict(url='http://127.0.0.1:' + str(PORT), pid=os.getpid(), directory=str(HERE)), ensure_ascii=True), flush=True)
    server.serve_forever()
