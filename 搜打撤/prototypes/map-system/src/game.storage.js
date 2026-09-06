import { migrateRunCharacter } from './characters.js';
const SLOT_COUNT = 5;
const RUN_KEY = index => `sdt-save-v2-slot${index}`;
const OLD_SAVE_KEY = 'sdt-save-v1';

const RunStorage = Object.freeze({
  key: RUN_KEY,
  has(index) {
    try { return !!localStorage.getItem(RUN_KEY(index)); } catch { return false; }
  },
  read(index) {
    try { return migrateRunCharacter(JSON.parse(localStorage.getItem(RUN_KEY(index)))); } catch { return null; }
  },
  write(index, value) {
    try { localStorage.setItem(RUN_KEY(index), JSON.stringify(value)); return true; } catch { return false; }
  },
  remove(index) {
    try { localStorage.removeItem(RUN_KEY(index)); } catch { /* 存储不可用 */ }
  },
  migrateLegacy() {
    try {
      const old = localStorage.getItem(OLD_SAVE_KEY);
      if (old && !localStorage.getItem(RUN_KEY(1))) localStorage.setItem(RUN_KEY(1), old);
      localStorage.removeItem(OLD_SAVE_KEY);
    } catch { /* 存储不可用 */ }
  },
});

export { OLD_SAVE_KEY, RUN_KEY, RunStorage, SLOT_COUNT };
