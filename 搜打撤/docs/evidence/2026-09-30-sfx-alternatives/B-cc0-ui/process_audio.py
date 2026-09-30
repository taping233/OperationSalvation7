"""Edit existing CC0 audio. No oscillator, generated noise, or upstream code."""
from pathlib import Path
import hashlib
import json
import math
import subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfilt

BASE = Path(__file__).resolve().parent
PROJECT = BASE.parents[3]
OUTPUT = PROJECT / "game/assets/sfx/alternatives/cc0-ui"
OUTPUT.mkdir(parents=True, exist_ok=True)
WORK = BASE / "processed-wav"
WORK.mkdir(exist_ok=True)
SR = 48000

# All offsets are seconds; level values are peak dBFS before the final cue gain.
# A single main action recording is preserved for each role, with at most one
# quieter physical layer where it clarifies the gameplay event.
PLAN = [
    {"id": "click", "label": "点击 · 机械触点", "group": "ui", "peakDb": -14,
     "note": "短促机械反馈，适合点击落点。", "layers": [
         {"source": "uisfx__mechanical__press.ogg", "offset": 0, "peakDb": -12}]},
    {"id": "confirm", "label": "确认 · 冷感收束", "group": "ui", "peakDb": -12,
     "note": "稍厚的确认反馈，用于完成选择。", "layers": [
         {"source": "uisfx__studio__check.ogg", "offset": 0, "peakDb": -12}]},
    {"id": "card", "label": "出牌 · 纸牌滑落", "group": "cards", "peakDb": -10,
     "note": "纸牌滑动接落桌，强调卡牌动作。", "layers": [
         {"source": "casino-audio__card-slide-4.ogg", "offset": 0, "peakDb": -9},
         {"source": "casino-audio__card-place-2.ogg", "offset": 0.31, "peakDb": -16}]},
    {"id": "attackSlash", "label": "斩击 · 刀划冲击", "group": "combat", "peakDb": -9,
     "note": "刀划为主体，轻冲击加强命中落点。", "layers": [
         {"source": "rpg-audio__knifeSlice2.ogg", "offset": 0, "peakDb": -9},
         {"source": "impact-sounds__impactPunch_medium_002.ogg", "offset": 0.16, "peakDb": -16}]},
    {"id": "parry", "label": "格挡 · 金属碰撞", "group": "combat", "peakDb": -9,
     "note": "紧凑的金属碰撞，适合格挡瞬间。", "layers": [
         {"source": "impact-sounds__impactMetal_medium_002.ogg", "offset": 0, "peakDb": -9}]},
    {"id": "shieldBreak", "label": "破盾 · 脆裂冲击", "group": "combat", "peakDb": -9,
     "note": "裂响接玻璃撞击，保留较长破碎尾部。", "layers": [
         {"source": "sci-fi-sounds__explosionCrunch_003.ogg", "offset": 0, "peakDb": -9,
          "maxSeconds": 1.25},
         {"source": "impact-sounds__impactGlass_heavy_003.ogg", "offset": 0.018, "peakDb": -13}]},
    {"id": "heal", "label": "回血 · 能量场", "group": "combat", "peakDb": -10,
     "note": "能量场状态音，适合恢复或充能反馈。", "layers": [
         {"source": "sci-fi-sounds__forceField_003.ogg", "offset": 0, "peakDb": -9}]},
    {"id": "eventEnter", "label": "事件 · 机械门开启", "group": "nodes", "peakDb": -10,
     "note": "机械门开启，强调进入新的事件空间。", "layers": [
         {"source": "sci-fi-sounds__doorOpen_001.ogg", "offset": 0, "peakDb": -9}]},
    {"id": "chestBurst", "label": "开箱 · 金属扣与金币", "group": "rewards", "peakDb": -10,
     "note": "金属扣打开后接金币声，强调箱体与奖励。", "layers": [
         {"source": "rpg-audio__metalLatch.ogg", "offset": 0, "peakDb": -11},
         {"source": "rpg-audio__handleCoins2.ogg", "offset": 0.13, "peakDb": -13}]},
    {"id": "bossReveal", "label": "首领 · 低频爆发", "group": "nodes", "peakDb": -9,
     "note": "低频爆发与自然衰减，适合重型登场。", "layers": [
         {"source": "sci-fi-sounds__lowFrequency_explosion_001.ogg", "offset": 0,
          "peakDb": -9, "tailSeconds": 0.12}]},
]


