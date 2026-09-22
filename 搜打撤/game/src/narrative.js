const KNOTS = Object.freeze({
  'tt6-timeskip': 'tt6_timeskip',
  'tt6-demondeal': 'tt6_demondeal',
  'tt6-bandits': 'tt6_bandits',
  'tt6-goldmine': 'tt6_goldmine',
  'tt6-mystery': 'tt6_mystery',
  'tt6-goldhammer': 'tt6_goldhammer',
  'tt6-relief': 'tt6_relief',
  'tt6-airdrop': 'tt6_airdrop',
  'tt6-chestdraw': 'tt6_chestdraw',
  'tt6-systemsupply': 'tt6_systemsupply',
});

function parseChoice(text) {
  const [label, ...parts] = String(text || '').split('@@');
  const metadata = Object.fromEntries(parts.map(part => {
    const at = part.indexOf('=');
    return at < 0 ? [part.trim(), ''] : [part.slice(0, at).trim(), part.slice(at + 1).trim()];
  }));
  return { label: label.trim(), effect: metadata.effect || '', detail: metadata.detail || '', tone: metadata.tone || '' };
}

async function eventNarrative(cardId) {
  const knot = KNOTS[cardId];
  if (!knot) return null;
  // Ink 解释器只服务 10 张专属事件卡，不应进入每次启动都解析的首屏依赖图。
  // 与编译后的故事一起按需加载；失败时返回 null，由事件页沿用卡面描述/default 结算。
  let Story, storyContent;
  try {
    [{ Story }, { default: storyContent }] = await Promise.all([
      import('inkjs'),
      import('./generated/narrative-events.js'),
    ]);
  } catch (error) {
    console.warn('[narrative] Ink 叙事模块加载失败，回退卡面事件', error);
    return null;
  }
  const story = new Story(storyContent);
  story.ChoosePathString(knot);
  const intro = story.ContinueMaximally().trim();
  const choices = story.currentChoices.map((choice, index) => ({
    ...parseChoice(choice.text),
    choose() {
      story.ChooseChoiceIndex(index);
      return story.ContinueMaximally().trim();
    },
  }));
  return { intro, choices };
}

async function lastLampNarrative(segmentId) {
  if (![1, 2, 3].includes(+segmentId)) return null;
  let Story, storyContent;
  try {
    [{ Story }, { default: storyContent }] = await Promise.all([
      import('inkjs'), import('./generated/narrative-events.js'),
    ]);
  } catch (error) {
    console.warn('[narrative] 环境故事加载失败，回退普通事件', error);
    return null;
  }
  try {
    const story = new Story(storyContent);
    story.ChoosePathString(`r6_last_lamp_${segmentId}`);
    const intro = story.ContinueMaximally().trim();
    const choices = story.currentChoices.map((choice, index) => ({ ...parseChoice(choice.text), choose() {
      story.ChooseChoiceIndex(index); return story.ContinueMaximally().trim();
    } }));
    return { intro, choices };
  } catch (error) {
    console.warn('[narrative] 环境故事解析失败，回退普通事件', error);
    return null;
  }
}

export { eventNarrative, lastLampNarrative, parseChoice, KNOTS };
