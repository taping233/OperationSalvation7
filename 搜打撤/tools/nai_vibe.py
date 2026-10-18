"""Explicit, cached NAI V4+ vibe encoding using the existing transport and rate guard."""
import base64
import hashlib
import json
import os
import tempfile
from pathlib import Path
from nai_gen import MODEL, LARGE_USAGE_FILE, load_token, _requests_request
from nai_guard import RequestGuard

ENDPOINT = 'https://image.novelai.net/ai/encode-vibe'


def encode_vibe(image_path, cache_dir, *, model=MODEL, information_extracted=1.0,
                guard=None, transport=None, token=None):
    """Encode once (NAI charges 2 Anlas); repeat matching inputs reuse a verified local cache."""
    if (isinstance(information_extracted, bool) or not isinstance(information_extracted, (int, float))
            or not 0 <= information_extracted <= 1):
        raise ValueError('information_extracted 必须在 0 到 1 之间')
    data = Path(image_path).read_bytes()
    key = hashlib.sha256(data + model.encode('utf-8') + repr(information_extracted).encode('ascii')).hexdigest()
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached = cache_dir / (key + '.json')
    if cached.exists():
        record = json.loads(cached.read_text(encoding='utf-8'))
        binary = base64.b64decode(record['encoding'], validate=True)
        if not binary or hashlib.sha256(binary).hexdigest() != record['encoding_sha256']:
            raise ValueError('vibe cache 校验失败，停止，不能自动重复扣费')
        return record
    body = {'image': base64.b64encode(data).decode('ascii'), 'model': model,
            'information_extracted': information_extracted}
    guard = guard if guard is not None else RequestGuard(LARGE_USAGE_FILE.parent)
    send = transport if transport is not None else (
        lambda p, out, tok, channel: _requests_request(p, out, tok, channel, endpoint=ENDPOINT))
    token = token if token is not None else load_token()
    with tempfile.TemporaryDirectory(prefix='nai-vibe-', dir=str(cache_dir)) as directory:
        directory = Path(directory)
        payload, output = directory / 'payload.json', directory / 'encoding.bin'
        payload.write_text(json.dumps(body), encoding='utf-8')
        proxy = (os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy') or
                 os.environ.get('ALL_PROXY') or os.environ.get('all_proxy'))
        channels = [['--noproxy', '*']] + ([['-x', proxy]] if proxy else [])
        for channel in channels:
            status = str(guard.perform(1, 1, lambda: send(payload, output, token, channel)))
            print('NAI vibe HTTP ' + status, flush=True)
            if status != '000':
                break
        if status not in ('200', '201'):
            raise SystemExit('Vibe encoding failed HTTP ' + status + '; stop, no automatic retry')
        binary = output.read_bytes()
        if not binary:
            raise ValueError('Empty vibe encoding; stop before image generation')
        record = {'source_sha256': hashlib.sha256(data).hexdigest(), 'model': model,
                  'information_extracted': information_extracted,
                  'encoding_sha256': hashlib.sha256(binary).hexdigest(),
                  'encoding': base64.b64encode(binary).decode('ascii')}
        temporary = directory / 'cache.json'
        temporary.write_text(json.dumps(record), encoding='utf-8')
        os.replace(str(temporary), str(cached))
        return record
