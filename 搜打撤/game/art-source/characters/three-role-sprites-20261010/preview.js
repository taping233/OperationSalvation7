const roles = { baita: '白塔', heixiang: '黑像', xingyue: '星月' };
const actionNames = { idle: '待机', atk: '攻击', hurt: '受击', death: '死亡' };
const widgets = [];
let speed = 1;
const status = document.querySelector('#status');
const errors = document.querySelector('#error');

function start(widget, action, queue = []) {
  widget.action = action;
  widget.queue = queue;
  widget.step = 0;
  widget.paused = false;
  widget.ended = false;
  widget.remaining = widget.spec.timings[action][0];
  widget.slider.max = widget.spec.sequences[action].length - 1;
  widget.pause.textContent = '暂停';
  draw(widget);
}

function draw(widget) {
  const sequence = widget.spec.sequences[widget.action];
  const image = widget.images.get(sequence[widget.step]);
  widget.context.clearRect(0, 0, 768, 512);
  widget.context.drawImage(image, 0, 0, 768, 512);
  widget.slider.value = widget.step;
  widget.readout.textContent = `${actionNames[widget.action]} · ${widget.step + 1}/${sequence.length}${widget.ended ? ' · 保持倒地' : widget.paused ? ' · 已暂停' : ''}`;
  widget.section.dataset.action = widget.action;
  widget.section.dataset.step = widget.step;
  widget.section.dataset.ended = String(widget.ended);
  widget.section.querySelectorAll('[data-action]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.action === widget.action));
  });
}

function advance(widget, delta) {
  if (widget.paused || widget.ended) return;
  widget.remaining -= delta * speed;
  let changed = false;
  while (widget.remaining <= 0) {
    widget.step++;
    if (widget.step >= widget.spec.sequences[widget.action].length) {
      if (widget.queue.length) {
        const [next, ...rest] = widget.queue;
        start(widget, next, rest);
        return;
      }
      if (widget.action === 'death') {
        widget.step--;
        widget.ended = true;
        draw(widget);
        return;
      }
      if (widget.action === 'idle') widget.step = 0;
      else { start(widget, 'idle'); return; }
    }
    widget.remaining += widget.spec.timings[widget.action][widget.step];
    changed = true;
  }
  if (changed) draw(widget);
}

async function loadRole(role, title) {
  const assets = new URL('../../../assets/portraits/frames/', location.href);
  const base = new URL(`${role}/`, assets);
  const response = await fetch(new URL('sprite-v1/animations.json', base));
  if (!response.ok) throw new Error(`${role}: 动作配置 ${response.status}`);
  const spec = await response.json();
  const images = new Map();
  for (const name of new Set(Object.values(spec.sequences).flat())) {
    const image = new Image();
    image.src = new URL(`${name}.webp`, base).href;
    await image.decode();
    images.set(name, image);
  }
  const section = document.createElement('section');
  section.className = 'role';
  section.dataset.role = role;
  section.innerHTML = `<h2>${title}</h2><div class="view"><canvas width="768" height="512" aria-label="${title}动作预览"></canvas></div>
    <div class="actions">${Object.entries(actionNames).map(([action, name]) => `<button data-action="${action}">${name}</button>`).join('')}</div>
    <input type="range" min="0" step="1" value="0" aria-label="${title}逐帧进度">
    <div class="readout"></div><div class="actions"><button class="pause">暂停</button><button class="previous">上一帧</button><button class="next">下一帧</button></div>
    <div class="notes">全部姿势朝右 · 固定画布 · 攻击/受击首尾与待机同图</div>`;
  const canvas = section.querySelector('canvas');
  const widget = { role, section, spec, images, context: canvas.getContext('2d'),
    slider: section.querySelector('input'), readout: section.querySelector('.readout'), pause: section.querySelector('.pause') };
  section.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => start(widget, button.dataset.action)));
  widget.pause.addEventListener('click', () => {
    widget.paused = !widget.paused;
    widget.pause.textContent = widget.paused ? '继续' : '暂停';
    draw(widget);
  });
  widget.slider.addEventListener('input', () => {
    widget.paused = true;
    widget.ended = false;
    widget.step = Number(widget.slider.value);
    widget.pause.textContent = '继续';
    widget.remaining = spec.timings[widget.action][widget.step];
    draw(widget);
  });
  function step(direction) {
    widget.paused = true;
    widget.ended = false;
    widget.step = Math.max(0, Math.min(spec.sequences[widget.action].length - 1, widget.step + direction));
    widget.remaining = spec.timings[widget.action][widget.step];
    widget.pause.textContent = '继续';
    draw(widget);
  }
  section.querySelector('.previous').addEventListener('click', () => step(-1));
  section.querySelector('.next').addEventListener('click', () => step(1));
  widgets.push(widget);
  document.querySelector('#roles').append(section);
  start(widget, 'idle');
}

async function boot() {
  for (const [role, title] of Object.entries(roles)) await loadRole(role, title);
  document.documentElement.dataset.ready = 'true';
  document.querySelectorAll('#demo,#reset').forEach(button => { button.disabled = false; });
  status.textContent = '三人四动作已就绪';
  let last = performance.now();
  function tick(now) {
    const delta = document.hidden ? 0 : Math.min(200, now - last);
    last = now;
    widgets.forEach(widget => advance(widget, delta));
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

document.querySelector('#demo').addEventListener('click', () => widgets.forEach(widget => start(widget, 'idle', ['atk', 'hurt', 'death'])));
document.querySelector('#reset').addEventListener('click', () => widgets.forEach(widget => start(widget, 'idle')));
document.querySelector('#background').addEventListener('change', event => { document.body.dataset.background = event.target.value; });
document.querySelector('#speed').addEventListener('change', event => { speed = Number(event.target.value); });
boot().catch(error => {
  document.documentElement.dataset.ready = 'false';
  errors.textContent = String(error);
  status.textContent = '载入失败';
});
