const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4',
};

// Keep app://sdt and its existing saves. Serve bundled bytes directly rather
// than forwarding each stylesheet/font/audio request through a second file: fetch.
function createGameFileHandler(directory, onError = console.error) {
  const root = path.resolve(directory);
  return async request => {
    let file;
    let handle;
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'sdt') return new Response(null, { status: 403 });
      if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
      const pathname = decodeURIComponent(url.pathname);
      file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const relative = path.relative(root, file);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || pathname.includes('\\') || pathname.includes('\0')) {
        return new Response(null, { status: 403 });
      }
      handle = await fs.promises.open(file, 'r');
      const stat = await handle.stat();
      if (!stat.isFile()) { await handle.close(); handle = null; return new Response(null, { status: 404 }); }
      const headers = {
        'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'accept-ranges': 'bytes',
        // These are local bundled files; avoid stale failures from older releases.
        'cache-control': 'no-store',
      };
      let start = 0, end = stat.size - 1, status = 200;
      const range = request.method === 'GET' && request.headers.get('range');
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (match && (match[1] || match[2])) {
          start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
          end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
        } else start = stat.size;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= stat.size) {
          await handle.close(); handle = null;
          return new Response(null, { status: 416, headers: { 'content-range': `bytes */${stat.size}` } });
        }
        status = 206;
        headers['content-range'] = `bytes ${start}-${end}/${stat.size}`;
      }
      headers['content-length'] = String(Math.max(0, end - start + 1));
      if (request.method === 'HEAD' || stat.size === 0) {
        await handle.close(); handle = null;
        return new Response(null, { status, headers });
      }
      // The stream owns the already-open descriptor, avoiding a stat/open race.
      const stream = handle.createReadStream({ start, end, autoClose: true });
      handle = null;
      stream.on('error', error => {
        if (error.name !== 'AbortError' && error.code !== 'ABORT_ERR') onError(`[game-file] ${relative}: ${error.message}`);
      });
      return new Response(Readable.toWeb(stream), { status, headers });
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      if (error instanceof URIError) return new Response(null, { status: 400 });
      onError(`[game-file] ${file ? path.relative(root, file) : 'invalid URL'}: ${error.message}`);
      return new Response(null, { status: error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500 });
    }
  };
}

module.exports = { createGameFileHandler };
