// Destination identity is shared by gates, route travel and the review page.
const profiles = [
  { art:new URL('../../assets/scenes/cinematic/layer-descent-v1.webp',import.meta.url).href, motion:'layer-descent' },
  { art:new URL('../../assets/scenes/cinematic/layer-watchline-v2.webp',import.meta.url).href, motion:'layer-watchline' },
  { art:new URL('../../assets/scenes/cinematic/layer-ruins-v2.webp',import.meta.url).href, motion:'layer-ruins' },
  { art:new URL('../../assets/scenes/cinematic/layer-core-v2.webp',import.meta.url).href, motion:'layer-core' },
];
export function layerPassageProfile(to) {
  return profiles[to] || profiles[0];
}
