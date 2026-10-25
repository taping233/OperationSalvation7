// @ts-check
/** 构造迁移数据；未声明 battle 时保持该键缺省。 */
export function triggerDefinition(triggers, battle = undefined) {
  return { rules: { version: 1, ...(battle === undefined ? {} : { battle }), triggers } };
}

export function onPlayDefinition(battle, onPlay) {
  return triggerDefinition({ onPlay }, battle);
}

/** 本批全部定义使用同一源表，仅显式列出例外。 */
export function canonicalTables(definitions, defaultTable, overrides = {}) {
  return new Map([...definitions.keys()].map(id => [id, overrides[id] ?? defaultTable]));
}
