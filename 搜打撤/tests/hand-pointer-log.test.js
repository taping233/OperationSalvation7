import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createPointerLog } from '../game/dev/hand-pointer-log.js';
let logger, root, output, cards;
beforeEach(() => {
  document.body.innerHTML = '<div id="root"><div class="bt-slot" style="z-index:90"><div class="bt-card" data-uid="a" style="transform:translateY(0px)"><b>甲</b><span>文</span><button class="bt-infchip">注能</button></div></div><div class="bt-slot" style="z-index:11"><div class="bt-card" data-uid="b">乙</div></div></div><output></output>';
  root = document.querySelector('#root'); output = document.querySelector('output'); cards = root.querySelectorAll('.bt-card');
  root.querySelectorAll('.bt-slot,.bt-card').forEach((el, index) => {
    el.getBoundingClientRect = () => ({ x: index * 30, y: 100, width: 260, height: 390 });
  });
  document.elementFromPoint = vi.fn(() => cards[0]); logger = createPointerLog(root, output);
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
const event = (type, target, relatedTarget = null) => ({ type, target, relatedTarget, clientX: 120, clientY: 200 });
it('records ordinary face entry/down with timestamps, both UIDs and two card geometries', () => {
  logger.event(event('pointerover', cards[0].querySelector('b')));
  document.elementFromPoint.mockReturnValue(cards[1]);
  logger.event(event('pointerdown', cards[0]));
  const rows = output.textContent.split('\n'); expect(rows).toHaveLength(2);
  expect(rows[0]).toMatch(/^\d+\.\dms pointerover \(120,200\)/);
  expect(rows[1]).toContain('targetUID=a elementFromPointUID=b');
  const geometry = JSON.parse(rows[1].split('cards=')[1]);
  expect(geometry.map(card => card.uid)).toEqual(['a', 'b']);
  expect(geometry[0]).toMatchObject({ rect: [30, 100, 260, 390], slotRect: [0, 100, 260, 390], transform: 'translateY(0px)', zIndex: '90' });
});
it('suppresses text-descendant churn but retains entry into an infusion button', () => {
  logger.event(event('pointerover', cards[0].querySelector('span'), cards[0].querySelector('b')));
  expect(output.textContent).toBe('');
  logger.event(event('pointerover', cards[0].querySelector('button'), cards[0].querySelector('b')));
  logger.event(event('pointerdown', cards[0].querySelector('button')));
  expect(output.textContent.split('\n')).toHaveLength(2); expect(output.textContent).toContain('GUARD: button/term');
});
it('keeps a crossed previous card as the second geometry', () => {
  document.elementFromPoint.mockReturnValue(cards[1]);
  logger.event(event('pointerover', cards[1], cards[0]));
  const geometry = JSON.parse(output.textContent.split('cards=')[1]);
  expect(geometry.map(card => card.uid)).toEqual(['b', 'a']);
});
it('bounds visible history to 20 records and clears it explicitly', () => {
  for (let i = 0; i < 25; i++) logger.record(`event-${i}`);
  expect(output.textContent.split('\n')).toHaveLength(20);
  expect(output.textContent.split('\n')[0]).toContain('event-5');
  logger.clear(); expect(output.textContent).toBe(''); logger.record('new'); expect(output.textContent.split('\n')).toHaveLength(1);
});
