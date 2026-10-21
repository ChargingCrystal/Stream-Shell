/* v0.20.34: distinguish real Twitch reloads from late DOM/CSS reflow. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const load = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const manifest = JSON.parse(load('manifest.json'));
const early = manifest.content_scripts.find(entry => entry.js?.includes('providers/player/twitch-utility.js'));
assert.equal(early.run_at, 'document_start');
assert.ok(early.css?.includes('providers/player/twitch-stream-cleanup.css'), 'passive stream layout CSS must load with early kernel');
const css = load('providers/player/twitch-stream-cleanup.css');
assert.match(css, /html\[data-stream-shell-twitch-workspace-clean="true"\]/);
assert.match(css, /\.root-scrollable__wrapper/);
const core = load('providers/player/twitch-utility.js');
const hud = load('providers/player/twitch-workspace-v2.js');
assert.match(core, /workspaceContext\?\.effectiveKind === "stream"/);
assert.match(core, /workspaceContext\?\.role === "slot"/);
assert.match(core, /document\.documentElement\.dataset\.streamShellTwitchWorkspaceClean = "true"/);
assert.ok(core.indexOf('dataset.streamShellTwitchWorkspaceClean = "true"') < core.indexOf('scheduleAutomationLoad(staggerMs)'), 'stream layout admission must precede deferred automation');
assert.doesNotMatch(hud, /CLEANUP_STYLE_ID|stream-shell-twitch-workspace-v2-cleanup/, 'late HUD must not add a second cleanup stylesheet');
assert.match(hud, /currentVisibleKind\(\) === "stream"/);
assert.match(hud, /AUTO_STREAM_SURFACE_SETTLE_MS = 14000/);
assert.match(hud, /documentStartedAt < AUTO_STREAM_SURFACE_SETTLE_MS/);

const background = load('background/src/05aa-twitch-workspace-v2.js');
const start = background.indexOf('const twitchWorkspaceV2NavigationAudit = new Map();');
const end = background.indexOf('function rememberTwitchWorkspaceV2NativeCaption', start);
assert.ok(start >= 0 && end > start);
assert.match(background, /navigationAudit: getTwitchWorkspaceV2NavigationAudit\(tab\?\.id\)/);
const listeners = [];
const events = [];
const sandbox = vm.createContext({
  Map, Date, Number, Array, String,
  isTwitchUrl: url => /^https:\/\/www\.twitch\.tv\//.test(url || ''),
  recordFlightEvent: e => {events.push(e); return Promise.resolve();},
  chrome: {webNavigation: {onCommitted: {addListener: fn => listeners.push(fn)}}}
});
vm.runInContext(background.slice(start, end), sandbox);
assert.equal(listeners.length, 1);
function commit(tabId, transitionType, overrides = {}) {
  listeners[0]({tabId, frameId:0, url:'https://www.twitch.tv/tester', transitionType,
    timeStamp:1000, transitionQualifiers:[], ...overrides});
}
commit(55, 'link');
commit(55, 'reload');
commit(55, 'auto_toplevel', {transitionQualifiers:['client_redirect']});
commit(55, 'reload', {frameId:3});
commit(55, 'reload', {url:'https://example.org/'});
commit(60, 'typed');
const a = vm.runInContext('getTwitchWorkspaceV2NavigationAudit(55)', sandbox);
assert.equal(a.tracked,true);
assert.equal(a.observedCommits,3);
assert.equal(a.observedReloads,1);
assert.equal(a.clientRedirects,1);
assert.equal(a.lastTransitionType,'auto_toplevel');
assert.equal(events.length,1,'flight recorder reports only confirmed browser reloads');
assert.equal(events[0].action,'document-reloaded');
const other=vm.runInContext('getTwitchWorkspaceV2NavigationAudit(60)', sandbox);
assert.equal(other.observedCommits,1);
assert.equal(other.observedReloads,0);
const unknown=vm.runInContext('getTwitchWorkspaceV2NavigationAudit(99)',sandbox);
assert.equal(unknown.tracked,false);
for(let id=100;id<180;id++) commit(id,'link');
const auditSize=vm.runInContext('twitchWorkspaceV2NavigationAudit.size',sandbox);
assert.ok(auditSize<=64,'worker memory audit is bounded');
console.log('Twitch early CSS + bounded top-frame navigation/reload audit: PASS');
