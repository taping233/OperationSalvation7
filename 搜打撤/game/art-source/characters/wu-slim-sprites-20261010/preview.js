const actions = ['idle', 'attack', 'hurt', 'death'];
const specs = {};
const images = {};
const errors = [];
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const frame = document.querySelector('#frame');
const status = document.querySelector('#status');
let action = 'idle';
let step = 0;
let playing = true;
let elapsed = 0;
let last = 0;
let chain = false;

function show() {
  const spec = specs[action];
  frame.src = images[action][step].src;
  status.textContent = `${({idle:'待机',attack:'攻击',hurt:'受击',death:'死亡'})[action]} · ${step + 1}/${spec.frameCount} · ${playing ? '播放中' : '已暂停'}${action === 'death' && step === 5 ? ' · 保持倒地' : ''}`;
  document.querySelectorAll('button[data-action]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.action === action)));
  document.body.dataset.action = action;
  document.body.dataset.frame = String(step);
  document.body.dataset.playing = String(playing);
}

function start(name, chained = false) {
  action = name;
  step = 0;
  elapsed = 0;
  playing = true;
  chain = chained;
  document.querySelector('#pause').textContent = '暂停';
  show();
}

function advance() {
  if (step < 5) {
    step += 1;
  } else if (chain && action !== 'death') {
    start(actions[actions.indexOf(action) + 1], true);
    return;
  } else if (action === 'idle') {
    step = 0;
  } else if (action === 'death') {
    playing = false;
    document.querySelector('#pause').textContent = '继续';
  } else {
    start('idle');
    return;
  }
  show();
}

try {
  await Promise.all(actions.map(async name => {
    const response = await fetch(`${name}/sprite.json`);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    specs[name] = await response.json();
    images[name] = await Promise.all(specs[name].frames.map(src => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`加载失败 ${name}/${src}`));
      image.src = `${name}/${src}`;
    })));
  }));
  document.body.dataset.ready = 'true';
  start('idle');
  document.querySelectorAll('button[data-action]').forEach(button => button.addEventListener('click', () => start(button.dataset.action)));
  document.querySelector('#chain').addEventListener('click', () => start('idle', true));
  document.querySelector('#pause').addEventListener('click', () => {
    playing = !playing;
    document.querySelector('#pause').textContent = playing ? '暂停' : '继续';
    show();
  });
  document.querySelector('#next').addEventListener('click', () => {
    playing = false;
    step = (step + 1) % 6;
    document.querySelector('#pause').textContent = '继续';
    show();
  });
  document.querySelector('#restart').addEventListener('click', () => start(action));
  function tick(time) {
    const delta = last ? Math.min(time - last, 100) : 0;
    last = time;
    if (playing) {
      elapsed += delta * Number(document.querySelector('#speed').value);
      const duration = specs[action].durationsMs[step];
      if (elapsed >= duration) {
        elapsed -= duration;
        advance();
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
} catch (error) {
  errors.push(String(error));
  status.textContent = String(error);
  document.body.dataset.ready = 'false';
}
window.wuPreview = { getState: () => ({ action, step, playing, errors: [...errors], ready: document.body.dataset.ready }) };
