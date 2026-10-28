const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '../..');
const file = p => fs.readFileSync(path.join(root,p), 'utf8');
const sync = file('native/titlebar-src/06-Overlay-State-Synchronization.cs');
const occlusion = file('native/titlebar-src/05-Foreground-Visibility-And-Pruning.cs');
assert.match(sync, /currentLeftMode, "mangayomi"[\s\S]*?FindWideSurfaceTarget\(left, "left", "landing"\)/);
assert.match(sync, /!compactLayout/);
assert.match(occlusion, /GetProcessName\(hWnd\), "Mangayomi"/);
assert.match(occlusion, /allowMangayomi && IsSelectedMangayomiLeftWindow/);
assert.match(occlusion, /containedInLeftPane/);
assert.match(occlusion, /String\.Equals\(leftMode, "mangayomi"/);
assert.match(occlusion, /String\.Equals\(layoutProfile, "wide"/);
assert.match(occlusion, /return !HasForeignWindowAboveWideLeftChrome\(leftTarget, allowMangayomi\)/);
assert.ok(!sync.includes('FindWideSurfaceTarget(left, "left", "discord")'));
for (const app of ['discord','mangayomi']) {
  const cls = app === 'discord' ? 'Discord' : 'Mangayomi';
  for (const name of [`StreamShell${cls}Host.cs`,`install-${app}-helper.ps1`,`uninstall-${app}-helper.ps1`]) {
    assert.ok(fs.existsSync(path.join(root,'integrations',app,name)), 'moved source missing: '+name);
    assert.ok(!fs.existsSync(path.join(root,'native',name)), 'old source still in native: '+name);
  }
  assert.match(file(`integrations/${app}/install-${app}-helper.ps1`), /Split-Path \(Split-Path \$PSScriptRoot -Parent\) -Parent/);
  assert.doesNotMatch(file(`integrations/${app}/uninstall-${app}-helper.ps1`), /Remove-Item -LiteralPath \$InstallRoot -Recurse/);
}
console.log('Mangayomi-only Wide titlebar scope and integration separation: PASS');
