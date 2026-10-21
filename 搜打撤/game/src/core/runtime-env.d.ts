/** Browser/build globals injected by Vite or attached by the runtime modules. */
interface ImportMetaEnv { readonly DEV: boolean; readonly PROD: boolean; readonly MODE: string; readonly BASE_URL: string; }
interface ImportMeta { readonly env: ImportMetaEnv; readonly hot?: { dispose(callback: () => void): void; }; }
declare const __BUILD_VERSION__: string;
declare const __RUNTIME_ASSET_ALIASES__: Record<string, string>;
declare const process: { env: Record<string, string | undefined> };
declare module '*.css';
interface Window { SDT: RuntimeFacade; webkitAudioContext?: typeof AudioContext; }
interface RuntimeFacade {
  __frameStats?: {updateMs:number,renderMs:number,fps:number,loopTicks:number};
  BattleLoader: typeof import('../battle/battle-loader.js').BattleLoader;
  Runes: typeof import('../battle/runes.js').Runes;
  EffectVerbs: typeof import('../battle/effects/effect-verbs.js').EffectVerbs;
  Battle: typeof import('../battle/view/battle.view.js').Battle;
  Meta: typeof import('../hub/meta.js').Meta;
  Base: typeof import('../hub/base.js').Base;
  Chests: typeof import('../run/chests.js').Chests;
  Nest: typeof import('../run/game.nest.js').Nest;
  UI: typeof import('../ui/ui.js').UI;
  UiScale: typeof import('../ui/ui-scale.js').UiScale;
  Art: typeof import('./art.js').Art;
  Icons: typeof import('./icons-bitmap.js').Icons;
  Input: typeof import('./input.js').Input;
  Motion: typeof import('./motion.js').Motion;
  Notes: typeof import('./notes.js').Notes;
  Sound: typeof import('../audio/sound.js').Sound;
  Cards: typeof import('../cards/cards.js').Cards;
  Camera: typeof import('./camera.js').Camera;
  Renderer: typeof import('./renderer.js').Renderer;
  Agent: typeof import('../agent/agent.js').Agent;
  Bus: typeof import('./event-bus.js').default;
  Random: typeof import('./random.js').Random;
  RenderScheduler: typeof import('./render-scheduler.js').renderScheduler;
  FX: typeof import('./renderer.fx.js').FX;
  MAP: typeof import('./mapData.js').MAP;
  RULES: typeof import('./rules.js').RULES;
  GameStore: typeof import('../hub/game.store.js').GameStore;
  game: typeof import('../run/game.session.kernel.js').game & {debug?:{showBackpack?:()=>void}};
}
interface Navigator { readonly scheduling?: { isInputPending(options?: { includeContinuous?: boolean }): boolean }; }
interface Performance { readonly memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }; }
interface Document { readonly wasDiscarded?: boolean; }
interface HTMLImageElement { __released?: boolean; }
declare module '*.svg?raw' { const source: string; export default source; }
declare module '*.txt?url&no-inline' { const url: string; export default url; }
interface Window {
  __expPocketStrip?: boolean;
  sdtDesktop?: {
    isDesktop: boolean;
    quit(): void;
    appendSuggestion(entry: import('../ui/feedback.local.js').FeedbackEntry): Promise<boolean | {ok:boolean}>;
    readSuggestions(): Promise<{ok:boolean,list:import('../ui/feedback.local.js').FeedbackEntry[]}>;
    deleteSuggestion(ts:string): Promise<boolean | {ok:boolean}>;
  };
}
