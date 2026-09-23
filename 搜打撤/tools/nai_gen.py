# -*- coding: utf-8 -*-
"""NAI V5 生图客户端 —— 全游戏生图 API 权威链路，0919 固化进 git（token 不入库）。

【通道（0919 实测唯一稳定）】curl 子进程直连：`curl --noproxy "*" -sS --ssl-no-revoke`
  —— Python requests 本机对 image.novelai.net 握手必报 WinError 0，代理/直连皆然，勿改回 requests。
【端点】POST https://image.novelai.net/ai/generate-image
  Authorization: Bearer <token>；响应是 ZIP（200/201 都算成功）取第一个条目。
【token】绝不进 git/记忆/日志：默认读 .tmp/nai/token.txt（过滤 # 注释行），或环境变量 NAI_TOKEN。
  .tmp 被清理后需老板重新提供。
【计费】Opus 无限生成仅对 V5 受限：steps≤28 且 长×宽<约108万px 免费（走额度条）；超档烧 Anlas。
  迭代免费档横版 1344×768 / 竖版 832×1216；定稿大图 2048×1152 等。
【节奏铁律】一轮一张 ≥45s 间隔；HTTP 403=token 失效立即停手上报老板；
  HTTP 429=冷却 15 分钟再跑；HTTP 000=网络瞬断，稍候重试即可（通道本身通常无恙）。
【画风】正向提示词一律走 tools/nai_style.py 的 build_prompt/build_uc，勿散抄。

用法：
    from nai_gen import generate_image
    generate_image(prompt, uc, char_prompt='...', width=832, height=1216, out='x.png')
"""
import json
import os
import random
import subprocess
import zipfile
from pathlib import Path

ENDPOINT = 'https://image.novelai.net/ai/generate-image'
MODEL = 'nai-diffusion-5-full'
# 0919「配置拉满」口径：steps 28 顶格 + scale 6.5（官方区间上限）+ variety_plus
DEFAULTS = dict(steps=28, scale=6.5, cfg_rescale=0.0, sampler='k_euler_ancestral',
                noise_schedule='karras', variety_plus=True)
# 仓库根 = 本文件的上级（搜打撤/tools/nai_gen.py -> 代号柒/）
ROOT = Path(__file__).resolve().parents[1]
TOKEN_FILE = ROOT / '.tmp' / 'nai' / 'token.txt'


def load_token():
    tok = os.environ.get('NAI_TOKEN', '').strip()
    if not tok and TOKEN_FILE.is_file():
        lines = TOKEN_FILE.read_text(encoding='utf-8').splitlines()
        for ln in lines:
            ln = ln.strip()
            if ln and not ln.startswith('#'):
                tok = ln
                break
    if not tok:
        raise SystemExit('NAI token 缺失：请提供 .tmp/nai/token.txt 或环境变量 NAI_TOKEN（token 不入库）')
    return tok


def build_payload(prompt, uc='', char_prompt='', width=832, height=1216, seed=None, model=MODEL):
    """按 V5 params_version=3 构造完整请求体（样例见 0919 wu-portrait json，逐字段对齐）。"""
    seed = seed if seed is not None else random.randint(100_000_000, 2_000_000_000)
    center = {'x': 0.5, 'y': 0.5}
    return {
        'input': prompt,
        'model': model,
        'action': 'generate',
        'parameters': {
            'params_version': 3,
            'width': width, 'height': height,
            'scale': DEFAULTS['scale'],
            'sampler': DEFAULTS['sampler'],
            'steps': DEFAULTS['steps'],
            'variety_plus': DEFAULTS['variety_plus'],
            'n_samples': 1,
            'ucPresetId': 'none', 'qualityPresetId': 'none',
            'autoSmea': False, 'straight_alpha': False, 'dynamic_thresholding': False,
            'controlnet_strength': 1,
            'legacy': False, 'legacy_v3_extend': False, 'legacy_uc': False,
            'add_original_image': True,
            'cfg_rescale': DEFAULTS['cfg_rescale'],
            'noise_schedule': DEFAULTS['noise_schedule'],
            'use_coords': False, 'normalize_reference_strength_multiple': True,
            'inpaintImg2ImgStrength': 1.0,
            'seed': seed,
            'negative_prompt': uc,
            'characterPrompts': [{'prompt': char_prompt, 'uc': '', 'center': center, 'enabled': True}],
            'v4_prompt': {'caption': {'base_caption': prompt,
                                      'char_captions': [{'char_caption': char_prompt, 'centers': [center]}]},
                          'use_coords': False, 'use_order': True},
            'v4_negative_prompt': {'caption': {'base_caption': uc,
                                               'char_captions': [{'char_caption': '', 'centers': [center]}]},
                                   'use_coords': False, 'use_order': True},
            'deliberate_euler_ancestral_bug': False,
            'prefer_brownian': True,
        },
    }


def generate_image(prompt, uc='', char_prompt='', width=832, height=1216, seed=None, out='nai-out.png', model=MODEL):
    """构造 payload → curl 直连生成 → 解 ZIP 首条目存 PNG → PIL 校验尺寸。返回 (out, seed)。"""
    from PIL import Image

    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    body = build_payload(prompt, uc, char_prompt, width, height, seed, model)
    seed = body['parameters']['seed']
    payload_file = out.with_suffix('.payload.json')
    zip_file = out.with_suffix('.zip')
    payload_file.write_text(json.dumps(body, ensure_ascii=False), encoding='utf-8')

    curl = ('curl --noproxy "*" -sS --ssl-no-revoke --max-time 240 '
            '-H "Authorization: Bearer ' + load_token() + '" -H "Content-Type: application/json" '
            '-w "%{http_code}" -o "' + str(zip_file) + '" '
            '--data-binary @' + str(payload_file) + ' ' + ENDPOINT)
    status = subprocess.run(curl, shell=True, capture_output=True, text=True).stdout.strip()
    print(f'HTTP {status} seed={seed} {width}x{height}', flush=True)
    if status == '403':
        raise SystemExit('NAI HTTP 403：token 失效，立即停手上报老板')
    if status == '429':
        raise SystemExit('NAI HTTP 429：冷却 15 分钟后重跑')
    if status == '000':
        raise SystemExit('NAI HTTP 000：网络瞬断，稍候重试')
    if status not in ('200', '201'):
        raise SystemExit(f'Generation failed (HTTP {status})')

    with zipfile.ZipFile(zip_file) as z:
        out.write_bytes(z.read(z.namelist()[0]))
    with Image.open(out) as im:
        assert im.size == (width, height), im.size
        im.verify()
    print(f'SAVED {out} {width}x{height} {out.stat().st_size} bytes', flush=True)
    return str(out), seed


if __name__ == '__main__':
    # 冒烟：只构造 payload 不联网（验证结构完整）
    p = build_payload('test prompt', 'test uc', 'girl, test', 832, 1216, 42)
    keys = sorted(p['parameters'].keys())
    print('payload ok:', len(keys), 'params; seed=', p['parameters']['seed'],
          '; charPrompts=', len(p['parameters']['characterPrompts']))
