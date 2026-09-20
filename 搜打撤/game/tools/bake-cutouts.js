/* ============================================================
 * 离线烘焙战场立绘抠图（把原运行时 makeCutout 挪到构建期）
 *
 * 用法（在 搜打撤/ 目录下）：
 *   ./desktop/electron/electron.exe game/tools/bake-cutouts.js
 *
 * 读取 assets/portraits/{classes,enemies}/*.png，按 art.js 战场同款算法
 * （等比降到高 760 → 四边洪泛去纸色背景 → 轮廓半透明羽化）处理后，
 * 写入 assets/portraits/cut/{classes,enemies}/ 同名 png。
 * 游戏运行时只做路径映射直接调用，零图像处理开销。
 *
 * 素材有更新时重跑一次即可；整图≈纯背景（判定失败）的图会跳过不产出。
 * ============================================================ */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'assets', 'portraits');
const OUT = path.join(ROOT, 'cut');
const MAX_H = 760;   // 与旧运行时行为一致：战场显示宽 180~290px，2x 屏足够

// 在渲染进程里跑的单文件处理：返回 dataURL 或 null（跳过）
// 注意：本函数源码会被内嵌进渲染进程执行，不能引用本文件作用域的变量（参数传入）
const processOne = (dataUrl, MAX_H) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    try {
      const W0 = img.naturalWidth, H0 = img.naturalHeight;
      const k = Math.min(1, MAX_H / H0);
      const W = Math.max(1, Math.round(W0 * k)), H = Math.max(1, Math.round(H0 * k));
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H);
      const px = data.data;
      // 纸色判定：亮且低饱和（米白纸底）
      const isPaper = (i) => {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        return mx > 200 && (mx - mn) < 42;
      };
      const mask = new Uint8Array(W * H);
      const edge = new Uint8Array(W * H);
      const stack = [];
      for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
      for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
      let removed = 0;
      while (stack.length) {
        const p = stack.pop();
        if (mask[p]) continue;
        const i = p * 4;
        if (!isPaper(i)) continue;
        mask[p] = 1; removed++;
        const x = p % W, y = (p / W) | 0;
        const push = (q) => { if (!mask[q]) { stack.push(q); edge[q] = 1; } };
        if (x > 0) push(p - 1);
        if (x < W - 1) push(p + 1);
        if (y > 0) push(p - W);
        if (y < H - 1) push(p + W);
      }
      if (removed > W * H * 0.92) return resolve(null);   // 抠图判定失败，保留原图
      for (let p = 0; p < W * H; p++) {
        if (mask[p]) px[p * 4 + 3] = 0;
        else if (edge[p]) px[p * 4 + 3] = Math.min(px[p * 4 + 3], 150);
      }
      ctx.putImageData(data, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    } catch (e) { resolve(null); }
  };
  img.onerror = () => resolve(null);
  img.src = dataUrl;
});

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  await win.loadURL('about:blank');
  let done = 0, skipped = 0;
  for (const group of ['classes', 'enemies']) {
    const srcDir = path.join(ROOT, group);
    const outDir = path.join(OUT, group);
    fs.mkdirSync(outDir, { recursive: true });
    // 输入兼容 .png/.webp（迭代评审 09-20 美术岗 D-P1）：portraits/enemies 现役 18 张全为 .webp，
    // 旧过滤 .endsWith('.png') 对龙巢新图会 0 产出静默空转；MIME 跟随输入扩展名，产出统一 png
    for (const f of fs.readdirSync(srcDir).filter(n => /\.png$|\.webp$/i.test(n))) {
      const mime = /\.webp$/i.test(f) ? 'image/webp' : 'image/png';
      const b64 = fs.readFileSync(path.join(srcDir, f)).toString('base64');
      // 把 processOne 的函数源码内嵌进渲染进程调用（about:blank 页里没有主进程的符号）
      const url = await win.webContents.executeJavaScript(
        `(${processOne.toString()})('data:${mime};base64,${b64}', ${MAX_H})`, true);
      if (!url) { console.log(`跳过（判定失败）: ${group}/${f}`); skipped++; continue; }
      const outName = f.replace(/\.webp$/i, '.png');
      fs.writeFileSync(path.join(outDir, outName), Buffer.from(url.split(',')[1], 'base64'));
      done++;
      console.log(`OK: ${group}/${f}`);
    }
  }
  console.log(`\n完成：产出 ${done} 张，跳过 ${skipped} 张 → ${OUT}`);
  app.quit();
});
