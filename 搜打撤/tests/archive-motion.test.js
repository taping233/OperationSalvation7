import { afterEach, expect, it, vi } from 'vitest';
import { enterArchive, clearArchiveMotion } from '../game/src/ui/archive-motion.js';
import { captureArchiveExit, enterCamp, clearCampEntry, enterAchievementCut } from '../game/src/ui/camp-entry.js';
// This suite verifies handoff ownership/timing; cold artwork is tested by page-loading.
vi.mock('../game/src/core/map-image-ready.js', () => ({ mapImageReady: () => Promise.resolve(true) }));

afterEach(() => {
  clearArchiveMotion(document.getElementById('overlay'));
  clearCampEntry();
  document.body.replaceChildren();
  document.body.className = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function picker() {
  document.body.innerHTML = '<div id="overlay"><div class="card"><div id="ovBody">'
    + '<main class="slot-page"><article class="slot-card"><b class="slot-card-name">档位 01</b>'
    + '<button data-act="enterSlot">Enter</button><button data-act="delSlot">Delete</button></article>'
    + '<article class="slot-card"><button data-act="enterSlot">Enter</button></article></main>'
    + '</div></div></div>';
  const overlay = document.getElementById('overlay');
  const body = document.getElementById('ovBody');
  return { overlay, body };
}

it('achievement browsing keeps the navigation surface free of scene curtains', () => {
  const { overlay, body } = picker();
  body.innerHTML = '<main class="achievement-gallery">Awards</main>';
  enterAchievementCut(body.firstElementChild, false);
  expect(overlay.querySelector('.camp-entry-cut')).toBeNull();
  enterAchievementCut(body.firstElementChild, false);
  expect(overlay.querySelector('.camp-entry-cut')).toBeNull();
});

it('reduced motion keeps achievement entry free of decorative cuts', () => {
  const { overlay, body } = picker();
  body.innerHTML = '<main class="achievement-gallery">Awards</main>';
  enterAchievementCut(body.firstElementChild, true);
  expect(overlay.querySelector('.camp-entry-cut')).toBeNull();
});

it('captures the activated archive without changing click handlers or destructive controls', () => {
  const { overlay, body } = picker();
  const launch = vi.fn();
  body.addEventListener('click', launch);
  enterArchive(overlay, body, false);
  body.querySelector('[data-act="delSlot"]').click();
  expect(body.querySelector('[data-archive-picked]')).toBeNull();
  body.querySelector('[data-act="enterSlot"]').click();
  expect(launch).toHaveBeenCalledTimes(2);
  const ghost = captureArchiveExit(body);
  expect(ghost.querySelector('.archive-picked .camp-identity-source').textContent).toBe('档位 01');
  expect(ghost.querySelector('[data-act]')).toBeNull();
  expect(ghost.getAttribute('aria-hidden')).toBe('true');
});

it('cancels landing sound when another page replaces the picker', async () => {
  vi.useFakeTimers();
  const { overlay, body } = picker();
  const sfx = vi.fn();
  window.SDT = { Sound: { sfx } };
  enterArchive(overlay, body, false);
  body.innerHTML = '<main class="settings-page">Settings</main>';
  enterArchive(overlay, body, false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(sfx).not.toHaveBeenCalled();
  expect(overlay.dataset.archiveMotion).toBeUndefined();
});

it('reduced motion keeps archive input available and emits no decorative landing sound', async () => {
  vi.useFakeTimers();
  const { overlay, body } = picker();
  const sfx = vi.fn();
  window.SDT = { Sound: { sfx } };
  enterArchive(overlay, body, true);
  body.querySelector('[data-act="enterSlot"]').click();
  enterCamp(overlay, captureArchiveExit(body), true);
  await vi.advanceTimersByTimeAsync(800);
  expect(sfx).not.toHaveBeenCalled();
  expect(overlay.dataset.campEntry).toBeUndefined();
  expect(document.querySelector('.camp-entry-identity')).toBeNull();
  expect(document.querySelector('.camp-entry-cut')).toBeNull();
});

it('cleans the old handoff before a second camp entry and leaves the new entry alive', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  const { overlay, body } = picker();
  body.querySelector('.slot-card').dataset.archivePicked = '1';
  const ghost = captureArchiveExit(body);
  body.innerHTML = '<main id="hubMain"><section class="hub-page page-in">Base</section></main>';
  enterCamp(overlay, ghost, false);
  const cut = overlay.querySelector('.camp-entry-cut');
  expect(cut.getAttribute('aria-hidden')).toBe('true');
  expect(cut.querySelector('.camp-entry-register').textContent).toContain('档位 01');
  expect(cut.querySelector('.transition-heading')).not.toBeNull();
  expect(cut.querySelector('[data-act]')).toBeNull();
  await vi.advanceTimersByTimeAsync(300);
  enterCamp(overlay, null, false);
  expect(ghost.isConnected).toBe(false);
  expect(cut.isConnected).toBe(false);
  await vi.advanceTimersByTimeAsync(680);
  expect(overlay.dataset.campEntry).toBe('1');
  expect(body.querySelector('.page-in')).toBeNull();
  await vi.advanceTimersByTimeAsync(300);   // 新切幕先等视觉就绪再计时长，仍在原时长内保持
  expect(overlay.dataset.campEntry).toBe('1');
  await vi.advanceTimersByTimeAsync(700);   // 播满后才清理
  expect(overlay.dataset.campEntry).toBeUndefined();
});
