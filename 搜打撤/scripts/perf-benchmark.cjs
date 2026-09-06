const { spawn } = require('node:child_process');
const { request } = require('node:http');
const { existsSync, readFileSync, unlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 48731;
const URL = `http://127.0.0.1:${PORT}/`;

function waitForServer(timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolveReady, reject) => {
    const poll = () => {
      const req = request(URL, res => {
        res.resume();
        if (res.statusCode < 500) resolveReady();
        else retry();
      });
      const retry = () => {
        if (Date.now() - started > timeoutMs) reject(new Error(`Vite 启动超时。
${serverLog}`));
        else setTimeout(poll, 200);
      };
      req.on('error', retry);
      req.end();
    };
    poll();
  });
}

async function orchestrate() {
  const node = process.execPath;
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const electron = path.join(ROOT, 'desktop', 'electron', 'electron.exe');
  const server = spawn(node, [vite, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // 端口被占用时 strictPort 会让 vite 立即退出；不捕获就会连上该端口上的未知服务
  //（探针测的可能是别的应用），或把启动失败误报成“性能探针未产生结果”。
  let serverLog = '';
  let serverExitCode = null;
  server.stdout.on('data', chunk => { serverLog += chunk; });
  server.stderr.on('data', chunk => { serverLog += chunk; });
  server.on('exit', code => { serverExitCode = code; });
  try {
    await waitForServer();
    if (serverExitCode != null) {
      throw new Error(`Vite 提前退出（code ${serverExitCode}）。
${serverLog}`);
    }
    const resultPath = path.join(tmpdir(), `codename7-perf-${process.pid}.json`);
    const probe = spawn(electron, [__filename], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, SDT_PERF_RESULT: resultPath },
    });
    await new Promise(resolveExit => probe.on('exit', resolveExit));
    if (!existsSync(resultPath)) throw new Error('Electron 性能探针未产生结果');
    const output = readFileSync(resultPath, 'utf8');
    unlinkSync(resultPath);
    console.log(output);
    const result = JSON.parse(output);
    process.exitCode = result.acceptance.performanceGatePassed ? 0 : 1;
  } finally {
    server.kill();
  }
}

