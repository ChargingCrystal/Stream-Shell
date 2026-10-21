#!/usr/bin/env node
/** Stream Shell offline quality gate. Node 22+, no npm packages required.
 *  Run: node tools/check-project.mjs
 *  This is a source/asset/test contract, not a Windows C# compilation test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const absolute = file => path.join(root, file);
const read = file => fs.readFileSync(absolute(file));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const exists = file => fs.existsSync(absolute(file));
const ignore = new Set(['.git', 'node_modules', '.vscode']);

function walk(folder = '.') {
    return fs.readdirSync(absolute(folder), { withFileTypes: true }).flatMap(item => {
        if (ignore.has(item.name)) return [];
        const name = path.posix.join(folder, item.name);
        return item.isDirectory() ? walk(name) : [name];
    });
}

function psArray(script, declaration) {
    const text = read(script).toString('utf8');
    const start = text.indexOf(declaration);
    check(start >= 0, `${script}: missing PowerShell array ${declaration}`);
    if (start < 0) return [];
    const body = text.slice(start + declaration.length).split(/\r?\n\s*\)/, 1)[0];
    return [...body.matchAll(/"([^"\n]+\.js)"/g)].map(match => match[1]);
}

function bundle(label, result, inputs, byteExact = true) {
    const missing = inputs.filter(file => !exists(file));
    for (const file of missing) errors.push(`${label}: missing source ${file}`);
    if (missing.length || !exists(result)) return;
    const expected = Buffer.concat(inputs.map(read));
    const actual = read(result);
    check(expected.equals(actual), `${label}: generated bundle differs from its source modules (run the corresponding build-*.ps1)`);
    if (byteExact) console.log(`  ${label}: ${inputs.length} modules, ${actual.length} bytes, parity OK`);
}

function jsSource(script, sourcePrefix, declaration) {
    return psArray(script, declaration).map(file => file.startsWith('../shared/')
        ? `shared/${file.substring('../shared/'.length)}`
        : `${sourcePrefix}/${file}`);
}

console.log('Stream Shell project quality gate');
const manifest = JSON.parse(read('manifest.json').toString('utf8'));
check(manifest.manifest_version === 3, 'Manifest V3 contract changed');
check(typeof manifest.version === 'string', 'Manifest version missing');
const readme = read('README.md').toString('utf8');
check(readme.includes(`**Current version: ${manifest.version}**`), 'README current version does not match manifest');
check(exists(`release-notes/RELEASE_NOTES_v${manifest.version}.md`), 'release note missing for manifest version');

const background = jsSource('background/build-background.ps1', 'background', '$Chunks = @(');
bundle('background.js', 'background.js', background);
const common = jsSource('common/build-shell.ps1', 'common/src', '$Files = @(');
bundle('common/shell.js', 'common/shell.js', common);
const dashboard = ['shared/provider-registry-core.js', ...jsSource('dashboard/build-dashboard.ps1', 'dashboard/src', '$Files = @(')];
bundle('dashboard/dashboard.js', 'dashboard/dashboard.js', dashboard);
const landingFiles = psArray('landing/build-landing.ps1', '$Order = @(');
bundle('landing/landing.js', 'landing/landing.js', ['shared/provider-registry-core.js', ...landingFiles.map(file => `landing/src/${file}`)]);
const compactParts = ['dashboard/src/compact-home-prefix.js', ...psArray('dashboard/build-dashboard.ps1', '$LandingFiles = @(').map(file => `landing/src/${file}`), 'dashboard/src/compact-home-suffix.js'];
bundle('dashboard/compact-home.js', 'dashboard/compact-home.js', compactParts);

const referenced = [
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
    ...(manifest.content_scripts || []).flatMap(script => [...script.js || [], ...script.css || []]),
    manifest.background?.service_worker,
    manifest.action?.default_popup
].filter(Boolean);
for (const file of referenced) check(exists(file), `manifest: missing asset ${file}`);
// Optional local wallpapers are intentionally not included in released ZIPs.
for (const entry of manifest.web_accessible_resources || []) {
    for (const file of entry.resources || []) {
        if (file.startsWith('assets/backgrounds/')) continue;
        check(exists(file), `manifest: missing web-accessible asset ${file}`);
    }
}

const all = walk();
// Repository layout contract: root stays small and browser-resolvable paths stable.
// When adding a new top-level runtime surface, document its responsibility first.
const rootDirectories = new Set([
    '.github', 'assets', 'background', 'common', 'dashboard', 'docs',
    'integrations', 'landing', 'media', 'native', 'offscreen', 'popup',
    'providers', 'release-notes', 'shared', 'subscriptions', 'tools', 'twitch-workspace'
]);
const rootFiles = new Set([
    '.gitattributes', '.gitignore', 'CHANGELOG.md', 'CONTRIBUTING.md',
    'LICENSE.md', 'NOTICE', 'README.md', 'SECURITY.md',
    'background.js', 'manifest.json'
]);
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const allowed = entry.isDirectory() ? rootDirectories.has(entry.name) : rootFiles.has(entry.name);
    check(allowed, `project layout: unexpected root ${entry.isDirectory() ? 'directory' : 'file'} ${entry.name} (see docs/PROJECT-STRUCTURE.md)`);
}
const strandedTests = all.filter(file => file.endsWith('.test.js') && !file.includes('/tests/'));
for (const file of strandedTests) check(false, `project layout: move test into its area's tests/ folder: ${file}`);
check(!exists('tools/ci-bootstrap.mjs'), 'project layout: deprecated CI bootstrap still present');
console.log(`  project layout: known runtime roots and tests/ locations (${strandedTests.length} stray tests)`);

for (const file of all.filter(file => file.endsWith('.html'))) {
    const html = read(file).toString('utf8');
    const values = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)];
    for (const [, raw] of values) {
        if (/^(?:https?:|data:|mailto:|javascript:|#|\/\/)/i.test(raw) || raw.includes('${') || raw.includes('{{')) continue;
        const local = path.posix.normalize(path.posix.join(path.posix.dirname(file), raw.split(/[?#]/)[0]));
        check(!local.startsWith('../') && exists(local), `${file}: missing referenced ${raw}`);
    }
}
console.log(`  manifest/HTML: ${referenced.length} required runtime assets checked, ${all.filter(file => file.endsWith('.html')).length} HTML files checked`);

// These are intentional concatenation fragments, not independently parseable JS.
// They are still syntax-checked through the complete generated bundles above.
const bundleFragments = new Set([
    'common/src/bootstrap-state.js', 'common/src/start.js',
    'dashboard/src/compact-home-prefix.js', 'dashboard/src/compact-home-suffix.js'
]);
const jsFiles = all.filter(file => (file.endsWith('.js') || file.endsWith('.mjs')) && !bundleFragments.has(file));
let syntaxOk = 0;
for (const file of jsFiles) {
    const command = spawnSync(process.execPath, ['--check', absolute(file)], { encoding: 'utf8' });
    if (command.status === 0) syntaxOk++;
    else errors.push(`${file}: JavaScript syntax error: ${(command.stderr || command.stdout || '').trim().slice(0, 400)}`);
}
console.log(`  JavaScript syntax: ${syntaxOk}/${jsFiles.length}`);

// Discover every *.test.js, including legacy tests beside their production files.
const tests = all.filter(file => file.endsWith('.test.js')).sort();
const requiredBehaviorTests = [
    'landing/tests/finance-entry.test.js',
    'landing/tests/provider-background.test.js',
    'offscreen/tests/titlebar-svg.test.js',
    'background/tests/renderer-startup-admission.test.js',
    'background/tests/renderer-handoff-session-lease.test.js',
    'background/tests/twitch-cold-window-identity.test.js',
    'background/tests/twitch-staged-content-startup.test.js',
    'background/tests/twitch-lazy-hud-admission.test.js',
    'background/tests/twitch-marbles-history-admission.test.js',
    'background/tests/twitch-automation-code-split.test.js',
    'background/tests/twitch-startup-reflow-and-navigation-audit.test.js',
    'background/tests/twitch-alarm-concurrent-admission.test.js',
    'background/tests/twitch-player-audio-raid-navigation.test.js',
    'background/tests/twitch-first-playback-autoplay-policy.test.js',
    'background/tests/native-idle-reconcile.test.js',
    'background/tests/native-resilience-regression.test.js',
    'background/tests/message-ipc-contract.test.js',
    'background/tests/dashboard-ipc-regression.test.js',
    'dashboard/tests/twitch-skeleton.test.js',
    'dashboard/tests/hidden-idle-budget.test.js',
    'dashboard/tests/settings-storage-contract.test.js',
    'dashboard/tests/settings-validation.test.js',
    'common/tests/provider-api-contract.test.js',
    'common/tests/provider-media-resolver.test.js',
    'common/tests/provider-loop-lifecycle.test.js',
    'common/tests/provider-feature-start-lifecycle.test.js',
    'common/tests/provider-window-state-ordering.test.js',
    'common/tests/youtube-observer-wake-budget.test.js',
    'common/tests/provider-dom-governor-wake-budget.test.js',
    'common/tests/windowed-player-storage-order.test.js'
];
for (const file of requiredBehaviorTests) {
    check(tests.includes(file), `required regression missing: ${file}`);
}
check(tests.length >= requiredBehaviorTests.length, 'no regression tests discovered');
let passing = 0;
for (const file of tests) {
    const command = spawnSync(process.execPath, [absolute(file)], { encoding: 'utf8', timeout: 30_000 });
    if (command.status === 0) passing++;
    else errors.push(`${file}: FAIL ${String(command.stderr || command.stdout || `exit ${command.status}`).trim().slice(0, 550)}`);
}
console.log(`  JavaScript regressions: ${passing}/${tests.length}`);

// On Windows the Python launcher usually exposes `py -3`, not `python3`.
const pythonCandidates = process.platform === 'win32'
    ? [['py', ['-3']], ['python', []], ['python3', []]]
    : [['python3', []], ['python', []]];
let python = null;
for (const [command, args] of pythonCandidates) {
    const attempt = spawnSync(command, [...args, absolute('native/tests/titlebar-source-parity.py')], { encoding: 'utf8' });
    if (attempt.error?.code === 'ENOENT') continue;
    python = attempt;
    break;
}
if (!python) {
    errors.push('Python 3 unavailable: cannot run native C# source contract test');
} else if (python.status !== 0) {
    errors.push(`C# native source contract FAIL: ${String(python.stderr || python.stdout).trim()}`);
} else console.log('  Native C# source contract: OK (NOT Windows compilation)');

if (errors.length) {
    console.error(`\nFAIL: ${errors.length} project quality issue(s):`);
    errors.forEach(error => console.error(`  - ${error}`));
    process.exitCode = 1;
} else {
    console.log(`\nPASS: v${manifest.version} source and generated artifacts consistent.\nNote: Only Windows can validate titlebar-host compilation and Opera integration.`);
}
