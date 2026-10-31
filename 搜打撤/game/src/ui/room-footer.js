import '../../css/room-footer.css';

// Trusted, already-rendered controls; commands and persistence stay with the room.
export function roomFooterHTML({ back = '', info = '', actions = '', className = '', tag = 'footer' } = {}) {
  const element = tag === 'div' ? 'div' : 'footer';
  return `<${element} class="room-footer ${className}"><div class="room-footer-back">${back}</div><div class="room-footer-info">${info}</div><div class="room-footer-actions">${actions}</div></${element}>`;
}

const buttonLocks = new WeakMap();
/** @param {Iterable<HTMLButtonElement>} controls */
export function lockRoomButtons(controls) {
  const buttons = [...new Set(controls)];
  for (const button of buttons) {
    let lock = buttonLocks.get(button);
    if (!lock) {
      lock = { depth:0, disabled:button.disabled };
      buttonLocks.set(button, lock);
      button.dataset.roomSaveLocked = lock.disabled ? 'disabled' : 'enabled';
    }
    lock.depth++;
    button.disabled = true;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const button of buttons) {
      const lock = buttonLocks.get(button);
      if (!lock || --lock.depth > 0) continue;
      buttonLocks.delete(button);
      button.disabled = button.hasAttribute('data-room-disabled-after-save') ? button.dataset.roomDisabledAfterSave === 'true' : lock.disabled;
      button.removeAttribute('data-room-disabled-after-save');
      button.removeAttribute('data-room-save-locked');
    }
  };
}

export function beginRoomSave(root, statusHost = null, messageText = '正在保存…') {
  if (!root) return () => {};
  const releaseButtons = lockRoomButtons(root.querySelectorAll('button'));
  root.setAttribute('aria-busy','true');
  const message = document.createElement('span'); message.className='room-saving';message.setAttribute('role','status');message.textContent=messageText;
  (statusHost || root.querySelector('.room-footer-info,.reward-footer-info') || root).append(message);
  return () => {
    root.removeAttribute('aria-busy');message.remove();
    releaseButtons();
    root.querySelectorAll('button[data-room-disabled-after-save]').forEach(button => {
      if (buttonLocks.has(button)) return;
      button.disabled = button.dataset.roomDisabledAfterSave === 'true';
      button.removeAttribute('data-room-disabled-after-save');
      button.removeAttribute('data-room-save-locked');
    });
  };
}
