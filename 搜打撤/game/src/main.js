/* ============================================================
 * main.js —— ESM 唯一入口
 *
 * 按原 index.html 的 <script> 顺序导入全部模块，保持初始化顺序。
 * 模块间依赖由各文件顶部的 import 显式声明（见 scripts/esm-convert.mjs）。
 * ============================================================ */
import './random.js';
import './rules.js';
import './mapData.js';
import './art.js';
import './icons-bitmap.js';
import './sound.js';
import './camera.js';
import './motion.js';
import './input.js';


import './notes.js';
import './cards.js';
import './combat.js';
import './base.js';
import './meta.js';
import './render-scheduler.js';
import './renderer.fx.js';

import './renderer.js';        // 老板留言 #53：对局地图改回原二维面板（停用 3D 场景）
// import './scene/runtime.js'; // 3D 场景暂退（如需恢复取消注释并移除上一行）
import './ui.js';
import './shared.js';
import './battle.effects.js';
import './battle.core.js';
import './battle.view.js';
import './chests.js';
import './game.storage.js';
import './game.store.js';
import './game.session.js';
import './game.run.js';
import './game.hub.js';
import './game.bag.js';
import './game.notes.js';
import './game.cardslib.js';
import './game.boot.js';
