const icons = {
  home:'M2 10 12 2l10 8v12h-7v-8H9v8H2V10Zm3 1v8h2v-7h10v7h2v-8l-7-5-7 5Z',
  deploy:'M2 5 9 2l6 3 7-3v17l-7 3-6-3-7 3V5Zm3 2v10l3-1V6L5 7Zm11 1v10l3-1V7l-3 1Zm-6 1v3h4l-2-2 2-2 5 5-5 5-2-2 2-2h-4v3l-3-4 3-4Z',
  classes:'M9 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM9 12c-4 0-7 3-7 7v3h14v-3c0-4-3-7-7-7Zm8 0h-1a9 9 0 0 1 3 7v3h4v-4c0-3-2-6-6-6Z',
  stash:'M2 3h20v5H2V3Zm2 7h16v12H4V10Zm4 3v3h8v-3H8Z',
  shop:'M7 3h10v4h5l-5 6H7l-5-6h5V3Zm1 2v2h8V5H8Zm-6 12 5-4v3h10v-3l5 4-5 4v-3H7v3l-5-4Z',
  ach:'M3 3h8v18H3V3Zm10 0h8v18h-8V3Zm-7 4v2h2V7H6Zm0 5v2h2v-2H6Zm10-6-1 3-3 1 3 1 1 3 1-3 3-1-3-1-1-3Zm-1 10v2h4v-2h-4Z',
  upgrade:'M21 3a7 7 0 0 0-9 9L2 21l3 3 10-10a7 7 0 0 0 9-9l-5 5-4-4 6-3ZM5 19a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
  courtyard:'M22 2C8 2 2 7 2 14a8 8 0 0 0 8 8c8 0 12-8 12-20ZM6 19l-2-2L16 5l2 2L6 19Z',
};
export function baseHomeIconV10(id) {
  return `<svg class="base-home-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="${icons[id] || icons.stash}"/></svg>`;
}
