// 基地与照相馆共用的轻量取消仲裁，不持有游戏/档案状态，也不导入页面实现。
const entries = new Map();

export function cancelPendingPageEntries(exceptOwner) {
  let consumed = false;
  for (const [owner, cancel] of [...entries]) {
    if (owner !== exceptOwner) consumed = cancel() || consumed;
  }
  return consumed;
}

export function beginPageEntryCancellation(owner, cancel) {
  cancelPendingPageEntries(owner);
  entries.set(owner, cancel);
}

export function releasePageEntryCancellation(owner, cancel) {
  if (entries.get(owner) === cancel) entries.delete(owner);
}
