# -*- coding: utf-8 -*-
"""NAI 生图客户端 —— 全游戏生图 API 权威链路，0919 固化进 git（token 不入库）。

【默认（09-24 老板定版，新 token 起）】模型 nai-diffusion-4-5-full + 免费档小图（832×1216/1344×768）；
  V5 需显式传 model='nai-diffusion-5-full'。**大图一天限额 20 张**：长×宽超过免费档上限
  每次请求（含通道重试）即计一次，工具内按自然日锁定预扣、到顶拒出
  （.tmp/nai/large-usage.json；状态损坏停手核对，宁保守勿超限）。
【通道（09-24 双通道互试）】curl 子进程：先直连 `--noproxy "*"`，000 自动换 `-x socks5h://127.0.0.1:7890`
  （Clash/TUN 起来后直连常被掐，见记忆 nai-image-endpoint-network-quirks）。
  Python requests 本机对 image.novelai.net 握手必报 WinError 0，勿改回 requests。
【端点】POST https://image.novelai.net/ai/generate-image
  Authorization: Bearer <token>；响应是 ZIP（200/201 都算成功）取第一个条目。
【token】绝不进 git/记忆/日志：默认读 .tmp/nai/token.txt（过滤 # 注释行），或环境变量 NAI_TOKEN。
  .tmp 被清理后需老板重新提供；09-24 已轮换（旧 token 作废）。
【计费】steps≤28 且 长×宽<约108万px 免费（走额度条）；超档烧 Anlas 并计大图限额。
  迭代免费档横版 1344×768 / 竖版 832×1216；定稿大图 2048×1152 等。
【节奏铁律】跨进程请求 ≥45s 间隔；HTTP 403=token 失效立即停手上报老板；
  HTTP 429=持久化共享冷却 15 分钟；HTTP 000=网络瞬断，按节流换通道。
  request-rate.json 记录预约与冷却；请求中断或响应未保存时停手核对，不自动解除未知状态。
【画风】正向提示词一律走 tools/nai_style.py 的 build_prompt/build_uc，勿散抄。

用法：
    from nai_gen import generate_image
    generate_image(prompt, uc, char_prompt='...', width=832, height=1216, out='x.png')
"""
import json
import os
import random
import subprocess
import tempfile
import zipfile
from pathlib import Path
from nai_guard import GuardError, RequestGuard

ENDPOINT = 'https://image.novelai.net/ai/generate-image'
MODEL = 'nai-diffusion-4-5-full'   # 09-24 起默认 4.5 小图；V5 显式传 model='nai-diffusion-5-full'
# 0919「配置拉满」口径：steps 28 顶格 + scale 6.5（官方区间上限）+ variety_plus
DEFAULTS = dict(steps=28, scale=6.5, cfg_rescale=0.0, sampler='k_euler_ancestral',
                noise_schedule='karras', variety_plus=True)
# 仓库根 = 代号柒/（搜打撤/tools/nai_gen.py → 搜打撤 → 代号柒；.tmp/nai 挂在仓库根）
ROOT = Path(__file__).resolve().parents[2]
TOKEN_FILE = ROOT / '.tmp' / 'nai' / 'token.txt'
# 免费档像素上限（约 108 万）：超过即视为大图，计 20 张/日限额
FREE_PX_CAP = 1_080_000
LARGE_QUOTA_PER_DAY = 20
LARGE_USAGE_FILE = ROOT / '.tmp' / 'nai' / 'large-usage.json'


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


def _curl_request(payload_file, zip_file, token, channel):
    # Argument lists preserve paths/headers literally; no shell expansion of
    # credentials or output names. Keep the existing two network channels.
    arguments = ['curl'] + channel + ['-sS', '--ssl-no-revoke', '--max-time', '240',
                 '-H', 'Authorization: Bearer ' + token, '-H', 'Content-Type: application/json',
                 '-w', '%{http_code}', '-o', str(zip_file),
                 '--data-binary', '@' + str(payload_file), ENDPOINT]
    return subprocess.run(arguments, shell=False, capture_output=True, text=True).stdout.strip()


def generate_image(prompt, uc='', char_prompt='', width=832, height=1216, seed=None, out='nai-out.png', model=MODEL,
                   *, guard=None, transport=None, token=None):
    """构造 payload → curl 直连生成 → 解 ZIP 首条目存 PNG → PIL 校验尺寸。返回 (out, seed)。"""
    from PIL import Image

    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    body = build_payload(prompt, uc, char_prompt, width, height, seed, model)
    seed = body['parameters']['seed']

    # 双通道互试（09-24）：Clash/TUN 起来后直连常被掐（000），自动换 socks5h 7890；
    # 两条都 000 才报网络瞬断。顺序与 [[nai-image-endpoint-network-quirks]] 一致。
    channels = [['--noproxy', '*'], ['-x', 'socks5h://127.0.0.1:7890']]
    guard = guard if guard is not None else RequestGuard(
        LARGE_USAGE_FILE.parent, free_px_cap=FREE_PX_CAP, quota=LARGE_QUOTA_PER_DAY)
    transport = transport if transport is not None else _curl_request
    token = token if token is not None else load_token()
    # Output names can be shared by concurrent calls (including the default).
    # Keep each call's payload, response and verification private; only publish
    # a fully verified image to the requested output. Clean up only this call's
    # temporary directory, never existing sibling payload/ZIP artifacts.
    with tempfile.TemporaryDirectory(prefix=out.stem + '.nai-', dir=str(out.parent)) as temporary:
        temporary = Path(temporary)
        payload_file = temporary / 'payload.json'
        zip_file = temporary / 'response.zip'
        image_file = temporary / 'image.png'
        payload_file.write_text(json.dumps(body, ensure_ascii=False), encoding='utf-8')
        status = ''
        for idx, channel in enumerate(channels):
            try:
                status = str(guard.perform(width, height, lambda: transport(payload_file, zip_file, token, channel)))
            except (GuardError, OSError) as error:
                raise SystemExit(str(error)) from error
            print(f'HTTP {status} seed={seed} {width}x{height} channel={idx}({channel[0]})', flush=True)
            if status != '000':
                break
        if status == '403':
            raise SystemExit('NAI HTTP 403：token 失效，立即停手上报老板')
        if status == '429':
            raise SystemExit('NAI HTTP 429：冷却 15 分钟后重跑')
        if status == '000':
            raise SystemExit('NAI HTTP 000：网络瞬断，稍候重试')
        if status not in ('200', '201'):
            raise SystemExit(f'Generation failed (HTTP {status})')

        with zipfile.ZipFile(zip_file) as z:
            image_file.write_bytes(z.read(z.namelist()[0]))
        with Image.open(image_file) as im:
            assert im.size == (width, height), im.size
            im.verify()
        os.replace(str(image_file), str(out))
    print(f'SAVED {out} {width}x{height} {out.stat().st_size} bytes', flush=True)
    return str(out), seed


if __name__ == '__main__':
    # 冒烟：只构造 payload 不联网（验证结构完整）
    p = build_payload('test prompt', 'test uc', 'girl, test', 832, 1216, 42)
    keys = sorted(p['parameters'].keys())
    print('payload ok:', len(keys), 'params; seed=', p['parameters']['seed'],
          '; charPrompts=', len(p['parameters']['characterPrompts']))
