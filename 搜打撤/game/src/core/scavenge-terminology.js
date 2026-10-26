// Normalize saved Chinese labels while keeping card IDs and save fields stable.
export function scavengeText(value) {
  return String(value || '')
    .replaceAll('搜索大宝箱', '搜索军用保险柜')
    .replaceAll('大、中、小宝箱', '军用保险柜、密封物资箱、小型物资箱')
    .replaceAll('大，中，小宝箱', '军用保险柜、密封物资箱、小型物资箱')
    .replaceAll('小宝箱', '小型物资箱')
    .replaceAll('中宝箱', '密封物资箱')
    .replaceAll('大宝箱', '军用保险柜')
    .replaceAll('宝箱', '搜刮点');
}
