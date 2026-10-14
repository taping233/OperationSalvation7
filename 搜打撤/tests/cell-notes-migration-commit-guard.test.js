import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { fixtureGame } = vi.hoisted(() => ({ fixtureGame: {
  layerData: [{ id: 'fixture', name: 'fixture', logical: [{ grid: [{ x: 4, y: 4 }], def: null }], doors: [], entrances: [], altarEntrances: [] }],
  nodes: [], nodePos: [[{ x: 0, y: 0 }]], centerPos: [], noteMap: new Map(), state: 'idle',
} }));
vi.mock('../game/src/run/game.session.js', () => ({ game: fixtureGame, MAP: { boardId: 'B1' } }));
const actions = new Map();
const UI = {
  act: (name, fn) => actions.set(name, fn),
  showOverlay: (_title, body) => { document.body.innerHTML = body; },
  hideOverlay: vi.fn(), log: vi.fn(),
};
window.SDT = { UI };
await import('../game/src/core/notes.js');
const { rebuildNotes, openCellEditor, showImportOverlay, showClearOverlay } = await import('../game/src/hub/game.notes.js');
const Notes = window.SDT.Notes;
const KEY = 'sdt-cell-notes-v1', MARKER = 'sdt-notes-node-migrated';
const before = '{ "B1|4,4": "legacy fixture" }';
const after = '{"B1|0,0":"legacy fixture"}';
const pending = (b = before, a = after) => JSON.stringify({ version: 1, stage: 'pending', before: b, after: a });
const originalSet = Storage.prototype.setItem;
const seed = () => localStorage.setItem(KEY, before);

beforeEach(() => {
  vi.restoreAllMocks(); localStorage.clear(); fixtureGame.noteMap.clear(); fixtureGame.state = 'idle';
  actions.clear(); UI.hideOverlay.mockClear(); UI.log.mockClear(); document.body.innerHTML = '';
});
afterEach(() => vi.restoreAllMocks());

