import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const refs = [
  ['snap', 'MARVEL SNAP', 'Captain Marvel variants', 'https://marvelsnap.com/media/', 'https://d2fstzkj6h0nvg.cloudfront.net/wp-content/uploads/2025/03/31182908/CAPTAIN-MARVEL-VARIANT-SHOWCASE.png'],
  ['mtg-standard', '万智牌', 'Talion · 标准框', 'https://magic.wizards.com/en/news/announcements/a-first-look-at-wilds-of-eldraine', 'https://media.wizards.com/2023/images/daily/en_0284d07b3e.png'],
  ['mtg-borderless', '万智牌', 'Talion · 无边框', 'https://magic.wizards.com/en/news/announcements/a-first-look-at-wilds-of-eldraine', 'https://media.wizards.com/2023/images/daily/en_a4c94c7dbb.png'],
  ['mtg-showcase', '万智牌', 'Cruel Somnophage · 展示框', 'https://magic.wizards.com/en/news/announcements/a-first-look-at-wilds-of-eldraine', 'https://media.wizards.com/2023/images/daily/en_b5f83c4ed8.png'],
  ['lor-lux', '符文之地传说', 'Lux · 单位卡', 'https://developer.riotgames.com/docs/lor', 'https://dd.b.pvp.net/7_10_0/set1/en_us/img/cards/01DE042.png'],
  ['lor-deny', '符文之地传说', 'Deny · 法术卡', 'https://developer.riotgames.com/docs/lor', 'https://dd.b.pvp.net/7_10_0/set1/en_us/img/cards/01IO049.png'],
  ['lor-garen', '符文之地传说', 'Garen · 单位卡', 'https://developer.riotgames.com/docs/lor', 'https://dd.b.pvp.net/7_10_0/set1/en_us/img/cards/01DE012.png'],
  ['spire-cards', '杀戮尖塔 2', '官方卡牌品质展示', 'https://megacrit.com/news/2024-11-07-neowsletter-issue-4/', 'https://megacrit.com/images/shiny_rare_qol.gif'],
  ['spire-game', '杀戮尖塔 2', '官方实机截图', 'https://www.megacrit.com/press-kits/slay-the-spire-2/', 'https://www.megacrit.com/images/steam_screenshot1_new.png'],
  ['balatro', 'Balatro', 'Joker · 官网卡牌', 'https://www.playbalatro.com/', 'https://www.playbalatro.com/_astro/main_card.CCEQ3skO_Z2jsFf3.png'],
  ['hearth-unit', '炉石传说', 'Elise · 标准随从框', 'https://hearthstone.blizzard.com/en-us/news/24267727/', 'https://bnetcmsus-a.akamaihd.net/cms/content_entry_media/GLJW9GBQCD7C1772489162074.png'],
  ['hearth-spell', '炉石传说', 'Unleash the Crocolisks · 法术框', 'https://hearthstone.blizzard.com/en-us/news/24267727/', 'https://bnetcmsus-a.akamaihd.net/cms/content_entry_media/M5U5OL1WU3HY1772489162904.png'],
];
await fs.mkdir(path.join(root, 'images'), { recursive: true });
const results = await Promise.all(refs.map(async ([id, game, label, source, url]) => {
  const file = 'images/' + id + (url.includes('.gif') ? '.gif' : '.png');
  let bytes;
  try { bytes = await fs.readFile(path.join(root, file)); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(url);
    if (!response.ok) throw Error(id + ': HTTP ' + response.status);
    const type = response.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw Error(id + ': unexpected ' + type);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  await fs.writeFile(path.join(root, file), bytes);
  return { id, game, label, source, url, file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}));
await fs.writeFile(path.join(root, 'sources.json'), JSON.stringify({ collected: '2026-10-10', refs: results }, null, 2) + '\n');
await fs.writeFile(path.join(root, '.gitignore'), results.filter(r => r.bytes > 1024 * 1024).map(r => r.file).join('\n') + '\n');
console.log(JSON.stringify(results.map(({ id, game, bytes }) => ({ id, game, bytes })), null, 2));
