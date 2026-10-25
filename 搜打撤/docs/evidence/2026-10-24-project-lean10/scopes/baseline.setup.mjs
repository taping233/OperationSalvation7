import { vi } from 'vitest';

// Read the frozen game text in memory; the shared working tree is never replaced.
vi.mock('node:fs', async importOriginal => {
  const original = await importOriginal();
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = process.cwd();
  const baseline = path.join(root, 'node_modules/.cache/project-lean10-1024/before');
  const readFileSync = (file, ...options) => {
    if (typeof file === 'string' || file instanceof URL) {
      const absolute = path.resolve(file instanceof URL ? fileURLToPath(file) : file);
      const relative = path.relative(root, absolute);
      if (relative.startsWith(`game${path.sep}`)) {
        const frozen = path.join(baseline, relative);
        if (original.existsSync(frozen)) return original.readFileSync(frozen, ...options);
      }
    }
    return original.readFileSync(file, ...options);
  };
  return { ...original, readFileSync, default: { ...original.default, readFileSync } };
});
