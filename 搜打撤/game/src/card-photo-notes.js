const AUTHORED_NOTES = Object.freeze({
  'cc-chase-slash': '快门只捕到了刀光。拍摄者坚持，那天现场明明没有人拔刀。',
  'cc-cursed-blade': '背签上原有一行名字，后来变成了五道很深的刮痕。库管说，这就算完成交接了。',
  'cc-last-stand': '最后一张底片洗出来时，照片里的人仍然站着。现场记录不同意。',
  'cc-mana-surge': '暗房停电七分钟。就在那七分钟里，这张底片自己完成了显影。',
  'cmtn79743r2n': '冲洗记录：曝光时间为零。拍摄地点为「门后」。档案室里没人知道那扇门在哪里。',
  'cmtn7err0a7': '照片上的光源不属于任何已知天体。把它倒过来看，还是一扇门。',
  'pet-egg': '共有十三人声称听见蛋壳里有爪子挠门。第十四人问：「你们确定那是爪子？」',
  'tt-keys-bunch': '两把钥匙都打不开避难所的门。但每到凌晨三点，它们会同时变热。',
  'tt3-savior-elixir': '药瓶标签被人撕走了。瓶底留着一句小字：「救你的不一定希望你活下来。」',
  'tt8-abyss-sovereign': '本照片被要求面朝墙壁收藏。理由不明。违反过两次，馆内便多了两位参观者。',
  'tt8-hero-mage': '这不是狂语，只是某个真相在练习怎么把自己说得像个笑话。',
  'tt8-hero-sealer': '盖章人在「已回收」和「从未存在」之间犹豫了很久，最后把两个章都盖了上去。',
  'tt8-hero-summoner': '花只开了一次。但相纸上的另一朵，每次查看都比上次更新鲜。',
  'tt7-naturestaff': '拍照前是根枯枝，拍照后成了法杖。唯一的目击者是架子上那盆已经死了三年的绿萝。',
});

const TYPE_NOTES = Object.freeze({
  '武术': [
    '连拍的第三张里，影子比本人先完成了动作。',
    '姿势很标准。负责示范的人后来坚持，照片里的手不是他的。',
    '背签只写了四个字：先活下来。墨迹尚未干。',
    '这一招不难。难的是让对面相信，刚才只是在摆拍。',
  ],
  '法术': [
    '快门按下时屋里没有光。底片洗出来后，却多了第二个月亮。',
    '显影液在接触它之前就沸腾了。具体原因，请不要询问显影液。',
    '拍摄者说他记得咒文。再问一次时，他已经不认识「语言」这个词了。',
    '照片能够正常保存。不能正常保存的是看过它的人的梦。',
  ],
  '装备': [
    '送拍者坚持这不是遗物，只是一件「尚未决定杀谁的工具」。',
    '相片上没有锈迹。实物也没有——直到某人说出了自己的名字。',
    '它的保养手册只有一页：「别让它记住你的手。」',
    '标签上写着已领取。仓库里的实物还在，而且正在使用中。',
  ],
  '生物': [
    '它在每一张连拍里都更靠近镜头。摄影师只按过一次快门。',
    '请不要对着这张照片喂食。没有人知道它吃掉的东西去了哪里。',
    '拍摄时镜头盖并未取下。这一点不能解释照片里的牙。',
    '危险等级最初写的是「不可接近」。有人在前面加了一个「不得不」。',
  ],
  '道具': [
    '标签写着「一次性用品」。仓库记录显示，它已经被使用了十七次。',
    '按规程它不能解决任何问题。所以大家都在出问题之前使用它。',
    '上一位持有者留下一句话：「它非常好用，其余不便透露。」',
    '本物品没有副作用。「副作用」部门对此拒绝置评。',
  ],
  '事件': [
    '这张照片没有拍摄日期，因为日期栏里填的是明天。',
    '档案员已经把经过改了三次。遗憾的是，结果每次都没变。',
    '它不是事件的记录，而是事件对我们的记录。',
    '图片边缘那个模糊的人影，本来应该站在镜头后面。',
  ],
  '资源': [
    '数清楚以后记得再数一遍。少掉的那份通常已经在你口袋里。',
    '库存数量永远正确，除非你真的去仓库看一眼。',
    '这张照片的保险金额高于实物。于是实物不见了，照片留了下来。',
    '看起来很普通。通常这句话会出现在事故报告的第一行。',
  ],
  '能力卡': [
    '冲洗液变黑之前，底片上没有这个人。变黑之后，暗房里也没有摄影师了。',
    '它不能证明你拥有某种能力，只能证明某种能力曾经拥有你。',
    '签收栏空着。不是没人签，而是签字者的名字不再适用。',
    '看久了会有一种奇怪的熟悉感。请放心，熟悉你的是它。',
  ],
});

