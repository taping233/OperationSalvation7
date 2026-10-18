import { storeGet, storeSet } from './storage.js';
import '../../css/performance-settings.css';

export const QUALITY_PRESETS = Object.freeze({
  low: Object.freeze({ label: '节能', backdropScale: 1, courtyardScale: .75, retainedImageScale: .25,
    description: '背景与角色画布采样最高 1×，庭院 0.75×；关闭标题雪雾、装饰呼吸与地图辉光呼吸；图片缓存上限 48 MiB。' }),
  balanced: Object.freeze({ label: '均衡（推荐）', backdropScale: 1.5, courtyardScale: 1, retainedImageScale: .5,
    description: '背景与角色画布采样最高 1.5×，庭院 1×；减少标题雪雾与装饰光效；图片缓存上限 96 MiB。' }),
  high: Object.freeze({ label: '高画质', backdropScale: 2, courtyardScale: 1.25, retainedImageScale: 1,
    description: '背景与角色画布采样最高 2×，庭院 1.25×；保留完整装饰光效；图片缓存上限 192 MiB。' }),
});
export const FRAME_LIMITS = Object.freeze([30, 60, 120]);
export function normalizePerformanceSettings(value = {}) {
  return Object.freeze({
    quality: Object.hasOwn(QUALITY_PRESETS, value.quality) ? value.quality : 'balanced',
    fps: FRAME_LIMITS.includes(Number(value.fps)) ? Number(value.fps) : 60,
  });
}
function readSettings() {
  try { return normalizePerformanceSettings(JSON.parse(storeGet('sdt-performance', '{}')) || {}); }
  catch { return normalizePerformanceSettings(); }
}
let settings = readSettings();
const listeners = new Set();
export const getPerformanceSettings = () => settings;
export const getQualityPreset = () => QUALITY_PRESETS[settings.quality];
function syncDocument() {
  if (typeof document !== 'undefined' && document.body) document.body.dataset.renderQuality = settings.quality;
}
export function onPerformanceSettingsChange(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
// Rendering preferences never enter save games, game clocks, RNG or battle pace.
export function setPerformanceSettings(patch) {
  settings = normalizePerformanceSettings({ ...settings, ...patch });
  const saved = storeSet('sdt-performance', JSON.stringify(settings));
  syncDocument();
  for (const listener of listeners) listener(settings);
  return { ...settings, saved };
}
syncDocument();
if (typeof document !== 'undefined' && !document.body) document.addEventListener('DOMContentLoaded', syncDocument, { once: true });