describe('legacy note migration commit and recovery through real Notes facade', () => {
  it.each(['pending', 'notes', 'done'])('write failure at %s preserves a recoverable state and retries once', stage => {
    seed();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if ((stage === 'pending' && key === MARKER && value !== '1') ||
        (stage === 'notes' && key === KEY) || (stage === 'done' && key === MARKER && value === '1')) throw new Error('quota');
      return originalSet.call(this, key, value);
    });
    expect(rebuildNotes()).toBe(false);
    expect(localStorage.getItem(KEY)).toBe(stage === 'done' ? after : before);
    expect(localStorage.getItem(MARKER)).toBe(stage === 'pending' ? null : pending());
    if (stage !== 'pending') {
      expect(Notes.set('B1', 0, 0, 'new input')).toBe(false);
      expect(Notes.clearAll()).toBe(false);
      expect(localStorage.getItem(KEY)).toBe(stage === 'done' ? after : before);
    }
    vi.restoreAllMocks();
    expect(rebuildNotes()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe(after);
    expect(localStorage.getItem(MARKER)).toBe('1');
    expect(fixtureGame.noteMap.get('B1|0,0')).toBe('legacy fixture');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(rebuildNotes()).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });

  it.each([before, after])('refresh recovers journal matching raw %s without remapping node keys', raw => {
    localStorage.setItem(KEY, raw); localStorage.setItem(MARKER, pending());
    expect(rebuildNotes()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe(after); expect(localStorage.getItem(MARKER)).toBe('1');
    expect(fixtureGame.noteMap.get('B1|0,0')).toBe('legacy fixture');
  });

  it('third-value conflict preserves both exact original strings and rejects editing/clear', () => {
    const third = '{"B1|9,9":"external fixture"}';
    localStorage.setItem(KEY, third); localStorage.setItem(MARKER, pending());
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(rebuildNotes()).toBe(false); expect(Notes.set('B1', 0, 0, 'input')).toBe(false); expect(Notes.clearAll()).toBe(false);
    expect(localStorage.getItem(KEY)).toBe(third); expect(localStorage.getItem(MARKER)).toBe(pending());
    expect(write).not.toHaveBeenCalled();
  });

  it('missing notes key remains absent if pending write fails, and null-before journal can recover', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(rebuildNotes()).toBe(false); expect(localStorage.getItem(KEY)).toBeNull(); expect(localStorage.getItem(MARKER)).toBeNull();
    write.mockRestore(); localStorage.setItem(MARKER, pending(null, '{}'));
    expect(rebuildNotes()).toBe(true); expect(localStorage.getItem(KEY)).toBe('{}'); expect(localStorage.getItem(MARKER)).toBe('1');
  });

  it('empty migration result is committed as {}, and refresh stays empty', () => {
    localStorage.setItem(KEY, '{"B1|8,8":"unmatched legacy fixture"}');
    expect(rebuildNotes()).toBe(true); expect(localStorage.getItem(KEY)).toBe('{}'); expect(localStorage.getItem(MARKER)).toBe('1');
    expect(rebuildNotes()).toBe(true); expect(fixtureGame.noteMap.size).toBe(0);
  });

  it.each(['', '2', '{bad', '{}', 'null', '[]', JSON.stringify({ version: 1, stage: 'pending', before: 7, after }),
    JSON.stringify({ version: 1, stage: 'pending', before, after: null }),
    JSON.stringify({ version: 1, stage: 'pending', before, after, extra: true }),
    pending(before, '[]'), pending('[]', after)])('unknown or invalid marker %s is preserved, never treated as complete', raw => {
    seed(); localStorage.setItem(MARKER, raw);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(rebuildNotes()).toBe(false); expect(Notes.set('B1', 0, 0, 'input')).toBe(false); expect(Notes.clearAll()).toBe(false);
    expect(localStorage.getItem(KEY)).toBe(before); expect(localStorage.getItem(MARKER)).toBe(raw); expect(write).not.toHaveBeenCalled();
  });

  it.each([KEY, MARKER])('read failure on %s blocks migration and editing without overwrites', badKey => {
    seed(); const get = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) { if (key === badKey) throw new Error('unavailable'); return get.call(this, key); });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(rebuildNotes()).toBe(false); expect(Notes.set('B1', 0, 0, 'input')).toBe(false);
    if (badKey === MARKER) expect(Notes.clearAll()).toBe(false);
    expect(write).not.toHaveBeenCalled();
    vi.restoreAllMocks(); expect(localStorage.getItem(KEY)).toBe(before); expect(localStorage.getItem(MARKER)).toBeNull();
  });

  it.each(['pending', 'notes', 'done'])('silent failed write at %s is not acknowledged', stage => {
    seed();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if ((stage === 'pending' && key === MARKER && value !== '1') || (stage === 'notes' && key === KEY) ||
        (stage === 'done' && key === MARKER && value === '1')) return;
      return originalSet.call(this, key, value);
    });
    expect(rebuildNotes()).toBe(false);
    expect(localStorage.getItem(KEY)).toBe(stage === 'done' ? after : before);
    expect(localStorage.getItem(MARKER)).toBe(stage === 'pending' ? null : pending());
  });

  it.each(['pending', 'notes', 'done'])('read-back failure after %s write is reported accurately and recovers', stage => {
    seed(); let reached = false;
    const get = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      originalSet.call(this, key, value);
      if ((stage === 'pending' && key === MARKER && value !== '1') || (stage === 'notes' && key === KEY) ||
        (stage === 'done' && key === MARKER && value === '1')) reached = true;
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (reached && key === (stage === 'notes' ? KEY : MARKER)) throw new Error('readback unavailable');
      return get.call(this, key);
    });
    expect(rebuildNotes()).toBe(false);
    expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining(stage === 'pending' ? '核对待完成' : stage === 'notes' ? '核对迁移后' : '核对完成迁移'), 'warn');
    vi.restoreAllMocks(); expect(rebuildNotes()).toBe(true); expect(localStorage.getItem(KEY)).toBe(after); expect(localStorage.getItem(MARKER)).toBe('1');
  });

  it('null-before is not confused with a present empty-object raw string', () => {
    localStorage.setItem(KEY, '{}'); localStorage.setItem(MARKER, pending(null));
    expect(rebuildNotes()).toBe(false); expect(localStorage.getItem(KEY)).toBe('{}'); expect(localStorage.getItem(MARKER)).toBe(pending(null));
  });

  it('crossing legacy-to-node chain migrates each original note once without overwriting the next source', () => {
    const logical = fixtureGame.layerData[0].logical;
    fixtureGame.layerData[0].logical = [logical[0], { grid: [{ x: 0, y: 0 }], def: null }];
    try {
      localStorage.setItem(KEY, '{"B1|4,4":"note A","B1|0,0":"note B"}');
      expect(rebuildNotes()).toBe(true);
      expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ 'B1|0,0': 'note A', 'B1|0,1': 'note B' });
    } finally { fixtureGame.layerData[0].logical = logical; }
  });

  it('true mapping collision retains existing last-source-entry priority', () => {
    const grid = fixtureGame.layerData[0].logical[0].grid;
    fixtureGame.layerData[0].logical[0].grid = [{ x: 4, y: 4 }, { x: 5, y: 5 }];
    try {
      localStorage.setItem(KEY, '{"B1|4,4":"first fixture","B1|5,5":"last fixture"}');
      expect(rebuildNotes()).toBe(true); expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ 'B1|0,0': 'last fixture' });
    } finally { fixtureGame.layerData[0].logical[0].grid = grid; }
  });

  it('same old-grid and new-node key preserves the note rather than deleting the newly assigned value', () => {
    fixtureGame.layerData[0].logical[0].grid = [{ x: 0, y: 0 }];
    try {
      localStorage.setItem(KEY, after); expect(rebuildNotes()).toBe(true); expect(localStorage.getItem(KEY)).toBe(after);
      expect(fixtureGame.noteMap.get('B1|0,0')).toBe('legacy fixture');
    } finally { fixtureGame.layerData[0].logical[0].grid = [{ x: 4, y: 4 }]; }
  });

  it('external notes replacement after pending is not overwritten', () => {
    seed(); const third = '{"B1|1,2":"external fixture"}';
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      originalSet.call(this, key, value);
      if (key === MARKER && value !== '1') originalSet.call(this, KEY, third);
    });
    expect(rebuildNotes()).toBe(false); expect(localStorage.getItem(KEY)).toBe(third); expect(localStorage.getItem(MARKER)).toBe(pending());
  });

  it('external journal replacement after notes write is preserved without done stamp', () => {
    seed(); const other = pending(null, '{}');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      originalSet.call(this, key, value);
      if (key === KEY && value === after) originalSet.call(this, MARKER, other);
    });
    expect(rebuildNotes()).toBe(false); expect(localStorage.getItem(KEY)).toBe(after); expect(localStorage.getItem(MARKER)).toBe(other);
  });

  it('existing done marker keeps node coordinates, with no redundant writes', () => {
    localStorage.setItem(KEY, after); localStorage.setItem(MARKER, '1'); const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(rebuildNotes()).toBe(true); expect(localStorage.getItem(KEY)).toBe(after); expect(write).not.toHaveBeenCalled();
  });

  it('existing done marker still normalizes F1 alias once without remigrating node coordinates', () => {
    localStorage.setItem(KEY, '{"F1|0,0":"alias fixture"}'); localStorage.setItem(MARKER, '1');
    expect(rebuildNotes()).toBe(true); expect(localStorage.getItem(KEY)).toBe('{"B1|0,0":"alias fixture"}');
    const write = vi.spyOn(Storage.prototype, 'setItem'); expect(rebuildNotes()).toBe(true); expect(write).not.toHaveBeenCalled();
  });

  it('clearAll has boolean success/failure and never throws', () => {
    localStorage.setItem(KEY, after); localStorage.setItem(MARKER, '1');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('quota'); });
    expect(Notes.clearAll()).toBe(false); expect(localStorage.getItem(KEY)).toBe(after);
    vi.restoreAllMocks(); expect(Notes.clearAll()).toBe(true); expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('pending note migration UI input preservation', () => {
  function blocked() { seed(); localStorage.setItem(MARKER, pending()); vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); }); }
  it.each(['saveNote', 'clearNote'])('editor %s does not hide or replace input during failed recovery', action => {
    blocked(); openCellEditor(0, 0); document.getElementById('ovNote').value = 'typed fixture'; actions.get(action)();
    expect(document.getElementById('ovNote').value).toBe('typed fixture'); expect(UI.hideOverlay).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(before); expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining('失败'), 'warn');
  });
  it('import keeps its JSON and overlay when migration cannot complete', () => {
    blocked(); showImportOverlay(); const input = '{"cells":[{"li":0,"idx":0,"note":"typed fixture"}]}';
    document.getElementById('ovImport').value = input; actions.get('doImport')();
    expect(document.getElementById('ovImport').value).toBe(input); expect(UI.hideOverlay).not.toHaveBeenCalled(); expect(localStorage.getItem(KEY)).toBe(before);
  });
  it('clear action keeps overlay and original notes on failed recovery', () => {
    blocked(); showClearOverlay(); actions.get('doClear')();
    expect(UI.hideOverlay).not.toHaveBeenCalled(); expect(localStorage.getItem(KEY)).toBe(before);
  });
});

