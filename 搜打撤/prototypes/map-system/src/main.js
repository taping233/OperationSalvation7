/* ============================================================
 * main.js —— ESM 唯一入口
 *
 * 按原 index.html 的 <script> 顺序导入全部模块，保持初始化顺序。
 * 模块间依赖由各文件顶部的 import 显式声明（见 scripts/esm-convert.mjs）。
 * ============================================================ */
import './mapData.js';
import './art.js';
import './icons-bitmap.js';
import './sound.js';
import './camera.js';
import './notes.js';
import './cards.js';
import './combat.js';
import './base.js';
import './meta.js';
import './renderer.js';
import './ui.js';
import './shared.js';
import './battle.core.js';
import './battle.view.js';
import './chests.js';
import './game.core.js';
import './game.run.js';
import './game.hub.js';
import './game.bag.js';
import './game.notes.js';
import './game.cardslib.js';
import './game.boot.js';
