const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const names = ['wu-bass-1020', 'baita-station-1020', 'xingyue-piano-1020', 'baita-heixiang-1016', 'snow-road-1016', 'xingyue-reeds-1020'];

function prepareWallpapers(projectDir, target = path.join(projectDir, 'game/startup-wallpapers')) {
  fs.mkdirSync(target, { recursive: true });
  const files = names.map((name, index) => ({
    source: path.join(projectDir, '../game/assets/reconstruction/wallpaper-' + name + '.webp'),
    target: path.join(target, 'wallpaper-' + index + '.jpg'),
  }));
  // UTF-8 stdin preserves Chinese paths with older Python launchers on Windows.
  execFileSync('python', ['-c', 'from PIL import Image; import sys,json; files=json.loads(sys.stdin.buffer.read().decode("utf-8"));\nfor f in files:\n im=Image.open(f["source"]).convert("RGB"); im.thumbnail((1920,1080)); im.save(f["target"],quality=90)'], { input: JSON.stringify(files) });
  return files.map(file => file.target);
}

// Build one portable EXE whose first window exists before archive extraction.
async function buildNativePortable({ projectDir = __dirname, stagingDir, sevenZip }) {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
  const unpacked = path.join(stagingDir, 'win-unpacked');
  const compiler = path.join(process.env.WINDIR, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  sevenZip ||= process.env.ELECTRON_BUILDER_7ZIP_PATH;
  sevenZip ||= await require('app-builder-lib/out/toolsets/7zip').getPath7za();
  for (const input of [compiler, sevenZip, path.join(unpacked, pkg.productName + '.exe')]) {
    if (!input || !fs.existsSync(input)) throw Error('Missing local portable build input: ' + input);
  }
  const resources = path.join(stagingDir, 'launcher-inputs');
  fs.mkdirSync(resources, { recursive: true });
  const archive = path.join(resources, 'payload.7z');
  if (fs.existsSync(archive)) throw Error('Refusing to reuse a previous portable payload');
  const wallpapers = prepareWallpapers(projectDir, path.join(unpacked, 'resources/game/startup-wallpapers'));
  execFileSync(sevenZip, ['a', '-t7z', '-mx=1', '-mmt=2', archive, '.'], { cwd: unpacked, stdio: 'inherit' });
  const args = ['/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/utf8output',
    '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll',
    '/win32icon:' + path.join(projectDir, 'app.ico'),
    '/out:' + path.join(stagingDir, pkg.build.portable.artifactName),
    '/resource:' + archive + ',payload', '/resource:' + sevenZip + ',extractor'];
  for (const [index, target] of wallpapers.entries()) {
    args.push('/resource:' + target + ',wallpaper' + index);
  }
  args.push(path.join(projectDir, 'portable-launcher.cs'));
  execFileSync(compiler, args, { stdio: 'inherit' });
  return path.join(stagingDir, pkg.build.portable.artifactName);
}
if (require.main === module) {
  Promise.resolve().then(() => process.argv[2] === '--prepare' ? prepareWallpapers(__dirname) : buildNativePortable({ stagingDir: path.resolve(process.argv[2]) }))
    .then(result => console.log(result)).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { buildNativePortable, prepareWallpapers };
