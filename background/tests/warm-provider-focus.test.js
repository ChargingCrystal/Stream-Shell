const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/01-window-utils.js'),'utf8');
const from = source.indexOf('function streamShellWindowBoundsMatch(');
const to = source.indexOf('async function getStreamShellParkingBounds(',from);
assert.ok(from === 0 && to > 0);
const bounds = {left:0,top:0,width:1920,height:1080};
const makeContext = initial => {
    const calls = [];
    let state = {...initial};
    const ctx = vm.createContext({
        Date, Promise, console, setTimeout, shuttingDown:false,
        chrome: { windows: {
            get: async () => {calls.push(['get']);return {...state};},
            update: async (_id, patch) => {calls.push(['update',patch]);state={...state,...patch};return {...state};}
        }}
    });
    vm.runInContext(source.slice(from,to),ctx);
    return {calls,ctx};
};
(async()=>{
    const warm=makeContext({...bounds,state:'normal',focused:false});
    await vm.runInContext('restoreWindow(1, {left:0,top:0,width:1920,height:1080},true)',warm.ctx);
    assert.deepEqual(warm.calls.filter(x=>x[0]==='update').map(x=>Object.keys(x[1])),[['focused']]);

    const cold=makeContext({...bounds,state:'minimized',focused:false});
    await vm.runInContext('restoreWindow(2, {left:0,top:0,width:1920,height:1080},true)',cold.ctx);
    const ops=cold.calls.filter(x=>x[0]==='update').map(x=>x[1]);
    assert.ok(ops.some(x=>x.state==='normal'));
    assert.ok(ops.some(x=>x.left===0 && x.width===1920));
    assert.ok(ops.some(x=>x.focused===true));
    console.log('warm fast path and minimized restore: PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