const DEFAULT_NOTES = Object.freeze([
  '照片背面没有日期，只有一道像是被指甲划出来的刻度。',
  '馆藏编号是连续的。这张是唯一个例外。',
  '更换过三次相纸，画面始终没变。变的只有查看者的记忆。',
  '注释被擦得很干净。太干净了，像是它从没被写下过。',
]);

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function ownerSentence(card, owner, hash) {
  if (owner) {
    const lines = [
      `${owner}把这张照片交来时，只说了一句「别问快门是谁按的」。`,
      `背签上是${owner}的笔迹，签名却被同一支笔反复划掉。`,
      `${owner}要求把它挂在能够随手取下的位置；档案员问过理由，没有问第二次。`,
    ];
    return lines[hash % lines.length];
  }
  const lines = [
    '归属栏留白。每次有人试图补上名字，墨迹都会在天亮前消失。',
    '这张照片没有送存人，但领取记录上有一整页指纹。',
    '无人认领。不过每次整理完墙面，它都会回到最显眼的位置。',
  ];
  return lines[hash % lines.length];
}

function effectSentence(card) {
  const desc = `${card?.desc || ''} ${card?.effect || ''}`;
  const name = card?.name || '这张照片';
  if (/夺取|偷取/.test(desc)) return `按【${name}】的记录完成曝光后，照片中少掉的力量会出现在持有者的影子里。`;
  if (/冰冻|寒冷|冰/.test(desc)) return `只要【${name}】仍在生效，相纸边缘就会结霜；温度计却始终停在零上七度。`;
  if (/中毒|毒/.test(desc) && /流血|血/.test(desc)) return `【${name}】在显影液里留下紫斑与暗红丝线，两种痕迹从不出现在同一个人身上。`;
  if (/中毒|毒/.test(desc)) return `【${name}】的暗部会慢慢泛紫，毒性检测却只在查看者身上呈阳性。`;
  if (/流血|血/.test(desc)) return `【${name}】每次被取下，背面都会多一道新鲜的红线，但从未沾湿相邻的照片。`;
  if (/沉默|禁言/.test(desc)) return `拍摄【${name}】时，录音设备丢失了整整一回合的声音；波形里只留下一道平直黑线。`;
  if (/抽牌|抽\s*\d|抽到/.test(desc) || +(card?.draw || 0) > 0) return `每次从墙上抽出【${name}】，它背后都会多粘着一张不属于本批次的底片。`;
  if (/回复|治疗|生命|回血/.test(desc) || +(card?.heal || 0) > 0) return `照片里的伤口永远比现实早愈合一步；这是【${name}】唯一愿意被重复验证的性质。`;
  if (/护甲|格挡|护盾/.test(desc) || +(card?.armor || 0) > 0) return `【${name}】曾被子弹击中，相纸弯曲却没有破损；装它的铁柜倒是留下了一个完整弹孔。`;
  if (/召唤|生成|置入|洗入/.test(desc)) return `【${name}】初洗时只有一个主体；当它的效果发生，同片底片上就会出现新的轮廓。`;
  if (/能量|注能|法伤/.test(desc) || +(card?.infuse || 0) > 0) return `【${name}】的曝光值每次测量都更高，却从不把相纸烧焦——它把多出的部分留给了持有者。`;
  if (/伤害|攻击/.test(desc) || +(card?.dmg || 0) > 0) return `【${name}】的相纸温度一直很正常，只有画面中被击中的位置会烫伤指尖。`;
  if (card?.type === '装备') return `把【${name}】挂到其他照片旁边时，后者的姿势会自行调整，像是已经把它装备上了。`;
  return `【${name}】与卡面所记的效果同步变化；档案室因此从不把它当作一张静态照片。`;
}

const PHOTO_NOTE_KEY = 'sdt-card-photo-notes-v1';
export const PHOTO_NOTE_PLACEHOLDER = '馆方记录尚未写完，点击这里继续撰写……';

function noteId(card) {
  return String(card?.id || card?.name || '').trim();
}

function readSavedNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PHOTO_NOTE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function savePhotoNote(card, value) {
  const id = noteId(card);
  const note = String(value || '').trim().slice(0, 240);
  if (!id) return note;
  const notes = readSavedNotes();
  if (note) notes[id] = note;
  else delete notes[id];
  try { localStorage.setItem(PHOTO_NOTE_KEY, JSON.stringify(notes)); } catch (_) {}
  return note;
}

export function photoNoteFor(card) {
  const id = noteId(card);
  if (!id) return '';
  // 馆方记录只认老板手写内容：未完成的卡统一显示 textarea placeholder，避免旧自动
  // 文案被误认作正式设定。上方旧文案池暂时保留，但不接入展示或保存流程。
  return String(readSavedNotes()[id] || '').trim();
}
