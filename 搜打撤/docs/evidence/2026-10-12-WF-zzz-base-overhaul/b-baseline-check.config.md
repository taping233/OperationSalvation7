import { readFileSync } from 'node:fs';
import baseConfig from '../../../vite.config.js';

// Read-only comparison: preserve module identity/import paths and load only B's warehouse baseline.
export default {
  ...baseConfig,
  plugins: [{
    name: 'b-warehouse-baseline',
    enforce: 'pre',
    load(id) {
      if (id.replaceAll('\\', '/').endsWith('/game/src/hub/hub.warehouse.js')) {
        return readFileSync(new URL('./b-baseline/hub.warehouse.js', import.meta.url), 'utf8');
      }
    },
  }, ...(baseConfig.plugins || [])],
};
