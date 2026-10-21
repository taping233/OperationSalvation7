// Original miniature HUD symbols, scoped to the map tools rather than the global icon set.
const tools = {
  bag:new URL('../../assets/ui/map-tools-1021/bag-v2.webp',import.meta.url).href,
  safe:new URL('../../assets/ui/map-tools-1021/safe-v2.webp',import.meta.url).href,
  pocket:new URL('../../assets/ui/map-tools-1021/pocket-v2.webp',import.meta.url).href,
  focus:new URL('../../assets/ui/map-tools-1021/focus-v2.webp',import.meta.url).href,
  overview:new URL('../../assets/ui/map-tools-1021/overview-v2.webp',import.meta.url).href,
};

export function expeditionToolArt(tool) {
  return `<img class="expedition-tool-art" src="${tools[tool]}" alt="" aria-hidden="true" draggable="false">`;
}
