#!/usr/bin/env node
/**
 * CI entrypoint that works across the historic GitHub v0.20.0 baseline and
 * current modular Stream Shell releases.
 *
 * Modern releases have tools/check-project.mjs: it is the authoritative gate.
 * Historic v0.20.0 has no project checker; run the subset that its source
 * supports, with ONE visible allowlisted finance-bundle drift from v0.20.0.
 *
 * No npm dependencies, network calls, secrets, or Native Host installation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const absolute = file => path.join(root, file);
const read = file => fs.readFileSync(absolute(file));
const exists = file => fs.existsSync(absolute(file));
const errors = [];
const fail = message => errors.push(message);

function runNode(args, label) {
    const result = spawnSync(process.execPath, args, {
        cwd: root, encoding: 'utf8', timeout: 30_000,
    });
    if (result.status !== 0) {
        fail(`${label}: ${(result.error?.message || result.stderr || result.stdout || `exit ${result.status}`).trim().slice(0, 450)}`);
        return false;
    }
    return true;
}

if (exists('tools/check-project.mjs')) {
    console.log('Modern release detected: running full Stream Shell quality gate.');
    const full = spawnSync(process.execPath, [absolute('tools/check-project.mjs')], {
        cwd: root, stdio: 'inherit', timeout: 9 * 60_000,
    });
    if (full.error) console.error(full.error.message);
    process.exit(full.status ?? 1);
}

console.log('Legacy repository detected: checking the v0.20.0 baseline.');
const manifest = JSON.parse(read('manifest.json').toString('utf8'));
if (manifest.manifest_version !== 3) fail('Expected Manifest V3');
if (manifest.version !== '0.20.0') fail('Legacy CI mode is valid ONLY on v0.20.0; newer releases must include tools/check-project.mjs');

const ignored = new Set(['.git', 'node_modules', '.vscode']);
function walk(dir = '.') {
    return fs.readdirSync(absolute(dir), { withFileTypes: true }).flatMap(entry => {
        if (ignored.has(entry.name)) return [];
        const name = path.posix.join(dir, entry.name);
        return entry.isDirectory() ? walk(name) : [name];
    });
}
const all = walk();
const chunks = (build, declaration) => {
    const script = read(build).toString('utf8');
    const index = script.indexOf(declaration);
    if (index === -1) { fail(`Missing ${declaration} in ${build}`); return []; }
    const body = script.slice(index + declaration.length).split(/\r?\n\s*\)/, 1)[0];
    return [...body.matchAll(/"([^"\n]+\.js)"/g)].map(m => m[1]);
};
function verifyBundle(label, output, inputs, options = {}) {
    if (!exists(output) || inputs.some(file => !exists(file))) {
        fail(`${label}: missing generated file or source inputs`);
        return;
    }
    const actual = read(output);
    const expected = Buffer.concat(inputs.map(read));
    if (actual.equals(expected)) {
        console.log(`  ${label}: byte-identical (${inputs.length} parts)`);
        return;
    }
    if (options.legacyFinance === true && manifest.version === '0.20.0') {
        const withoutFinance = inputs.filter(f => f !== 'landing/src/finance.js');
        if (actual.equals(Buffer.concat(withoutFinance.map(read)))) {
            console.log('::warning file=landing/build-landing.ps1::v0.20.0 legacy mismatch: finance.js is in the builder but missing from the shipped landing.js. Fixed in v0.20.18; update main to remove this exception.');
            return;
        }
    }
    fail(`${label}: bundle differs from its declared source modules`);
}
const withPrefix = (build, decl, prefix) => chunks(build, decl).map(file =>
    file.startsWith('../shared/') ? `shared/${file.slice('../shared/'.length)}` : `${prefix}/${file}`);
verifyBundle('background.js', 'background.js', withPrefix('background/build-background.ps1', '$Chunks = @(', 'background'));
verifyBundle('common/shell.js', 'common/shell.js', withPrefix('common/build-shell.ps1', '$Files = @(', 'common/src'));
verifyBundle('dashboard/dashboard.js', 'dashboard/dashboard.js', [
    'shared/provider-registry-core.js', ...withPrefix('dashboard/build-dashboard.ps1', '$Files = @(', 'dashboard/src')]);
verifyBundle('landing/landing.js', 'landing/landing.js', [
    'shared/provider-registry-core.js', ...chunks('landing/build-landing.ps1', '$Order = @(').map(f => `landing/src/${f}`)], {legacyFinance: true});
verifyBundle('dashboard/compact-home.js', 'dashboard/compact-home.js', [
    'dashboard/src/compact-home-prefix.js',
    ...chunks('dashboard/build-dashboard.ps1', '$LandingFiles = @(').map(f => `landing/src/${f}`),
    'dashboard/src/compact-home-suffix.js',
]);

const references = [
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
    ...(manifest.content_scripts || []).flatMap(entry => [...(entry.js || []), ...(entry.css || [])]),
    manifest.background?.service_worker,
    manifest.action?.default_popup,
].filter(Boolean);
for (const file of references) if (!exists(file)) fail(`manifest: missing ${file}`);

const fragments = new Set([
    'common/src/bootstrap-state.js', 'common/src/start.js',
    'dashboard/src/compact-home-prefix.js', 'dashboard/src/compact-home-suffix.js',
]);
const scripts = all.filter(file => /\.m?js$/.test(file) && !fragments.has(file));
let syntaxPassed = 0;
for (const file of scripts) if (runNode(['--check', absolute(file)], file)) syntaxPassed++;
console.log(`  JS syntax: ${syntaxPassed}/${scripts.length}`);

const tests = all.filter(file => /(?:^|\/)tests\/[^/]+\.test\.js$/.test(file));
let testsPassed = 0;
for (const file of tests) if (runNode([absolute(file)], file)) testsPassed++;
console.log(`  Regression tests: ${testsPassed}/${tests.length}`);
console.log('  Native C# compilation: not run (separate Windows validation required)');

if (errors.length) {
    for (const message of errors) console.error('FAIL: ' + message);
    process.exit(1);
}
console.log(`PASS: legacy v${manifest.version} baseline checks (Finance drift reported as warning).`);
