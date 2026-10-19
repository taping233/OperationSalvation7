// Fixture-only events: no game state, storage, asset downloads or commands.
const output = document.querySelector('#reviewResult');
for (const button of document.querySelectorAll('button')) {
  button.addEventListener('click', () => {
    if (button.disabled) return;
    if (button.hasAttribute('data-review-toggle')) {
      const selected = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(selected));
      button.querySelector('b').textContent = (selected ? '已选' : '未选') + '：保留当前装备';
    }
    output.textContent = '样例已激活：' + button.textContent.trim();
  });
}
