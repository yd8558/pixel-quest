// Applies Pixel Quest customizations to the Capacitor-generated Android project (android/).
// Run after `npx cap add android`. Safe to run more than once.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = path.join(root, 'android', 'app', 'src', 'main');
const fail = (msg) => { console.error('ERROR: ' + msg); process.exit(1); };
if (!fs.existsSync(app)) fail('android/ project not found. Run `npx cap add android` first.');

// 1. Main activity with immersive fullscreen
const javaDir = path.join(app, 'java', 'com', 'pixelquest', 'game');
fs.mkdirSync(javaDir, { recursive: true });
for (const f of fs.readdirSync(javaDir)) if (/^MainActivity\.(java|kt)$/.test(f)) fs.unlinkSync(path.join(javaDir, f));
fs.copyFileSync(path.join(root, 'native', 'MainActivity.java'), path.join(javaDir, 'MainActivity.java'));
console.log('✓ MainActivity (immersive fullscreen)');

// 2. Manifest: landscape orientation, no resize on rotation
const manifestPath = path.join(app, 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
const actRe = /<activity\b[^>]*android:name="\.MainActivity"[^>]*>/s;
const act = manifest.match(actRe);
if (!act) fail('MainActivity <activity> tag not found in AndroidManifest.xml');
let tag = act[0];
tag = tag.replace(/\s+android:screenOrientation="[^"]*"/, '');
tag = tag.replace(/android:name="\.MainActivity"/, 'android:name=".MainActivity"\n            android:screenOrientation="sensorLandscape"');
if (!/android:configChanges=/.test(tag)) {
  tag = tag.replace(/android:name="\.MainActivity"/, 'android:name=".MainActivity"\n            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation"');
}
manifest = manifest.replace(actRe, tag);
fs.writeFileSync(manifestPath, manifest);
if (!/screenOrientation="sensorLandscape"/.test(fs.readFileSync(manifestPath, 'utf8'))) fail('could not set landscape orientation');
console.log('✓ AndroidManifest (landscape)');

// 3. App name
const stringsPath = path.join(app, 'res', 'values', 'strings.xml');
if (fs.existsSync(stringsPath)) {
  let s = fs.readFileSync(stringsPath, 'utf8');
  s = s.replace(/(<string name="app_name">)[^<]*(<\/string>)/, '$1Pixel Quest$2');
  s = s.replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, '$1Pixel Quest$2');
  fs.writeFileSync(stringsPath, s);
  console.log('✓ App name: Pixel Quest');
}

// 4. Theme: fullscreen, dark background (avoids white flash on launch)
const stylesPath = path.join(app, 'res', 'values', 'styles.xml');
if (fs.existsSync(stylesPath)) {
  let s = fs.readFileSync(stylesPath, 'utf8');
  if (!s.includes('android:windowFullscreen')) {
    s = s.replace(/(<style name="AppTheme\.NoActionBar"[^>]*>)/, '$1\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowBackground">@color/pq_background</item>');
    fs.writeFileSync(stylesPath, s);
  }
  console.log('✓ Theme (fullscreen)');
}

// 5. Icons, splash screens, colors (overwrite generated defaults)
const resSrc = path.join(root, 'native', 'res');
let copied = 0;
(function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else { fs.copyFileSync(s, d); copied++; }
  }
})(resSrc, path.join(app, 'res'));
// Remove the default WebP/vector launcher assets that could shadow our PNG icons
for (const dir of fs.readdirSync(path.join(app, 'res'))) {
  if (!dir.startsWith('mipmap') && !dir.startsWith('drawable')) continue;
  for (const f of fs.readdirSync(path.join(app, 'res', dir))) {
    if (/^ic_launcher.*\.webp$/.test(f)) fs.unlinkSync(path.join(app, 'res', dir, f));
  }
}
console.log('✓ Icons & splash (' + copied + ' files)');

console.log('Pixel Quest Android customization complete.');
