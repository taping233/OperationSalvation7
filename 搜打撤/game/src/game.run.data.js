/* 行军场景、事件与职业叙事的只读授权数据。 */
/* 纯数据外置 game/data/scenes.json（2026-09-11 架构批次 2：中央数据源）；
   PRELOAD_SCENES 依赖 import.meta.url 的资源 URL 解析、IMMEDIATE_SCENES 是 Set，
   二者留在代码中组装。 */
import { DATA } from './data-loader.js';
import { STARTUP_SCENE_KEYS } from './performance-budgets.js';

const SCENES = DATA.scenes.scenes;
const SCENE_META = DATA.scenes.sceneMeta;
const EVENT_SCENE_META = DATA.scenes.eventSceneMeta;
const NODE_BG = DATA.scenes.nodeBg;
const PICKUP_BG = DATA.scenes.pickupBg;
const CLASS_STORY = DATA.scenes.classStory;
  const PRELOAD_SCENES = Object.freeze({
    battle: new URL('../assets/scenes/battle-normal-anime-v2.webp', import.meta.url).href,
    // 三首脑底图挂载槽（迭代评审 09-20 美术岗 D-P2）：专属底图排产中，先挂 anime-v2 同图占位——
    // 底图就位后只改这三个 URL 即接管，css/scenes.css 的 per-boss tint 差分同步保留；
    // 与 altar 同属路线内场景，不进 STARTUP_SCENE_KEYS（启动带宽零冲击）
    bossGeneral: new URL('../assets/scenes/battle-normal-anime-v2.webp', import.meta.url).href,
    bossOrc: new URL('../assets/scenes/battle-normal-anime-v2.webp', import.meta.url).href,
    bossElement: new URL('../assets/scenes/battle-normal-anime-v2.webp', import.meta.url).href,
    coin: new URL('../assets/scenes/scene-pickup-coin-anime-v2.webp', import.meta.url).href,
    wood: new URL('../assets/scenes/scene-pickup-wood-anime-v2.webp', import.meta.url).href,
    rations: new URL('../assets/scenes/scene-pickup-rations-anime-v2.webp', import.meta.url).href,
    key: new URL('../assets/scenes/scene-pickup-key-anime-v2.webp', import.meta.url).href,
    fire: new URL('../assets/scenes/scene-fire-anime-v2.webp', import.meta.url).href,
    shop: new URL('../assets/scenes/scene-shop-anime-v2.webp', import.meta.url).href,
    emergencyExit: new URL('../assets/scenes/scene-extract-anime-v2.webp', import.meta.url).href,
    door: new URL('../assets/scenes/scene-door-anime-v2.webp', import.meta.url).href,
    altar: new URL('../assets/scenes/scene-altar-anime-v2.webp', import.meta.url).href,
    // 事件/宝箱整页（nodeShell）背景：与 css/scenes.css 里 scene-event-bg / scene-chest-bg 同图，
    // 不预载的话打开页面时 CSS background-image 才发请求，大图期间整页近乎黑屏。
    // 2026-09-10 留言 #18：事件通用底图换为独立事件场景图（不再与祭坛共用）；轮换图 a/b/c 在此一并预载
    event: new URL('../assets/scenes/event-tt6-mystery.webp', import.meta.url).href,
    eventB: new URL('../assets/scenes/event-tt6-airdrop.webp', import.meta.url).href,
    eventC: new URL('../assets/scenes/event-tt6-relief.webp', import.meta.url).href,
    chest: new URL('../assets/scenes/scene-chest-anime-v2.webp', import.meta.url).href,
  });
  const IMMEDIATE_SCENES = new Set(STARTUP_SCENE_KEYS);

Object.freeze(SCENES);
Object.freeze(SCENE_META);
Object.freeze(EVENT_SCENE_META);
Object.freeze(CLASS_STORY);

export { CLASS_STORY, EVENT_SCENE_META, IMMEDIATE_SCENES, NODE_BG, PICKUP_BG, PRELOAD_SCENES, SCENES, SCENE_META };
