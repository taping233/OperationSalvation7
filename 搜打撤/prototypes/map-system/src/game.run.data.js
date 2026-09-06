/* 行军场景、事件与职业叙事的只读授权数据。 */
const SCENES = {
    battle: { icon: '[[icon:swords]]', title: '遭遇战', tone: 'battle', btn: '应 战',
      lines: ['{name}从废墟的阴影中逼近，战斗一触即发！', '脚步声戛然而止——{name}发现了你！',
        '「这片废土是我的猎场。」{name}拦住了去路。', '沙尘翻涌，{name}的轮廓自辐射尘雾中缓缓显形……'] },
    shop: { icon: '[[icon:bag]]', title: '拾荒商队', tone: 'shop', btn: '看看货品',
      lines: ['帆布帐篷下传来砂轮磨刀的声响：「哟，医疗队的稀客！以物易物，童叟无欺。」',
        '商队头目掀开防水布：「旧世界的玩意儿，能换你兜里的币就归你。」'] },
    event: { icon: '[[icon:question]]', title: '奇遇', tone: 'event', btn: '一探究竟',
      lines: ['盖革计数器忽然轻颤，空气里有种说不出的味道……', '脚下的碎砖微微震颤，荒土深处似有目光落在你身上。'] },
    fire: { icon: '[[icon:fire]]', title: '营火休整', tone: 'fire', btn: '坐下歇脚',
      lines: ['废料燃起的篝火噼啪作响，暖意顺着指尖爬了上来。', '有人刚离开不久——灭火的沙土还是新的。'] },
    chest: { icon: '[[icon:archive]]', title: '遗留物资', tone: 'chest', btn: '撬开柜子',
      lines: ['瓦砾半掩着一只落满灰尘的保险柜，锁扣早已锈蚀……', '物资箱的缝隙里透出微光——运气不错。'] },
    coin: { icon: '[[icon:coin]]', title: '拾获', tone: 'pick', auto: true,
      lines: ['路边的瓦砾堆里，有什么东西闪了一下。', '「叮」——一枚旧世界硬币从锈铁皮里滚了出来。'] },
    wood: { icon: '[[icon:wood]]', title: '拾获', tone: 'pick', auto: true,
      lines: ['一根还没被白蚁蛀空的建材斜靠在断墙边，正好能用上。'] },
    rations: { icon: '[[icon:bread]]', title: '拾获', tone: 'pick', auto: true,
      lines: ['压扁的背囊里，居然还有未开封的应急口粮！'] },
    key: { icon: '[[icon:key]]', title: '拾获', tone: 'pick', auto: true,
      lines: ['一把泛着幽光的钥匙躺在碎石缝里——它能打开哪扇门？'] },
    door: { icon: '[[icon:door]]', title: '隔离闸门', tone: 'door', btn: '靠 近',
      lines: ['厚重的隔离闸门无声地滑开，另一侧的光影陌生而深邃。'] },
    altar: { icon: '[[icon:crystal]]', title: '污染核心', tone: 'altar', btn: '深入污染区',
      lines: ['裂谷尽头，紫色的辐射结晶在黑暗中明灭，空气凝重得令人窒息……'] },
    exit: { icon: '[[icon:exit]]', title: '撤离点', tone: 'exit', btn: '前往撤离点',
      lines: ['一枚信号弹拖着尾烟升上天空——营地的回收队就在眼前！'] },
  };
  // 场景契约：assetKey 由美术/CSS 代理消费；本层只保证稳定 ID、容器 class 与 data 属性。
  const SCENE_META = {
    battle: ['battle', 'scene-battle', 'scene-battle-bg'], shop: ['shop', 'scene-shop', 'scene-shop-bg'],
    event: ['event', 'scene-event', 'scene-event-bg'], fire: ['fire', 'scene-fire', 'scene-fire-bg'],
    chest: ['chest', 'scene-chest', 'scene-chest-bg'], door: ['door', 'scene-door', 'scene-door-bg'],
    altar: ['altar', 'scene-altar', 'scene-altar-bg'], exit: ['extract', 'scene-extract', 'scene-extract-bg'],
    coin: ['pickup-coin', 'scene-pickup scene-pickup-coin', 'scene-pickup-coin'], wood: ['pickup-wood', 'scene-pickup scene-pickup-wood', 'scene-pickup-wood'],
    rations: ['pickup-rations', 'scene-pickup scene-pickup-rations', 'scene-pickup-rations'], key: ['pickup-key', 'scene-pickup scene-pickup-key', 'scene-pickup-key'],
  };
  const EVENT_SCENE_META = {
    'tt6-timeskip': ['event-timeskip', 'scene-event-timeskip', 'scene-event-timeskip'], 'tt6-demondeal': ['event-demondeal', 'scene-event-demondeal', 'scene-event-demondeal'],
    'tt6-bandits': ['event-bandits', 'scene-event-bandits', 'scene-event-bandits'], 'tt6-mystery': ['event-mystery', 'scene-event-mystery', 'scene-event-mystery'],
    'tt6-goldmine': ['event-goldmine', 'scene-event-goldmine', 'scene-event-goldmine'], 'tt6-goldhammer': ['event-goldhammer', 'scene-event-goldhammer', 'scene-event-goldhammer'],
    'tt6-relief': ['event-relief', 'scene-event-relief', 'scene-event-relief'], 'tt6-airdrop': ['event-airdrop', 'scene-event-airdrop', 'scene-event-airdrop'],
    'tt6-chestdraw': ['event-chestdraw', 'scene-event-chestdraw', 'scene-event-chestdraw'], 'tt6-systemsupply': ['event-systemsupply', 'scene-event-systemsupply', 'scene-event-systemsupply'],
  };
  const PRELOAD_SCENES = Object.freeze({
    battle: new URL('../assets/scenes/battle-normal-anime-v2.webp', import.meta.url).href,
    coin: new URL('../assets/scenes/scene-pickup-coin-anime-v2.webp', import.meta.url).href,
    wood: new URL('../assets/scenes/scene-pickup-wood-anime-v2.webp', import.meta.url).href,
    rations: new URL('../assets/scenes/scene-pickup-rations-anime-v2.webp', import.meta.url).href,
    key: new URL('../assets/scenes/scene-pickup-key-anime-v2.webp', import.meta.url).href,
    fire: new URL('../assets/scenes/scene-fire-anime-v2.webp', import.meta.url).href,
    shop: new URL('../assets/scenes/scene-shop-anime-v2.webp', import.meta.url).href,
    emergencyExit: new URL('../assets/scenes/scene-extract-anime-v2.webp', import.meta.url).href,
    door: new URL('../assets/scenes/scene-door-anime-v2.webp', import.meta.url).href,
    altar: new URL('../assets/scenes/scene-altar-anime-v2.webp', import.meta.url).href,
  });
  const IMMEDIATE_SCENES = new Set(['battle', 'coin', 'wood', 'rations', 'key', 'fire']);

