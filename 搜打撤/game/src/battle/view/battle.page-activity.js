// Presentation lifetime only. Domain commands retain all eligibility and cost rules.
export function isInteractiveBattlePage(UI, page) {
  return !!page?.isConnected && !!UI.el?.ovBody?.contains(page) && !UI.el?.overlay?.hidden
    && !UI.el?.overlay?.classList?.contains('closing')
    && !page.closest('[hidden], [inert], [aria-hidden="true"]');
}

export function bindBattlePageAction({ UI, getSnapshot, snapshot }, name, handler, selector = '.battle-decision') {
  const page = UI.el?.ovBody?.querySelector(selector);
  UI.act(name, data => {
    if (!isInteractiveBattlePage(UI, page) || UI.el.ovBody.querySelector(selector) !== page
      || getSnapshot()?.battleToken !== snapshot.battleToken) return;
    return handler(data);
  });
}
