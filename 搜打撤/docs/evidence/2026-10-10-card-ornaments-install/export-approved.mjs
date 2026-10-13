// One-time export of the accepted ink proposal; run from the project checkout.
import fs from 'node:fs';
import vm from 'node:vm';
import postcss from 'postcss';
const source = fs.readFileSync('game/src/rarity-design-lab.js', 'utf8');
const context = {};
const start = source.indexOf('const diamond=');
const end = source.indexOf('function jewel(i)');
if (start < 0 || end < start) throw new Error('Proposal helpers not found');
vm.runInNewContext(source.slice(0, source.indexOf('const arts=')) + '\nlet ornamentSerial=0;\n' + source.slice(start, end) + '\nthis.render=ornament;this.tiers=tiers;', context);
const css = [];
postcss.parse(fs.readFileSync('game/css/rarity-design-lab.css', 'utf8')).walkRules(rule => {
  if (rule.selector.startsWith('.ornament ')) {
    css.push(rule.toString().replaceAll('.ornament ', ''));
  }
});
const files = ['rare', 'epic', 'legendary', 'prism'];
const opacity = [.8, .9, .96, 1];
for (let i = 1; i <= 4; i++) {
  const tier = context.tiers[i];
  const markup = context.render('ink', i);
  const svg = markup.match(/<svg[\s\S]*<\/svg>/)?.[0];
  if (!svg) throw new Error(`Missing SVG for ${tier.name}`);
  // Production rules occupy a wider lower text region than the review fixture.
  // Keep only the outermost lower accents, leaving the existing text inset intact.
  const output = svg.replace('class="ornament"', 'xmlns="http://www.w3.org/2000/svg" class="ornament"')
    .replace('style="', `color="${tier.shine}" style="--tone:${tier.tone};--shine:${tier.shine};opacity:${opacity[i-1]};`)
    .replace('<defs>', `<style>${css.join('\n')}</style><defs>`)
    .replace('<rect x="0" y="342" width="20" height="64"/>', '<rect x="0" y="342" width="8" height="64"/>')
    .replace('<rect x="252" y="342" width="20" height="64"/>', '<rect x="264" y="342" width="8" height="64"/>');
  const path = `game/css/card-ornaments/${files[i-1]}.svg`;
  if (fs.existsSync(path)) throw new Error(`Refusing to overwrite ${path}`);
  fs.writeFileSync(path, output + '\n');
  console.log(`${tier.name}: ${path} (${Buffer.byteLength(output)} bytes)`);
}
