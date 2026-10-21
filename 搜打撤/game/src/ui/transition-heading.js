import { esc } from '../core/shared.js';
import '../../css/transition-heading.css';

// 过场共用标题；必须随所属切幕一起离场，不能另挂在已揭开的目标页上。
export function transitionHeadingHTML(title) {
  return `<div class="transition-heading"><div class="expedition-cut-rule" aria-hidden="true"></div><h2>${esc(title)}</h2></div>`;
}
