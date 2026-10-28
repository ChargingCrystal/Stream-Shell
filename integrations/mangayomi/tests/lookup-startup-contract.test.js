// Regression tests for issue: no Mangayomi process exists at first lookup.
// Startup must be implicit and isolated from HWND and Windows URI associations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'StreamShellMangayomiHost.cs'),'utf8');
function method(name,next) {
  const from = source.indexOf('static void '+name+'(');
  const to = source.indexOf('static void '+next+'(',from+1);
  assert.ok(from>=0 && to>from, name+' present');
  return source.slice(from,to);
}
const lookup=method('HandleLookup','HandleOpenResult');
assert.match(lookup,/ConfiguredForkExe\(GetString\(json, "executablePath"\)\)/);
assert.match(lookup,/FindApp\(exe, false\)/);
assert.match(lookup,/Process\.Start\(new ProcessStartInfo\(exe\)/);
assert.match(lookup,/WaitForBridge\(process, 40000\)/);
assert.match(lookup,/QueryInstalledSources\(query, itemType, process\)/);
assert.match(lookup,/HideStartedFork\(process\)/);
assert.doesNotMatch(lookup,/FindMainWindow\(/);
assert.doesNotMatch(lookup,/CanDispatchDirectSearch\(/);
assert.doesNotMatch(lookup,/ResolveExe\(/);
assert.match(source,/GetInt\(data, "pid", 0\) == expected.Id/);
const main=source.slice(source.indexOf('static void Main()'));
assert.ok(main.indexOf('HandleLookup(json); return;') < main.indexOf('FindMainWindow(process)'), 'lookup bypasses any HWND requirement');
console.log('Mangayomi cold lookup startup/PID/foreground isolation: PASS');
