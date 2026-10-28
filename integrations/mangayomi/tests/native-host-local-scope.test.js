// Regression guard for CS0136 collisions in the PowerShell Add-Type C# host.
// The open-result handler must be a separate method, rather than declaring
// locals inside Main's nested if-block (where C# rejects same names later).
// Full C# compilation is independently performed on Windows by
// integrations/mangayomi/tests/compile-mangayomi-host.ps1.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'StreamShellMangayomiHost.cs'), 'utf8');

// Identify method bodies by matching braces, ignoring brace pairs inside
// text literals and comments in this controlled source fixture.
function methodBody(methodName) {
  const match = source.match(new RegExp('static\\s+(?:void|string|bool|int)\\s+' + methodName + '\\s*\\([^)]*\\)\\s*\\{'));
  assert.ok(match, methodName + ' method exists');
  const start = match.index + match[0].length;
  let depth = 1;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i);
  }
  assert.fail(methodName + ' method not closed');
}

const result = methodBody('HandleOpenResult');
const main = methodBody('Main');
assert.match(main, /if\s*\(action\s*==\s*"open-result"\)\s*\{\s*HandleOpenResult\(json\);\s*return;\s*\}/);
assert.doesNotMatch(main, /OpenInstalledResult\(/, 'result logic must not be nested in Main');
assert.match(result, /OpenInstalledResult\(GetString\(json, "resultId"\), process\)/);
for (const name of ['resultLeft', 'resultTop', 'resultWidth', 'resultHeight', 'resultPositioned']) {
  assert.match(result, new RegExp('\\b' + name + '\\b'), 'result method contains ' + name);
  assert.doesNotMatch(main, new RegExp('\\b' + name + '\\b'), 'result local is isolated from Main: ' + name);
}
assert.match(result, /SetWindowPos\(hwnd, HWND_TOP, resultLeft, resultTop, resultWidth, resultHeight, SWP_SHOWWINDOW\)/);
assert.match(main, /int left = GetInt\(json, "left", 0\)/, 'generic positioning unchanged');
assert.match(main, /bool positioned = SetWindowPos\(hwnd, HWND_TOP, left, top, width, height, SWP_SHOWWINDOW\)/, 'generic positioning unchanged');
assert.doesNotMatch(result, /\bbool positioned\b/, 'no second positioned declaration in result flow');
console.log('Mangayomi C# open-result method isolation: PASS (source-only; Windows compilation separate)');
