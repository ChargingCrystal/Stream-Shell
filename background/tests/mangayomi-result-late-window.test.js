// A source navigation accepted by /v1/open must not be falsely reported as failure
// just because Flutter has not created its main window yet.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../src/05-mangayomi.js'), 'utf8');
const resultId = '123456789012345678901234';
function harness({nativeOpen, onStatus = () => ({ok:true,running:false})} = {}) {
    const events = [], scheduled = [];
    const state = {leftMode:'landing'};
    const context = vm.createContext({
        console, shuttingDown:false,
        chrome:{storage:{local:{get:async key => ({[key]:state[key]})}}},
        setTimeout:(callback,ms)=>{scheduled.push({callback,ms});return scheduled.length;},
        clearTimeout:()=>{}
    });
    vm.runInContext(source,context);
    context.mangayomiNativeCommand = async action => {
        events.push(action);
        return action === 'open-result' ? nativeOpen() : onStatus();
    };
    context.showMangayomi = async () => { events.push('show'); state.leftMode='mangayomi'; };
    return {context, events, scheduled, state};
}
(async()=>{
    const ready = harness({nativeOpen:()=>({ok:true,visible:true})});
    assert.equal((await vm.runInContext(`streamShellMangayomiOpenSourceResult("${resultId}")`,ready.context)).pending,false);
    assert.deepEqual(ready.events,['open-result','show']);
    assert.equal(ready.scheduled.length,0);

    let windowReady=false;
    const cold = harness({nativeOpen:()=>{throw Error('Result opened but Mangayomi window is not ready.');},
        onStatus:()=>({ok:true,running:windowReady,visible:false})});
    const accepted = await vm.runInContext(`streamShellMangayomiOpenSourceResult("${resultId}")`,cold.context);
    assert.equal(accepted.opened,true);
    assert.equal(accepted.pending,true);
    assert.deepEqual(cold.events,['open-result']);
    assert.equal(cold.scheduled.length,1);
    await cold.scheduled.shift().callback();
    assert.deepEqual(cold.events,['open-result','status']);
    assert.equal(cold.scheduled.length,1);
    windowReady=true;
    await cold.scheduled.shift().callback();
    assert.deepEqual(cold.events,['open-result','status','status','show']);
    assert.equal(cold.scheduled.length,0);

    const cancelled = harness({nativeOpen:()=>({ok:true,visible:false})});
    await vm.runInContext(`streamShellMangayomiOpenSourceResult("${resultId}")`,cancelled.context);
    cancelled.state.leftMode='youtube';
    await cancelled.scheduled.shift().callback();
    assert.deepEqual(cancelled.events,['open-result'],'user provider switch must cancel pending reveal');

    const reposition = harness({nativeOpen:()=>{throw Error('Could not position selected result.');}});
    assert.equal((await vm.runInContext(`streamShellMangayomiOpenSourceResult("${resultId}")`,reposition.context)).pending,true);
    assert.equal(reposition.scheduled.length,1);

    const invalid = harness({nativeOpen:()=>{throw Error('Search bridge returned HTTP 410');}});
    await assert.rejects(vm.runInContext(`streamShellMangayomiOpenSourceResult("${resultId}")`,invalid.context), /410/);
    assert.equal(invalid.scheduled.length,0);

    console.log('Mangayomi accepted /v1/open / late-window / cancelled switch: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
