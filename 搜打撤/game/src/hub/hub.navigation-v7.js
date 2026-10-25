import { esc } from '../core/shared.js';
import { baseHomeIconV10 } from './hub.home-icons-v10.js';

const rooms = [
  ['deploy', '基地'], ['classes', '人物'], ['stash', '后勤'], ['shop', '交易所'],
  ['ach', '收藏室'], ['upgrade', '建设'], ['courtyard', '庭院'],
];

// 同一条底部图标导航贯穿基地首页及所有房间，目的地位置保持一致。
export function baseNavigationV7HTML({ tab = 'deploy', pendingRewards = 0 } = {}) {
  return `<nav class="hub-tabs base-navigation-v7" aria-label="基地房间">${rooms.map(([id, name]) => `<button type="button" class="hub-tab${id === tab ? ' on' : ''}" data-act="hubTab" data-tab="${id}"${id === 'courtyard' ? ' data-view="koi"' : ''} aria-pressed="${id === tab}"${id === tab ? ' aria-current="page"' : ''}>${baseHomeIconV10(id === 'deploy' ? 'home' : id)}<span>${name}</span>${id === 'ach' && pendingRewards ? `<em aria-label="${esc(pendingRewards)}项奖励可领取">${esc(pendingRewards)}</em>` : ''}</button>`).join('')}</nav>`;
}
