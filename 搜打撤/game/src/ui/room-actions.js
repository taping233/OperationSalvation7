// One rendered room owns its callbacks. The room supplies its live-source and
// busy checks; transaction commands still validate the resources at commit.
export function createRoomActions(UI, current, { emptyData = false } = {}) {
  return (name, handler) => UI.act(name, data => {
    if (current()) return handler(emptyData ? data || {} : data);
  });
}
