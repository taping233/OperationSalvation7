"""C alternative: edit recorded/publicly licensed material; generate no tones/noise."""
from pathlib import Path
from math import gcd
import hashlib
import json
import shutil
import subprocess
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly, butter, sosfilt

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[3]
OUT = PROJECT / 'game/assets/sfx/alternatives/cc0-action'
WAV = ROOT / 'rendered-wav'
OUT.mkdir(parents=True, exist_ok=True)
WAV.mkdir(exist_ok=True)
RATE = 48000

RECIPES = [
    dict(id='click', label='点击', group='ui', peak=-13, note='剪刀闭合的短促轻扣，起音干净。', layers=[
        dict(file='scissors-close-01.wav', gain=1, offset=0, max=0.15)]),
    dict(id='confirm', label='确认', group='ui', peak=-11, note='金属锁扣落定，和点击的轻扣区分。', layers=[
        dict(file='handcuffs-metal-lock-01.wav', gain=1, offset=0, max=0.52)]),
    dict(id='card', label='出牌', group='cards', peak=-11, note='真实纸页滑动，保留纸张摩擦与落点。', layers=[
        dict(file='book-page-02.wav', gain=1, offset=0, max=0.74)]),
    dict(id='attackSlash', label='斩击', group='combat', peak=-7.5, note='挥动空气先行、刀刃滑切随后，短而锐。', layers=[
        dict(file='tube-plastic-whoosh-01.wav', gain=0.48, offset=0, max=0.27),
        dict(file='sword.6.ogg', gain=1, offset=0.055, max=0.46)]),
    dict(id='parry', label='格挡', group='combat', peak=-8, note='双刀硬碰的金属顿点，保留自然短响。', layers=[
        dict(file='sword_clash.5.ogg', gain=1, offset=0, max=0.56)]),
    dict(id='shieldBreak', label='破盾', group='combat', peak=-7.5, note='护面冲击后玻璃裂散，明确碎裂过程。', layers=[
        dict(file='bfh1_metal_hit_04.ogg', gain=0.48, offset=0, max=0.3),
        dict(file='bfh1_glass_breaking_02.ogg', gain=1, offset=0.032, max=0.4)]),
    dict(id='heal', label='治疗', group='combat', peak=-10, note='药瓶拔塞、药液流动与一滴收尾，温和具体。', layers=[
        dict(file='bottle-glass-uncork-01.wav', gain=0.74, offset=0, max=0.42),
        dict(file='water-vial-fill-01.wav', gain=0.58, offset=0.17, cropStart=0.1, max=0.7),
        dict(file='water-drop-01.wav', gain=0.38, offset=0.82, max=0.23)]),
    dict(id='eventEnter', label='进入事件', group='nodes', peak=-10, note='抽屉滑动与木质摩擦，像开启现场档案。', layers=[
        dict(file='drawer-open-01.wav', gain=1, offset=0, max=1.12)]),
    dict(id='chestBurst', label='开启宝箱', group='rewards', peak=-9, note='转锁、箱体落扣、金币散落，三段动作有次序。', layers=[
        dict(file='keyhole-lockbox-turn-01.wav', gain=0.55, offset=0, max=0.56),
        dict(file='drawer-close-01.wav', gain=0.45, offset=0.23, max=0.39),
        dict(file='coins-shake-01.wav', gain=0.75, offset=0.39, max=0.92)]),
    dict(id='bossReveal', label='首脑登场', group='nodes', peak=-8, note='铁门摩擦展开、重金属锤击落定，克制地增加重量。', layers=[
        dict(file='0303.mp3', gain=0.58, offset=0, speed=0.88, max=1.38, lowpass=5800),
        dict(file='metal-hammer-hit-02.wav', gain=0.86, offset=0.54, speed=0.94, max=0.86, lowpass=7200)]),
]

def locate(name):
    files = list((ROOT / 'materials').rglob(name))
    if len(files) != 1:
        raise ValueError('Ambiguous source: ' + name)
    return files[0]

