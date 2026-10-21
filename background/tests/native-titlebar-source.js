/* Read the same native C# partial-class compilation units as the installer. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../..');
module.exports = function readNativeTitlebarSource() {
  const core = fs.readFileSync(path.join(root, 'native/StreamShellTitlebarHost.cs'), 'utf8');
  const folder = path.join(root, 'native/titlebar-src');
  const parts = fs.readdirSync(folder).filter(name => name.endsWith('.cs')).sort();
  if (parts.length !== 19) throw new Error(`Expected 19 native modules, found ${parts.length}`);
  const marker = 'internal static partial class StreamShellTitlebarHost';
  return core + parts.map(name => {
    const source = fs.readFileSync(path.join(folder, name), 'utf8');
    const at = source.indexOf(marker);
    if (at < 0) throw new Error(`Invalid native titlebar module: ${name}`);
    return '\n' + source.slice(at);
  }).join('');
};
