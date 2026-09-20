const { spawn } = require('node:child_process');
const { request } = require('node:http');
const { existsSync, readFileSync, unlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 48731;
const URL = `http://127.0.0.1:${PORT}/`;
const SOAK_MS = Math.max(5000, Number(process.env.SDT_PERF_SOAK_MS) ||
  (process.argv.includes('--soak') ? 10 * 60 * 1000 : 15 * 1000));

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
  const electron = path.join(ROOT, 'desktop-app', 'node_modules', 'electron', 'dist', 'electron.exe');
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
      env: { ...process.env, SDT_PERF_RESULT: resultPath, SDT_PERF_SOAK_MS: String(SOAK_MS) },
    });
    const probeExitCode = await new Promise(resolveExit => probe.on('exit', resolveExit));
    if (!existsSync(resultPath)) throw new Error(`Electron 性能探针未产生结果（exit ${probeExitCode}）`);
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
  const soakMs = Math.max(5000, Number(process.env.SDT_PERF_SOAK_MS) || 15000);
  if (process.env.SDT_PERF_GPU !== 'auto') app.commandLine.appendSwitch('force_high_performance_gpu');
  await app.whenReady();
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1;
  // 虚拟分辨率档（迭代评审 09-20 D-P2）：SDT_PERF_VR_H=2160 可采样 4K/高 DPI——
  // 高分屏为 report-only 独立预算（draw p95≤16ms），不进 1080p 的 AND 发布门禁
  const vrHeight = Number(process.env.SDT_PERF_VR_H) || 1080;
  const vrWidth = Math.round((1920 * vrHeight) / 1080);
  const win = new BrowserWindow({
    show: true,
    frame: false,
    useContentSize: true,
    width: Math.round(vrWidth / scaleFactor),
    height: Math.round(vrHeight / scaleFactor),
    // 非持久 partition：性能探针可以自由构造战斗/牌库压力场景，不污染玩家存档。
    webPreferences: { backgroundThrottling: false, partition: `sdt-perf-${process.pid}` },
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[perf] renderer process gone', JSON.stringify(details));
  });
  win.webContents.on('unresponsive', () => console.error('[perf] renderer unresponsive'));
  win.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`[perf] load failed ${code}: ${description}`);
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
    const battleWasDeferred = !window.SDT.Battle;
    const battleLoadStarted = performance.now();
    await window.SDT.BattleLoader.ensure();
    const lazyBattleLoadMs = +(performance.now() - battleLoadStarted).toFixed(1);
    async function sample(name, duration, setup) {
      const step = setup ? setup() : null;
      const loopTicksBefore = window.SDT.__frameStats?.loopTicks || 0;
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
        loopTicks: (window.SDT.__frameStats?.loopTicks || 0) - loopTicksBefore,
        loopHz: +(((window.SDT.__frameStats?.loopTicks || 0) - loopTicksBefore) / duration * 1000).toFixed(1),
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
      loopTicks: metricMedian(name, 'loopTicks'),
      loopHz: metricMedian(name, 'loopHz'),
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

    // P1 最坏场景：四敌人 + 24 张手牌的战斗 DOM 重绘，以及全卡库快速滚动。
    // 随后反复切换三套角色帧纹理/卡牌库，检查 JS 堆、DOM 与受控纹理缓存是否回落。
    const saved = {
      ownedCards: game.ownedCards, hp: game.hp, maxHp: game.maxHp, atk: game.atk,
      spellPower: game.spellPower, myClass: game.myClass, characterId: game.characterId,
      state: game.state, battleActive: game.battleActive,
    };
    const combatCards = window.SDT.Cards.all()
      .filter(card => ['武术', '法术', '装备'].includes(card.type))
      .slice(0, 24);
    game.ownedCards = combatCards.map((card, i) => ({ uid: 'perf-' + i, card: { ...card }, safe: false }));
    game.hp = game.maxHp = 9999; game.atk = 5; game.spellPower = 2;
    const roles = [
      { cls: '侠客', id: 'wu' },
      { cls: '降临者', id: 'changwuyu' },
      { cls: '法师', id: 'baita' },
    ];
    const foes = Array.from({ length: 4 }, (_, i) => ({
      id: ['infantry', 'archer', 'bandit', 'orc_axe'][i],
      name: '压力靶-' + (i + 1), hp: 9999, atk: 1,
    }));
    async function openPerfBattle(role) {
      if (game.battleActive) { window.SDT.Battle.commands.flee(); await wait(300); }
      if (title) title.hidden = true;
      game.state = 'idle'; game.myClass = role.cls; game.characterId = role.id;
      window.SDT.Battle.start(game, foes, { isBoss: false, layer: 0, name: '性能压力战' });
      await wait(700);
    }
    async function closePerfBattle() {
      if (game.battleActive) window.SDT.Battle.commands.flee();
      await wait(320);
      window.SDT.UI.hideOverlay();
      game.state = 'idle';
      await wait(260);
    }
    async function openPerfLibrary() {
      window.SDT.UI.hideOverlay();
      game.state = 'idle';
      await wait(260);
      game.debug.openCardLibrary();
      await wait(700);
    }
    async function closePerfLibrary() {
      window.SDT.UI.hideOverlay();
      await wait(320);
      game.state = 'idle';
    }

    const stress = [];
    await openPerfBattle(roles[0]);
    stress.push(await sample('battle-heavy', 2400, () => {
      let next = 0;
      return now => {
        if (now < next) return;
        next = now + 150;
        window.SDT.Battle.commands.refreshView();
      };
    }));
    await closePerfBattle();
    await openPerfLibrary();
    stress.push(await sample('card-library-scroll', 2400, () => now => {
      const grid = document.getElementById('libGrid');
      if (!grid) return;
      const span = Math.max(1, grid.scrollHeight - grid.clientHeight);
      grid.scrollTop = (now * 1.7) % span;
      grid.dispatchEvent(new Event('scroll'));
    }));
    await closePerfLibrary();

    // 先把三种角色都走一遍，基线包含正常的首次模块/纹理解码成本；之后只测重复循环增长。
    for (const role of roles) { await openPerfBattle(role); await closePerfBattle(); }
    const heapBefore = performance.memory?.usedJSHeapSize || 0;
    const domBefore = document.getElementsByTagName('*').length;
    const soakStarted = performance.now();
    let soakCycles = 0;
    while (performance.now() - soakStarted < ${soakMs}) {
      const role = roles[soakCycles % roles.length];
      await openPerfBattle(role);
      window.SDT.Battle.commands.refreshView();
      await wait(180);
      await closePerfBattle();
      await openPerfLibrary();
      const grid = document.getElementById('libGrid');
      if (grid) { grid.scrollTop = grid.scrollHeight; grid.dispatchEvent(new Event('scroll')); }
      await wait(180);
      await closePerfLibrary();
      soakCycles++;
    }
    const heapAfter = performance.memory?.usedJSHeapSize || 0;
    const domAfter = document.getElementsByTagName('*').length;
    const frameCache = window.SDT.Battle._perf.frameCacheStats();
    const warmPool = window.SDT.Art.warmStats();
    const memory = {
      soakMs: Math.round(performance.now() - soakStarted), soakCycles,
      heapBefore, heapAfter, heapGrowthBytes: heapBefore && heapAfter ? heapAfter - heapBefore : null,
      domBefore, domAfter, domGrowth: domAfter - domBefore,
      frameCache, warmPool,
    };
    Object.assign(game, saved);
    if (title) title.hidden = false;

    const active = summary.filter(sample => sample.name === 'moving' || sample.name === 'zoom');
    const idle = summary.find(sample => sample.name === 'idle');
    const covered = summary.find(sample => sample.name === 'covered');
    const viewport = [innerWidth, innerHeight];
    const physicalViewport = viewport.map(value => Math.round(value * devicePixelRatio));
    const canvasBackingStore = [canvas.width, canvas.height];
    // Chromium 在 125% DPI 下 CSS→物理像素偶尔会因窗口边界取整少 1px；这不是性能
    // 退化。容许单像素误差，同时仍校验 Canvas 后备缓冲与实际物理视口一致。
    const physicalViewportIs1920x1080 = Math.abs(physicalViewport[0] - 1920) <= 1 &&
      Math.abs(physicalViewport[1] - 1080) <= 1 &&
      canvasBackingStore[0] === physicalViewport[0] && canvasBackingStore[1] === physicalViewport[1];
    const rendererP95AtMost8 = active.every(sample => sample.drawP95 <= 8);
    const coveredDrawsZero = covered.calls === 0;
    const idleDrawReductionAtLeast40 = idle.calls <= idle.duration / 1000 * 60 * 0.6;
    const idleLoopAtMost8Hz = idle.loopHz <= 8;
    const activeTargetIs120 = Math.abs(1000 / window.SDT.RenderScheduler.activeInterval - 120) < 0.01;
    const target120DeliveryMet = summary.find(sample => sample.name === 'moving').rendererFps >= 110;
    const experienceTargetMet = active.every(sample => sample.frameP95 <= 20 && sample.slowRate < 5);
    const stressExperienceMet = stress.every(sample => sample.frameP95 <= 20 && sample.slowRate < 5 && sample.longTasks === 0);
    const memoryStable = (memory.heapGrowthBytes == null || memory.heapGrowthBytes <= 32 * 1024 * 1024) &&
      memory.domGrowth <= 300 && memory.frameCache.roles <= 1 &&
      memory.warmPool.count <= memory.warmPool.maxCount && memory.warmPool.bytes <= memory.warmPool.maxBytes;
    // 高分屏 report-only 预算（迭代评审 09-20 D-P2）：fill rate 随分辨率翻倍，1080p 的 8ms
    // 门禁不适用；4K/VR 档独立看 draw p95≤16ms，只上报不参与 performanceGatePassed
    const vrReportOnly = vrHeight !== 1080;
    const vrDrawP95Within16 = active.every(sample => sample.drawP95 <= 16);
    return {
      viewport,
      devicePixelRatio,
      physicalViewport,
      canvasBackingStore,
      virtualResolution: { height: vrHeight, reportOnly: vrReportOnly, drawP95BudgetMs: 16, drawP95WithinBudget: vrDrawP95Within16 },
      acceptance: {
        performanceGatePassed: physicalViewportIs1920x1080 && rendererP95AtMost8 && coveredDrawsZero && idleDrawReductionAtLeast40 && idleLoopAtMost8Hz && activeTargetIs120 && target120DeliveryMet && experienceTargetMet && stressExperienceMet && memoryStable && battleWasDeferred && lazyBattleLoadMs <= 1500,
        physicalViewportIs1920x1080,
        rendererP95AtMost8,
        idleDrawReductionAtLeast40,
        idleLoopAtMost8Hz,
        coveredDrawsZero,
        activeTargetIs120,
        target120DeliveryMet,
        experienceTargetMet,
        stressExperienceMet,
        memoryStable,
        battleWasDeferred,
        lazyBattleLoadUnder1500ms: lazyBattleLoadMs <= 1500,
      },
      lazyBattleLoadMs,
      stress,
      memory,
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

if (process.versions.electron) {
  console.error(`[perf] Electron probe runtime ${process.versions.electron}`);
  runElectronProbe().catch(error => { console.error(error); process.exit(1); });
}
else orchestrate().catch(error => { console.error(error); process.exitCode = 1; });
