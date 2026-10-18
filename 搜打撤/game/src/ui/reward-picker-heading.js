// Presentation follows the live picker mode, including restored legacy choices.
// A generated random reward is already revealed; this does not roll or claim it.
export function rewardPickerTitle({ finished = false, isPick = false, choice = false, count = 0, randomSingle = false } = {}) {
  if (finished) return '奖励已处理';
  if (isPick) return '选择 1 张';
  if (choice) return '领取附赠奖励';
  if (randomSingle && count === 1) return '随机收获 · 1 张';
  return count === 1 ? '领取 1 张' : '领取奖励 · 全部可领';
}
