/* Native titlebar provider protocol and registry independence; Node mock. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..', '..');
const listeners=[];
const posted=[];
const storage={};
const ctx=vm.createContext({
    URL, btoa, TextEncoder, console,
    chrome: {storage: {
        onChanged: {addListener: listener => listeners.push(listener)},
        local: {get: async key => ({[key]: storage[key]})}
    }},
    shuttingDown:false, titlebarPort: {postMessage: message => posted.push(message)},
    titlebarProtocolReady:true, TITLEBAR_PROTOCOL_VERSION:9
});
for (const rel of ['shared/provider-registry-core.js','background/src/06-titlebar.js']) {
    vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),ctx,{filename:rel});
}
const run=expression=>vm.runInContext(expression,ctx);
const plain=expression=>JSON.parse(JSON.stringify(run(expression)));
async function main(){
    const original=plain('defaultStreamShellProviderRegistry()');
    original.providers.push({id:'custom-abcdefgh',kind:'custom',name:'Paramount+',url:'https://paramountplus.com/',icon:'P+',enabled:true,showOnDashboard:false,showInTitlebar:true});
    original.providers.push({id:'custom-ijklmnop',kind:'custom',name:'Ü TV 日本',url:'https://example.com/',icon:'Ü+',enabled:true,showOnDashboard:false,showInTitlebar:false});
    original.titlebarOrder=['custom-abcdefgh','youtube','netflix','prime','disney','crunchyroll','custom-ijklmnop'];
    storage.streamShellProviderRegistry=original;
    assert.deepEqual(plain('streamShellTitlebarButtons(streamShellProviderRegistryInput).map(p=>p.id)').length,6);
}
ctx.streamShellProviderRegistryInput=null;
(async()=>{
 const r=plain('defaultStreamShellProviderRegistry()');
 r.providers.push({id:'custom-abcdefgh',kind:'custom',name:'Paramount+',url:'https://paramountplus.com/',icon:'P+',enabled:true,showOnDashboard:false,showInTitlebar:true});
 r.providers.push({id:'custom-ijklmnop',kind:'custom',name:'Ü TV 日本',url:'https://example.com/',icon:'Ü+',enabled:true,showOnDashboard:false,showInTitlebar:true});
 r.titlebarOrder=['custom-ijklmnop','youtube','custom-abcdefgh','netflix','prime','disney','crunchyroll'];
 storage.streamShellProviderRegistry=r;
 ctx.reg=r;
 let buttons=plain('streamShellTitlebarButtons(reg)');
 assert.deepEqual(buttons.map(p=>p.id),r.titlebarOrder);
 assert.equal(buttons[0].icon,'Ü+');
 assert.equal(buttons[0].name,'Ü TV 日本');
 assert.equal(buttons[2].icon,'P+');
 assert.equal(buttons.length,7); // Dashboard still has only built-ins pinned.
 assert.equal(plain('normalizeStreamShellProviderRegistry(reg).providers.filter(p=>p.showOnDashboard).length'),5);
 await run('syncTitlebarProviderRegistry(reg)');
 await new Promise(resolve=>setImmediate(resolve)); // finish optional artwork phase
 assert.equal(posted.length,1);
 assert.equal(posted[0].generation,1);
 assert.equal(posted[0].protocolVersion,9);
 assert.equal(posted[0].type,'provider-buttons');
 let decoded=Buffer.from(posted[0].payloadB64,'base64').toString('utf8');
 assert.equal(decoded.split('\n').length,7);
 assert.ok(decoded.startsWith('custom-ijklmnop\tÜ+\tÜ TV 日本\t\t'));
 await run('syncTitlebarProviderRegistry(reg)');
 assert.equal(posted.length,2,'unacknowledged config must retry');
 ctx.ack={event:'provider-buttons-ack',generation:1,accepted:true,protocolVersion:9};
 run('handleTitlebarNativeMessage(ack)');
 await run('syncTitlebarProviderRegistry(reg)');
 assert.equal(posted.length,2,'acknowledged config must not spam host');
 const next=structuredClone(r);
 next.providers.at(-1).showInTitlebar=false;
 ctx.next=next;
 await run('syncTitlebarProviderRegistry(next)');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(posted.at(-1).generation,2);
 assert.equal(Buffer.from(posted.at(-1).payloadB64,'base64').toString('utf8').split('\n').length,6);
 // Reorder and hide only titlebar, without touching Dashboard.
 next.titlebarOrder.reverse();
 ctx.next=next;
 await run('syncTitlebarProviderRegistry(next)');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(posted.at(-1).generation,3);
 assert.equal(plain('normalizeStreamShellProviderRegistry(next).providers.filter(p=>p.showOnDashboard).length'),5);
 assert.deepEqual(plain('streamShellTitlebarButtons(next).map(p=>p.id)'),next.titlebarOrder.filter(id=>id!=='custom-ijklmnop'));
 const empty=structuredClone(next);empty.providers.forEach(p=>p.showInTitlebar=false);
 ctx.empty=empty;
 assert.equal(await run('streamShellTitlebarPayload(empty)'),'','empty list is valid and represented as empty base64');
 console.log('Dynamic native provider protocol, UTF-8, ack/retry, titlebar/dashboard isolation: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
