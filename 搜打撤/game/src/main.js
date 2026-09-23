/* ============================================================
 * main.js —— ESM 唯一入口
 *
 * 按原 index.html 的 <script> 顺序导入全部模块，保持初始化顺序。
 * 模块间依赖由各文件顶部的 import 显式声明（见 scripts/esm-convert.mjs）。
 * 下面的导入顺序即启动顺序，须与 boot-order.js 的 BOOT_ORDER 一致
 * （tests/contracts.test.js 有守护断言，勿随意调换）。
 * ============================================================ */
import './ui/ui-scale.js';   // 全局 UI 缩放：须在首帧渲染前挂 zoom，故先于一切模块
import './core/random.js';
import './core/rules.js';
import './core/mapData.js';
import './core/art.js';
import './core/icons-bitmap.js';
import './audio/sound.js';
import './core/camera.js';
import './core/motion.js';
import './core/input.js';

import './core/event-bus.js';   // 模块间事件总线（批次 5）：须早于战斗/背包的订阅方
import './core/notes.js';
import './cards/cards.js';
import './battle/combat.js';
import './hub/base.js';
import './hub/meta.js';
import './core/render-scheduler.js';
import './core/renderer.fx.js';

import './core/renderer.js';        // 老板留言 #53：对局地图改回原二维面板（停用 3D 场景）；
                               // scene/ 目录已随 2026-09-19 技术清理删除，需要 3D 时从 git 历史找回
import './ui/ui.js';
import './ui/term-tips.js';   // 词条讲解浮框（09-20 老板：特殊词条触摸即讲解）——全局委托
import './core/shared.js';
import './battle/battle-loader.js';
import './run/chests.js';
import './hub/game.storage.js';
import './hub/game.store.js';
import './run/game.session.js';
import './run/game.nest.js';
import './run/game.run.js';
import './hub/game.hub.js';
import './hub/game.bag.js';
import './hub/game.notes.js';
import './hub/game.cardslib.js';
import './game.boot.js';
