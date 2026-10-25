// Battle system controls share the exit/audio icons' optical grid and stroke.
const icon = paths => `<svg class="battle-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
export const battleSettingsIcon = icon('<path d="M4 7h3m6 0h7M4 17h7m6 0h3"/><circle cx="10" cy="7" r="3"/><circle cx="14" cy="17" r="3"/>');
export const battleExitIcon = icon('<path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9M4 12h10M4 12l4-4M4 12l4 4"/>');
export const battleBackIcon = battleExitIcon;
