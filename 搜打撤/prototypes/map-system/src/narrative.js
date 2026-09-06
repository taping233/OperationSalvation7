import { Story } from 'inkjs';
import storyContent from './generated/narrative-events.js';

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

function eventNarrative(cardId) {
  const knot = KNOTS[cardId];
  if (!knot) return null;
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

export { eventNarrative, parseChoice, KNOTS };
