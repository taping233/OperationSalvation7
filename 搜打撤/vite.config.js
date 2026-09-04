import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 逐文件读写拷贝：copyFileSync 在 Windows 下对只读源文件会 EPERM，read+write 则正常
function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else {
      // 只读残留会令 writeFileSync EPERM，且 rmSync 对只读文件静默失败，先清属性再删
      try { chmodSync(d, 0o666); } catch { /* 不存在则忽略 */ }
      rmSync(d, { force: true });
      writeFileSync(d, readFileSync(s));
    }
  }
}

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = path.join(ROOT, 'prototypes', 'map-system');
const OUT_DIR = path.join(ROOT, 'desktop-app', 'game');

// 构建版本号：取 version.json 的版本 + 当前时间戳，供 assetUrl() 做资产缓存失效
function buildVersion() {
  try {
    const { version } = JSON.parse(readFileSync(path.join(GAME_ROOT, 'version.json'), 'utf8'));
    return `${version}.${Date.now()}`;
  } catch {
    return `dev.${Date.now()}`;
  }
}

// 把运行时字符串路径引用的资产（assets/**）与 version.json 拷进产物；
// CSS/JS 静态引用的资产由 Vite 自带管线哈希，不走这里。
function copyStatic() {
  return {
    name: 'copy-static',
    closeBundle() {
      const srcAssets = path.join(GAME_ROOT, 'assets');
      if (existsSync(srcAssets)) copyDir(srcAssets, path.join(OUT_DIR, 'assets'));
      writeFileSync(path.join(OUT_DIR, 'version.json'), readFileSync(path.join(GAME_ROOT, 'version.json')));
    },
  };
}

export default defineConfig({
  root: GAME_ROOT,
  base: './',
  publicDir: false,
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion()),
  },
  test: {
    root: ROOT,
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    // 音频/图片一律出文件，不内联 base64（桌面端 file 协议下更稳，也便于缓存）
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
      },
    },
  },
  plugins: [copyStatic()],
});
