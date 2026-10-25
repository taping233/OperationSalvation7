// This page is a disposable, in-memory copy of the live entry, not a second UI.
function installMemoryStorage() {
  const makeStorage = () => {
    const data = new Map();
    return Object.freeze({
      get length() { return data.size; },
      key(index) { return [...data.keys()][Number(index)] ?? null; },
      getItem(key) { return data.get(String(key)) ?? null; },
      setItem(key, value) { data.set(String(key), String(value)); },
      removeItem(key) { data.delete(String(key)); },
      clear() { data.clear(); },
    });
  };
  for (const key of ['localStorage', 'sessionStorage']) {
    const memory = makeStorage();
    Object.defineProperty(window, key, { configurable: false, get: () => memory });
  }
  // Suppress a first-run hint that would otherwise cover the scene controls.
  window.localStorage.setItem('sdt-rmb-hint', '1');
  document.documentElement.dataset.materialFixtureStorage = 'memory';
}

async function loadEntry() {
  const response = await fetch('/index.html', { cache: 'no-store' });
  if (!response.ok) throw new Error(`真实入口读取失败：${response.status}`);
  const source = await response.text();
  // Vite rewrites ./src/main.js to /src/main.js and may append a timestamp.
  const entry = new DOMParser().parseFromString(source, 'text/html');
  if (![...entry.querySelectorAll('script[src]')].some(script =>
    new URL(script.getAttribute('src'), new URL('/', location.href)).pathname === '/src/main.js')) {
    throw new Error('真实入口缺少 main.js，停止加载');
  }
  const storage = `<script>(${installMemoryStorage.toString()})();</script>`;
  const fixture = '<script type="module" src="/tools/material-window-round2.fixture.js"></script>';
  const isolated = source.replace(/<head>/i, `<head><base href="/">${storage}`)
    .replace(/<\/body>/i, `${fixture}</body>`);
  // A new document preserves the actual module/DOMContentLoaded boot order.
  document.open(); document.write(isolated); document.close();
}

loadEntry().catch(error => {
  const status = document.getElementById('material-fixture-loading');
  if (status) status.textContent = `隔离复核未启动：${error.message}`;
});