async function runElectronProbe() {
  const { app, BrowserWindow, screen } = require('electron');
  if (process.env.SDT_PERF_GPU !== 'auto') app.commandLine.appendSwitch('force_high_performance_gpu');
  await app.whenReady();
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1;
  const win = new BrowserWindow({
    show: true,
    frame: false,
    useContentSize: true,
    width: Math.round(1920 / scaleFactor),
    height: Math.round(1080 / scaleFactor),
    webPreferences: { backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  await win.loadURL(URL);
  const targetViewport = [Math.round(1920 / scaleFactor), Math.round(1080 / scaleFactor)];
  for (let attempt = 0; attempt < 3; attempt++) {
    const viewport = await win.webContents.executeJavaScript('[innerWidth, innerHeight]');
    const delta = [targetViewport[0] - viewport[0], targetViewport[1] - viewport[1]];
    if (delta[0] === 0 && delta[1] === 0) break;
    const contentSize = win.getContentSize();
    win.setContentSize(contentSize[0] + delta[0], contentSize[1] + delta[1], false);
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  win.focus();
  for (let i = 0; i < 30; i++) {
    const ready = await win.webContents.executeJavaScript('!!(window.SDT && window.SDT.game && window.SDT.Renderer)');
    if (ready) break;
    await new Promise(resolveWait => setTimeout(resolveWait, 200));
  }
  const result = await win.webContents.executeJavaScript(`(async () => {
    const title = document.getElementById('title');
    if (title) title.hidden = true;
    const game = window.SDT.game;
    const canvas = document.getElementById('game');
    const draw = window.SDT.Renderer.draw;
    const rounds = [];
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    await wait(1800);
    async function sample(name, duration, setup) {
      const step = setup ? setup() : null;
      let calls = 0, drawTotal = 0, drawMax = 0;
      const drawTimes = [];
      const longTasks = [];
      const longTaskObserver = typeof PerformanceObserver === 'function'
        ? new PerformanceObserver(list => list.getEntries().forEach(entry => longTasks.push(entry.duration)))
        : null;
      try { longTaskObserver?.observe({ type: 'longtask', buffered: false }); } catch (_) {}
      window.SDT.Renderer.draw = function (...args) {
        const begin = performance.now();
        const value = draw.apply(this, args);
        const elapsed = performance.now() - begin;
        calls++; drawTotal += elapsed; drawMax = Math.max(drawMax, elapsed); drawTimes.push(elapsed);
        return value;
      };
      const gaps = [];
      let previous = performance.now();
      const end = previous + duration;
      while (performance.now() < end) {
        await new Promise(resolveFrame => requestAnimationFrame(resolveFrame));
        const now = performance.now();
        gaps.push(now - previous);
        previous = now;
        if (step) step(now);
      }
      gaps.sort((a, b) => a - b);
      drawTimes.sort((a, b) => a - b);
      longTaskObserver?.disconnect();
      const result = {
        name, calls,
        rendererFps: +(calls / duration * 1000).toFixed(1),
        averageDrawMs: +(drawTotal / Math.max(1, calls)).toFixed(2),
        drawP95: +(drawTimes[Math.floor(drawTimes.length * .95)] || 0).toFixed(2),
        drawMax: +drawMax.toFixed(2),
        frameP95: +gaps[Math.floor(gaps.length * .95)].toFixed(1),
        slowFrames: gaps.filter(value => value > 20).length,
        slowRate: +(gaps.filter(value => value > 20).length / Math.max(1, gaps.length) * 100).toFixed(1),
        longTasks: longTasks.length,
        longTaskTotalMs: +longTasks.reduce((sum, value) => sum + value, 0).toFixed(1),
        longTaskMaxMs: +Math.max(0, ...longTasks).toFixed(1),
        frames: gaps.length,
        duration,
      };
      window.SDT.Renderer.draw = draw;
      return result;
    }
    const baseX = game.pos.x, baseY = game.pos.y;
    for (let round = 1; round <= 3; round++) {
      const samples = [];
      samples.push(await sample('idle', 2400, () => { game.state = 'idle'; if (title) title.hidden = true; window.SDT.RenderScheduler.invalidate(); }));
      samples.push(await sample('moving', 2400, () => {
        game.state = 'moving';
        window.SDT.RenderScheduler.invalidate();
        return now => {
          game.pos.x = baseX + Math.sin(now / 260) * 36;
          game.pos.y = baseY + Math.cos(now / 310) * 24;
        };
      }));
      samples.push(await sample('zoom', 1200, () => {
        game.state = 'idle';
        let next = 0;
        return now => {
          if (now < next) return;
          next = now + 100;
          canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: Math.floor(now / 100) % 2 ? 100 : -100, clientX: innerWidth / 2, clientY: innerHeight / 2 }));
        };
      }));
      samples.push(await sample('covered', 700, () => { if (title) title.hidden = false; }));
      rounds.push({ round, samples });
      await wait(250);
    }
    game.pos.x = baseX; game.pos.y = baseY;
    const metricMedian = (name, key) => {
      const values = rounds.map(round => round.samples.find(sample => sample.name === name)[key]).sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)];
    };
    const summary = ['idle', 'moving', 'zoom', 'covered'].map(name => ({
      name,
      calls: metricMedian(name, 'calls'),
      rendererFps: metricMedian(name, 'rendererFps'),
      averageDrawMs: metricMedian(name, 'averageDrawMs'),
      drawP95: metricMedian(name, 'drawP95'),
      drawMax: metricMedian(name, 'drawMax'),
      frameP95: metricMedian(name, 'frameP95'),
      slowRate: metricMedian(name, 'slowRate'),
      longTasks: metricMedian(name, 'longTasks'),
      longTaskTotalMs: metricMedian(name, 'longTaskTotalMs'),
      longTaskMaxMs: metricMedian(name, 'longTaskMaxMs'),
      frames: metricMedian(name, 'frames'),
      duration: rounds[0].samples.find(sample => sample.name === name).duration,
    }));
    const active = summary.filter(sample => sample.name === 'moving' || sample.name === 'zoom');
    const idle = summary.find(sample => sample.name === 'idle');
    const covered = summary.find(sample => sample.name === 'covered');
    const viewport = [innerWidth, innerHeight];
    const physicalViewport = viewport.map(value => Math.round(value * devicePixelRatio));
    const canvasBackingStore = [canvas.width, canvas.height];
    const physicalViewportIs1920x1080 = physicalViewport[0] === 1920 && physicalViewport[1] === 1080;
    const rendererP95AtMost8 = active.every(sample => sample.drawP95 <= 8);
    const coveredDrawsZero = covered.calls === 0;
    const idleDrawReductionAtLeast40 = idle.calls <= idle.duration / 1000 * 60 * 0.6;
    const activeTargetIs120 = Math.abs(1000 / window.SDT.RenderScheduler.activeInterval - 120) < 0.01;
    const target120DeliveryMet = summary.find(sample => sample.name === 'moving').rendererFps >= 110;
    const experienceTargetMet = active.every(sample => sample.frameP95 <= 20 && sample.slowRate < 5);
    return {
      viewport,
      devicePixelRatio,
      physicalViewport,
      canvasBackingStore,
      acceptance: {
        performanceGatePassed: physicalViewportIs1920x1080 && rendererP95AtMost8 && coveredDrawsZero && idleDrawReductionAtLeast40 && activeTargetIs120,
        physicalViewportIs1920x1080,
        rendererP95AtMost8,
        idleDrawReductionAtLeast40,
        coveredDrawsZero,
        activeTargetIs120,
        target120DeliveryMet,
        experienceTargetMet,
      },
      rounds,
      summary,
    };
  })()`);
  const gpuInfo = await app.getGPUInfo('complete');
  const activeGpu = (gpuInfo.gpuDevice || []).find(device => device.active);
  result.gpu = activeGpu ? {
    deviceString: activeGpu.deviceString,
    driverVersion: activeGpu.driverVersion,
  } : null;
  const output = JSON.stringify(result, null, 2);
  if (process.env.SDT_PERF_RESULT) writeFileSync(process.env.SDT_PERF_RESULT, output, 'utf8');
  else console.log(output);
  process.exitCode = result.acceptance.performanceGatePassed ? 0 : 1;
  win.setAlwaysOnTop(false);
  await win.close();
  app.quit();
}

if (process.versions.electron) runElectronProbe().catch(error => { console.error(error); process.exit(1); });
else orchestrate().catch(error => { console.error(error); process.exitCode = 1; });
