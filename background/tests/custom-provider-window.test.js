/* Node-only mock of the basic-provider lifecycle; native HWND still needs real Opera GX testing. */
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '../..');
const saved = { rightMode: 'dashboard' };
const newWindows = [];
const navigations = [];
let nextId=200;
const browserWindows = new Map();
const get = async keys => {
    const names = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(names.filter(k => k in saved).map(k => [k, saved[k]]));
};
const chrome = {
    runtime: { getURL: name => `chrome-extension://test/${name}` },
    storage: { local: {
        get, set: async props => Object.assign(saved, props),
        remove: async key => { for (const k of Array.isArray(key)?key:[key]) delete saved[k]; }
    }, onChanged: { addListener() {} } },
    windows: {
        create: async data => { const w={id: nextId++, ...data}; newWindows.push(w); browserWindows.set(w.id, w); return w; },
        get: async id => { if (!browserWindows.has(id)) throw Error('missing window'); return browserWindows.get(id); }
    },
    tabs: {
        query: async q => [{id: q.windowId * 10, windowId: q.windowId}],
        update: async (id, props) => navigations.push({id, ...props}),
        sendMessage: async () => ({ok:true})
    }
};
const events = [];
const ctx=vm.createContext({
    chrome, URL, console, setTimeout: () => {},
    getStreamShellDisplayProfile: async () => ({ mode:'wide' }),
    refreshStreamShellDisplayProfile: async () => ({ mode:'wide' }),
    getStreamShellParkingBounds: async target => target,
    streamShellWindowBoundsMatch: () => true,
    restoreWindow: async (id,target,focus) => events.push(['restore',id,focus]),
    safelyMinimizeWindow: async id => events.push(['minimize',id]),
    parkWindowOffscreen: async () => {},
    recordFlightEvent: async () => {},
    stopVolumeCaptureForProviderChange: async () => {},
    claimFocusedTitlebarSurface: async id => events.push(['claim',id]),
    scheduleTitlebarClaimRetries: () => {},
    scheduleWideRightPaneReassert: mode => events.push(['right-reassert',mode]),
    broadcastState: async () => {}
});
for (const file of ['shared/provider-registry-core.js','background/src/00-config-home.js','background/src/02-providers.js']) {
    vm.runInContext(fs.readFileSync(path.join(root,file), 'utf8'),ctx);
}
const run=code=>vm.runInContext(code,ctx);
async function test() {
    saved.streamShellProviderRegistry = {
        ...JSON.parse(JSON.stringify(run('defaultStreamShellProviderRegistry()'))),
        providers: [...JSON.parse(JSON.stringify(run('defaultStreamShellProviderRegistry().providers'))),
            {id:'custom-aaaaaaaa',kind:'custom',name:'Example',url:'https://example.com/',enabled:true,showOnDashboard:true,showInTitlebar:true}]
    };
    await run('switchProvider("custom-aaaaaaaa")');
    assert.equal(newWindows.length,1);
    assert.equal(newWindows[0].url,'https://example.com/');
    assert.equal(saved.leftMode,'custom-aaaaaaaa');
    assert.equal(saved.rightMode,'dashboard','switching LEFT must not mutate rightMode');
    assert.equal(saved.providerWindows['custom-aaaaaaaa'],newWindows[0].id);
    assert.ok(events.some(e=>e[0]==='restore'&&e[1]===newWindows[0].id&&e[2]===true));
    await run('switchProvider("custom-aaaaaaaa")');
    assert.equal(newWindows.length,1,'same ID should reuse window');
    assert.equal(navigations.filter(item => item.url).length,0,'ordinary activation should not reload');
    saved.streamShellProviderRegistry.providers.at(-1).url='https://example.com/updated';
    await run('switchProvider("custom-aaaaaaaa")');
    assert.equal(navigations.filter(item => item.url).length,1,'edited URL navigated on next explicit activation');
    assert.equal(navigations.filter(item => item.url)[0].url,'https://example.com/updated');
    saved.streamShellProviderRegistry.providers.at(-1).url='javascript:alert(1)';
    await assert.rejects(run('switchProvider("custom-aaaaaaaa")'),/Unknown or disabled provider/);
    assert.equal(navigations.filter(item => item.url).length,1,'unsafe URL never navigated');
    assert.equal(saved.rightMode,'dashboard');
    console.log('Basic provider window + stable identity + left/right isolation: PASS');
}
test().catch(e=>{console.error(e); process.exitCode=1;});
