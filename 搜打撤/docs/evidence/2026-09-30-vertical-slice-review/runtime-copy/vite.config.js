import config from './vite.base.config.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const reviewRoot = path.dirname(fileURLToPath(import.meta.url));
export default { ...config, cacheDir: path.join(reviewRoot, '.vite-cache'), server: { ...(config.server || {}), host: '127.0.0.1', port: 5386, strictPort: true, watch: { ignored: ['**/*'] } } };
