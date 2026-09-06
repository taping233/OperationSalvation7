/* ============================================================
 * jsfxr-generate.cjs —— 用 jsfxr（sfxr 的 JS 移植）程序化生成
 * UI/战斗反馈音效，输出 16-bit WAV 到 assets/sfx/jsfxr/。
 *
 * 用法：node scripts/jsfxr-generate.cjs
 * 调整某个音效：改下面 SFX 里的参数后重跑即可，产物同名覆盖。
 * 授权：生成结果无版权问题（程序化合成）。
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { sfxr, Params } = require('jsfxr');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'sfx', 'jsfxr');

// 波形：0 square · 1 sawtooth · 2 sine · 3 noise
// p_base_freq 0~1，p_env_attack/sustain/decay 时长 0~1，p_freq_ramp 扫频方向
const SFX = {
  // 拾取/获得：短促上行方波
  'pickup.wav': p => {
    p.wave_type = 0;
    p.p_base_freq = 0.4; p.p_freq_ramp = 0.35;
    p.p_env_attack = 0; p.p_env_sustain = 0.1; p.p_env_decay = 0.25;
  },
  // 确认/点击：干净的正弦短音
  'confirm.wav': p => {
    p.wave_type = 2;
    p.p_base_freq = 0.55;
    p.p_env_attack = 0; p.p_env_sustain = 0.06; p.p_env_decay = 0.18;
  },
  // 取消/报错：下行扫频
  'error.wav': p => {
    p.wave_type = 1;
    p.p_base_freq = 0.45; p.p_freq_ramp = -0.5;
    p.p_env_attack = 0; p.p_env_sustain = 0.08; p.p_env_decay = 0.3;
  },
  // 升级/解锁：快速琶音上行
  'levelup.wav': p => {
    p.wave_type = 0;
    p.p_base_freq = 0.35; p.p_freq_ramp = 0.2;
    p.p_arp_mod = 0.5; p.p_arp_speed = 0.25;
    p.p_env_attack = 0; p.p_env_sustain = 0.1; p.p_env_decay = 0.4;
  },
  // 受击/失败：噪声爆
  'hit.wav': p => {
    p.wave_type = 3;
    p.p_base_freq = 0.3; p.p_freq_ramp = -0.3;
    p.p_env_attack = 0; p.p_env_sustain = 0.05; p.p_env_decay = 0.35;
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, tune] of Object.entries(SFX)) {
  const params = new Params();
  params.sample_rate = 44100;
  params.sound_vol = 0.9;
  tune(params);
  const wave = sfxr.toWave(params);
  const out = path.join(OUT_DIR, name);
  // jsfxr 的 RIFFWAVE 对象拿 dataURI 最稳，base64 解出 WAV 字节
  const buf = Buffer.from(wave.dataURI.split(',')[1], 'base64');
  fs.writeFileSync(out, buf);
  console.log('written', out, buf.length, 'bytes');
}
