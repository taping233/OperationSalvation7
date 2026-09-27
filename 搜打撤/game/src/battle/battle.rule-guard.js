// @ts-check
import { inspectCardRuleCapability } from '../cards/card-rules.capability.js';

/** @typedef {import('../cards/card-rules.capability.types.js').CardRuleIssue} CardRuleIssue */
/** @typedef {import('../cards/card-rules.capability.types.js').RuleWarningPort} RuleWarningPort */

/** @param {readonly CardRuleIssue[]} issues @returns {string} */
function describeIssues(issues) {
  return issues.map(issue => `${issue.cardId} ${issue.path}: ${issue.message}`).join('; ');
}

/** Assert the whole rule list before the resolver consumes any operation.
 * @param {unknown} card @returns {void} */
export function assertCardRulesExecutable(card) {
  const result = inspectCardRuleCapability(card);
  if (!result.ok) throw new TypeError(`${result.kind === 'invalid' ? 'Invalid' : 'Unsupported'} card rules: ${describeIssues(result.issues)}`);
}

/** The warning port receives HTML-safe text for the battle log.
 * @param {string} value @returns {string} */
function escapeMessage(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** true means the card was rejected; invalid schema is rejected as well.
 * @param {unknown} card @param {RuleWarningPort} port @returns {boolean} */
export function rejectUnsupportedCard(card, port) {
  const result = inspectCardRuleCapability(card);
  if (result.ok) return false;
  const reason = result.kind === 'invalid' ? '规则格式非法' : '规则尚未支持';
  port.warn(`无法打出：${reason}（${escapeMessage(describeIssues(result.issues))}）`);
  return true;
}
