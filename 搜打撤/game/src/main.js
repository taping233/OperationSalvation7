/* ============================================================
 * main.js —— ESM 唯一入口
 *
 * 按原 index.html 的 <script> 顺序导入全部模块，保持初始化顺序。
 * 模块间依赖由各文件顶部的 import 显式声明（见 scripts/esm-convert.mjs）。
 * 下面的导入顺序即启动顺序，须与 boot-order.js 的 BOOT_ORDER 一致
 * （tests/contracts.test.js 有守护断言，勿随意调换）。
 * ============================================================ */
import './ui-scale.js';   // 全局 UI 缩放：须在首帧渲染前挂 zoom，故先于一切模块
import './random.js';
import './rules.js';
import './mapData.js';
import './art.js';
import './icons-bitmap.js';
import './sound.js';
import './camera.js';
import './motion.js';
import './input.js';

import './event-bus.js';   // 模块间事件总线（批次 5）：须早于战斗/背包的订阅方
import './notes.js';
import './cards.js';
import './combat.js';
import './base.js';
import './meta.js';
import './render-scheduler.js';
import './renderer.fx.js';

import './renderer.js';        // 老板留言 #53：对局地图改回原二维面板（停用 3D 场景）；
                               // scene/ 目录已随 2026-09-19 技术清理删除，需要 3D 时从 git 历史找回
import './ui.js';
import './shared.js';
import './battle-loader.js';
import './chests.js';
import './game.storage.js';
import './game.store.js';
import './game.session.js';
import './game.nest.js';
import './game.run.js';
import './game.hub.js';
import './game.bag.js';
import './game.notes.js';
import './game.cardslib.js';
import './game.boot.js';
