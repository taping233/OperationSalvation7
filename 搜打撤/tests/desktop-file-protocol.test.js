import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createGameFileHandler } = require('../desktop-app/game-file-protocol.cjs');
let directory, serve, errors;
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'c7-资源协议-'));
  errors = vi.fn(); serve = createGameFileHandler(directory, errors);
  writeFileSync(path.join(directory, 'index.html'), '<h1>冬日猜想</h1>');
  writeFileSync(path.join(directory, '首页.css'), 'body { color: white; }');
  writeFileSync(path.join(directory, 'font.woff2'), Buffer.from([0, 1, 2, 255]));
  writeFileSync(path.join(directory, 'music.ogg'), '0123456789');
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));
const request = (url, options) => new Request('app://sdt/' + url, options);

describe('desktop bundled file protocol', () => {
  it('serves the entry and encoded stylesheet with explicit MIME types and query parameters', async () => {
    const entry = await serve(request(''));
    expect(await entry.text()).toBe('<h1>冬日猜想</h1>');
    const css = await serve(request(encodeURIComponent('首页.css') + '?v=0.60.0'));
    expect(css.status).toBe(200);
    expect(css.headers.get('content-type')).toBe('text/css; charset=utf-8');
    expect(await css.text()).toBe('body { color: white; }');
    expect(errors).not.toHaveBeenCalled();
  });
  it('serves fonts as binary font responses and supports HEAD without opening a body stream', async () => {
    const response = await serve(request('font.woff2'));
    expect(response.headers.get('content-type')).toBe('font/woff2');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from([0, 1, 2, 255]));
    const head = await serve(request('font.woff2', { method: 'HEAD' }));
    expect(head.headers.get('content-length')).toBe('4');
    expect(await head.text()).toBe('');
  });
  it.each([['bytes=2-4', '234'], ['bytes=8-', '89'], ['bytes=-3', '789']])('honours audio range %s', async (range, expected) => {
    const response = await serve(request('music.ogg', { headers: { range } }));
    expect(response.status).toBe(206);
    expect(response.headers.get('content-type')).toBe('audio/ogg');
    expect(response.headers.get('content-range')).toMatch(/^bytes \d+-\d+\/10$/);
    expect(await response.text()).toBe(expected);
  });
  it.each(['bytes=20-', 'bytes=5-2', 'bytes=-0', 'bytes=1-2,4-5'])('rejects unsatisfiable range %s', async range => {
    const response = await serve(request('music.ogg', { headers: { range } }));
    expect(response.status).toBe(416);
  });
  it('returns failures instead of rejected promises and refuses invalid hosts and paths', async () => {
    expect((await serve(request('missing.css'))).status).toBe(404);
    expect(errors).toHaveBeenCalledOnce();
    expect((await serve(new Request('app://other/index.html'))).status).toBe(403);
    expect((await serve(request('%2e%2e%5csecret.css'))).status).toBe(403);
    expect((await serve(request('%E0%A4%A.css'))).status).toBe(400);
    expect((await serve(request('index.html', { method: 'POST' }))).status).toBe(405);
  });
  it('does not log a cancelled image/audio body as a resource failure', async () => {
    const response = await serve(request('music.ogg'));
    await response.body.cancel();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(errors).not.toHaveBeenCalled();
  });
});
