/* ============================================================
 * main.js —— ESM 唯一入口
 *
 * 装配全部生产页面模块；HTML 与启动集成测试共同加载本入口。
 * 首页、游戏内核与启动展示沿用原 HTML 的模块求值顺序。
 * 模块间依赖由各文件顶部的 import 显式声明（见 scripts/esm-convert.mjs）。
 * MAP/FX 等内核依赖由 ESM 直接声明；其余兼容页面仍按下列顺序装配。
 * 入口清单须与 boot-order.js 的独立 BOOT_ORDER 合同一致
 * （tests/contracts.test.js 有守护断言，勿随意调换）。
 * ============================================================ */
import './ui/title-credits.js';
import './ui/title-wallpaper.js';
import './ui/ui-scale.js';   // 全局 UI 缩放：须在游戏首帧渲染前挂 zoom
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
import './battle/core/combat.js';
import './hub/base.js';
import './hub/meta.js';
import './core/render-scheduler.js';
import './core/renderer.fx.js';

import './core/renderer.js';        // 老板留言 #53：对局地图改回原二维面板（停用 3D 场景）；
                               // scene/ 目录已随 2026-09-19 技术清理删除，需要 3D 时从 git 历史找回
import './ui/ui.js';
import './ui/term-tips.js';   // 词条讲解浮框（09-20 老板：特殊词条触摸即讲解）——全局委托
import './ui/character-idle.js';   // 选人页五人待机演出（自挂载：监听 sdt-overlay-mode，不侵入 altar 渲染）
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
import './ui/startup-transition.js';
import './ui/cover-context.js';
