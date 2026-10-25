// One source for symbolic artwork, palette and playback rhythm. Scene owners
// still own preparation, input, cancellation and when a transition may finish.
const art = {
  city:new URL('../../assets/scenes/departure/city-reflection-v1.webp',import.meta.url).href,
  battle:new URL('../../assets/scenes/departure/battle-incision-v1.webp',import.meta.url).href,
  boss:new URL('../../assets/scenes/departure/boss-monolith-v1.webp',import.meta.url).href,
  extraction:new URL('../../assets/scenes/departure/extraction-seam-v1.webp',import.meta.url).href,
  camp:new URL('../../assets/scenes/cinematic/camp-shelter-v1.webp',import.meta.url).href,
  photo:new URL('../../assets/scenes/cinematic/photo-plates-v1.webp',import.meta.url).href,
  archive:new URL('../../assets/scenes/cinematic/archive-leaves-v1.webp',import.meta.url).href,
  gate:new URL('../../assets/scenes/cinematic/gate-cleft-v1.webp',import.meta.url).href,
  shop:new URL('../../assets/scenes/cinematic/trade-pair-v1.webp',import.meta.url).href,
  event:new URL('../../assets/scenes/cinematic/event-fold-v1.webp',import.meta.url).href,
  altar:new URL('../../assets/scenes/cinematic/altar-fracture-v1.webp',import.meta.url).href,
};
const dark='#090b0d', light='#e8e5dd';
export const CINEMATIC_PROFILES = Object.freeze({
  departure:{art:art.city,renderer:'image',duration:2400,label:'入城',background:dark,motion:'reflection',exit:'iris',exitDuration:420},
  field:{art:art.city,renderer:'procedural',duration:260,label:'进入地图',background:dark,motion:'aperture',exit:'iris',exitDuration:260},
  resume:{art:art.city,renderer:'procedural',duration:300,label:'继续对局',background:dark,motion:'scan',exit:'fade',exitDuration:180},
  loading:{art:art.event,renderer:'procedural',duration:360,label:'准备画面',background:dark,motion:'breath',exit:'fade',exitDuration:420},
  camp:{art:art.camp,renderer:'image',duration:800,label:'返回基地',background:dark,motion:'shelter',exit:'gate',exitDuration:300},
  photo:{art:art.photo,renderer:'image',duration:1100,label:'影像收藏',background:light,motion:'develop',exit:'fade',exitDuration:280},
  achievement:{art:art.archive,renderer:'image',duration:850,label:'收藏档案',background:dark,motion:'raking-light',exit:'slide',exitDuration:240},
  door:{art:art.gate,renderer:'procedural',duration:420,label:'抵达闸门',background:dark,motion:'threshold',exit:'gate',exitDuration:320},
  passage:{art:art.gate,renderer:'procedural',duration:400,label:'跨层通行',background:dark,motion:'threshold',exit:'gate',exitDuration:300},
  shop:{art:art.shop,renderer:'procedural',duration:460,label:'进入交易',background:dark,motion:'glide',exit:'fade',exitDuration:420},
  event:{art:art.event,renderer:'procedural',duration:520,label:'发现见闻',background:dark,motion:'unveil',exit:'fade',exitDuration:420},
  altar:{art:art.altar,renderer:'image',duration:820,label:'进入污染区域',background:dark,motion:'disturb',exit:'slash',exitDuration:260},
  emergencyExit:{art:art.extraction,renderer:'procedural',duration:360,label:'抵达撤离点',background:dark,motion:'beacon',exit:'fade',exitDuration:180},
  retreat:{art:art.battle,renderer:'procedural',duration:320,label:'撤退',background:dark,motion:'recede',exit:'slide',exitDuration:220},
  extraction:{art:art.extraction,renderer:'procedural',duration:1400,label:'撤离成功',background:light,motion:'release',exit:'lift',exitDuration:360},
  battle:{art:art.battle,renderer:'procedural',duration:300,label:'进入战斗',background:dark,motion:'stroke',exit:'slash',exitDuration:220},
  boss:{art:art.boss,renderer:'image',duration:1500,label:'首脑登场',background:dark,motion:'pressure',exit:'fade',exitDuration:320},
});
export function cinematicProfile(kind='loading') {
  return CINEMATIC_PROFILES[kind] || CINEMATIC_PROFILES.loading;
}
export function cinematicKind({scene='',tone='',presentation=''}={}) {
  if (scene && Object.hasOwn(CINEMATIC_PROFILES,scene)) return scene;
  if (presentation==='base-arrival') return 'camp';
  if (tone==='exit') return 'emergencyExit';
  return Object.hasOwn(CINEMATIC_PROFILES,tone) ? tone : 'loading';
}
