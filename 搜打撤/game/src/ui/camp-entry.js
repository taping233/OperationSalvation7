// 基地初次展开独立编排；只保留选档画面的短暂装饰副本，不接管存档或焦点。
import '../../css/camp-entry.css';
const CUT_SCENES = {
  camp: new URL('../../assets/scenes/transition-camp-v2.webp', import.meta.url).href,
  photo: new URL('../../assets/scenes/transition-photo-v2.webp', import.meta.url).href,
  field: new URL('../../assets/scenes/transition-field-v2.webp', import.meta.url).href,
  battle: new URL('../../assets/scenes/transition-battle-v2.webp', import.meta.url).href,
  boss: new URL('../../assets/scenes/transition-boss-v2.webp', import.meta.url).href,
  achievement: new URL('../../assets/scenes/transition-achievement-v2.webp', import.meta.url).href,
};
// 各目的页小图随模块预热，首次切幕出现前即可加载。
for (const src of Object.values(CUT_SCENES)) {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
}

let cleanup = null;
const identities = new WeakMap();

export function clearCampEntry() {
  cleanup?.();
  cleanup = null;
}

export function captureArchiveExit(body) {
  const picker = body?.querySelector('.slot-page');
  if (!picker) return null;
  const cards = [...picker.querySelectorAll('.slot-card')];
  const picked = picker.querySelector('[data-archive-picked]')
    || document.activeElement?.closest?.('.slot-card')
    || picker.querySelector('.slot-card:hover');
  const bounds = picker.getBoundingClientRect();
  const name = picked?.querySelector('.slot-card-name');
  const copy = picker.cloneNode(true);
  copy.classList.add('camp-entry-ghost');
  copy.setAttribute('aria-hidden', 'true');
  copy.inert = true;
  Object.assign(copy.style, {
    position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`,
    right: 'auto', bottom: 'auto', width: `${bounds.width}px`, height: `${bounds.height}px`,
  });
  copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  copy.querySelectorAll('[data-act]').forEach(el => el.removeAttribute('data-act'));
  const index = cards.indexOf(picked);
  if (index >= 0) copy.querySelectorAll('.slot-card')[index]?.classList.add('archive-picked');
  if (name) {
    const style = getComputedStyle(name);
    identities.set(copy, { text: name.textContent, rect: name.getBoundingClientRect(),
      font: style.font, fontSize: parseFloat(style.fontSize), color: style.color, letterSpacing: style.letterSpacing });
    copy.querySelector('.archive-picked .slot-card-name')?.classList.add('camp-identity-source');
  }
  return copy;
}

function transferIdentity(overlay, ghost) {
  const from = identities.get(ghost);
  const target = overlay.querySelector('.hub-slot-label');
  const to = target?.getBoundingClientRect();
  if (!from?.rect.width || !to?.width) return null;
  const style = getComputedStyle(target);
  const identity = document.createElement('span');
  identity.className = 'camp-entry-identity';
  identity.textContent = from.text;
  identity.setAttribute('aria-hidden', 'true');
  identity.inert = true;
  Object.assign(identity.style, { left: `${from.rect.left}px`, top: `${from.rect.top}px`,
    font: from.font, color: from.color, letterSpacing: from.letterSpacing });
  document.body.appendChild(identity);
  const scale = from.fontSize ? parseFloat(style.fontSize) / from.fontSize : 1;
  const motion = identity.animate?.([
    { opacity: 1, transform: 'none', offset: 0 },
    { opacity: 1, transform: 'scale(1.04)', offset: .16 },
    { opacity: 1, color: style.color,
      transform: `translate(${to.left - from.rect.left}px,${to.top - from.rect.top}px) scale(${scale})`, offset: .84 },
    { opacity: 0, color: style.color,
      transform: `translate(${to.left - from.rect.left}px,${to.top - from.rect.top}px) scale(${scale})`, offset: 1 },
  ], { duration: 680, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
  return () => { motion?.cancel(); identity.remove(); };
}

// 共用斜切编排，画面、文案与水印按目的页选择。
export function createCityCut({ archive = '基地档案', title = '返回基地',
  subtitle = 'BASE CAMP / 冬日远征档案室', edition = 'WINTER EXPEDITION / VII',
  destination = 'BASE CAMP', watermark = 'BASE', scene = 'camp' } = {}) {
  const cut = document.createElement('div');
  cut.className = 'camp-entry-cut';
  cut.setAttribute('aria-hidden', 'true');
  cut.inert = true;
  const caption = document.createElement('div');
  caption.className = 'camp-entry-caption';
  const label = document.createElement('small');
  label.textContent = archive;
  const heading = document.createElement('strong');
  heading.textContent = title;
  const sub = document.createElement('span');
  sub.textContent = subtitle;
  caption.append(label, heading, sub);
  const register = document.createElement('div');
  register.className = 'camp-entry-register';
  register.dataset.watermark = watermark;
  const issue = document.createElement('small');
  issue.textContent = edition;
  const folio = document.createElement('span');
  folio.textContent = `${archive} / ${destination}`;
  register.append(issue, folio);
  const scenery = document.createElement('div');
  scenery.className = 'camp-entry-scenery';
  const image = document.createElement('img');
  image.src = CUT_SCENES[scene] || CUT_SCENES.camp;
  image.style.objectPosition = 'center';
  image.alt = '';
  image.decoding = 'async';
  scenery.append(image);
  cut.append(scenery, register, caption);
  return cut;
}

export const cityCutDuration = 980;

// 成就首次打开使用独立荣誉档案切幕，关闭或换页即清理装饰层。
export function enterAchievementCut(page, reduced) {
  const overlay = page?.closest('#overlay');
  const card = page?.closest('.card');
  if (reduced || !overlay || !card) return () => {};
  const cut = createCityCut({ scene: 'achievement', archive: '荣誉档案', title: '成就总览',
    subtitle: 'ACHIEVEMENTS / 远征荣誉陈列', destination: 'ACHIEVEMENTS', watermark: 'HONOR' });
  card.append(cut);
  let timer;
  const finish = () => {
    clearTimeout(timer);
    observer.disconnect();
    cut.remove();
  };
  const observer = new MutationObserver(() => {
    if (!page.isConnected || !overlay.contains(page) || overlay.hidden || overlay.dataset.uiClosing) finish();
  });
  observer.observe(overlay, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['hidden', 'data-ui-closing'] });
  timer = setTimeout(finish, cityCutDuration);
  return finish;
}

export function enterCamp(overlay, ghost, reduced) {
  clearCampEntry();
  // 首次进入仅由本模块展开；临时编排结束后不能恢复 page-in 再播一遍。
  overlay.querySelector('#hubMain .hub-page')?.classList.remove('page-in');
  if (reduced) return;
  // 先取目标位置，再挂入场标记，避免把目标的暂时位移当作落点。
  const removeIdentity = ghost ? transferIdentity(overlay, ghost) : null;
  overlay.dataset.campEntry = '1';
  const card = overlay.querySelector('#ovBody')?.parentElement;
  if (ghost && card) card.appendChild(ghost);
  // 切面承接旧页和基地，装饰层不参与点击、焦点或业务等待。
  const cut = ghost && card ? createCityCut({ archive: identities.get(ghost)?.text || '基地档案' }) : null;
  if (cut) card.append(cut);
  const finish = () => {
    clearTimeout(timer);
    ghost?.remove();
    cut?.remove();
    removeIdentity?.();
    delete overlay.dataset.campEntry;
  };
  const timer = setTimeout(() => {
    finish();
    cleanup = null;
  }, 980);
  cleanup = finish;
}
