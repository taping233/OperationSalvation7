import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, chmodSync } from 'node:fs';
import { execSync } from 'node:child_process';
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

function clearGeneratedDir(dir) {
  const expectedParent = path.join(ROOT, 'desktop-app');
  const relative = path.relative(expectedParent, dir);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !path.basename(dir).startsWith('game')) {
    throw new Error(`Refusing to clear unexpected build directory: ${dir}`);
  }
  if (!existsSync(dir)) return;
  // node 的 rmSync 在部分环境下会静默失败（不删除也不报错），旧哈希产物因此逐次堆积；
  // 改用系统原生命令删除，删除后必须校验目录确实消失，失败则大声警告并给出手动命令
  const nativeRemove = process.platform === 'win32'
    ? `rd /s /q "${dir}"`
    : `rm -rf "${dir}"`;
  try { execSync(nativeRemove, { stdio: 'ignore' }); } catch { /* 由下方 existsSync 兜底校验 */ }
  if (existsSync(dir)) {
    console.warn('[assets] WARNING: 旧产物目录删除失败，本次构建将与旧产物混叠！');
    console.warn(`[assets] 请先手动执行删除再构建: ${nativeRemove}`);
  } else {
    console.log(`[assets] cleared generated directory: ${dir}`);
  }
}

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = path.join(ROOT, 'game');
const OUT_DIR = process.env.SDT_BUILD_OUT_DIR
  ? path.resolve(ROOT, process.env.SDT_BUILD_OUT_DIR)
  : path.join(ROOT, 'desktop-app', 'game');
const RUNTIME_ASSET_DIRS = ['cards', 'portraits', 'icons', 'scenes', path.join('ui', 'icons'), 'sfx'];

// 构建版本号：取 version.json 的版本 + 当前时间戳，供 assetUrl() 做资产缓存失效
function buildVersion() {
  try {
    const { version } = JSON.parse(readFileSync(path.join(GAME_ROOT, 'version.json'), 'utf8'));
    return `${version}.${Date.now()}`;
  } catch {
    return `dev.${Date.now()}`;
  }
}

// 只复制无法由 Vite 静态分析的动态资源族；其余图片、场景和音乐交给
// new URL(..., import.meta.url) / CSS 管线哈希，避免产物同时保留哈希版和原始版。
function copyStatic() {
  return {
    name: 'copy-static',
    apply: 'build',
    buildStart() {
      clearGeneratedDir(OUT_DIR);
      console.log(`[assets] cleared generated directory: ${OUT_DIR}`);
    },
    closeBundle() {
      const srcAssets = path.join(GAME_ROOT, 'assets');
      for (const relativeDir of RUNTIME_ASSET_DIRS) {
        const source = path.join(srcAssets, relativeDir);
        if (existsSync(source)) copyDir(source, path.join(OUT_DIR, 'assets', relativeDir));
      }
      writeFileSync(path.join(OUT_DIR, 'version.json'), readFileSync(path.join(GAME_ROOT, 'version.json')));
      // 哨兵：正常构建产出 1 个入口 + 1 个异步 index chunk（共 2 个）；更多说明旧产物未清掉
      const jsDir = path.join(OUT_DIR, 'assets', 'js');
      if (existsSync(jsDir)) {
        const entries = readdirSync(jsDir).filter(name => /^index-.*\.js$/.test(name));
        if (entries.length > 2) {
          console.warn(`[assets] WARNING: 产物中出现 ${entries.length} 个 index bundle（应为 2 个），旧产物未清理干净: ${entries.join(', ')}`);
        }
      }
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
        // 大依赖各自成 chunk：主入口回到 500kB 以下，且库不升级时哈希稳定利于缓存
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](three|pixi\.js|@pixi)[\\/]/.test(id)) return 'vendor-render';
          if (/[\\/]node_modules[\\/](howler|motion|inkjs|sortablejs)[\\/]/.test(id)) return 'vendor-misc';
        },
      },
    },
  },
  plugins: [copyStatic()],
});