def layer_audio(spec):
    path = locate(spec['file'])
    raw, source_rate = sf.read(str(path), dtype='float64', always_2d=True)
    if not np.isfinite(raw).all():
        raise ValueError('Nonfinite source: ' + str(path))
    if raw.shape[1] == 1:
        raw = np.repeat(raw, 2, axis=1)
    if raw.shape[1] != 2:
        raise ValueError('Expected mono or stereo')
    source_peak = float(np.max(np.abs(raw)))
    active = np.flatnonzero(np.max(np.abs(raw), axis=1) > source_peak * 0.004)
    if len(active) == 0:
        raise ValueError('Empty source: ' + str(path))
    start = max(0, int(active[0]) - int(source_rate * 0.008))
    end = min(len(raw), int(active[-1]) + int(source_rate * 0.035) + 1)
    audio = raw[start:end]
    common = gcd(source_rate, RATE)
    audio = resample_poly(audio, RATE // common, source_rate // common, axis=0)
    speed = spec.get('speed', 1)
    if speed != 1:
        scale = int(round(speed * 1000))
        audio = resample_poly(audio, 1000, scale, axis=0)
    crop = int(round(spec.get('cropStart', 0) * RATE))
    audio = audio[crop:crop + int(round(spec['max'] * RATE))]
    audio = sosfilt(butter(2, 35, 'highpass', fs=RATE, output='sos'), audio, axis=0)
    if 'lowpass' in spec:
        audio = sosfilt(butter(2, spec['lowpass'], 'lowpass', fs=RATE, output='sos'), audio, axis=0)
    fade_in = min(len(audio), int(RATE * 0.002))
    fade_out = min(len(audio), int(RATE * (0.045 if spec['file'] == '0303.mp3' else 0.018)))
    audio[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
    audio[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
    scale = spec['gain'] / max(float(np.max(np.abs(audio))), 1e-12)
    audio *= scale
    record = dict(spec)
    record.update(localSource=str(path.relative_to(ROOT)).replace('\\', '/'), sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                  originalRate=source_rate, originalSeconds=round(len(raw) / source_rate, 6), originalDecodedPeak=round(source_peak, 6),
                  activeTrimStartSeconds=round(start / source_rate, 6), activeTrimEndSeconds=round(end / source_rate, 6),
                  outputLayerSeconds=round(len(audio) / RATE, 6), highpassHz=35, fadeInSeconds=0.002,
                  fadeOutSeconds=0.045 if spec['file'] == '0303.mp3' else 0.018, layerNormalizationGain=round(scale, 6))
    return audio, record

def render(recipe):
    layers = [layer_audio(item) for item in recipe['layers']]
    frames = max(len(audio) + int(round(record['offset'] * RATE)) for audio, record in layers)
    audio = np.zeros((frames + int(RATE * 0.015), 2), dtype='float64')
    for clip, record in layers:
        offset = int(round(record['offset'] * RATE))
        audio[offset:offset + len(clip)] += clip
    final_gain = (10 ** (recipe['peak'] / 20)) / max(float(np.max(np.abs(audio))), 1e-12)
    audio *= final_gain
    wav = WAV / (recipe['id'] + '.wav')
    dest = OUT / (recipe['id'] + '.ogg')
    sf.write(str(wav), audio, RATE, subtype='PCM_24')
    command = [shutil.which('ffmpeg'), '-y', '-hide_banner', '-loglevel', 'error', '-i', str(wav),
               '-ar', str(RATE), '-ac', '2', '-c:a', 'libvorbis', '-q:a', '5', str(dest)]
    subprocess.run(command, check=True)
    decoded, decoded_rate = sf.read(str(dest), dtype='float64', always_2d=True)
    peak = float(np.max(np.abs(decoded)))
    rms = float(np.sqrt(np.mean(decoded ** 2)))
    info = sf.info(str(dest))
    assert decoded_rate == RATE and decoded.shape[1] == 2
    assert np.isfinite(decoded).all() and 0 < peak < 0.8
    assert info.format == 'OGG' and info.subtype == 'VORBIS'
    assert len(decoded) == len(audio)
    assert float(np.max(np.abs(decoded[-480:]))) < 0.005
    record = dict(id=recipe['id'], output=str(dest.relative_to(PROJECT)).replace('\\', '/'),
                  targetPeakDbfs=recipe['peak'], finalMixGain=round(final_gain, 6), layers=[record for _, record in layers],
                  seconds=round(len(decoded) / RATE, 6), sampleRate=decoded_rate, channels=decoded.shape[1],
                  codec=info.subtype, decodedPeak=round(peak, 6), decodedPeakDbfs=round(20 * np.log10(peak), 3),
                  decodedRmsDbfs=round(20 * np.log10(rms), 3), bytes=dest.stat().st_size,
                  outputSha256=hashlib.sha256(dest.read_bytes()).hexdigest())
    print(json.dumps({k: record[k] for k in ('id', 'seconds', 'decodedPeakDbfs', 'decodedRmsDbfs', 'bytes')}, ensure_ascii=False))
    cue = dict(id=recipe['id'], label=recipe['label'], group=recipe['group'], loop=False,
               note=recipe['note'], variants=[dict(src='./assets/sfx/alternatives/cc0-action/' + dest.name, seconds=record['seconds'])])
    return cue, record

if __name__ == '__main__':
    rendered = [render(recipe) for recipe in RECIPES]
    cues, records = zip(*rendered)
    library = dict(name='C · 动作材质', version='C', featuredLabel='动作材质 · 十个', featuredTitle='真实动作，各有材质',
                   featuredIds=[recipe['id'] for recipe in RECIPES],
                   groups=dict(ui='界面反馈', cards='卡牌动作', combat='战斗与状态', nodes='事件与登场', rewards='开箱奖励'),
                   cues=list(cues))
    (OUT / 'library.json').write_text(json.dumps(library, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    report = dict(version='C', recordedAt='2026-09-30', manualListening=False, browserValidation=False,
                  description='Only selected existing source recordings/audio data are edited; no tones, noise generators, or prior procedural samples.',
                  technicalChecks='10 OGG Vorbis decodes, 48kHz stereo, finite samples, preserved frame count, decoded peak <0.8, quiet final 10ms.',
                  outputs=list(records))
    (ROOT / 'processing-and-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
