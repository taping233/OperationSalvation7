// 中间实验配置，不进 Git，不修改项目配置。
import config from '../../../vite.config.js';
export default { ...config, test: { ...config.test, include: ['docs/evidence/2026-10-03-WF-experience-art-exec/pouch-check.tmp.test.js'] } };
