// Builds dist/pixel-quest.html: a single self-contained file with all scripts inlined.
// Usage: node tools/build.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<!-- build:scripts -->([\s\S]*?)<!-- \/build:scripts -->/, (_, block) => {
  const files = [...block.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  return files.map((f) => `<script>\n/* ${f} */\n${fs.readFileSync(path.join(root, f), 'utf8')}\n</script>`).join('\n');
});
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'pixel-quest.html'), html);
console.log('Built dist/pixel-quest.html', (html.length / 1024).toFixed(1) + ' KB');
