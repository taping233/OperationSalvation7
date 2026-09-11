#!/usr/bin/env node
/**
 * 数据校验（2026-09-11 架构批次 2）：game/data/*.json 的 schema 与引用完整性。
 * 挂在 pretest / prebuild 前运行，数据坏了在构建期报错而不是运行期静默。
 *
 * 校验项：
 *   - JSON 可解析、顶层结构齐全
 *   - 各表 id 唯一、必填字段非空
 *   - 宠物 icon、art 映射的资源卡文件存在于 game/assets/
 *   - 成就 back 引用的卡背 id 存在于 cards.js CARD_BACKS 的已知清单
 *   - 遭遇表敌人 id 必须在怪物图鉴中
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'game', 'data');
const ASSETS = path.join(ROOT, 'game', 'assets');
const errors = [];

const read = (name) => {
  const p = path.join(DATA, name);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    errors.push(`${name}: JSON 解析失败 ${e.message}`);
    return null;
  }
};

const pets = read('pets.json');
const achievements = read('achievements.json');
const art = read('art-mapping.json');
const scenes = read('scenes.json');
const map = read('map.json');

const dupCheck = (list, label) => {
  const seen = new Set();
  for (const item of list) {
    if (!item.id) errors.push(`${label}: 缺 id -> ${JSON.stringify(item).slice(0, 60)}`);
    else if (seen.has(item.id)) errors.push(`${label}: id 重复 ${item.id}`);
    seen.add(item.id);
  }
};

if (pets) {
  dupCheck(pets.list || [], 'pets.list');
  for (const p of pets.list || []) {
    if (!p.name || !p.icon || !p.effect) errors.push(`pets.list[${p.id}]: 缺 name/icon/effect`);
  }
  if (typeof pets.hatchCost !== 'number' || !Array.isArray(pets.upCosts)) errors.push('pets: hatchCost/upCosts 类型错误');
}

if (achievements) {
  dupCheck(achievements.achievements || [], 'achievements');
  const BACK_IDS = new Set(['classic', 'wolf', 'coin', 'vault', 'boss', 'altar', 'pet']);
  for (const a of achievements.achievements || []) {
    if (!a.name || !a.desc || !a.reward) errors.push(`achievements[${a.id}]: 缺 name/desc/reward`);
    if (a.back && !BACK_IDS.has(a.back)) errors.push(`achievements[${a.id}]: 未知卡背 ${a.back}`);
  }
  const needs = (achievements.collectionMilestones || []).map(m => m.need).filter(n => n !== 'all');
  dupCheck(achievements.collectionMilestones || [], 'collectionMilestones');
  if (needs.some(n => typeof n !== 'number')) errors.push('collectionMilestones: need 应为数字或 "all"');
}

if (art) {
  // 美术映射的资源卡/事件图文件存在性（按 id 推断 webp 路径）
  for (const [id, file] of Object.entries(art.resourceArt || {})) {
    if (!fs.existsSync(path.join(ASSETS, 'cards', 'resources', `${file}.webp`))) errors.push(`resourceArt[${id}]: 缺 assets/cards/resources/${file}.webp`);
  }
  for (const [id, file] of Object.entries(art.itemArt || {})) {
    if (!fs.existsSync(path.join(ASSETS, 'cards', 'items', `${file}.webp`)) &&
        !fs.existsSync(path.join(ASSETS, 'cards', `${file}.webp`))) errors.push(`itemArt[${id}]: 缺 items/${file}.webp`);
  }
  for (const [id, file] of Object.entries(art.eventCardArt || {})) {
    if (!fs.existsSync(path.join(ASSETS, 'scenes', `${file}.webp`))) errors.push(`eventCardArt[${id}]: 缺 scenes/${file}.webp`);
  }
}

if (scenes) {
  for (const [key, sc] of Object.entries(scenes.scenes || {})) {
    if (!sc.title || !Array.isArray(sc.lines) || !sc.lines.length) errors.push(`scenes[${key}]: 缺 title/lines`);
  }
  dupCheck(Object.entries(scenes.classStory || {}).map(([id, v]) => ({ id })), 'classStory');
}

if (map) {
  const monsterIds = new Set(Object.keys(map.monsters || {}));
  dupCheck(Object.values(map.monsters || {}), 'monsters');
  (map.encounters || []).forEach((enc, li) => {
    for (const e of enc.entries || []) {
      if (!monsterIds.has(e.id)) errors.push(`encounters[${li}]: 未知敌人 ${e.id}`);
      const [min, max] = e.size || [];
      if (!(min >= 1 && max >= min)) errors.push(`encounters[${li}]: ${e.id} 数量区间非法 ${JSON.stringify(e.size)}`);
      if (max > 3) errors.push(`encounters[${li}]: ${e.id} 区间上限 ${max} 违反 1~3 定版`);
    }
  });
  for (const [id, m] of Object.entries(map.monsters || {})) {
    if (!(m.atk >= 0 && m.hp >= 1) || !m.name || !m.behavior) errors.push(`monsters[${id}]: 缺 atk/hp/name/behavior`);
  }
}

if (errors.length) {
  console.error(`[validate-data] ${errors.length} 个问题：`);
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[validate-data] 全部通过（pets ${pets?.list?.length || 0} / 成就 ${achievements?.achievements?.length || 0} / 怪物 ${Object.keys(map?.monsters || {}).length} / 场景 ${Object.keys(scenes?.scenes || {}).length}）`);
