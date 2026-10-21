/** Fields attached by battle presenters to their generated HTML containers. */
export interface BattleElement extends HTMLElement {
 _battleToken?: number; _misTimer?: ReturnType<typeof setTimeout>;
 _battleRenderCurrent?: () => boolean;
 _decisionTitle?: string; _sourceUid?: string; _formationPoolKey?: string;
 _secondaryReturnFocus?: HTMLElement; _selectionHTML?: string;
 _battleHtml?: string; _battleTemplate?: BattleElement;
}
