import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { createHash } = require('node:crypto');
const { auditAssets, canonicalAssetBytes, canonicalPath, inspectAssets, selectedAssetPaths } = require('../scripts/asset-audit-lib.cjs');

function fixture(entries = [{ path: 'old.png', ext: 'png', bytes: 3, license: 'CC0' }], files = { 'old.png': 'old' }) {
  const root = mkdtempSync(path.join(tmpdir(), 'asset-audit-test-'));
  mkdirSync(path.join(root, 'game/assets'), { recursive: true });
  mkdirSync(path.join(root, 'docs'));
  for (const [name, bytes] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, 'game/assets', name)), { recursive: true });
    writeFileSync(path.join(root, 'game/assets', name), bytes);
  }
  function manifest(assets = entries) {
    writeFileSync(path.join(root, 'game/assets/asset-manifest.json'), JSON.stringify({ count: assets.length, assets }));
  }
  manifest();
  writeFileSync(path.join(root, 'docs/asset-audit-debt.json'), JSON.stringify({ version: 1, issues: inspectAssets(root).issues }));
  return { root, manifest };
}

describe('incremental asset registration gate', () => {
  it('warns for unchanged frozen debt without accepting new unregistered assets', () => {
    const { root } = fixture([], { 'old.png': 'old' });
    expect(auditAssets({ root }).warnings.map(item => item.code)).toEqual(['unlisted']);
    writeFileSync(path.join(root, 'game/assets/new.png'), 'new');
    expect(auditAssets({ root }).errors.map(item => item.path)).toEqual(['new.png']);
  });

  it('ignores nested Git control files while checking adjacent assets', () => {
    const { root } = fixture([], {});
    const dir = path.join(root, 'game/assets/scenes');
    mkdirSync(dir);
    writeFileSync(path.join(dir, '.gitignore'), 'far.webp\n');
    writeFileSync(path.join(dir, 'new.webp'), 'new');
    expect(inspectAssets(root).issues.map(item => [item.code, item.path])).toEqual([['unlisted', 'scenes/new.webp']]);
    expect(selectedAssetPaths(['game/assets/scenes/.gitignore'])).toEqual([]);
    expect(auditAssets({ root }).errors.map(item => item.path)).toEqual(['scenes/new.webp']);
  });

  it('does not grandfather selected debt, including repository paths and directories', () => {
    const { root } = fixture([], { 'nested/old.png': 'old' });
    for (const selected of ['搜打撤/game/assets/nested/old.png', 'game\\assets\\nested\\old.png', 'game/assets/nested']) {
      expect(auditAssets({ root, paths: [selected] }).errors[0].code).toBe('unlisted');
    }
  });

  it('invalidates historical debt when same-size asset bytes change', () => {
    const { root } = fixture([], { 'old.png': 'old' });
    writeFileSync(path.join(root, 'game/assets/old.png'), 'new');
    expect(auditAssets({ root }).errors[0].code).toBe('unlisted');
  });

  it.each([null, '', '  ', undefined, '未登记：待查', 'unknown'])('rejects newly introduced license %s', license => {
    const { root, manifest } = fixture();
    manifest([{ path: 'old.png', ext: 'png', bytes: 3, license }]);
    expect(auditAssets({ root }).errors.map(item => item.code)).toContain('license-pending');
  });

  it('allows a correctly registered new asset and checks size, extension and optional hash', () => {
    const { root, manifest } = fixture();
    writeFileSync(path.join(root, 'game/assets/new.png'), 'new');
    const assets = [{ path: 'old.png', ext: 'png', bytes: 3, license: 'CC0' }, { path: 'new.png', ext: 'png', bytes: 3, license: 'CC0' }];
    manifest(assets);
    expect(auditAssets({ root, paths: ['game/assets/new.png'] }).ok).toBe(true);
    assets[1] = { ...assets[1], bytes: 4, ext: 'jpeg', sha256: 'a'.repeat(64) };
    manifest(assets);
    expect(auditAssets({ root }).errors.map(item => item.code)).toEqual(['bytes-mismatch', 'extension-mismatch', 'sha256-mismatch']);
  });

  it('rejects duplicate registrations and case/normalization collisions', () => {
    const { root, manifest } = fixture();
    const entry = { path: 'old.png', ext: 'png', bytes: 3, license: 'CC0' };
    manifest([entry, { ...entry, path: './old.png' }, { ...entry, path: 'OLD.png' }]);
    const codes = auditAssets({ root }).errors.map(item => item.code);
    expect(codes).toContain('duplicate-entry');
    expect(codes).toContain('path-collision');
    expect(codes).toContain('noncanonical-path');
  });

  it('rejects path traversal and malformed manifest/debt instead of resetting debt', () => {
    const { root, manifest } = fixture();
    expect(() => canonicalPath('../private.png')).toThrow('unsafe');
    expect(() => canonicalPath('C:\\private.png')).toThrow('unsafe');
    expect(() => selectedAssetPaths(null)).toThrow();
    manifest([{ path: '../private.png' }]);
    expect(() => auditAssets({ root })).toThrow('unsafe');
    manifest();
    writeFileSync(path.join(root, 'docs/asset-audit-debt.json'), '{');
    expect(() => auditAssets({ root })).toThrow();
    writeFileSync(path.join(root, 'docs/asset-audit-debt.json'), JSON.stringify({ version: 1, issues: [{}] }));
    expect(() => auditAssets({ root })).toThrow('invalid historical');
  });

  it('retains ghost debt as warnings until that registration changes', () => {
    const { root, manifest } = fixture([{ path: 'gone.png', ext: 'png', bytes: 3, license: 'CC0' }], {});
    expect(auditAssets({ root }).warnings[0].code).toBe('ghost');
    manifest([{ path: 'gone.png', ext: 'png', bytes: 4, license: 'CC0' }]);
    expect(auditAssets({ root }).errors[0].code).toBe('ghost');
  });

  // 隔离快照按 index 字节落盘（文本 LF 化），审计指纹按工作树字节登记——快照内必漂移；staged 门内跳过，工作树门与 CI 覆盖。
  it('文本类资产 CRLF/LF 检出形态审计等价（#35 LF 归一口径）', () => {
    // Windows 检出（CRLF）、Linux/git 对象（LF）对同一文本资产必须给出同一 bytes/sha256；
    // 登记一次，两种检出形态都过审——跨平台移植性由归一化保证，不再按检出字节漂移。
    const crlf = Buffer.from('<svg>\r\n<a/>\r\n</svg>\r\n');
    const { root, manifest } = fixture([], { 'icon.svg': crlf });
    const canonical = canonicalAssetBytes(crlf, 'icon.svg');
    expect(canonical.length).toBeLessThan(crlf.length);
    const sha = value => createHash('sha256').update(value).digest('hex');
    manifest([{ path: 'icon.svg', ext: 'svg', bytes: canonical.length, sha256: sha(canonical), license: 'CC0' }]);
    expect(auditAssets({ root, paths: ['game/assets/icon.svg'] }).ok).toBe(true);
    writeFileSync(path.join(root, 'game/assets/icon.svg'), Buffer.from('<svg>\n<a/>\n</svg>\n'));
    expect(auditAssets({ root, paths: ['game/assets/icon.svg'] }).ok).toBe(true);
  });
  it.skipIf(Boolean(process.env.SDT_STAGED_SNAPSHOT))('runs the repository CLI without a build or document writes and rejects bad arguments', () => {
    const debtPath = path.resolve('docs/asset-audit-debt.json');
    const before = readFileSync(debtPath, 'utf8');
    const command = path.resolve('scripts/asset-audit.cjs');
    const result = spawnSync(process.execPath, [command, '--check', '--paths-json', '[]'], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('0 errors');
    expect(result.stdout).not.toContain('Packaged game');
    expect(readFileSync(debtPath, 'utf8')).toBe(before);
    const invalid = spawnSync(process.execPath, [command, '--check', '--paths-json'], { encoding: 'utf8' });
    expect(invalid.status).toBe(1);
  });
});
