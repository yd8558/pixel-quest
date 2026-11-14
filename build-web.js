// Bundles the existing PIXEL QUEST game into a single offline file: www/index.html
// (no network needed at runtime — all art and audio are generated in code).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
execFileSync(process.execPath, [path.join(root, 'game', 'tools', 'build.js')], { stdio: 'inherit' });
const src = path.join(root, 'game', 'dist', 'pixel-quest.html');
const outDir = path.join(root, 'www');
fs.mkdirSync(outDir, { recursive: true });
let html = fs.readFileSync(src, 'utf8');
// Capacitor injects its native bridge (window.Capacitor) automatically; nothing else to load.
if (/https?:\/\/(?!localhost)/.test(html.replace(/https:\/\/html\.spec\.whatwg\.org[^"' ]*/g, ''))) {
  console.warn('Warning: the game references an external URL; it must work offline.');
}
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log('Web build ready: www/index.html');
