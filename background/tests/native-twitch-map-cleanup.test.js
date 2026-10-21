const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = require('./native-titlebar-source')();
const section=src.slice(src.indexOf('List<string> duplicateMembers ='), src.indexOf('WideTwitchClusterWindows[claim.Member]'));
assert.match(section,/WideTwitchClaimBrowserWindowIds\.Remove\(duplicate\)/);
const get=src.slice(src.indexOf('private static IntPtr GetWideTwitchClusterHandle('),src.indexOf('private static void RaiseWideTwitchClusterOnce'));
assert.match(get,/WideTwitchClaimBrowserWindowIds\.Remove\(member\)/);
console.log('Native browser-window ID and HWND lifecycle cleanup: PASS (static)');
