// Transparent, code-native diagrams: short facts, not simulated game screenshots.
export function bossPreparationHTML() {
  return '<p><b>深入前练习防御：</b>先看敌方下一步意图；对方要攻击时，留能量使用护甲、护盾或格挡，别把所有牌都换成伤害。</p><p><b>遇到减伤先查词缀：</b>破甲可使目标的格挡、护盾、护甲与元素庇幕失效；部分破甲牌有流血等前提，先看卡牌规则再安排出牌顺序。普通战可先练习，首脑前补给并保留关键牌。</p>';
}
const icons = {
  archive: '<path d="M6 9h32v29H6zM4 4h36v7H4zM16 19h12M17 27h10"/>',
  mode: '<path d="M7 12h30M7 23h30M7 34h30M16 7v10M29 18v10M18 29v10"/>',
  bag: '<path d="M9 14h26v25H9zM16 14V8h12v6M16 24h12M22 24v8"/>',
  person: '<circle cx="22" cy="12" r="7"/><path d="M8 39v-7a14 14 0 0 1 28 0v7"/>',
  map: '<path d="m4 10 12-5 12 5 12-5v30l-12 5-12-5-12 5zM16 5v30M28 10v30"/>',
  shop: '<path d="M8 19v20h28V19M4 19l5-12h26l5 12zM16 39V26h12v13"/>',
  fire: '<path d="M23 3c5 10-1 12 6 18 1-5 4-6 5-7 5 13 5 25-12 27C6 39 6 26 15 17c-1 9 2 10 4 10-4-9 5-12 4-24z"/>',
  door: '<path d="M9 39V5h26v34M18 24h4M4 39h36"/>',
  eye: '<path d="M3 22c10-16 28-16 38 0-10 16-28 16-38 0z"/><circle cx="22" cy="22" r="6"/>',
  energy: '<path d="m25 3-16 23h12l-2 15 16-24H23z"/>',
  target: '<circle cx="22" cy="22" r="14"/><circle cx="22" cy="22" r="6"/><path d="M22 3v7M22 34v7M3 22h7M34 22h7"/>',
  card: '<path d="M10 5h24v34H10zM16 13h12M16 21h12M16 29h8"/>',
  shield: '<path d="m22 4 15 6v11c0 10-7 16-15 20C14 37 7 31 7 21V10zM15 23l5 5 10-13"/>',
  restore: '<path d="M8 17a15 15 0 1 1 0 13M8 5v12h12M22 13v10l7 5"/>',
  chest: '<path d="M6 18h32v20H6zM6 18V9h32v9M6 24h32M18 20h8v8h-8z"/>',
  trophy: '<path d="M12 5h20v13a10 10 0 0 1-20 0zM12 9H5v8a9 9 0 0 0 9 9M32 9h7v8a9 9 0 0 1-9 9M22 28v10M13 39h18"/>',
};

const diagrams = {
  prepare: [
    ['archive', '独立档位', '基地与对局各自保存'], ['mode', '两种模式', '正常入城 / 直入敌腹'],
    ['person', '选择人物', '整备前确认本局人物'], ['bag', '整备行囊', '选择卡牌后确认出发'],
  ],
  map: [
    ['map', '相邻前进', '沿连线选择下一格'], ['shop', '补给站', '购买卡牌与补给'],
    ['fire', '火堆', '休整与部分复原'], ['door', '层间门', '深入后不能回头'],
  ],
  battle: [
    ['eye', '敌方意图', '先决定怎么应对'], ['energy', '基础能量', '每回合 2 点'],
    ['target', '选择目标', '指向牌拖到目标'], ['card', '效果抽牌', '5张初始攻击库，不自动抽牌'],
  ],
  loot: [
    ['chest', '密封物资箱', '三张奖励选一张'], ['bag', '背包', '留出领取奖励的空位'],
    ['shield', '宠物安全格', '失败时保留符合条件的牌'], ['restore', '消耗区', '复原后才能再用'],
  ],
  extract: [
    ['door', '第三层：紧急撤离', '提前带回剩余收获'], ['trophy', '第四层：终局撤离', '击败首脑后前往终点'],
    ['card', '献祭 3 张卡牌', '从背包支付撤离代价'], ['target', '祭坛 → 首脑', '先激活祭坛，再挑战'],
  ],
  growth: [
    ['archive', '使用材料卡', '折成基地储备'], ['bag', '扩建容量', '背包与宠物安全格'],
    ['restore', '复原卡牌', '花钥匙取回消耗卡'], ['trophy', '收藏职业卡', '消耗卡牌，增加熟练度'],
  ],
};

export function beginnerGuideDiagram(id) {
  const items = diagrams[id];
  if (!items) return '';
  const tiles = items.map(([icon, title, note], index) => {
    const x = index % 2 ? 292 : 18;
    const y = index < 2 ? 20 : 222;
    const titleSize = title.length > 8 ? 19 : 23;
    return `<g transform="translate(${x} ${y})">
      <path d="M0 0h231l17 17v147H0z" fill="#e4ebe5" stroke="#91a7a7" stroke-width="1.5"/>
      <path d="M0 0h36" stroke="#b59c65" stroke-width="4"/>
      <g transform="translate(20 19)" fill="none" stroke="#31515e" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${icons[icon]}</g>
      <text x="20" y="96" fill="#1b3442" font-size="${titleSize}" font-weight="700">${title}</text>
      <text x="20" y="128" fill="#586c77" font-size="17">${note}</text>
    </g>`;
  }).join('');
  return `<svg class="bg-guide-diagram" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 410" role="img" aria-label="机制速览图示" font-family="HarmonyOS Sans SC, Microsoft YaHei, sans-serif">${tiles}</svg>`;
}
