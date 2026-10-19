/* v0.19.36: artwork stalls must not block native provider buttons. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root=path.join(__dirname,'../..');
const posted=[];
const ctx=vm.createContext({
 URL,btoa,TextEncoder,console,setTimeout,clearTimeout,
 shuttingDown:false,titlebarPort:{postMessage:m=>posted.push(m)},
 titlebarProtocolReady:true,TITLEBAR_PROTOCOL_VERSION:9,
 // Simulate an offscreen document which never finishes initializing.
 ensureVolumeOffscreenDocument:()=>new Promise(()=>{}),
 fetch:()=>new Promise(()=>{}),
 chrome:{runtime:{getURL:p=>'ext://'+p,sendMessage:()=>new Promise(()=>{})},storage:{onChanged:{addListener(){}},local:{get:async()=>({})}}}
});
for(const f of ['shared/provider-registry-core.js','background/src/06-titlebar.js'])
 vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const evalIn=expr=>vm.runInContext(expr,ctx);
(async()=>{
 const r=JSON.parse(JSON.stringify(evalIn('defaultStreamShellProviderRegistry()')));
 r.providers.push({id:'custom-1234abcd',name:'Custom!',kind:'custom',url:'https://example.com/',icon:'C+',artKey:'missing',titlebarColor:'#5500AA',enabled:true,showOnDashboard:false,showInTitlebar:true});
 r.titlebarOrder.push('custom-1234abcd');ctx.registry=r;
 await Promise.race([evalIn('syncTitlebarProviderRegistry(registry)'),new Promise((_,rej)=>setTimeout(()=>rej(new Error('text sync blocked')),500))]);
 assert.equal(posted.length,1,'text fallback sent before artwork awaits');
 let rows=Buffer.from(posted[0].payloadB64,'base64').toString('utf8').split('\n');
 assert.equal(rows.length,6,'the custom provider must be included');
 assert.equal(rows.at(-1).split('\t')[1],'C+');
 assert.equal(rows.at(-1).split('\t')[4],'');
 assert.equal(evalIn('titlebarProviderSyncPhase'),'buttons-ready');
 assert.equal(evalIn('streamShellTitlebarArtworkStatus.get("custom-1234abcd").reason'),'artwork-loading');
 await new Promise(resolve=>setTimeout(resolve,5400));
 assert.equal(posted.length,1,'failed artwork does not remove existing buttons');
 assert.equal(evalIn('titlebarProviderSyncPhase'),'artwork-ready');
 assert.equal(evalIn('streamShellTitlebarArtworkStatus.get("custom-1234abcd").source'),'text');
 assert.equal(evalIn('streamShellTitlebarArtworkStatus.get("custom-1234abcd").primaryFailure'),'png-fetch-timeout');
 const native=fs.readFileSync(path.join(root,'native/StreamShellTitlebarHost.cs'),'utf8');
 assert.match(native,/bytes\.Length < 24 \|\| bytes\.Length > 16384/);
 assert.match(native,/if \(!TryDecodeTitlebarIcon\(parts\[4\], out icon\)\)/);
 assert.match(native,/skippedIcons\+\+/);
 assert.doesNotMatch(native,/if \(!TryDecodeTitlebarIcon\(parts\[4\], out icon\)\) return false/);
 console.log('Titlebar text-first/nonblocking, offscreen timeout, native per-icon fallback: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