describe('successful note actions retain their existing behavior', () => {
  beforeEach(() => { localStorage.setItem(KEY, after); localStorage.setItem(MARKER, '1'); });
  it('editor saves current node coordinates and closes on confirmed success', () => {
    openCellEditor(0, 0); document.getElementById('ovNote').value = 'edited fixture'; actions.get('saveNote')();
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ 'B1|0,0': 'edited fixture' });
    expect(UI.hideOverlay).toHaveBeenCalledOnce(); expect(fixtureGame.state).toBe('idle');
  });
  it('import preserves existing cells and closes after successful merge', () => {
    showImportOverlay(); document.getElementById('ovImport').value = '{"cells":[{"li":0,"idx":1,"note":"import fixture"}]}'; actions.get('doImport')();
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ 'B1|0,0': 'legacy fixture', 'B1|0,1': 'import fixture' });
    expect(UI.hideOverlay).toHaveBeenCalledOnce();
  });
  it('clearAll failure after migration leaves confirmation open', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('quota'); });
    showClearOverlay(); actions.get('doClear')(); expect(localStorage.getItem(KEY)).toBe(after); expect(UI.hideOverlay).not.toHaveBeenCalled();
    expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining('清空失败'), 'warn');
  });
  it('clearAll confirmed success clears the map and closes', () => {
    showClearOverlay(); actions.get('doClear')(); expect(localStorage.getItem(KEY)).toBeNull();
    expect(fixtureGame.noteMap.size).toBe(0); expect(UI.hideOverlay).toHaveBeenCalledOnce();
  });
});
