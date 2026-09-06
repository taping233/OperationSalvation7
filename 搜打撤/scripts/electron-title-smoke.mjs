/* Smoke-test the real Electron renderer through the Chrome DevTools Protocol. */
const port = Number(process.argv[2] || 9223);
const targets = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
const target = targets.find(item => item.type === 'page' && item.url.startsWith('app://sdt/'));
if (!target) throw new Error('Electron game page was not found');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

function command(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function click(selector) {
  const hit = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    return {
      x, y,
      disabled: !!element.disabled,
      pointerEvents: getComputedStyle(element).pointerEvents,
      hitId: top?.id || '',
      hitTag: top?.tagName || '',
      hitInside: !!top && (top === element || element.contains(top)),
    };
  })()`);
  if (!hit || hit.disabled || hit.pointerEvents === 'none' || !hit.hitInside) {
    throw new Error(`${selector} cannot receive a pointer: ${JSON.stringify(hit)}`);
  }
  await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hit.x, y: hit.y });
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: hit.x, y: hit.y, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hit.x, y: hit.y, button: 'left', clickCount: 1 });
  // UI 关闭动画本身为 150ms；给 Windows/Electron 合成与计时器抖动留出余量，
  // 避免在动画刚结束但 hidden 尚未提交时误报。
  await new Promise(resolve => setTimeout(resolve, 350));
  return hit;
}

async function expectOverlay(button, closeSelector) {
  const hit = await click(button);
  const opened = await evaluate(`!document.getElementById('overlay').hidden`);
  if (!opened) throw new Error(`${button} did not open its view`);
  await click(closeSelector);
  const closed = await evaluate(`document.getElementById('overlay').hidden`);
  if (!closed) throw new Error(`${closeSelector} did not close the view opened by ${button}`);
  console.log(`${button}: PASS`, hit);
}

const bound = await evaluate(`document.getElementById('title')?.dataset.controlsBound`);
if (bound !== 'true') {
  const failures = [];
  const capture = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') failures.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text);
    if (message.method === 'Log.entryAdded') failures.push(`${message.params.entry.level}: ${message.params.entry.text}`);
    if (message.method === 'Network.loadingFailed') failures.push(`${message.params.type}: ${message.params.errorText} ${message.params.blockedReason || ''}`);
  };
  socket.addEventListener('message', capture);
  await command('Runtime.enable');
  await command('Log.enable');
  await command('Network.enable');
  await command('Page.reload', { ignoreCache: true });
  await new Promise(resolve => setTimeout(resolve, 1200));
  socket.removeEventListener('message', capture);
  const diagnostics = await evaluate(`({
    title: document.title,
    bodyClass: document.body.className,
    moduleSrc: document.querySelector('script[type="module"]')?.src,
    sdtKeys: Object.keys(window.SDT || {}),
    resources: performance.getEntriesByType('resource').map(entry => entry.name).filter(name => name.includes('/src/')),
  })`);
  console.error('Renderer diagnostics:', diagnostics);
  console.error('Renderer failures:', failures);
  throw new Error(`Title controls are not bound (value: ${bound})`);
}

await expectOverlay('#mSettings', '[data-act="closeSettings"]');
await expectOverlay('#btnCardLib', '[data-act="closeCardPage"]');
await expectOverlay('#btnCardDesigner', '[data-act="closeDesigner"]');
await expectOverlay('#mStart', '[data-act="slotBack"]');

console.log('All non-destructive title controls passed in Electron.');
if (process.argv.includes('--exit')) {
  await click('#mExit');
  await new Promise(resolve => setTimeout(resolve, 300));
  console.log('#mExit: PASS (Electron quit action dispatched)');
} else {
  socket.close();
}