const NODE_BG = { door: 'scene-door-bg', altar: 'scene-altar-bg', fire: 'scene-fire-bg',
    exit: 'scene-extract-bg', shop: 'scene-shop-bg', event: 'scene-event-bg' };

const PICKUP_BG = { coin: 'scene-pickup-coin', wood: 'scene-pickup-wood',
    rations: 'scene-pickup-rations', key: 'scene-pickup-key' };

const CLASS_STORY = {
    '刺客': {
      tag: '暗巷收刀人',
      bg: '旧城暗巷里最安静的影子，靠一柄短刃替商行"处理麻烦"。没人见过他出刀，只见过结果。',
      task: '潜入最深处的宝库，取回"无面者"的封印钥匙，并在追兵合围前活着撤离。',
    },
    '剑客': {
      tag: '独行的佩剑客',
      bg: '背一柄旧剑走遍十六州，只为找回被师兄带走的那半卷剑谱。剑出鞘时，从不问对方有多少人。',
      task: '循剑谱残页的线索深入遗迹，在藏经阁取得完整剑谱，带剑撤离。',
    },
    '术士': {
      tag: '禁咒的继承者',
      bg: '被学院除名的天才，因钻研禁忌咒文而被通缉。诅咒在他左臂上生长，也给他力量。',
      task: '找到先代术士的祭坛，用一场完整的禁咒仪式压制左臂的诅咒，并夺走祭坛上的秘宝。',
    },
    '法师': {
      tag: '星图测绘员',
      bg: '皇家学院的首席测绘师，毕生绘制"活动地脉"的星图。她相信宝藏的位置写在星星的偏移里。',
      task: '在遗迹深处架设三座测星仪，校准星图并回收古代魔导核心，天亮前撤离。',
    },
    '牧师': {
      tag: '灰袍巡回者',
      bg: '不属于任何教团的灰袍修士，为战乱之地的伤者包扎，也为亡者祷告。他背囊里永远有一格留给别人的药。',
      task: '护送遇险商队余部穿过战区，在圣祠取得愈合金像，全员撤离。',
    },
    '授印者': {
      tag: '守印一族的末裔',
      bg: '古老守印家族的最后一人，掌心生来就有一枚会发烫的封印。家族遗产是责任，也是追杀令。',
      task: '找回被夺走的家族印玺，在封印之地重新落印，将追猎者甩在门后。',
    },
    '降临者': {
      tag: '自云上而来',
      bg: '从没人见过他落地的那一刻——他只是某天出现在坍塌的神殿里，衣角还带着云上的风。他自己也不记得来处。',
      task: '循着本能的指引收拢散落的"天界残片"，在身体被这个世界同化之前离开。',
    },
    '召唤师': {
      tag: '灵契商行的少东家',
      bg: '灵契商行的继承人，能和见过的任何生灵签订临时契约。商行破产了，剩下的只有一柜子契约书。',
      task: '用最后的契约书召回祖辈封存的灵体，护送商行金库余货出境变卖，重振家业。',
    },
    '守卫': {
      tag: '不退的老门卫',
      bg: '为旧王陵守了三十年门的退伍老兵，王陵封了，他没走。他守的从来不是门，是门后的人。',
      task: '在王陵坍塌前护送考古队撤离，顺手把三十年来欠他的那份抚恤金从陵库里"领"回来。',
    },
    '游侠': {
      tag: '风语斥候',
      bg: '在边荒靠给商队带路为生的斥候，认得每一处水源和每一张兽皮下的陷阱。风改变方向时，她比风先知道。',
      task: '抢先在佣兵团之前标定宝藏坐标，布下陷阱迟滞追兵，携带测绘图撤离。',
    },
    '战士': {
      tag: '佣兵团老团长',
      bg: '解散前的"铁砧佣兵团"团长，打过所有能叫上名字的仗。如今兵团只剩他一个人和一面团旗。',
      task: '接下悬赏最高的委托，正面击破盘踞遗迹的匪帮，把团旗插在宝藏堆上再撤离。',
    },
  };

Object.freeze(SCENES);
Object.freeze(SCENE_META);
Object.freeze(EVENT_SCENE_META);
Object.freeze(CLASS_STORY);

export { CLASS_STORY, EVENT_SCENE_META, IMMEDIATE_SCENES, NODE_BG, PICKUP_BG, PRELOAD_SCENES, SCENES, SCENE_META };
