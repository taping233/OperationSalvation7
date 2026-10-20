import { FRAME_LIMITS, QUALITY_PRESETS, getPerformanceSettings, hasUnsavedPerformanceSettings, setPerformanceSettings } from '../core/performance-settings.js';

const UNSAVED_MESSAGE = '本次已生效，但浏览器未能保存；重新加载游戏后可能恢复原设置。';

const QUALITY_HELP = Object.freeze({
  low: '减少装饰光效，降低画面开销，适合省电或运行不流畅时使用。',
  balanced: '兼顾画面清晰度与运行流畅度，推荐日常使用。',
  high: '保留更细腻的背景与角色画面，以及完整装饰光效。',
});

export function performanceSettingsHTML() {
  const value = getPerformanceSettings();
  return `<div class="performance-controls">
    <label class="performance-setting" for="setQuality"><span>画质档位</span><select id="setQuality">${Object.entries(QUALITY_PRESETS).map(([key, preset]) => `<option value="${key}"${key === value.quality ? ' selected' : ''}>${preset.label}</option>`).join('')}</select></label>
    <p id="setQualityHelp" class="performance-help">${QUALITY_HELP[value.quality]}</p>
    <label class="performance-setting" for="setFrameLimit"><span>动画帧率</span><select id="setFrameLimit">${FRAME_LIMITS.map(fps => `<option value="${fps}"${fps === value.fps ? ' selected' : ''}>${fps} FPS${fps === 60 ? '（推荐）' : ''}</option>`).join('')}</select></label>
    <p id="setFrameHelp" class="performance-help">地图最高按所选帧率绘制；战斗角色最高 60 帧，庭院最高 30 帧。实际流畅度取决于设备。</p>
    <p class="performance-help">只调整画面表现，不改变战斗速度或结算。操作即时响应，卡牌文字与目标提示保留清晰；修改立即生效。</p>
    <details class="performance-details"><summary>详细说明</summary>
      <p id="setQualityTechnical" class="performance-help">${QUALITY_PRESETS[value.quality].description}</p>
      <p class="performance-help">采样倍率控制画布清晰度与绘制开销，并受屏幕像素密度（DPR）限制。帧率选项只限制这些画布的动画绘制，不限制浏览器全部 CSS 动画或视频；与「减少动态效果」独立。</p>
    </details>
    <p id="setPerformanceStatus" class="performance-help" role="status" aria-live="polite">${hasUnsavedPerformanceSettings() ? UNSAVED_MESSAGE : ''}</p>
  </div>`;
}
export function bindPerformanceSettings(root) {
  const quality = root.querySelector('#setQuality');
  const fps = root.querySelector('#setFrameLimit');
  quality.setAttribute('aria-describedby', 'setQualityHelp');
  fps.setAttribute('aria-describedby', 'setFrameHelp');
  const change = () => {
    const result = setPerformanceSettings({ quality: quality.value, fps: fps.value });
    root.querySelector('#setQualityHelp').textContent = QUALITY_HELP[result.quality];
    root.querySelector('#setQualityTechnical').textContent = QUALITY_PRESETS[result.quality].description;
    root.querySelector('#setPerformanceStatus').textContent = result.saved ? '已保存，立即生效' : UNSAVED_MESSAGE;
  };
  quality.addEventListener('change', change);
  fps.addEventListener('change', change);
}
