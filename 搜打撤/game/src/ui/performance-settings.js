import { FRAME_LIMITS, QUALITY_PRESETS, getPerformanceSettings, hasUnsavedPerformanceSettings, setPerformanceSettings } from '../core/performance-settings.js';

const UNSAVED_MESSAGE = '已生效但保存失败；重载后可能恢复原设置。';

const QUALITY_HELP = Object.freeze({
  low: '减少光效，节省性能。',
  balanced: '画质与性能均衡。',
  high: '精细画面，完整光效。',
});

export function performanceSettingsHTML() {
  const value = getPerformanceSettings();
  return `<div class="performance-controls">
    <label class="performance-setting" for="setQuality"><span>画质档位</span><select id="setQuality">${Object.entries(QUALITY_PRESETS).map(([key, preset]) => `<option value="${key}"${key === value.quality ? ' selected' : ''}>${preset.label}</option>`).join('')}</select></label>
    <p id="setQualityHelp" class="performance-help">${QUALITY_HELP[value.quality]}</p>
    <label class="performance-setting" for="setFrameLimit"><span>动画帧率</span><select id="setFrameLimit">${FRAME_LIMITS.map(fps => `<option value="${fps}"${fps === value.fps ? ' selected' : ''}>${fps} FPS${fps === 60 ? '（推荐）' : ''}</option>`).join('')}</select></label>
    <p id="setFrameHelp" class="performance-help">地图按所选上限绘制；战斗角色 ≤60 帧，庭院 ≤30 帧。</p>
    <p class="performance-help">立即生效；战斗速度不变。</p>
    <details class="performance-details"><summary>详细说明</summary>
      <p id="setQualityTechnical" class="performance-help">${QUALITY_PRESETS[value.quality].description}</p>
      <p class="performance-help">采样倍率控制画布清晰度与绘制开销，并受屏幕像素密度（DPR）限制。帧率选项只限制这些画布的动画绘制，不限制浏览器全部 CSS 动画或视频；与「减少动态效果」独立。</p>
    </details>
    <p id="setPerformanceStatus" class="performance-help" role="status" aria-live="polite">${hasUnsavedPerformanceSettings() ? UNSAVED_MESSAGE : ''}</p>
  </div>`;
}
export function bindPerformanceSettings(root) {
  const quality = /** @type {HTMLSelectElement} */ (root.querySelector('#setQuality'));
  const fps = /** @type {HTMLSelectElement} */ (root.querySelector('#setFrameLimit'));
  quality.setAttribute('aria-describedby', 'setQualityHelp');
  fps.setAttribute('aria-describedby', 'setFrameHelp');
  const change = () => {
    const result = setPerformanceSettings({ quality: quality.value, fps: fps.value });
    /** @type {HTMLSelectElement} */ (root.querySelector('#setQualityHelp')).textContent = QUALITY_HELP[result.quality];
    /** @type {HTMLSelectElement} */ (root.querySelector('#setQualityTechnical')).textContent = QUALITY_PRESETS[result.quality].description;
    /** @type {HTMLSelectElement} */ (root.querySelector('#setPerformanceStatus')).textContent = result.saved ? '已保存，立即生效' : UNSAVED_MESSAGE;
  };
  quality.addEventListener('change', change);
  fps.addEventListener('change', change);
}
