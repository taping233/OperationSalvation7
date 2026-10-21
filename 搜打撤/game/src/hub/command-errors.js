// Shared command errors do not load the retired furniture scene or its commands.
export function homeErrorMessage(result) {
  if (!result || result.ok) return '';
  return result.message || ({
    STALE_REVISION: '基地资料已变化，请刷新后重试。',
    SAVE_FAILED: '保存失败，原布局仍然保留。',
    INSUFFICIENT_FUNDS: '储备币不足。',
    PLACEMENT_OVERLAP: '家具位置重叠。',
    PLACEMENT_OUT_OF_BOUNDS: '家具超出房间范围。',
  }[result.code] || '操作失败，请重试。');
}
