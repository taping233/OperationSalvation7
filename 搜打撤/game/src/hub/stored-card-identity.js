// Warehouse cards retain stable identity even when their display names match.
// Older cards without an ID can still merge with other ID-less cards by name.
const variantOf = stack => stack.variantKey || stack.card?.variantKey || '';

export function sameStoredCard(left, right) {
  const a = left?.card, b = right?.card;
  if (!a || !b || variantOf(left) !== variantOf(right)) return false;
  return a.id || b.id ? !!a.id && a.id === b.id : a.name === b.name;
}

export function storedCardVariant(stack) {
  return stack.variantKey ? { variantKey: stack.variantKey } : {};
}
