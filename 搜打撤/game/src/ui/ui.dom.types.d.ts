/** Properties installed on generated UI containers by the owning presenter. */
export interface UIElement extends HTMLElement { _scrHiding?: boolean; _openToken?: symbol; _inventoryActions?: object; }
export interface CardZoomElement extends HTMLDivElement {
 _closeCardZoom?: (immediate?: boolean) => void;
 _refreshCardZoomBrowse?: () => void;
}

export interface CardZoomOptions {
 items?: import('../hub/game.store.types.js').CardSnapshot[]; index?: number;
 getItems?: () => import('../hub/game.store.types.js').CardSnapshot[];
 getIndex?: () => number;
 canNavigate?: () => boolean;
 onReopen?: () => void | boolean;
 optionsForItem?: (card: import('../hub/game.store.types.js').CardSnapshot, index: number) => CardZoomOptions;
 onBrowse?: (card: import('../hub/game.store.types.js').CardSnapshot, index: number) => void;
 referenceTrail?: {card: import('../hub/game.store.types.js').CardSnapshot, options: CardZoomOptions}[];
 returnFocus?: HTMLElement; descriptionRenderer?: ReturnType<typeof import('../cards/card-description-links.js').createCardDescriptionRenderer>;
 descriptionQuery?: string; note?: string; noteLabel?: string; notePlaceholder?: string; hideNote?: boolean;
 noteEditable?: boolean; notePending?: boolean; onNoteSave?: (note: string) => boolean | {ok?: boolean, persisted?: boolean};
 presentation?: string; photoMotion?: string; photoNumber?: string | number; footer?: string;
 from?: Element | (DOMRect & {querySelector?: never; isConnected?: never; getClientRects?: never; getBoundingClientRect?: never});
 createReferenceOptions?: (card: import('../hub/game.store.types.js').CardSnapshot) => CardZoomOptions;
}

export interface UIElements {
 statTurn: HTMLElement | null;
 statValue: HTMLElement | null;
 hpBar: HTMLElement | null;
 hpBarWrap: HTMLElement | null;
 hpText: HTMLElement | null;
 charCoins: HTMLElement | null;
 charAtk: HTMLElement | null;
 heroAva: HTMLElement | null;
 log: HTMLElement | null;
 logPanel: HTMLElement | null;
 overlay: HTMLElement | null;
 ovTitle: HTMLElement | null;
 ovBody: HTMLElement | null;
 ovCloseX: HTMLElement | null;
 tooltip: HTMLElement | null;
 tglIndex: HTMLInputElement | null;
 btnExport: HTMLElement | null;
 btnImport: HTMLElement | null;
 btnClear: HTMLElement | null;
 devTools: HTMLElement | null;
 devBattle: HTMLElement | null;
 devBoss: HTMLElement | null;
 titleDev: HTMLElement | null;
 btnCardDesigner: HTMLElement | null;
 btnCardLib: HTMLElement | null;
 viewport: HTMLElement | null;
 layerZh: HTMLElement | null;
 layerEn: HTMLElement | null;
}

/** Lazy mixin fields are absent before their owning presenter installs them. */
export type UILazyState = Partial<Pick<import('./hud.js').HudThis, '_lastMode' | '_lastBannerLayer' | '_lastTurn' | '_lastValue' | '_lastHpKey' | '_lastCoins' | '_lastAtk' | '_lastHeroCls'>> & {
 _inputHandler?: (event: Event) => void; _hoverHandler?: (event: MouseEvent) => void;
 _hideTimer?: number; _overlayRevision?: number; _motionHeading?: string; _motionKey?: string;
 _motionExitDuration?: number; _pageBgReady?: Promise<unknown>; _hasBattleStage?: () => boolean;
 _releaseScreenOwner?: () => void;
 _finishHide?: (() => void) | null;
 _retrySave?: () => unknown;
};
export type MountedHudMethods = { [K in keyof typeof import('./hud.js').hudMethods]: OmitThisParameter<(typeof import('./hud.js').hudMethods)[K]> };
