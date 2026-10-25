import '../../css/room-footer.css';

// Trusted, already-rendered controls; commands and persistence stay with the room.
export function roomFooterHTML({ back = '', info = '', actions = '', className = '', tag = 'footer' } = {}) {
  const element = tag === 'div' ? 'div' : 'footer';
  return `<${element} class="room-footer ${className}"><div class="room-footer-back">${back}</div><div class="room-footer-info">${info}</div><div class="room-footer-actions">${actions}</div></${element}>`;
}

export function beginRoomSave(root) {
  if (!root) return () => {};
  const buttons = [...root.querySelectorAll('button')].map(button => [button, button.disabled]);
  root.setAttribute('aria-busy','true');
  for (const [button] of buttons) button.disabled = true;
  const message = document.createElement('span'); message.className='room-saving';message.setAttribute('role','status');message.textContent='正在保存…';
  (root.querySelector('.room-footer-info,.reward-footer-info') || root).append(message);
  return () => {
    root.removeAttribute('aria-busy');message.remove();
    for (const [button, disabled] of buttons) if (button.isConnected) {
      button.disabled=button.hasAttribute('data-room-disabled-after-save') ? button.dataset.roomDisabledAfterSave === 'true' : disabled;
      button.removeAttribute('data-room-disabled-after-save');
    }
    root.querySelectorAll('[data-room-disabled-after-save]').forEach(button => button.removeAttribute('data-room-disabled-after-save'));
  };
}
