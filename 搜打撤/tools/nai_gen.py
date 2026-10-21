# -*- coding: utf-8 -*-
"""NAI 生图客户端 —— 全游戏生图 API 权威链路，0919 固化进 git（token 不入库）。

【默认（2026-10-19 老板指定免费横版）】模型 nai-diffusion-5-full，1344×768；
  CFG5.5、28步、Euler Ancestral、Karras、Rescale0、Variety+关闭。**大图一天限额 20 张**：长×宽超过免费档上限
  每次请求（含通道重试）即计一次，工具内按自然日锁定预扣、到顶拒出
  （.tmp/nai/large-usage.json；状态损坏停手核对，宁保守勿超限）。
【通道】默认用 Python requests 直连，000 时改用当前环境的 HTTPS_PROXY/ALL_PROXY；
  `NAI_TRANSPORT=curl` 可切回 Windows curl。代理端口不在客户端硬编码。
  旧环境的 requests WinError 0 是历史诊断；2026-10-13 新沙箱已实测 requests 完整生图 HTTP 200。
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
    # 多人：char_prompts=[{'prompt': '...', 'uc': '...', 'center': {'x': .3, 'y': .5}}, ...]
    # 显式位置同时传 use_coords=True；场景与画风留在 prompt。见 docs/production/art/NAI-PROMPTING.md。
"""
import json
import math
import os
import random
import subprocess
import tempfile
import zipfile
from pathlib import Path
from nai_guard import GuardError, RequestGuard

ENDPOINT = 'https://image.novelai.net/ai/generate-image'
MODEL = 'nai-diffusion-5-full'
DEFAULT_WIDTH, DEFAULT_HEIGHT = 1344, 768
# 采样沿用认可配置；默认横版用免费尺寸，显式大图仍受额度护栏保护。
DEFAULTS = dict(steps=28, scale=5.5, cfg_rescale=0.0, sampler='k_euler_ancestral',
                noise_schedule='karras', variety_plus=False)
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


def build_payload(prompt, uc='', char_prompt='', width=DEFAULT_WIDTH, height=DEFAULT_HEIGHT, seed=None, model=MODEL,
                  *, char_prompts=None, use_coords=False, vibes=None):
    """构造 V4+ 请求；多人用 char_prompts=[{prompt, uc, center}]，旧单人调用兼容。"""
    if char_prompts is not None and char_prompt:
        raise ValueError('char_prompt 与 char_prompts 不能同时使用')
    entries = [{'prompt': char_prompt}] if char_prompts is None else char_prompts
    if not isinstance(entries, (list, tuple)):
        raise ValueError('char_prompts 必须为列表')
    characters = []
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get('prompt'), str):
            raise ValueError('每个角色必须含字符串 prompt')
        negative = entry.get('uc', '')
        center = entry.get('center', {'x': 0.5, 'y': 0.5})
        if not isinstance(negative, str) or not isinstance(center, dict):
            raise ValueError('角色 uc 必须为字符串，center 必须为坐标对象')
        if any(isinstance(center.get(axis), bool) or
               not isinstance(center.get(axis), (int, float)) or
               not math.isfinite(center[axis]) or not 0 <= center[axis] <= 1
               for axis in ('x', 'y')):
            raise ValueError('角色坐标必须为 0 到 1 的有限数值')
        characters.append({'prompt': entry['prompt'], 'uc': negative,
                           'center': {axis: center[axis] for axis in ('x', 'y')}, 'enabled': True})
    seed = seed if seed is not None else random.randint(100_000_000, 2_000_000_000)
    body = {
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
            'use_coords': use_coords, 'normalize_reference_strength_multiple': True,
            'inpaintImg2ImgStrength': 1.0,
            'seed': seed,
            'negative_prompt': uc,
            'characterPrompts': characters,
            'v4_prompt': {'caption': {'base_caption': prompt,
                                      'char_captions': [{'char_caption': c['prompt'], 'centers': [c['center']]}
                                                        for c in characters]},
                          'use_coords': use_coords, 'use_order': True},
            'v4_negative_prompt': {'caption': {'base_caption': uc,
                                               'char_captions': [{'char_caption': c['uc'], 'centers': [c['center']]}
                                                                 for c in characters]},
                                   'use_coords': use_coords, 'use_order': True},
            'deliberate_euler_ancestral_bug': False,
            'prefer_brownian': True,
        },
    }
    if vibes:
        if not isinstance(vibes, (list, tuple)) or len(vibes) > 16:
            raise ValueError('vibes 必须为不超过 16 项的列表')
        for vibe in vibes:
            if not isinstance(vibe, dict) or not isinstance(vibe.get('encoding'), str) or not vibe['encoding']:
                raise ValueError('vibe 必须含非空 base64 encoding')
            strength = vibe.get('strength')
            if isinstance(strength, bool) or not isinstance(strength, (int, float)) or not 0 <= strength <= 1:
                raise ValueError('vibe strength 必须在 0 到 1 之间')
        if sum(v['strength'] for v in vibes) > 1:
            raise ValueError('vibe 总强度须不超过 1')
        body['parameters'].update(reference_image_multiple=[v['encoding'] for v in vibes],
                                  reference_strength_multiple=[v['strength'] for v in vibes],
                                  reference_information_extracted_multiple=[1.0] * len(vibes))
    return body


