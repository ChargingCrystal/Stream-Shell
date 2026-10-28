const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const ownership=read('native/titlebar-src/09-AltTab-Window-Ownership.cs');
const sync=read('native/titlebar-src/06-Overlay-State-Synchronization.cs');
const nativeStatus=read('native/titlebar-src/15-Native-ReadLoop-And-Status.cs');
assert.match(sync,/SyncAltTabIntegration\([\s\S]*?SyncMangayomiWideOwner\(compactLayout, currentLeftMode, leftTarget\)/,
    'Mangayomi adopts owner only AFTER Opera Alt+Tab group reconciliation');
const fn=ownership.match(/private static void SyncMangayomiWideOwner\([\s\S]*?\n    }/);
assert.ok(fn, 'owner lifecycle exists');
assert.match(fn[0],/!compactLayout/);
assert.match(fn[0],/currentLeftMode, "mangayomi"/);
assert.match(fn[0],/IsTrustedShellTarget\(landing\)/);
assert.match(fn[0],/IsHeartbeatFresh\(\)/);
assert.match(fn[0],/FindMangayomiWideLeftApp\(landing\)/);
assert.match(fn[0],/existingOwner != IntPtr.Zero && existingOwner != landing.Handle/,
    'do not hijack arbitrary existing window ownership');
assert.match(fn[0],/SetOwner\(app, landing.Handle\)/,
    'Mangayomi follows Landing owner group on RIGHT Dashboard focus');
assert.match(fn[0],/GetWindow\(app, GW_OWNER\) != landing.Handle/,
    'verify actual Win32 ownership change');
assert.doesNotMatch(fn[0],/SetForegroundWindow|HWND_TOPMOST|ShowWindow/,
    'no focus steal or global topmost');
assert.match(ownership,/private static void ReleaseMangayomiWideOwner\([\s\S]*?SetOwner\(app, mangayomiPreviousOwner\)/);
assert.match(fn[0],/ReleaseMangayomiWideOwner\(\)/,
    'detach owner on mode changes or HWND replacement');
assert.match(ownership,/private static void ResetAltTabOwnership\(\)\s*\{\s*ReleaseMangayomiWideOwner\(\)/);
assert.match(ownership,/private static void DisposeAltTabIntegration\(\)\s*\{\s*ReleaseMangayomiWideOwner\(\)/);
assert.match(nativeStatus,/mangayomiWideOwnerAttached/);
assert.match(nativeStatus,/mangayomiWideOwnerAttaches/);
console.log('PASS Mangayomi selected-Wide owner graph, restoration, no global Z-order/focus changes');
