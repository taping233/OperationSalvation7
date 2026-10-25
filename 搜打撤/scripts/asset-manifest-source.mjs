// Group only adjacent directory entries: preload order and duplicate keys remain intact.
export function serializeAssetManifest(files, { header = '' } = {}) {
  const groups = [];
  for (const file of files) {
    const split = file.lastIndexOf('/') + 1;
    const directory = file.slice(0, split), name = file.slice(split);
    const previous = groups.at(-1);
    if (previous?.directory === directory) previous.names.push(name);
    else groups.push({ directory, names: [name] });
  }
  let grouped = false;
  const entries = groups.map(({ directory, names }) => {
    const flat = names.map(name => `  ${JSON.stringify(directory + name)},`).join('\n');
    const compact = `  ...paths(${JSON.stringify(directory)}, [\n`
      + names.map(name => `    ${JSON.stringify(name)},`).join('\n') + '\n  ]),';
    if (compact.length >= flat.length) return flat;
    grouped = true;
    return compact;
  });
  return header + (grouped ? 'const paths = (directory, names) => names.map(name => directory + name);\n' : '')
    + `export default [\n${entries.join('\n')}\n];\n`;
}