def _curl_request(payload_file, zip_file, token, channel, endpoint=ENDPOINT):
    # Argument lists preserve paths/headers literally; no shell expansion of
    # credentials or output names. Keep the existing two network channels.
    arguments = ['curl'] + channel + ['-sS', '--ssl-no-revoke', '--max-time', '240',
                 '-H', 'Authorization: Bearer ' + token, '-H', 'Content-Type: application/json',
                 '-w', '%{http_code}', '-o', str(zip_file),
                 '--data-binary', '@' + str(payload_file), endpoint]
    return subprocess.run(arguments, shell=False, capture_output=True, text=True).stdout.strip()


def _requests_request(payload_file, zip_file, token, channel, endpoint=ENDPOINT):
    """Use Python TLS so Windows sandbox curl's Schannel credentials are not required."""
    try:
        import requests
    except ImportError:
        return _curl_request(payload_file, zip_file, token, channel, endpoint)
    proxy_options = {} if channel[0] == '--noproxy' else {
        'proxies': {'https': channel[1]}}
    with requests.Session() as session:
        session.trust_env = False
        try:
            response = session.post(
                endpoint, data=payload_file.read_bytes(),
                headers={'Authorization': 'Bearer ' + token,
                         'Content-Type': 'application/json'},
                timeout=120, **proxy_options,
            )
        except requests.RequestException as error:
            print(f'NAI transport {type(error).__name__} on {channel[0]}', flush=True)
            return '000'
    zip_file.write_bytes(response.content)
    return str(response.status_code)


def generate_image(prompt, uc='', char_prompt='', width=DEFAULT_WIDTH, height=DEFAULT_HEIGHT, seed=None, out='nai-out.png', model=MODEL,
                   *, guard=None, transport=None, token=None, char_prompts=None, use_coords=False, vibes=None):
    """构造 payload → 请求生成 → 解 ZIP 首条目存 PNG → PIL 校验尺寸。返回 (out, seed)。"""
    from PIL import Image

    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    body = build_payload(prompt, uc, char_prompt, width, height, seed, model,
                         char_prompts=char_prompts, use_coords=use_coords, vibes=vibes)
    seed = body['parameters']['seed']

    # 直连失败后使用本进程已配置的代理，避免沿用失效的固定端口。
    proxy = (os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy') or
             os.environ.get('ALL_PROXY') or os.environ.get('all_proxy'))
    channels = [['--noproxy', '*']]
    if proxy:
        channels.append(['-x', proxy])
    guard = guard if guard is not None else RequestGuard(
        LARGE_USAGE_FILE.parent, free_px_cap=FREE_PX_CAP, quota=LARGE_QUOTA_PER_DAY)
    transport = transport if transport is not None else (
        _curl_request if os.environ.get('NAI_TRANSPORT', '').lower() == 'curl' else _requests_request)
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
