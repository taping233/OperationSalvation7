import { esc } from '../core/shared.js';
import '../../css/collection-chrome.css';

// Trusted component fragments come from the caller; visible page names are escaped here.
export function collectionHeaderHTML({ title, back = '', navigation = '', actions = '', summary = '', className = '' }) {
  return `<header class="collection-page-header ${className}"><div class="collection-titlebar"><div class="collection-page-back">${back}</div><div class="collection-page-identity"><h2>${esc(title)}</h2>${summary}</div><div class="collection-page-actions">${actions}</div></div>${navigation ? `<div class="collection-navigation">${navigation}</div>` : ''}</header>`;
}

export function collectionToolbarHTML({ search = '', filters = '', results = '', className = '', label = '搜索与筛选' }) {
  return `<section class="collection-page-toolbar ${className}" aria-label="${esc(label)}"><div class="collection-search">${search}</div><div class="collection-filters">${filters}</div><div class="collection-results">${results}</div></section>`;
}
