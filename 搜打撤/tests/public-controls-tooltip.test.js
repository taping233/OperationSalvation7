import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const pointer = (target, type, relatedTarget = null) => {
  const event = new MouseEvent(type, { bubbles:true, relatedTarget });
  Object.defineProperties(event, { pointerType:{ value:'mouse' }, pointerId:{ value:1 } });
  target.dispatchEvent(event);
};

beforeAll(async () => {
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{ width:80, height:20 }]);
  await import('../game/src/ui/term-tips.js');
});
afterAll(() => {
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  vi.restoreAllMocks();
});

describe('shared explanation reading', () => {
  it('keeps a painted explanation readable while the pointer enters the panel, then clears it', async () => {
    const host = document.createElement('div');
    host.innerHTML = '<button data-ui-tip data-ui-tip-title="护符" data-ui-tip-text="长说明">发动</button>';
    document.body.appendChild(host);
    const button = host.querySelector('button');
    const action = vi.fn();
    button.addEventListener('click', action);
    pointer(button, 'pointerover');
    await vi.dynamicImportSettled();
    const panel = document.getElementById('sdt-term-tip');
    expect(panel.hidden).toBe(false);
    pointer(button, 'pointerout', panel);
    pointer(panel, 'pointerover', button);
    expect(panel.hidden).toBe(false);
    panel.dispatchEvent(new Event('scroll'));
    expect(panel.hidden).toBe(false);
    button.click();
    expect(action).toHaveBeenCalledOnce();
    pointer(panel, 'pointerout', document.body);
    expect(panel.hidden).toBe(true);
    host.remove();
  });
});