def get_layer(layer):
    path = BASE / "sources" / layer["source"]
    audio, old_sr = sf.read(str(path), dtype="float64", always_2d=True)
    original = {"rate": old_sr, "channels": audio.shape[1], "seconds": len(audio) / old_sr,
                "decodedPeakDb": float(20 * np.log10(np.max(np.abs(audio)) + 1e-12))}
    if old_sr != SR:
        gcd = math.gcd(old_sr, SR)
        audio = resample_poly(audio, SR // gcd, old_sr // gcd, axis=0)
    if audio.shape[1] == 1:
        audio = np.repeat(audio, 2, axis=1)
    # Conservative silence removal; source attacks and internal gaps are kept.
    amplitude = np.max(np.abs(audio), axis=1)
    active = np.flatnonzero(amplitude > max(amplitude.max() * 0.003, 1e-6))
    start = max(0, int(active[0]) - int(SR * 0.003))
    tail = layer.get("tailSeconds", 0.035)
    end = min(len(audio), int(active[-1]) + int(SR * tail) + 1)
    if "maxSeconds" in layer:
        end = min(end, start + int(layer["maxSeconds"] * SR))
    audio = audio[start:end].copy()
    # Remove DC/inaudible sub-bass only; preserve the source's principal timbre.
    audio = sosfilt(butter(2, 28, fs=SR, btype="highpass", output="sos"), audio, axis=0)
    fade_in = min(int(SR * 0.002), len(audio) // 4)
    fade_out = min(int(SR * 0.018), len(audio) // 4)
    audio[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
    audio[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
    gain = 10 ** (layer["peakDb"] / 20) / np.max(np.abs(audio))
    audio *= gain
    record = dict(layer, original=original, trimStartSeconds=start / SR, trimEndSeconds=end / SR,
                  trimPolicy="peak-relative -50.46 dB threshold; 3 ms attack margin; source tail margin",
                  highpassHz=28, highpassOrder=2, fadeInSeconds=0.002, fadeOutSeconds=0.018,
                  linearGain=float(gain), editedSeconds=len(audio) / SR)
    return audio, record


if __name__ == "__main__":
    output_records, cues = [], []
    for cue in PLAN:
        layers = [get_layer(layer) for layer in cue["layers"]]
        offsets = [int(layer["offset"] * SR) for layer in cue["layers"]]
        length = max(offset + len(audio) for offset, (audio, _) in zip(offsets, layers))
        mixed = np.zeros((length, 2), dtype="float64")
        for offset, (audio, _) in zip(offsets, layers):
            mixed[offset:offset + len(audio)] += audio
        final_gain = 10 ** (cue["peakDb"] / 20) / np.max(np.abs(mixed))
        mixed *= final_gain
        wav = WORK / (cue["id"] + ".wav")
        target = OUTPUT / (cue["id"] + ".ogg")
        sf.write(str(wav), mixed, SR, subtype="PCM_24")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav),
                        "-ar", str(SR), "-ac", "2", "-c:a", "libvorbis", "-q:a", "6", str(target)], check=True)
        decoded, rate = sf.read(str(target), dtype="float64", always_2d=True)
        probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
                           "stream=codec_name,sample_rate,channels:format=duration", "-of", "json", str(target)]))
        peak = float(np.max(np.abs(decoded)))
        record = {"id": cue["id"], "layers": [r for _, r in layers], "finalGain": float(final_gain),
                  "targetPeakDb": cue["peakDb"], "decodedPeak": peak,
                  "decodedPeakDb": float(20 * np.log10(peak + 1e-12)),
                  "decodedRmsDb": float(20 * np.log10(np.sqrt(np.mean(decoded ** 2)) + 1e-12)),
                  "clippedSamples": int(np.count_nonzero(np.abs(decoded) >= 1)),
                  "durationSeconds": len(decoded) / rate, "rate": rate, "channels": decoded.shape[1],
                  "ffprobe": probe, "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                  "encoder": "libvorbis q=6, 48000 Hz, stereo", "bytes": target.stat().st_size}
        assert rate == SR and decoded.shape[1] == 2 and peak < 1 and np.isfinite(decoded).all()
        output_records.append(record)
        cues.append({"id": cue["id"], "label": cue["label"], "group": cue["group"], "loop": False,
                     "note": cue["note"], "variants": [{"src": "./assets/sfx/alternatives/cc0-ui/" + cue["id"] + ".ogg",
                     "seconds": round(len(decoded) / rate, 4)}]})
        print(cue["id"], round(len(decoded) / rate, 3), "s", round(record["decodedPeakDb"], 2), "dBFS", flush=True)
    manifest = {"name": "CC0 冷感界面与工业动作", "version": "B", "featuredLabel": "冷感界面 · 十个",
                "featuredTitle": "机械触感、真实卡牌与冷感战斗反馈", "featuredIds": [cue["id"] for cue in cues],
                "groups": {"ui": "界面反馈", "cards": "卡牌动作", "combat": "战斗与状态",
                           "nodes": "事件与登场", "rewards": "开箱奖励"}, "cues": cues}
    (OUTPUT / "library.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (BASE / "processing-and-validation.json").write_text(json.dumps({"sampleRate": SR, "cues": output_records,
         "validation": "Technical decoding, rate, channel count, finite samples and clipping only; no human listening acceptance."},
         ensure_ascii=False, indent=2), encoding="utf-8")
